import pytest

from apps.drivers.models import Driver
from apps.drivers.services import create_driver, toggle_driver_status, update_driver
from apps.drivers.tests.factories import DriverFactory, DriverTypeFactory
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
            created_by=user,
        )
        assert driver.pk is not None
        assert driver.full_name == "John Smith"
        assert driver.status == Driver.Status.ACTIVE

    def test_driver_is_active_by_default(self):
        driver = create_driver(first_name="Jane", last_name="Doe")
        assert driver.status == Driver.Status.ACTIVE


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
