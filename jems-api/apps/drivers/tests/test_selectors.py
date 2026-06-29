import datetime

import pytest
from django.utils import timezone

from apps.drivers.models import Driver
from apps.drivers.selectors import get_drivers_last_loads
from apps.drivers.tests.factories import DriverFactory
from apps.integrations.tests.factories import RtlDriverFactory, RtlDriverStatusFactory
from apps.loads.models import Load
from apps.loads.tests.factories import (
    CityFactory,
    LoadFactory,
    StateFactory,
    TrailerTypeFactory,
    TruckFactory,
    TrailerFactory,
)
from apps.users.tests.factories import DispatcherFactory


@pytest.mark.django_db
class TestGetDriversLastLoads:
    def test_returns_empty_when_no_active_drivers(self):
        result = get_drivers_last_loads()
        assert result == []

    def test_excludes_inactive_drivers(self):
        driver = DriverFactory(status=Driver.Status.INACTIVE)
        LoadFactory(driver=driver, execute=True)
        result = get_drivers_last_loads()
        assert result == []

    def test_excludes_terminated_drivers(self):
        driver = DriverFactory(status=Driver.Status.TERMINATED)
        LoadFactory(driver=driver, execute=True)
        result = get_drivers_last_loads()
        assert result == []

    def test_excludes_active_drivers_with_no_executed_loads(self):
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        # load is not executed
        LoadFactory(driver=driver, execute=False)
        result = get_drivers_last_loads()
        assert result == []

    def test_includes_active_driver_with_executed_load(self):
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True)
        result = get_drivers_last_loads()
        assert len(result) == 1
        assert result[0]["id"] == driver.id

    def test_last_load_is_most_recent_executed(self):
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        now = timezone.now()
        _old = LoadFactory(
            driver=driver,
            execute=True,
            dropoff_date=now - datetime.timedelta(days=10),
        )
        recent = LoadFactory(
            driver=driver,
            execute=True,
            dropoff_date=now - datetime.timedelta(days=1),
        )
        result = get_drivers_last_loads()
        assert result[0]["last_load"]["id"] == recent.id

    def test_current_load_is_none_when_no_active_load(self):
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True)
        result = get_drivers_last_loads()
        assert result[0]["current_load"] is None

    def test_current_load_present_when_active_load_exists(self):
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True)
        today = timezone.now()
        current = LoadFactory(
            driver=driver,
            execute=False,
            dropoff_date=today + datetime.timedelta(days=2),
            status=Load.Status.REGISTERED,
        )
        result = get_drivers_last_loads()
        assert result[0]["current_load"] is not None
        assert result[0]["current_load"]["id"] == current.id

    def test_current_load_excluded_when_dropoff_in_past(self):
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True)
        LoadFactory(
            driver=driver,
            execute=False,
            dropoff_date=timezone.now() - datetime.timedelta(days=1),
            status=Load.Status.REGISTERED,
        )
        result = get_drivers_last_loads()
        assert result[0]["current_load"] is None

    def test_current_load_excluded_when_status_cancelled(self):
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True)
        LoadFactory(
            driver=driver,
            execute=False,
            dropoff_date=timezone.now() + datetime.timedelta(days=2),
            status=Load.Status.CANCELLED,
        )
        result = get_drivers_last_loads()
        assert result[0]["current_load"] is None

    def test_serializes_load_city_info(self):
        state = StateFactory(abbreviation="NC")
        pickup_city = CityFactory(name="Charlotte", state=state, zip="28201")
        dropoff_city = CityFactory(name="Atlanta", state=state, zip="30301")
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(
            driver=driver,
            execute=True,
            pickup_city=pickup_city,
            dropoff_city=dropoff_city,
        )
        result = get_drivers_last_loads()
        ll = result[0]["last_load"]
        assert ll["pickup_city"] == "Charlotte"
        assert ll["pickup_state"] == "NC"
        assert ll["pickup_zip"] == "28201"
        assert ll["dropoff_city"] == "Atlanta"

    def test_serializes_truck_and_trailer(self):
        truck = TruckFactory(number="TRK-001")
        trailer_type = TrailerTypeFactory(short_name="DV")
        trailer = TrailerFactory(number="TRL-001", trailer_type=trailer_type)
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(
            driver=driver,
            execute=True,
            truck=truck,
            trailer=trailer,
            trailer_type=trailer_type,
        )
        result = get_drivers_last_loads()
        ll = result[0]["last_load"]
        assert ll["truck"] == "TRK-001"
        assert ll["trailer"] == "TRL-001"
        assert ll["trailer_type"] == "DV"

    def test_result_ordered_by_first_name_then_last_name(self):
        d1 = DriverFactory(status=Driver.Status.ACTIVE, first_name="Zoe", last_name="A")
        d2 = DriverFactory(
            status=Driver.Status.ACTIVE, first_name="Alice", last_name="B"
        )
        LoadFactory(driver=d1, execute=True)
        LoadFactory(driver=d2, execute=True)
        result = get_drivers_last_loads()
        ids = [r["id"] for r in result]
        assert ids.index(d2.id) < ids.index(d1.id)

    def test_full_name_present(self):
        driver = DriverFactory(
            status=Driver.Status.ACTIVE, first_name="John", last_name="Smith"
        )
        LoadFactory(driver=driver, execute=True)
        result = get_drivers_last_loads()
        assert result[0]["full_name"] == "John Smith"

    # ── dispatcher_id filter ──────────────────────────────────────────────────

    def test_dispatcher_filter_includes_driver_with_matching_loads(self):
        dispatcher = DispatcherFactory()
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True, dispatcher=dispatcher)
        result = get_drivers_last_loads(dispatcher_id=dispatcher.pk)
        assert len(result) == 1
        assert result[0]["id"] == driver.id

    def test_dispatcher_filter_excludes_driver_without_matching_loads(self):
        dispatcher_a = DispatcherFactory()
        dispatcher_b = DispatcherFactory()
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True, dispatcher=dispatcher_a)
        result = get_drivers_last_loads(dispatcher_id=dispatcher_b.pk)
        assert result == []

    def test_dispatcher_filter_no_dispatcher_id_returns_all(self):
        d1 = DriverFactory(status=Driver.Status.ACTIVE)
        d2 = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=d1, execute=True)
        LoadFactory(driver=d2, execute=True)
        result = get_drivers_last_loads()
        ids = [r["id"] for r in result]
        assert d1.id in ids
        assert d2.id in ids

    def test_dispatcher_filter_none_id_ignores_filter(self):
        dispatcher = DispatcherFactory()
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True, dispatcher=dispatcher)
        # None means no filter → should still return the driver
        result = get_drivers_last_loads(dispatcher_id=None)
        assert any(r["id"] == driver.id for r in result)

    # ── location field ────────────────────────────────────────────────────────

    def test_location_field_is_none_without_rtl_data(self):
        driver = DriverFactory(status=Driver.Status.ACTIVE, license_number="NO-RTL")
        LoadFactory(driver=driver, execute=True)
        result = get_drivers_last_loads()
        assert result[0]["location"] is None

    def test_location_field_populated_when_rtl_status_exists(self):
        license_no = "LIC-TEST-001"
        driver = DriverFactory(status=Driver.Status.ACTIVE, license_number=license_no)
        LoadFactory(driver=driver, execute=True)
        rtl = RtlDriverFactory(license_number=license_no)
        RtlDriverStatusFactory(
            rtl_driver=rtl,
            location_state="VA",
            location_calculated="5.0mi NNE from Winchester, VA",
            location_timestamp="2025-02-11T16:52:00Z",
        )
        result = get_drivers_last_loads()
        loc = result[0]["location"]
        assert loc is not None
        assert loc["state"] == "VA"
        assert loc["calculated"] == "5.0mi NNE from Winchester, VA"
        assert loc["timestamp"] == "2025-02-11T16:52:00Z"

    def test_location_field_none_when_rtl_driver_exists_but_no_status(self):
        license_no = "LIC-NO-STATUS"
        driver = DriverFactory(status=Driver.Status.ACTIVE, license_number=license_no)
        LoadFactory(driver=driver, execute=True)
        # RTL driver exists but has no status record
        RtlDriverFactory(license_number=license_no)
        result = get_drivers_last_loads()
        assert result[0]["location"] is None

    def test_location_field_none_when_all_location_fields_empty(self):
        license_no = "LIC-EMPTY-LOC"
        driver = DriverFactory(status=Driver.Status.ACTIVE, license_number=license_no)
        LoadFactory(driver=driver, execute=True)
        rtl = RtlDriverFactory(license_number=license_no)
        RtlDriverStatusFactory(
            rtl_driver=rtl,
            location_state="",
            location_calculated="",
            location_timestamp="",
        )
        result = get_drivers_last_loads()
        assert result[0]["location"] is None

    def test_location_field_populated_from_calculated_alone(self):
        license_no = "LIC-CALC-ONLY"
        driver = DriverFactory(status=Driver.Status.ACTIVE, license_number=license_no)
        LoadFactory(driver=driver, execute=True)
        rtl = RtlDriverFactory(license_number=license_no)
        RtlDriverStatusFactory(
            rtl_driver=rtl,
            location_state="",
            location_calculated="3.1mi NE from Dallas, TX",
            location_timestamp="",
        )
        result = get_drivers_last_loads()
        loc = result[0]["location"]
        assert loc is not None
        assert loc["calculated"] == "3.1mi NE from Dallas, TX"
