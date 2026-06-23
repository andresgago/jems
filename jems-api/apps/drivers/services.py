from django.core.files.uploadedfile import UploadedFile

from apps.users.models import User

from .models import Driver, DriverDocument, DriverType


def create_driver(*, created_by: User | None = None, **fields) -> Driver:
    driver = Driver(created_by=created_by, **fields)
    driver.full_clean()
    driver.save()
    return driver


def update_driver(*, driver: Driver, **fields) -> Driver:
    for field, value in fields.items():
        setattr(driver, field, value)
    driver.full_clean()
    driver.save()
    return driver


def toggle_driver_status(*, driver: Driver) -> Driver:
    driver.status = (
        Driver.Status.INACTIVE
        if driver.status == Driver.Status.ACTIVE
        else Driver.Status.ACTIVE
    )
    driver.save(update_fields=["status", "updated_at"])
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
