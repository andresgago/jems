import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.documents.models import DriverFile, ImportRecordFile, TrailerFile, TruckFile
from apps.documents.tests.factories import (
    DriverFileFactory,
    ImportRecordFileFactory,
    TrailerFileFactory,
    TruckFileFactory,
)
from apps.drivers.tests.factories import DriverFactory
from apps.fleet.tests.factories import TrailerFactory, TruckFactory
from apps.users.tests.factories import UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client


# ── DriverFile ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestDriverFileViews:
    def test_list(self, auth_client):
        DriverFileFactory()
        response = auth_client.get(reverse("driver-file-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_filter_by_driver(self, auth_client):
        d1 = DriverFactory()
        d2 = DriverFactory()
        DriverFileFactory(driver=d1)
        DriverFileFactory(driver=d2)
        response = auth_client.get(reverse("driver-file-list") + f"?driver={d1.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(r["driver"] == d1.pk for r in response.data)

    def test_create(self, auth_client):
        driver = DriverFactory()
        from django.core.files.base import ContentFile

        response = auth_client.post(
            reverse("driver-file-list"),
            {
                "driver": driver.pk,
                "type": DriverFile.Type.LICENSE,
                "file": ContentFile(b"test", name="lic.pdf"),
                "expiry_date": "2027-01-01",
            },
            format="multipart",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["driver"] == driver.pk

    def test_delete(self, auth_client):
        doc = DriverFileFactory()
        response = auth_client.delete(
            reverse("driver-file-detail", kwargs={"pk": doc.pk})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not DriverFile.objects.filter(pk=doc.pk).exists()

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("driver-file-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ── TruckFile ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestTruckFileViews:
    def test_list(self, auth_client):
        TruckFileFactory()
        response = auth_client.get(reverse("truck-file-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_filter_by_truck(self, auth_client):
        t1 = TruckFactory()
        t2 = TruckFactory()
        TruckFileFactory(truck=t1)
        TruckFileFactory(truck=t2)
        response = auth_client.get(reverse("truck-file-list") + f"?truck={t1.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(r["truck"] == t1.pk for r in response.data)

    def test_create(self, auth_client):
        truck = TruckFactory()
        from django.core.files.base import ContentFile

        response = auth_client.post(
            reverse("truck-file-list"),
            {
                "truck": truck.pk,
                "type": TruckFile.Type.REGISTRATION,
                "file": ContentFile(b"test", name="reg.pdf"),
                "expiry_date": "2027-06-01",
            },
            format="multipart",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["truck"] == truck.pk

    def test_delete(self, auth_client):
        doc = TruckFileFactory()
        response = auth_client.delete(
            reverse("truck-file-detail", kwargs={"pk": doc.pk})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("truck-file-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ── TrailerFile ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestTrailerFileViews:
    def test_list(self, auth_client):
        TrailerFileFactory()
        response = auth_client.get(reverse("trailer-file-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_filter_by_trailer(self, auth_client):
        tr1 = TrailerFactory()
        tr2 = TrailerFactory()
        TrailerFileFactory(trailer=tr1)
        TrailerFileFactory(trailer=tr2)
        response = auth_client.get(reverse("trailer-file-list") + f"?trailer={tr1.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(r["trailer"] == tr1.pk for r in response.data)

    def test_create(self, auth_client):
        trailer = TrailerFactory()
        from django.core.files.base import ContentFile

        response = auth_client.post(
            reverse("trailer-file-list"),
            {
                "trailer": trailer.pk,
                "type": TrailerFile.Type.AVI,
                "file": ContentFile(b"test", name="avi.pdf"),
                "expiry_date": "2027-03-01",
            },
            format="multipart",
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["trailer"] == trailer.pk

    def test_delete(self, auth_client):
        doc = TrailerFileFactory()
        response = auth_client.delete(
            reverse("trailer-file-detail", kwargs={"pk": doc.pk})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("trailer-file-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ── ImportRecordFile ──────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestImportRecordFileViews:
    def test_list(self, auth_client):
        ImportRecordFileFactory()
        response = auth_client.get(reverse("import-record-file-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_create(self, auth_client):
        response = auth_client.post(
            reverse("import-record-file-list"),
            {"type": ImportRecordFile.Type.PILOT, "filename": "fuel_jan.xlsx"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["filename"] == "fuel_jan.xlsx"

    def test_delete(self, auth_client):
        rec = ImportRecordFileFactory()
        response = auth_client.delete(
            reverse("import-record-file-detail", kwargs={"pk": rec.pk})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("import-record-file-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
