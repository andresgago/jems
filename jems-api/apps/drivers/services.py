from django.core.files.uploadedfile import UploadedFile
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.users.models import User

from .models import Driver, DriverDocument, DriverType


def create_driver(*, created_by: User | None = None, **fields) -> Driver:
    driver = Driver(created_by=created_by, **fields)
    driver.full_clean()
    driver.save()
    return driver


def _solo_driver_type() -> DriverType | None:
    return DriverType.objects.filter(id=4).first()


def _sync_team_driver(driver: Driver) -> None:
    solo_type = _solo_driver_type()
    if driver.is_team_driver_type:
        team_driver_id = driver.team_driver_id
        old_partner_qs = Driver.objects.filter(team_driver=driver)
        if team_driver_id is not None:
            old_partner_qs = old_partner_qs.exclude(pk=team_driver_id)
        old_partner = old_partner_qs.first()
        if old_partner is not None:
            old_partner.team_driver = None
            if solo_type is not None:
                old_partner.driver_type = solo_type
            old_partner.save(update_fields=["team_driver", "driver_type", "updated_at"])

        if team_driver_id is not None:
            partner = Driver.objects.filter(pk=team_driver_id).first()
            if partner is None:
                return
            partner.team_driver = driver
            partner.fuel_card = driver.fuel_card
            if driver.driver_type_id:
                partner.driver_type = driver.driver_type
            partner.save(
                update_fields=["team_driver", "fuel_card", "driver_type", "updated_at"]
            )
        return

    partner = Driver.objects.filter(team_driver=driver).first()
    if partner is not None:
        partner.team_driver = None
        if solo_type is not None:
            partner.driver_type = solo_type
        partner.save(update_fields=["team_driver", "driver_type", "updated_at"])
    if driver.team_driver_id is not None:
        driver.team_driver = None
        driver.save(update_fields=["team_driver", "updated_at"])


def _clone_for_new_carrier(*, driver: Driver, new_carrier) -> Driver:
    today = timezone.localdate()
    clone = Driver()
    copy_fields = [
        field
        for field in Driver._meta.fields
        if field.name
        not in {
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "carrier",
            "status",
            "mvr_expiration",
            "application_file",
            "lease_agreement_file",
            "mvr_file",
            "contract",
            "fuel_card",
            "miles_empty",
            "miles_full",
            "pay_vacation",
            "team_driver",
            "hire_date",
            "termination_date",
            "carrier_start_date",
            "carrier_end_date",
            "carrier_end_reason",
        }
    ]
    for field in copy_fields:
        setattr(clone, field.name, getattr(driver, field.name))

    clone.carrier = new_carrier
    clone.status = Driver.Status.ACTIVE
    clone.mvr_expiration = None
    clone.application_file = None
    clone.lease_agreement_file = None
    clone.mvr_file = None
    clone.contract = Driver.Contract.BY_PERCENT
    clone.fuel_card = None
    clone.miles_empty = 0
    clone.miles_full = 0
    clone.pay_vacation = Driver.PayVacation.YES
    clone.team_driver = None
    clone.hire_date = today
    clone.termination_date = None
    clone.carrier_start_date = today
    clone.carrier_end_date = None
    clone.carrier_end_reason = ""
    clone.save()

    copied_types = {
        DriverDocument.DocumentType.LICENSE,
        DriverDocument.DocumentType.MEDICAL_CARD,
        DriverDocument.DocumentType.RESIDENCE_CARD,
        DriverDocument.DocumentType.SOCIAL_SECURITY,
    }
    for document in driver.documents.filter(document_type__in=copied_types):
        DriverDocument.objects.create(
            driver=clone,
            document_type=document.document_type,
            file=document.file,
            expiration_date=document.expiration_date,
        )

    return clone


@transaction.atomic
def update_driver(*, driver: Driver, **fields) -> Driver:
    old_carrier = driver.carrier
    new_carrier = fields.get("carrier", old_carrier)
    carrier_changed = (
        new_carrier is not None
        and old_carrier is not None
        and new_carrier.pk != old_carrier.pk
    ) or (new_carrier is not None and old_carrier is None)

    for field, value in fields.items():
        setattr(driver, field, value)

    if carrier_changed:
        if not driver.carrier_end_reason:
            raise ValidationError(
                {"carrier_end_reason": "Carrier end reason cannot be blank."}
            )
        today = timezone.localdate()
        driver.carrier = old_carrier
        driver.status = Driver.Status.INACTIVE
        driver.termination_date = today
        driver.carrier_end_date = today
        driver.full_clean()
        driver.save()
        return _clone_for_new_carrier(driver=driver, new_carrier=new_carrier)

    driver.full_clean()
    driver.save()
    _sync_team_driver(driver)
    return driver


def toggle_driver_status(*, driver: Driver) -> Driver:
    driver.status = (
        Driver.Status.INACTIVE
        if driver.status == Driver.Status.ACTIVE
        else Driver.Status.ACTIVE
    )
    driver.save(update_fields=["status", "updated_at"])
    return driver


def set_photo(*, driver: Driver, photo: UploadedFile) -> Driver:
    # Remove the previous file from storage before replacing it.
    if driver.photo:
        driver.photo.delete(save=False)
    driver.photo = photo
    driver.save(update_fields=["photo", "updated_at"])
    return driver


def remove_photo(*, driver: Driver) -> Driver:
    if driver.photo:
        driver.photo.delete(save=False)
        driver.photo = None
        driver.save(update_fields=["photo", "updated_at"])
    return driver


def upload_document(
    *,
    driver: Driver,
    document_type: DriverDocument.DocumentType,
    file: UploadedFile,
    expiration_date=None,
) -> DriverDocument:
    document = DriverDocument(
        driver=driver,
        document_type=document_type,
        file=file,
        expiration_date=expiration_date,
    )
    document.save()

    expiration_field_map = {
        DriverDocument.DocumentType.LICENSE: "license_expiration",
        DriverDocument.DocumentType.MEDICAL_CARD: "medical_card_expiration",
        DriverDocument.DocumentType.MVR: "mvr_expiration",
    }
    if expiration_date and document_type in expiration_field_map:
        setattr(driver, expiration_field_map[document_type], expiration_date)
        driver.save(update_fields=[expiration_field_map[document_type], "updated_at"])

    return document


def delete_document(*, document: DriverDocument) -> None:
    if document.file:
        document.file.delete(save=False)
    document.delete()


def create_driver_type(*, name: str) -> DriverType:
    driver_type = DriverType(name=name)
    driver_type.full_clean()
    driver_type.save()
    return driver_type
