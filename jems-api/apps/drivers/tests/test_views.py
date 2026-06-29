import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.drivers.models import Driver
from apps.drivers.tests.factories import DriverFactory, DriverTypeFactory
from apps.users.tests.factories import AdminUserFactory, UserFactory


def make_image_file(name="photo.png"):
    buffer = io.BytesIO()
    Image.new("RGB", (1, 1)).save(buffer, format="PNG")
    buffer.seek(0)
    return SimpleUploadedFile(name, buffer.read(), content_type="image/png")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


@pytest.fixture
def admin_client(api_client):
    user = AdminUserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


@pytest.mark.django_db
class TestDriverList:
    def test_authenticated_user_can_list_drivers(self, auth_client):
        client, _ = auth_client
        DriverFactory.create_batch(3)
        response = client.get(reverse("driver-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3

    def test_terminated_drivers_excluded(self, auth_client):
        client, _ = auth_client
        DriverFactory(status=Driver.Status.ACTIVE)
        DriverFactory(status=Driver.Status.TERMINATED)
        response = client.get(reverse("driver-list"))
        for driver in response.data:
            assert driver["status"] != Driver.Status.TERMINATED

    def test_unauthenticated_cannot_list(self, api_client):
        response = api_client.get(reverse("driver-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestDriverCreate:
    def test_create_driver(self, auth_client):
        client, _ = auth_client
        driver_type = DriverTypeFactory()
        payload = {
            "first_name": "Carlos",
            "last_name": "Lopez",
            "driver_type": driver_type.pk,
            "phone": "555-1234",
            "email": "carlos@example.com",
        }
        response = client.post(reverse("driver-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["full_name"] == "Carlos Lopez"

    def test_create_fails_without_name(self, auth_client):
        client, _ = auth_client
        response = client.post(reverse("driver-list"), {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestDriverRetrieve:
    def test_retrieve_returns_full_detail(self, auth_client):
        client, _ = auth_client
        driver = DriverFactory()
        response = client.get(reverse("driver-detail", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == driver.pk
        assert "documents" in response.data


@pytest.mark.django_db
class TestDriverToggleStatus:
    def test_toggle_active_to_inactive(self, auth_client):
        client, _ = auth_client
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        response = client.post(
            reverse("driver-toggle-status", kwargs={"pk": driver.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == Driver.Status.INACTIVE


@pytest.mark.django_db
class TestDriverDelete:
    def test_delete_marks_as_terminated(self, auth_client):
        client, _ = auth_client
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        response = client.delete(reverse("driver-detail", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        driver.refresh_from_db()
        assert driver.status == Driver.Status.TERMINATED


@pytest.mark.django_db
class TestDriverTypes:
    def test_list_driver_types(self, auth_client):
        client, _ = auth_client
        DriverTypeFactory.create_batch(3)
        response = client.get(reverse("driver-type-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3


@pytest.mark.django_db
class TestDriverPhoto:
    def test_upload_photo(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        driver = DriverFactory()
        response = client.post(
            reverse("driver-photo", kwargs={"pk": driver.pk}),
            {"photo": make_image_file()},
            format="multipart",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["photo"]
        driver.refresh_from_db()
        assert driver.photo

    def test_upload_rejects_non_image(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        driver = DriverFactory()
        bad = SimpleUploadedFile("x.txt", b"not an image", content_type="text/plain")
        response = client.post(
            reverse("driver-photo", kwargs={"pk": driver.pk}),
            {"photo": bad},
            format="multipart",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_without_file_is_rejected(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        driver = DriverFactory()
        response = client.post(
            reverse("driver-photo", kwargs={"pk": driver.pk}),
            {},
            format="multipart",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_photo(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        driver = DriverFactory(photo=make_image_file())
        response = client.delete(reverse("driver-photo", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_200_OK
        driver.refresh_from_db()
        assert not driver.photo

    def test_delete_photo_is_noop_when_absent(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        driver = DriverFactory()
        response = client.delete(reverse("driver-photo", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_200_OK


def make_pdf_file(name="doc.pdf"):
    return SimpleUploadedFile(name, b"%PDF-1.4 fake", content_type="application/pdf")


@pytest.mark.django_db
class TestDriverDocuments:
    def _upload(self, client, driver, document_type, **extra):
        return client.post(
            reverse("driver-documents", kwargs={"pk": driver.pk}),
            {"document_type": document_type, "file": make_pdf_file(), **extra},
            format="multipart",
        )

    def test_upload_document(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        driver = DriverFactory()
        response = self._upload(client, driver, 1, expiration_date="2030-01-01")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["document_type"] == 1
        assert response.data["document_type_display"] == "License"
        assert response.data["expiration_date"] == "2030-01-01"

    def test_upload_legacy_parity_type(self, auth_client, settings, tmp_path):
        # Type 7 (Social Security Card) was added for legacy parity — must work.
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        driver = DriverFactory()
        response = self._upload(client, driver, 7)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["document_type_display"] == "Social Security Card"

    def test_upload_rejects_invalid_type(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        driver = DriverFactory()
        response = self._upload(client, driver, 99)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_upload_requires_file(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        driver = DriverFactory()
        response = client.post(
            reverse("driver-documents", kwargs={"pk": driver.pk}),
            {"document_type": 1},
            format="multipart",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_list_documents(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        driver = DriverFactory()
        self._upload(client, driver, 1)
        self._upload(client, driver, 2)
        response = client.get(reverse("driver-documents", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_delete_document(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        driver = DriverFactory()
        doc_id = self._upload(client, driver, 1).data["id"]
        response = client.delete(
            reverse("driver-document-detail", kwargs={"pk": doc_id})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        # second delete → gone
        again = client.delete(reverse("driver-document-detail", kwargs={"pk": doc_id}))
        assert again.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestDriverLastVehicle:
    def test_unauthenticated_rejected(self, api_client):
        from apps.drivers.tests.factories import DriverFactory

        driver = DriverFactory()
        response = api_client.get(
            reverse("driver-last-vehicle", kwargs={"pk": driver.pk})
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_returns_empty_when_no_loads(self, auth_client):
        from apps.drivers.tests.factories import DriverFactory

        client, _ = auth_client
        driver = DriverFactory()
        response = client.get(reverse("driver-last-vehicle", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["last_truck_id"] is None
        assert response.data["last_trailer_id"] is None
        assert isinstance(response.data["trucks"], list)
        assert isinstance(response.data["trailers"], list)

    def test_returns_last_truck_and_trailer_from_most_recent_load(self, auth_client):
        import datetime
        from django.utils import timezone
        from apps.drivers.tests.factories import DriverFactory
        from apps.loads.tests.factories import (
            LoadFactory,
            TruckFactory,
            TrailerFactory,
        )
        from apps.fleet.models import Truck, Trailer

        client, _ = auth_client
        driver = DriverFactory()
        truck = TruckFactory(status=Truck.Status.ACTIVE)
        trailer = TrailerFactory(status=Trailer.Status.ACTIVE, is_rented=False)

        LoadFactory(
            driver=driver,
            truck=truck,
            trailer=trailer,
            dropoff_date=timezone.now() - datetime.timedelta(days=1),
        )

        response = client.get(reverse("driver-last-vehicle", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["last_truck_id"] == truck.pk
        assert response.data["last_trailer_id"] == trailer.pk

    def test_active_trucks_and_trailers_included(self, auth_client):
        from apps.drivers.tests.factories import DriverFactory
        from apps.loads.tests.factories import TruckFactory, TrailerFactory
        from apps.fleet.models import Truck, Trailer

        client, _ = auth_client
        driver = DriverFactory()
        TruckFactory(status=Truck.Status.ACTIVE)
        TruckFactory(status=Truck.Status.INACTIVE)
        TrailerFactory(status=Trailer.Status.ACTIVE, is_rented=False)
        TrailerFactory(status=Trailer.Status.ACTIVE, is_rented=True)

        response = client.get(reverse("driver-last-vehicle", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_200_OK
        truck_ids = [t["id"] for t in response.data["trucks"]]
        trailer_ids = [t["id"] for t in response.data["trailers"]]
        # inactive truck not included
        inactive = Truck.objects.filter(status=Truck.Status.INACTIVE).first()
        assert inactive.pk not in truck_ids
        # rented trailer not included
        rented = Trailer.objects.filter(is_rented=True).first()
        assert rented.pk not in trailer_ids


@pytest.mark.django_db
class TestDriverLastLoads:
    def test_returns_200(self, auth_client):
        from apps.loads.tests.factories import LoadFactory

        client, _ = auth_client
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True)
        response = client.get(reverse("driver-last-loads"))
        assert response.status_code == status.HTTP_200_OK

    def test_returns_list(self, auth_client):
        from apps.loads.tests.factories import LoadFactory

        client, _ = auth_client
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True)
        response = client.get(reverse("driver-last-loads"))
        assert isinstance(response.data, list)
        assert len(response.data) >= 1

    def test_each_entry_has_expected_keys(self, auth_client):
        from apps.loads.tests.factories import LoadFactory

        client, _ = auth_client
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True)
        response = client.get(reverse("driver-last-loads"))
        entry = response.data[0]
        assert "id" in entry
        assert "full_name" in entry
        assert "last_load" in entry
        assert "current_load" in entry

    def test_excludes_inactive_drivers(self, auth_client):
        from apps.loads.tests.factories import LoadFactory

        client, _ = auth_client
        driver = DriverFactory(status=Driver.Status.INACTIVE)
        LoadFactory(driver=driver, execute=True)
        response = client.get(reverse("driver-last-loads"))
        ids = [r["id"] for r in response.data]
        assert driver.pk not in ids

    def test_unauthenticated_blocked(self):
        api_client = APIClient()
        response = api_client.get(reverse("driver-last-loads"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_response_has_location_field(self, auth_client):
        from apps.loads.tests.factories import LoadFactory

        client, _ = auth_client
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver, execute=True)
        response = client.get(reverse("driver-last-loads"))
        assert response.status_code == status.HTTP_200_OK
        entry = response.data[0]
        assert "location" in entry

    def test_dispatcher_filter_returns_only_matching_drivers(self, auth_client):
        from apps.loads.tests.factories import LoadFactory
        from apps.users.tests.factories import DispatcherFactory

        client, _ = auth_client
        dispatcher = DispatcherFactory()
        other_dispatcher = DispatcherFactory()
        driver_a = DriverFactory(status=Driver.Status.ACTIVE)
        driver_b = DriverFactory(status=Driver.Status.ACTIVE)
        LoadFactory(driver=driver_a, execute=True, dispatcher=dispatcher)
        LoadFactory(driver=driver_b, execute=True, dispatcher=other_dispatcher)

        response = client.get(
            reverse("driver-last-loads"), {"dispatcher_id": dispatcher.pk}
        )
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert driver_a.pk in ids
        assert driver_b.pk not in ids

    def test_invalid_dispatcher_id_returns_400(self, auth_client):
        client, _ = auth_client
        response = client.get(
            reverse("driver-last-loads"), {"dispatcher_id": "not-a-number"}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "dispatcher_id" in response.data


@pytest.mark.django_db
class TestDriverBulkDelete:
    def test_terminates_listed_drivers(self, auth_client):
        client, _ = auth_client
        d1 = DriverFactory(status=Driver.Status.ACTIVE)
        d2 = DriverFactory(status=Driver.Status.ACTIVE)
        response = client.post(
            reverse("driver-bulk-delete"), {"ids": [d1.pk, d2.pk]}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert set(response.data["terminated"]) == {d1.pk, d2.pk}
        assert response.data["not_found"] == []
        d1.refresh_from_db()
        d2.refresh_from_db()
        assert d1.status == Driver.Status.TERMINATED
        assert d2.status == Driver.Status.TERMINATED

    def test_not_found_ids_reported_separately(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("driver-bulk-delete"), {"ids": [99999]}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["not_found"] == [99999]
        assert response.data["terminated"] == []

    def test_empty_ids_returns_400(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("driver-bulk-delete"), {"ids": []}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "ids" in response.data

    def test_non_list_ids_returns_400(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("driver-bulk-delete"), {"ids": "not-a-list"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_non_integer_ids_returns_400(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("driver-bulk-delete"), {"ids": ["abc", 1]}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_blocked(self):
        api_client = APIClient()
        response = api_client.post(
            reverse("driver-bulk-delete"), {"ids": [1]}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_ids_field_returns_400(self, auth_client):
        client, _ = auth_client
        response = client.post(reverse("driver-bulk-delete"), {}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
