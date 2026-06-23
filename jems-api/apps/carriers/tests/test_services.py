import pytest
from django.core.exceptions import ValidationError

from apps.carriers.services import create_carrier, toggle_carrier_status, update_carrier
from apps.carriers.tests.factories import CarrierFactory


@pytest.mark.django_db
class TestCreateCarrier:
    def test_creates_carrier_with_required_fields(self):
        carrier = create_carrier(
            mc="MC123456", dot_number="DOT123456", name="Test Carrier"
        )
        assert carrier.pk is not None
        assert carrier.mc == "MC123456"
        assert carrier.active is False

    def test_duplicate_mc_raises(self):
        CarrierFactory(mc="MC_DUP")
        with pytest.raises(ValidationError):
            create_carrier(mc="MC_DUP", dot_number="DOT999999", name="Another")

    def test_duplicate_dot_raises(self):
        CarrierFactory(dot_number="DOT_DUP")
        with pytest.raises(ValidationError):
            create_carrier(mc="MC999999", dot_number="DOT_DUP", name="Another")


@pytest.mark.django_db
class TestToggleCarrierStatus:
    def test_inactive_becomes_active(self):
        carrier = CarrierFactory(active=False)
        updated = toggle_carrier_status(carrier=carrier)
        assert updated.active is True

    def test_active_becomes_inactive(self):
        carrier = CarrierFactory(active=True)
        updated = toggle_carrier_status(carrier=carrier)
        assert updated.active is False


@pytest.mark.django_db
class TestUpdateCarrier:
    def test_updates_fields(self):
        carrier = CarrierFactory(phone="111-000-0000")
        updated = update_carrier(
            carrier=carrier, phone="999-888-7777", dba_name="New DBA"
        )
        assert updated.phone == "999-888-7777"
        assert updated.dba_name == "New DBA"
