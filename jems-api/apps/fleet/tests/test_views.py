import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.fleet.models import Trailer, Truck
from apps.fleet.tests.factories import (
    TrailerFactory,
    TrailerTypeFactory,
    TruckFactory,
    TruckOwnerFactory,
    TruckTypeFactory,
)
from apps.users.tests.factories import UserFactory


def make_image_file(name="photo.png"):
    buffer = io.BytesIO()
    Image.new("RGB", (1, 1)).save(buffer, format="PNG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="image/png")


def make_pdf_file(name="doc.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 fake", content_type="application/pdf")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


@pytest.mark.django_db
class TestTruckList:
    def test_lists_active_trucks(self, auth_client):
        client, _ = auth_client
        TruckFactory.create_batch(3, status=Truck.Status.ACTIVE)
        TruckFactory(status=Truck.Status.INACTIVE)
        response = client.get(reverse("truck-list"))
        assert response.status_code == status.HTTP_200_OK
        for truck in response.data:
            assert truck["status"] == Truck.Status.ACTIVE

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("truck-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTruckCreate:
    def test_create_truck(self, auth_client):
        client, _ = auth_client
        truck_type = TruckTypeFactory()
        payload = {"number": "TRK-9999", "truck_type": truck_type.pk, "year": 2023}
        response = client.post(reverse("truck-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["number"] == "TRK-9999"

    def test_duplicate_number_rejected(self, auth_client):
        client, _ = auth_client
        TruckFactory(number="DUPLICATE")
        response = client.post(reverse("truck-list"), {"number": "DUPLICATE"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTruckRetrieve:
    def test_retrieve_includes_maintenance(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        response = client.get(reverse("truck-detail", kwargs={"pk": truck.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert "maintenance_records" in response.data


@pytest.mark.django_db
class TestTruckToggleStatus:
    def test_toggle_active_to_inactive(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory(status=Truck.Status.ACTIVE)
        response = client.post(reverse("truck-toggle-status", kwargs={"pk": truck.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == Truck.Status.INACTIVE


@pytest.mark.django_db
class TestTruckMaintenance:
    def test_add_maintenance_record(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        payload = {
            "date": "2024-01-15",
            "miles_alert": 10000,
            "time_alert": 6,
            "time_year": 0,
            "time_month": 6,
            "odometer_start": 100000,
            "odometer_current": 100000,
        }
        response = client.post(
            reverse("truck-maintenance", kwargs={"pk": truck.pk}), payload
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_list_maintenance_records(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        response = client.get(reverse("truck-maintenance", kwargs={"pk": truck.pk}))
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTruckFiles:
    def _url(self, truck, slot):
        return reverse("truck-file", kwargs={"pk": truck.pk, "slot": slot})

    @pytest.mark.parametrize("slot", ["avi", "registration", "agreement", "leased"])
    def test_upload_document_slots(self, auth_client, settings, tmp_path, slot):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        truck = TruckFactory()
        response = client.post(
            self._url(truck, slot), {"file": make_pdf_file()}, format="multipart"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data[f"{slot}_file"]

    def test_upload_photo_slot(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        truck = TruckFactory()
        response = client.post(
            self._url(truck, "photo"), {"file": make_image_file()}, format="multipart"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["photo"]

    def test_photo_slot_rejects_non_image(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        truck = TruckFactory()
        response = client.post(
            self._url(truck, "photo"), {"file": make_pdf_file()}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unknown_slot_is_rejected(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        truck = TruckFactory()
        response = client.post(
            self._url(truck, "bogus"), {"file": make_pdf_file()}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_requires_file(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        truck = TruckFactory()
        response = client.post(self._url(truck, "avi"), {}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_clear_file(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        truck = TruckFactory(avi_file=make_pdf_file())
        response = client.delete(self._url(truck, "avi"))
        assert response.status_code == status.HTTP_200_OK
        truck.refresh_from_db()
        assert not truck.avi_file

    def test_clear_is_noop_when_absent(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        truck = TruckFactory()
        response = client.delete(self._url(truck, "agreement"))
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTrailerList:
    def test_lists_active_trailers(self, auth_client):
        client, _ = auth_client
        TrailerFactory.create_batch(2, status=Trailer.Status.ACTIVE)
        TrailerFactory(status=Trailer.Status.INACTIVE)
        response = client.get(reverse("trailer-list"))
        assert response.status_code == status.HTTP_200_OK
        for trailer in response.data:
            assert trailer["status"] == Trailer.Status.ACTIVE

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("trailer-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTrailerCreate:
    def test_create_trailer(self, auth_client):
        client, _ = auth_client
        trailer_type = TrailerTypeFactory()
        payload = {"number": "TRL-8888", "trailer_type": trailer_type.pk, "year": 2022}
        response = client.post(reverse("trailer-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["number"] == "TRL-8888"

    def test_duplicate_number_rejected(self, auth_client):
        client, _ = auth_client
        TrailerFactory(number="TRL-DUP")
        response = client.post(reverse("trailer-list"), {"number": "TRL-DUP"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTrailerRetrieve:
    def test_retrieve_includes_maintenance(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory()
        response = client.get(reverse("trailer-detail", kwargs={"pk": trailer.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert "maintenance_records" in response.data

    def test_retrieve_includes_carrier_owner_fields(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory()
        response = client.get(reverse("trailer-detail", kwargs={"pk": trailer.pk}))
        assert response.status_code == status.HTTP_200_OK
        for field in ("carrier", "owner", "carrier_start_date", "carrier_end_date"):
            assert field in response.data


@pytest.mark.django_db
class TestTrailerToggleStatus:
    def test_toggle_active_to_inactive(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory(status=Trailer.Status.ACTIVE)
        response = client.post(
            reverse("trailer-toggle-status", kwargs={"pk": trailer.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == Trailer.Status.INACTIVE


@pytest.mark.django_db
class TestTrailerDestroy:
    def test_soft_deletes_trailer(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory(status=Trailer.Status.ACTIVE)
        response = client.delete(reverse("trailer-detail", kwargs={"pk": trailer.pk}))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        trailer.refresh_from_db()
        assert trailer.status == Trailer.Status.INACTIVE


@pytest.mark.django_db
class TestTrailerOptions:
    def test_returns_active_non_rented(self, auth_client):
        client, _ = auth_client
        TrailerFactory(status=Trailer.Status.ACTIVE, is_rented=False)
        TrailerFactory(status=Trailer.Status.ACTIVE, is_rented=True)
        TrailerFactory(status=Trailer.Status.INACTIVE, is_rented=False)
        response = client.get(reverse("trailer-options"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["id"] is not None


@pytest.mark.django_db
class TestTrailerMaintenance:
    def test_add_maintenance_record(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory()
        payload = {"date": "2024-06-01", "miles": 50000, "detail": "Oil change"}
        response = client.post(
            reverse("trailer-maintenance", kwargs={"pk": trailer.pk}), payload
        )
        assert response.status_code == status.HTTP_201_CREATED

    def test_list_maintenance_records(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory()
        response = client.get(reverse("trailer-maintenance", kwargs={"pk": trailer.pk}))
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTrailerFiles:
    def _url(self, trailer, slot):
        return reverse("trailer-file", kwargs={"pk": trailer.pk, "slot": slot})

    @pytest.mark.parametrize("slot", ["annual_inspection", "registration", "agreement"])
    def test_upload_document_slots(self, auth_client, settings, tmp_path, slot):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        trailer = TrailerFactory()
        response = client.post(
            self._url(trailer, slot), {"file": make_pdf_file()}, format="multipart"
        )
        assert response.status_code == status.HTTP_200_OK
        field = f"{slot}_file"
        assert response.data[field]

    def test_unknown_slot_is_rejected(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        trailer = TrailerFactory()
        response = client.post(
            self._url(trailer, "bogus"), {"file": make_pdf_file()}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_requires_file(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        trailer = TrailerFactory()
        response = client.post(
            self._url(trailer, "registration"), {}, format="multipart"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_clear_file(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        trailer = TrailerFactory(agreement_file=make_pdf_file())
        response = client.delete(self._url(trailer, "agreement"))
        assert response.status_code == status.HTTP_200_OK
        trailer.refresh_from_db()
        assert not trailer.agreement_file

    def test_clear_is_noop_when_absent(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        trailer = TrailerFactory()
        response = client.delete(self._url(trailer, "registration"))
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestTruckOwnerList:
    def test_lists_active_owners(self, auth_client):
        client, _ = auth_client
        TruckOwnerFactory.create_batch(2)
        response = client.get(reverse("truck-owner-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 2


# ── Accident Views ────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestAccidentList:
    def test_lists_accidents(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory

        client, _ = auth_client
        AccidentFactory.create_batch(3)
        response = client.get(reverse("accident-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3

    def test_filter_by_truck(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory, TruckFactory

        client, _ = auth_client
        truck = TruckFactory()
        AccidentFactory(truck=truck)
        AccidentFactory()
        response = client.get(reverse("accident-list") + f"?truck={truck.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(a["truck"] == truck.pk for a in response.data)

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("accident-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestAccidentCreate:
    def test_creates_accident(self, auth_client):
        from apps.fleet.tests.factories import (
            TruckFactory,
            TrailerFactory,
            DriverFactory,
        )

        client, user = auth_client
        truck = TruckFactory()
        trailer = TrailerFactory()
        driver = DriverFactory()
        payload = {
            "date": "2024-03-15T14:30:00Z",
            "truck": truck.pk,
            "trailer": trailer.pk,
            "driver": driver.pk,
            "address": "I-10 Mile 45",
            "crash_number": "FMCSA-TEST-001",
            "tow_aways": False,
            "death_count": 0,
            "fatal_injuries": 0,
        }
        response = client.post(reverse("accident-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["crash_number"] == "FMCSA-TEST-001"


@pytest.mark.django_db
class TestAccidentDetail:
    def test_retrieves_accident(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory

        client, _ = auth_client
        accident = AccidentFactory()
        response = client.get(reverse("accident-detail", kwargs={"pk": accident.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == accident.pk

    def test_updates_crash_number(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory

        client, _ = auth_client
        accident = AccidentFactory(crash_number="OLD-001")
        response = client.patch(
            reverse("accident-detail", kwargs={"pk": accident.pk}),
            {"crash_number": "NEW-002"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["crash_number"] == "NEW-002"

    def test_deletes_accident(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory

        client, _ = auth_client
        accident = AccidentFactory()
        response = client.delete(reverse("accident-detail", kwargs={"pk": accident.pk}))
        assert response.status_code == status.HTTP_204_NO_CONTENT
