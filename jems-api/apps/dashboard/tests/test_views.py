import datetime

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from apps.drivers.models import Driver
from apps.fleet.models import Truck, TruckMaintenance, Trailer
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
# Stats
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_stats_loads_in_dispatch(auth_client):
    LoadFactory(status=Load.Status.REGISTERED)  # excluded
    LoadFactory(status=Load.Status.STARTED)
    LoadFactory(status=Load.Status.FINISHED)
    LoadFactory(status=Load.Status.DETENTION_PENDING)
    LoadFactory(status=Load.Status.CANCELLED)  # excluded

    response = auth_client.get(DASHBOARD_URL)
    assert response.status_code == status.HTTP_200_OK
    assert response.data["stats"]["loads_in_dispatch"] == 3


@pytest.mark.django_db
def test_stats_executed_loads(auth_client):
    LoadFactory(status=Load.Status.FINISHED)
    LoadFactory(status=Load.Status.FINISHED)
    LoadFactory(status=Load.Status.STARTED)

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["stats"]["executed_loads"] == 2


@pytest.mark.django_db
def test_stats_invoiced(auth_client):
    LoadFactory(invoiced=True)
    LoadFactory(invoiced=True)
    LoadFactory(invoiced=False)

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["stats"]["invoiced"] == 2


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
    assert "mvr" not in alert_types


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
# Counts
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_counts_drivers_expiring(auth_client):
    today = datetime.date.today()
    # Expires in 10 days — within 30-day count window
    DriverFactory(
        status=Driver.Status.ACTIVE,
        license_expiration=today + datetime.timedelta(days=10),
    )
    # Expires in 45 days — in 60-day alert list but NOT in 30-day count
    DriverFactory(
        status=Driver.Status.ACTIVE,
        license_expiration=today + datetime.timedelta(days=45),
    )

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["counts"]["drivers_expiring"] == 1


@pytest.mark.django_db
def test_counts_trucks_in_maintenance(auth_client):
    truck_with = TruckFactory(status=Truck.Status.ACTIVE)
    TruckMaintenance.objects.create(
        truck=truck_with,
        date=datetime.date.today(),
        odometer_start=0,
        odometer_current=0,
    )
    TruckFactory(status=Truck.Status.ACTIVE)  # no maintenance record

    response = auth_client.get(DASHBOARD_URL)
    assert response.data["counts"]["trucks_in_maintenance"] == 1


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
    assert set(data["expiration_alerts"].keys()) == {"drivers", "trucks", "trailers"}
    assert set(data["counts"].keys()) == {
        "drivers_expiring",
        "trucks_expiring",
        "trucks_in_maintenance",
        "trailers_expiring",
    }
