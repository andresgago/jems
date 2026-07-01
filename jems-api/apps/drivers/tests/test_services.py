import pytest
from django.core.exceptions import ValidationError

from apps.drivers.models import Driver
from apps.drivers.models import DriverDocument
from apps.drivers.services import (
    create_driver,
    delete_document,
    remove_photo,
    set_photo,
    toggle_driver_status,
    update_driver,
    upload_document,
)
from apps.drivers.tests.factories import CardFactory, DriverFactory, DriverTypeFactory
from apps.drivers.tests.test_views import make_image_file, make_pdf_file
from apps.users.tests.factories import UserFactory


@pytest.mark.django_db
class TestCreateDriver:
    def test_creates_driver_with_required_fields(self):
        driver_type = DriverTypeFactory()
        user = UserFactory()
        driver = create_driver(
            first_name="John",
            last_name="Smith",
            driver_type=driver_type,
            phone="555-1000",
            email="john@example.com",
            birth_date="1980-01-01",
            hire_date="2024-01-01",
            license_number="TX123",
            license_expiration="2030-01-01",
            fuel_card=CardFactory(),
            created_by=user,
        )
        assert driver.pk is not None
        assert driver.full_name == "John Smith"
        assert driver.status == Driver.Status.ACTIVE

    def test_driver_is_active_by_default(self):
        driver = create_driver(
            first_name="Jane",
            last_name="Doe",
            driver_type=DriverTypeFactory(),
            phone="555-1001",
            email="jane@example.com",
            birth_date="1980-01-01",
            hire_date="2024-01-01",
            license_number="TX124",
            license_expiration="2030-01-01",
            fuel_card=CardFactory(),
        )
        assert driver.status == Driver.Status.ACTIVE

    def test_contract_supports_legacy_no_expenses_state(self):
        driver = create_driver(
            first_name="Jane",
            last_name="Miles",
            driver_type=DriverTypeFactory(),
            phone="555-1002",
            email="miles@example.com",
            birth_date="1980-01-01",
            hire_date="2024-01-01",
            license_number="TX125",
            license_expiration="2030-01-01",
            fuel_card=CardFactory(),
            contract=Driver.Contract.BY_PERCENT_NO_EXPENSES,
        )
        assert driver.contract == Driver.Contract.BY_PERCENT_NO_EXPENSES


@pytest.mark.django_db
class TestToggleDriverStatus:
    def test_active_driver_becomes_inactive(self):
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        updated = toggle_driver_status(driver=driver)
        assert updated.status == Driver.Status.INACTIVE

    def test_inactive_driver_becomes_active(self):
        driver = DriverFactory(status=Driver.Status.INACTIVE)
        updated = toggle_driver_status(driver=driver)
        assert updated.status == Driver.Status.ACTIVE


@pytest.mark.django_db
class TestUpdateDriver:
    def test_updates_basic_fields(self):
        driver = DriverFactory(phone="000")
        updated = update_driver(
            driver=driver, phone="555-9999", email="new@example.com"
        )
        assert updated.phone == "555-9999"
        assert updated.email == "new@example.com"

    def test_updates_compensation_fields(self):
        driver = DriverFactory(percent=0)
        updated = update_driver(driver=driver, percent=85.5, miles_full=0.45)
        assert updated.percent == 85.5
        assert updated.miles_full == 0.45

    def test_rejects_termination_before_hire(self):
        driver = DriverFactory(hire_date="2024-02-01")
        with pytest.raises(ValidationError):
            update_driver(driver=driver, termination_date="2024-01-31")

    def test_rejects_duplicate_active_fuel_card(self):
        card = CardFactory()
        DriverFactory(fuel_card=card, status=Driver.Status.ACTIVE)
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        with pytest.raises(ValidationError):
            update_driver(driver=driver, fuel_card=card)

    def test_carrier_change_requires_end_reason(self):
        driver = DriverFactory()
        new_carrier = DriverFactory().carrier
        with pytest.raises(ValidationError):
            update_driver(driver=driver, carrier=new_carrier, carrier_end_reason="")

    def test_carrier_change_closes_old_driver_and_returns_clone(self):
        driver = DriverFactory()
        old_id = driver.pk
        old_carrier = driver.carrier
        new_carrier = DriverFactory().carrier
        cloned = update_driver(
            driver=driver,
            carrier=new_carrier,
            carrier_end_reason="Moved to sister carrier",
        )
        driver.refresh_from_db()
        assert driver.pk == old_id
        assert driver.carrier == old_carrier
        assert driver.status == Driver.Status.INACTIVE
        assert driver.carrier_end_reason == "Moved to sister carrier"
        assert cloned.pk != old_id
        assert cloned.carrier == new_carrier
        assert cloned.status == Driver.Status.ACTIVE
        assert cloned.fuel_card is None


@pytest.mark.django_db
class TestDriverPhoto:
    def test_set_photo_assigns_file(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        driver = DriverFactory()
        updated = set_photo(driver=driver, photo=make_image_file())
        assert updated.photo

    def test_set_photo_replaces_previous(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        driver = DriverFactory(photo=make_image_file("old.png"))
        old_name = driver.photo.name
        updated = set_photo(driver=driver, photo=make_image_file("new.png"))
        assert updated.photo.name != old_name

    def test_remove_photo_clears_file(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        driver = DriverFactory(photo=make_image_file())
        updated = remove_photo(driver=driver)
        assert not updated.photo

    def test_remove_photo_is_noop_without_photo(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        driver = DriverFactory()
        updated = remove_photo(driver=driver)
        assert not updated.photo


@pytest.mark.django_db
class TestDriverDocumentsService:
    def test_upload_document_creates_record(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        driver = DriverFactory()
        document = upload_document(
            driver=driver,
            document_type=DriverDocument.DocumentType.LICENSE,
            file=make_pdf_file(),
            expiration_date="2030-01-01",
        )
        assert document.pk is not None
        assert document.driver == driver
        assert str(document.expiration_date) == "2030-01-01"

    def test_upload_document_accepts_legacy_parity_types(self, settings, tmp_path):
        # Types 4–7 were added so the normalized store covers every legacy slot.
        settings.MEDIA_ROOT = str(tmp_path)
        driver = DriverFactory()
        for doc_type in (
            DriverDocument.DocumentType.RESIDENCE_CARD,
            DriverDocument.DocumentType.APPLICATION,
            DriverDocument.DocumentType.LEASE_AGREEMENT,
            DriverDocument.DocumentType.SOCIAL_SECURITY,
        ):
            document = upload_document(
                driver=driver, document_type=doc_type, file=make_pdf_file()
            )
            assert document.document_type == doc_type

    def test_delete_document_removes_record(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        driver = DriverFactory()
        document = upload_document(
            driver=driver,
            document_type=DriverDocument.DocumentType.MVR,
            file=make_pdf_file(),
        )
        doc_id = document.pk
        delete_document(document=document)
        assert not DriverDocument.objects.filter(pk=doc_id).exists()
