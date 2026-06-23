import datetime

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.integrations.models import RtlDriver, RtlTruck
from apps.integrations.tests.factories import (
    ReportIFTAFactory,
    RtlDriverFactory,
    RtlDriverStatusFactory,
    RtlIftaFactory,
    RtlTruckFactory,
    RtlTruckStatusFactory,
)
from apps.users.tests.factories import UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client


# ── RtlDriver ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRtlDriverViews:
    def test_list(self, auth_client):
        RtlDriverFactory()
        response = auth_client.get(reverse("rtl-driver-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_filter_active(self, auth_client):
        RtlDriverFactory(active=True)
        RtlDriverFactory(active=False)
        response = auth_client.get(reverse("rtl-driver-list") + "?active=true")
        assert response.status_code == status.HTTP_200_OK
        assert all(d["active"] for d in response.data)

    def test_retrieve(self, auth_client):
        driver = RtlDriverFactory()
        response = auth_client.get(reverse("rtl-driver-detail", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["rtl_id"] == driver.rtl_id

    def test_retrieve_includes_status(self, auth_client):
        driver = RtlDriverFactory()
        RtlDriverStatusFactory(rtl_driver=driver)
        response = auth_client.get(reverse("rtl-driver-detail", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["latest_status"] is not None

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("rtl-driver-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ── RtlTruck ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRtlTruckViews:
    def test_list(self, auth_client):
        RtlTruckFactory()
        response = auth_client.get(reverse("rtl-truck-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_retrieve_includes_status(self, auth_client):
        truck = RtlTruckFactory()
        RtlTruckStatusFactory(rtl_truck=truck)
        response = auth_client.get(reverse("rtl-truck-detail", kwargs={"pk": truck.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["latest_status"] is not None

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("rtl-truck-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ── RtlIfta ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRtlIftaViews:
    def test_list(self, auth_client):
        RtlIftaFactory()
        response = auth_client.get(reverse("rtl-ifta-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_filter_by_vin(self, auth_client):
        RtlIftaFactory(vehicle_vin="VIN001")
        RtlIftaFactory(vehicle_vin="VIN002")
        response = auth_client.get(reverse("rtl-ifta-list") + "?vin=VIN001")
        assert response.status_code == status.HTTP_200_OK
        assert all(r["vehicle_vin"] == "VIN001" for r in response.data)


# ── ReportIFTA ────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestReportIFTAViews:
    def test_list(self, auth_client):
        ReportIFTAFactory()
        response = auth_client.get(reverse("ifta-report-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_create(self, auth_client):
        response = auth_client.post(
            reverse("ifta-report-list"),
            {
                "from_date": "2024-01-01",
                "to_date": "2024-03-31",
                "report": "Q1-2024",
                "vehicles": "[]",
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["report"] == "Q1-2024"

    def test_delete(self, auth_client):
        report = ReportIFTAFactory()
        response = auth_client.delete(
            reverse("ifta-report-detail", kwargs={"pk": report.pk})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT


# ── Sync endpoint ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRtlSync:
    def test_sync_creates_records(self, auth_client):
        payload = {
            "drivers": [
                {
                    "_id": "driver-abc",
                    "firstName": "John",
                    "lastName": "Doe",
                    "email": "john@example.com",
                    "active": True,
                }
            ],
            "trucks": [
                {
                    "_id": "truck-abc",
                    "name": "T-001",
                    "vin": "1HTMKAAR3BH123456",
                    "active": True,
                }
            ],
        }
        response = auth_client.post(reverse("rtl-sync"), payload, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["synced"]["drivers"] == 1
        assert response.data["synced"]["trucks"] == 1
        assert RtlDriver.objects.filter(rtl_id="driver-abc").exists()
        assert RtlTruck.objects.filter(rtl_id="truck-abc").exists()

    def test_sync_is_idempotent(self, auth_client):
        payload = {
            "drivers": [{"_id": "driver-xyz", "firstName": "Jane", "active": True}],
        }
        auth_client.post(reverse("rtl-sync"), payload, format="json")
        auth_client.post(reverse("rtl-sync"), payload, format="json")
        assert RtlDriver.objects.filter(rtl_id="driver-xyz").count() == 1

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.post(reverse("rtl-sync"), {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
