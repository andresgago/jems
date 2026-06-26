import datetime

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounting.models import Record
from apps.accounting.tests.factories import CategoryFactory, RecordFactory
from apps.drivers.models import Driver
from apps.fleet.models import Trailer, Truck, TruckMaintenance, TrailerMaintenance
from apps.loads.models import Load
from apps.loads.tests.factories import (
    DriverFactory,
    LoadFactory,
    TruckFactory,
    TrailerFactory,
    UserFactory,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client


DASHBOARD_URL = "/api/v1/dashboard/"


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_unauthenticated_returns_401(api_client):
    response = api_client.get(DASHBOARD_URL)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# Response shape
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_response_shape(auth_client):
    response = auth_client.get(DASHBOARD_URL)
    assert response.status_code == status.HTTP_200_OK
    data = response.data
    assert "stats" in data
    assert "expiration_alerts" in data
    assert "counts" in data
    assert set(data["stats"].keys()) == {
        "loads_in_dispatch",
        "executed_loads",
        "invoiced",
    }
    assert set(data["expiration_alerts"].keys()) == {
        "drivers",
        "trucks",
        "trailers",
        "categories",
    }
    assert set(data["counts"].keys()) == {
        "drivers_expiring",
        "trucks_expiring",
        "trucks_maintenance_alerts",
        "trailers_expiring",
        "trailers_maintenance_alerts",
        "categories_expiring",
    }


# ---------------------------------------------------------------------------
# Stats — loads_in_dispatch (execute=False AND history=False)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_stats_loads_in_dispatch(auth_client):
    # Counted: not yet executed, not in history
    LoadFactory(execute=False, history=False)
    LoadFactory(execute=False, history=False, status=Load.Status.STARTED)
    # Excluded: already executed
    LoadFactory(execute=True, history=False)
    # Excluded: in history
    LoadFactory(execute=False, history=True)

    response = auth_client.get(DASHBOARD_URL)
    assert response.status_code == status.HTTP_200_OK
    assert response.data["stats"]["loads_in_dispatch"] == 2


@pytest.mark.django_db
def test_stats_loads_in_dispatch_excludes_archived(auth_client):
    LoadFactory(execute=True, history=True)  # archived executed load
    LoadFactory(execute=False, history=True)  # archived but never executed

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["stats"]["loads_in_dispatch"] == 0


# ---------------------------------------------------------------------------
# Stats — executed_loads (execute=True AND history=False AND drivers_paid=False)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_stats_executed_loads(auth_client):
    LoadFactory(execute=True, history=False, drivers_paid=False)
    LoadFactory(execute=True, history=False, drivers_paid=False)
    # Excluded: not executed
    LoadFactory(execute=False, history=False, drivers_paid=False)
    # Excluded: in history
    LoadFactory(execute=True, history=True, drivers_paid=False)
    # Excluded: driver already paid
    LoadFactory(execute=True, history=False, drivers_paid=True)

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["stats"]["executed_loads"] == 2


# ---------------------------------------------------------------------------
# Stats — invoiced (execute=True AND history=False AND drivers_paid=False AND invoiced=True)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_stats_invoiced(auth_client):
    LoadFactory(execute=True, history=False, drivers_paid=False, invoiced=True)
    LoadFactory(execute=True, history=False, drivers_paid=False, invoiced=True)
    # Excluded: not invoiced
    LoadFactory(execute=True, history=False, drivers_paid=False, invoiced=False)
    # Excluded: not yet executed
    LoadFactory(execute=False, history=False, drivers_paid=False, invoiced=True)
    # Excluded: in history
    LoadFactory(execute=True, history=True, drivers_paid=False, invoiced=True)
    # Excluded: driver already paid
    LoadFactory(execute=True, history=False, drivers_paid=True, invoiced=True)

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["stats"]["invoiced"] == 2


@pytest.mark.django_db
def test_stats_invoiced_percentage(auth_client):
    """invoiced is always ≤ executed_loads since filters are a subset."""
    LoadFactory(execute=True, history=False, drivers_paid=False, invoiced=True)
    LoadFactory(execute=True, history=False, drivers_paid=False, invoiced=False)

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["stats"]["executed_loads"] == 2
    assert response.data["stats"]["invoiced"] == 1


# ---------------------------------------------------------------------------
# Expiration alerts — drivers
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_driver_alerts_only_active_drivers(auth_client):
    today = datetime.date.today()
    soon = today + datetime.timedelta(days=10)

    active = DriverFactory(status=Driver.Status.ACTIVE, license_expiration=soon)
    DriverFactory(status=Driver.Status.INACTIVE, license_expiration=soon)
    DriverFactory(status=Driver.Status.TERMINATED, license_expiration=soon)

    response = auth_client.get(DASHBOARD_URL)
    driver_ids = [d["id"] for d in response.data["expiration_alerts"]["drivers"]]
    assert active.id in driver_ids
    assert len(driver_ids) == 1


@pytest.mark.django_db
def test_driver_alerts_include_expired_docs(auth_client):
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    driver = DriverFactory(status=Driver.Status.ACTIVE, license_expiration=yesterday)

    response = auth_client.get(DASHBOARD_URL)
    drivers = response.data["expiration_alerts"]["drivers"]
    assert any(d["id"] == driver.id for d in drivers)
    alert = next(
        a
        for d in drivers
        if d["id"] == driver.id
        for a in d["alerts"]
        if a["type"] == "license"
    )
    assert alert["expired"] is True
    assert alert["days_until"] < 0


@pytest.mark.django_db
def test_driver_alerts_exclude_far_future(auth_client):
    far = datetime.date.today() + datetime.timedelta(days=90)
    DriverFactory(status=Driver.Status.ACTIVE, license_expiration=far)

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["expiration_alerts"]["drivers"] == []


@pytest.mark.django_db
def test_driver_alerts_multiple_slots(auth_client):
    today = datetime.date.today()
    driver = DriverFactory(
        status=Driver.Status.ACTIVE,
        license_expiration=today + datetime.timedelta(days=5),
        medical_card_expiration=today + datetime.timedelta(days=15),
        mvr_expiration=today + datetime.timedelta(days=100),  # outside window
    )

    response = auth_client.get(DASHBOARD_URL)
    entry = next(
        d for d in response.data["expiration_alerts"]["drivers"] if d["id"] == driver.id
    )
    alert_types = [a["type"] for a in entry["alerts"]]
    assert "license" in alert_types
    assert "medical_card" in alert_types
    assert "record" not in alert_types  # mvr outside window


@pytest.mark.django_db
def test_driver_alerts_record_label(auth_client):
    """MVR/D&A document must display as 'Record' to match legacy dashboard."""
    today = datetime.date.today()
    driver = DriverFactory(
        status=Driver.Status.ACTIVE,
        mvr_expiration=today + datetime.timedelta(days=5),
    )

    response = auth_client.get(DASHBOARD_URL)
    entry = next(
        d for d in response.data["expiration_alerts"]["drivers"] if d["id"] == driver.id
    )
    record_alert = next(a for a in entry["alerts"] if a["type"] == "record")
    assert record_alert["label"] == "Record"


@pytest.mark.django_db
def test_driver_alerts_record_type_key(auth_client):
    """MVR field uses type key 'record' (matches legacy recordexpiration field name)."""
    today = datetime.date.today()
    driver = DriverFactory(
        status=Driver.Status.ACTIVE,
        mvr_expiration=today + datetime.timedelta(days=5),
    )

    response = auth_client.get(DASHBOARD_URL)
    entry = next(
        d for d in response.data["expiration_alerts"]["drivers"] if d["id"] == driver.id
    )
    types = [a["type"] for a in entry["alerts"]]
    assert "record" in types


# ---------------------------------------------------------------------------
# Expiration alerts — trucks
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_truck_alerts_active_only(auth_client):
    today = datetime.date.today()
    soon = today + datetime.timedelta(days=10)
    active_truck = TruckFactory(status=Truck.Status.ACTIVE, avi_expiration=soon)
    TruckFactory(status=Truck.Status.INACTIVE, avi_expiration=soon)

    response = auth_client.get(DASHBOARD_URL)
    truck_ids = [t["id"] for t in response.data["expiration_alerts"]["trucks"]]
    assert active_truck.id in truck_ids
    assert len(truck_ids) == 1


@pytest.mark.django_db
def test_truck_alerts_both_slots(auth_client):
    today = datetime.date.today()
    truck = TruckFactory(
        status=Truck.Status.ACTIVE,
        avi_expiration=today + datetime.timedelta(days=5),
        registration_expiration=today + datetime.timedelta(days=20),
    )

    response = auth_client.get(DASHBOARD_URL)
    entry = next(
        t for t in response.data["expiration_alerts"]["trucks"] if t["id"] == truck.id
    )
    types = [a["type"] for a in entry["alerts"]]
    assert "avi" in types
    assert "registration" in types


# ---------------------------------------------------------------------------
# Expiration alerts — trailers
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_trailer_alerts_active_only(auth_client):
    today = datetime.date.today()
    soon = today + datetime.timedelta(days=10)
    active = TrailerFactory(
        status=Trailer.Status.ACTIVE, annual_inspection_expiration=soon
    )
    TrailerFactory(status=Trailer.Status.INACTIVE, annual_inspection_expiration=soon)

    response = auth_client.get(DASHBOARD_URL)
    ids = [t["id"] for t in response.data["expiration_alerts"]["trailers"]]
    assert active.id in ids
    assert len(ids) == 1


# ---------------------------------------------------------------------------
# Expiration alerts — categories
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_category_alerts_within_window(auth_client):
    today = datetime.date.today()
    cat = CategoryFactory()
    rec = RecordFactory(
        category=cat,
        category_expire=True,
        category_expire_date=today + datetime.timedelta(days=15),
    )

    response = auth_client.get(DASHBOARD_URL)
    cats = response.data["expiration_alerts"]["categories"]
    assert any(c["id"] == rec.id for c in cats)


@pytest.mark.django_db
def test_category_alerts_excludes_far_future(auth_client):
    today = datetime.date.today()
    cat = CategoryFactory()
    RecordFactory(
        category=cat,
        category_expire=True,
        category_expire_date=today + datetime.timedelta(days=60),
    )

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["expiration_alerts"]["categories"] == []


@pytest.mark.django_db
def test_category_alerts_excludes_non_expiring_records(auth_client):
    today = datetime.date.today()
    cat = CategoryFactory()
    RecordFactory(
        category=cat,
        category_expire=False,
        category_expire_date=today + datetime.timedelta(days=5),
    )

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["expiration_alerts"]["categories"] == []


@pytest.mark.django_db
def test_category_alerts_include_expired(auth_client):
    today = datetime.date.today()
    cat = CategoryFactory()
    rec = RecordFactory(
        category=cat,
        category_expire=True,
        category_expire_date=today - datetime.timedelta(days=5),
    )

    response = auth_client.get(DASHBOARD_URL)
    cats = response.data["expiration_alerts"]["categories"]
    entry = next(c for c in cats if c["id"] == rec.id)
    assert entry["alerts"][0]["expired"] is True
    assert entry["alerts"][0]["days_until"] < 0


@pytest.mark.django_db
def test_category_alerts_name_includes_category_and_truck(auth_client):
    today = datetime.date.today()
    cat = CategoryFactory(code="OIL", name="Oil Change")
    truck = TruckFactory(number="T-001")
    rec = RecordFactory(
        category=cat,
        truck=truck,
        category_expire=True,
        category_expire_date=today + datetime.timedelta(days=5),
    )

    response = auth_client.get(DASHBOARD_URL)
    cats = response.data["expiration_alerts"]["categories"]
    entry = next(c for c in cats if c["id"] == rec.id)
    assert entry["category_code"] == "OIL"
    assert entry["category_name"] == "Oil Change"
    assert entry["truck_number"] == "T-001"


@pytest.mark.django_db
def test_category_alerts_null_expiry_excluded(auth_client):
    cat = CategoryFactory()
    RecordFactory(category=cat, category_expire=True, category_expire_date=None)

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["expiration_alerts"]["categories"] == []


# ---------------------------------------------------------------------------
# Counts — badge numbers match list lengths
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_counts_drivers_expiring_matches_list_length(auth_client):
    today = datetime.date.today()
    # Two drivers: one at 10 days, one at 50 days — both in 60-day window
    DriverFactory(
        status=Driver.Status.ACTIVE,
        license_expiration=today + datetime.timedelta(days=10),
    )
    DriverFactory(
        status=Driver.Status.ACTIVE,
        license_expiration=today + datetime.timedelta(days=50),
    )

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["counts"]["drivers_expiring"] == 2
    assert len(response.data["expiration_alerts"]["drivers"]) == 2


@pytest.mark.django_db
def test_counts_categories_expiring(auth_client):
    today = datetime.date.today()
    cat = CategoryFactory()
    RecordFactory(
        category=cat,
        category_expire=True,
        category_expire_date=today + datetime.timedelta(days=5),
    )
    RecordFactory(
        category=cat,
        category_expire=True,
        category_expire_date=today + datetime.timedelta(days=20),
    )
    # Excluded (outside window)
    RecordFactory(
        category=cat,
        category_expire=True,
        category_expire_date=today + datetime.timedelta(days=60),
    )

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["counts"]["categories_expiring"] == 2


# ---------------------------------------------------------------------------
# Counts — maintenance alerts
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_counts_trucks_maintenance_alerts_time_based(auth_client):
    today = datetime.date.today()
    truck = TruckFactory(status=Truck.Status.ACTIVE)
    # Alert was due 1 year ago → alert is active
    TruckMaintenance.objects.create(
        truck=truck,
        date=today - datetime.timedelta(days=400),
        time_alert=1,
        time_year=1,
        time_month=0,
        odometer_start=0,
        odometer_current=0,
    )
    TruckFactory(status=Truck.Status.ACTIVE)  # no maintenance record

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["counts"]["trucks_maintenance_alerts"] == 1


@pytest.mark.django_db
def test_counts_trucks_maintenance_alerts_future_date_excluded(auth_client):
    today = datetime.date.today()
    truck = TruckFactory(status=Truck.Status.ACTIVE)
    # Alert due in 6 months — not yet triggered
    TruckMaintenance.objects.create(
        truck=truck,
        date=today,
        time_alert=1,
        time_year=0,
        time_month=6,
        odometer_start=0,
        odometer_current=0,
    )

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["counts"]["trucks_maintenance_alerts"] == 0


@pytest.mark.django_db
def test_counts_trucks_maintenance_alerts_no_time_alert_flag_excluded(auth_client):
    today = datetime.date.today()
    truck = TruckFactory(status=Truck.Status.ACTIVE)
    # time_alert=0 means no time-based alert configured
    TruckMaintenance.objects.create(
        truck=truck,
        date=today - datetime.timedelta(days=400),
        time_alert=0,
        time_year=1,
        time_month=0,
        odometer_start=0,
        odometer_current=0,
    )

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["counts"]["trucks_maintenance_alerts"] == 0


@pytest.mark.django_db
def test_counts_trailers_maintenance_alerts_time_based(auth_client):
    today = datetime.date.today()
    trailer = TrailerFactory(status=Trailer.Status.ACTIVE)
    # Alert was due 1 year ago → active alert
    TrailerMaintenance.objects.create(
        trailer=trailer,
        date=today - datetime.timedelta(days=400),
        time_alert=1,
        time_year=1,
        time_month=0,
    )

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["counts"]["trailers_maintenance_alerts"] == 1


@pytest.mark.django_db
def test_counts_trailers_maintenance_alerts_inactive_excluded(auth_client):
    today = datetime.date.today()
    trailer = TrailerFactory(status=Trailer.Status.INACTIVE)
    TrailerMaintenance.objects.create(
        trailer=trailer,
        date=today - datetime.timedelta(days=400),
        time_alert=1,
        time_year=1,
        time_month=0,
    )

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["counts"]["trailers_maintenance_alerts"] == 0


@pytest.mark.django_db
def test_counts_truck_alerted_once_for_multiple_records(auth_client):
    """One truck with two past-due maintenance records should count as 1."""
    today = datetime.date.today()
    truck = TruckFactory(status=Truck.Status.ACTIVE)
    for _ in range(2):
        TruckMaintenance.objects.create(
            truck=truck,
            date=today - datetime.timedelta(days=400),
            time_alert=1,
            time_year=1,
            time_month=0,
            odometer_start=0,
            odometer_current=0,
        )

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["counts"]["trucks_maintenance_alerts"] == 1
