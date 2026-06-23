import datetime

import pytest
from django.core.exceptions import ValidationError

from apps.loads.exceptions import InvalidStatusTransition
from apps.loads.models import Load, LoadStop
from apps.loads.services import (
    assign_load,
    create_load,
    create_load_stop,
    delete_load_stop,
    set_invoiced,
    set_load_status,
    set_paid,
    update_load,
    update_load_stop,
)
from apps.loads.tests.factories import (
    BrokerFactory,
    CityFactory,
    DriverFactory,
    LoadFactory,
    LoadStopFactory,
    TruckFactory,
)


@pytest.mark.django_db
class TestCreateLoad:
    def test_creates_with_required_fields(self):
        city = CityFactory()
        broker = BrokerFactory()
        load = create_load(
            number="LD-001",
            pickup_date=datetime.date.today(),
            dropoff_date=datetime.date.today() + datetime.timedelta(days=1),
            pickup_city=city,
            dropoff_city=city,
            pickup_address="123 Main",
            dropoff_address="456 Oak",
            payment=1000.0,
            broker=broker,
        )
        assert load.pk is not None
        assert load.status == Load.Status.REGISTERED

    def test_duplicate_number_raises(self):
        LoadFactory(number="LD-DUP")
        with pytest.raises(ValidationError):
            create_load(
                number="LD-DUP",
                pickup_date=datetime.date.today(),
                dropoff_date=datetime.date.today(),
                pickup_address="x",
                dropoff_address="x",
            )


@pytest.mark.django_db
class TestUpdateLoad:
    def test_updates_payment(self):
        load = LoadFactory(payment=1000.0)
        updated = update_load(load=load, payment=2500.0)
        assert updated.payment == 2500.0


@pytest.mark.django_db
class TestAssignLoad:
    def test_assigns_truck_and_driver(self):
        load = LoadFactory()
        truck = TruckFactory()
        driver = DriverFactory()
        updated = assign_load(load=load, truck=truck, driver=driver)
        assert updated.truck == truck
        assert updated.driver == driver
        assert updated.execute is True

    def test_clears_team_driver_when_no_team(self):
        load = LoadFactory()
        driver = DriverFactory()
        updated = assign_load(load=load, driver=driver)
        assert updated.team_driver is None


@pytest.mark.django_db
class TestSetLoadStatus:
    def test_registered_to_started(self):
        load = LoadFactory(status=Load.Status.REGISTERED)
        updated = set_load_status(load=load, new_status=Load.Status.STARTED)
        assert updated.status == Load.Status.STARTED

    def test_invalid_transition_raises(self):
        load = LoadFactory(status=Load.Status.FINISHED)
        with pytest.raises(InvalidStatusTransition):
            set_load_status(load=load, new_status=Load.Status.STARTED)

    def test_cannot_go_from_cancelled(self):
        load = LoadFactory(status=Load.Status.CANCELLED)
        with pytest.raises(InvalidStatusTransition):
            set_load_status(load=load, new_status=Load.Status.REGISTERED)


@pytest.mark.django_db
class TestSetInvoiced:
    def test_toggles_invoiced(self):
        load = LoadFactory(invoiced=False)
        updated = set_invoiced(load=load)
        assert updated.invoiced is True
        updated = set_invoiced(load=updated)
        assert updated.invoiced is False


@pytest.mark.django_db
class TestSetPaid:
    def test_toggles_paid(self):
        load = LoadFactory(paid=False)
        updated = set_paid(load=load)
        assert updated.paid is True


@pytest.mark.django_db
class TestLoadStops:
    def test_creates_stop(self):
        load = LoadFactory()
        stop = create_load_stop(
            load=load,
            stop_type=LoadStop.StopType.PICKUP,
            from_date=datetime.date.today(),
            to_date=datetime.date.today() + datetime.timedelta(days=1),
            address="100 Stop St",
        )
        assert stop.pk is not None
        assert stop.load == load

    def test_updates_stop_address(self):
        stop = LoadStopFactory(address="Old Addr")
        updated = update_load_stop(stop=stop, address="New Addr")
        assert updated.address == "New Addr"

    def test_deletes_stop(self):
        stop = LoadStopFactory()
        pk = stop.pk
        delete_load_stop(stop=stop)
        assert not LoadStop.objects.filter(pk=pk).exists()
