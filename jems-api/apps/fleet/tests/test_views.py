import datetime
import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from apps.fleet.models import Trailer, Truck, TruckMaintenance
from apps.fleet.tests.factories import (
    TrailerFactory,
    TrailerMaintenanceFactory,
    TrailerStoredFileFactory,
    TrailerTypeFactory,
    TruckFactory,
    TruckMaintenanceFactory,
    TruckOwnerFactory,
    TruckStoredFileFactory,
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
    def test_lists_active_and_inactive_trucks(self, auth_client):
        client, _ = auth_client
        owner = TruckOwnerFactory(first_name="Express", last_name="Fleet")
        active = TruckFactory(status=Truck.Status.ACTIVE)
        inactive = TruckFactory(status=Truck.Status.INACTIVE, owner=owner)
        response = client.get(reverse("truck-list"))
        assert response.status_code == status.HTTP_200_OK
        ids = [truck["id"] for truck in response.data]
        assert active.pk in ids
        assert inactive.pk in ids
        assert response.data[0]["status"] == Truck.Status.ACTIVE
        inactive_row = next(
            truck for truck in response.data if truck["id"] == inactive.pk
        )
        assert inactive_row["owner_name"] == "Express Fleet"

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
        assert TruckMaintenance.objects.filter(
            truck_id=response.data["id"], detail="Automatic Maintenance"
        ).exists()

    def test_duplicate_number_rejected(self, auth_client):
        client, _ = auth_client
        TruckFactory(number="DUPLICATE")
        response = client.post(reverse("truck-list"), {"number": "DUPLICATE"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_leased_truck_requires_owner(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("truck-list"), {"number": "LEASED-1", "is_leased": True}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert response.data["owner"][0] == "Owner cannot be blank."


@pytest.mark.django_db
class TestTruckRetrieve:
    def test_retrieve_includes_maintenance(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        response = client.get(reverse("truck-detail", kwargs={"pk": truck.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert "maintenance_records" in response.data

    def test_retrieve_includes_stored_files_and_report_fields(self, auth_client):
        client, _ = auth_client
        stored = TruckStoredFileFactory()
        response = client.get(reverse("truck-detail", kwargs={"pk": stored.truck.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert "stored_files" in response.data
        assert "odometer_start" in response.data
        assert "eld_id" in response.data
        assert "factoring_account_id" in response.data


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

    def test_store_file_moves_avi_to_history(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        truck = TruckFactory(
            avi_file=make_pdf_file("avi.pdf"),
            avi_expiration=datetime.date(2026, 1, 1),
        )
        response = client.post(
            reverse("truck-store-file", kwargs={"pk": truck.pk, "slot": "avi"})
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["type"] == 1
        truck.refresh_from_db()
        assert not truck.avi_file

    def test_store_unknown_slot_is_rejected(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        response = client.post(
            reverse("truck-store-file", kwargs={"pk": truck.pk, "slot": "leased"})
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_stored_file(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        stored = TruckStoredFileFactory()
        response = client.delete(
            reverse(
                "truck-stored-file",
                kwargs={"pk": stored.truck.pk, "file_id": stored.pk},
            )
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestTrailerList:
    def test_lists_active_and_inactive_trailers_ordered(self, auth_client):
        client, _ = auth_client
        active = TrailerFactory(status=Trailer.Status.ACTIVE)
        inactive = TrailerFactory(status=Trailer.Status.INACTIVE)
        response = client.get(reverse("trailer-list"))
        assert response.status_code == status.HTTP_200_OK
        ids = [trailer["id"] for trailer in response.data]
        assert active.pk in ids
        assert inactive.pk in ids
        assert response.data[0]["status"] == Trailer.Status.ACTIVE
        assert ids.index(active.pk) < ids.index(inactive.pk)

    def test_includes_drop_label(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory()
        response = client.get(reverse("trailer-list"))
        assert response.status_code == status.HTTP_200_OK
        row = next(row for row in response.data if row["id"] == trailer.pk)
        assert row["drop_label"] == "In Yard"

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

    def test_retrieve_includes_stored_files(self, auth_client):
        client, _ = auth_client
        stored = TrailerStoredFileFactory()
        response = client.get(
            reverse("trailer-detail", kwargs={"pk": stored.trailer.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert "stored_files" in response.data
        assert len(response.data["stored_files"]) == 1

    def test_retrieve_owner_name_does_not_error(self, auth_client):
        client, _ = auth_client
        owner = TruckOwnerFactory(first_name="Express", last_name="Fleet")
        trailer = TrailerFactory(owner=owner)
        response = client.get(reverse("trailer-detail", kwargs={"pk": trailer.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["owner_name"] == "Express Fleet"


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

    def test_store_file_moves_ai_to_history(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        trailer = TrailerFactory(
            annual_inspection_file=make_pdf_file("ai.pdf"),
            annual_inspection_expiration=datetime.date(2026, 1, 1),
        )
        response = client.post(
            reverse(
                "trailer-store-file",
                kwargs={"pk": trailer.pk, "slot": "annual_inspection"},
            )
        )
        assert response.status_code == status.HTTP_201_CREATED
        trailer.refresh_from_db()
        assert not trailer.annual_inspection_file

    def test_store_unknown_slot_is_rejected(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory()
        response = client.post(
            reverse(
                "trailer-store-file", kwargs={"pk": trailer.pk, "slot": "registration"}
            )
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_store_without_existing_file_is_rejected(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory(annual_inspection_expiration=datetime.date(2026, 1, 1))
        response = client.post(
            reverse(
                "trailer-store-file",
                kwargs={"pk": trailer.pk, "slot": "annual_inspection"},
            )
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_delete_stored_file(self, auth_client, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        client, _ = auth_client
        stored = TrailerStoredFileFactory()
        response = client.delete(
            reverse(
                "trailer-stored-file",
                kwargs={"pk": stored.trailer.pk, "file_id": stored.pk},
            )
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestTrailerInDrop:
    def test_returns_only_trailers_currently_in_drop(self, auth_client):
        from apps.loads.models import Load
        from apps.loads.tests.factories import LoadFactory
        import django.utils.timezone as tz

        in_drop = TrailerFactory(status=Trailer.Status.ACTIVE, is_rented=False)
        LoadFactory(
            trailer=in_drop,
            pickup_date=tz.make_aware(
                datetime.datetime.combine(datetime.date.today(), datetime.time.min)
            ),
            dropoff_date=tz.make_aware(
                datetime.datetime.combine(
                    datetime.date.today() + datetime.timedelta(days=10),
                    datetime.time.min,
                )
            ),
            is_drop=True,
            drop_place=Load.DropPlace.PICKUP,
            days_in_drop=5,
        )
        not_in_drop = TrailerFactory(status=Trailer.Status.ACTIVE, is_rented=False)
        TrailerFactory(status=Trailer.Status.INACTIVE, is_rented=False)
        TrailerFactory(status=Trailer.Status.ACTIVE, is_rented=True)

        client, _ = auth_client
        response = client.get(reverse("trailer-in-drop"))
        assert response.status_code == status.HTTP_200_OK
        trailer_ids = [row["trailer_id"] for row in response.data]
        assert in_drop.pk in trailer_ids
        assert not_in_drop.pk not in trailer_ids

    def test_returns_empty_when_none_in_drop(self, auth_client):
        TrailerFactory(status=Trailer.Status.ACTIVE, is_rented=False)
        client, _ = auth_client
        response = client.get(reverse("trailer-in-drop"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []


@pytest.mark.django_db
class TestTrailerAviPdf:
    def test_returns_pdf(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory(
            number="TR-4521",
            vin="1JJV532D4ML240740",
            annual_inspection_expiration=datetime.date(2026, 12, 15),
        )
        response = client.get(reverse("trailer-avi-pdf", kwargs={"pk": trailer.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "application/pdf"
        assert b"".join(response.streaming_content).startswith(b"%PDF")

    def test_returns_pdf_with_blank_fields(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory(number="TR-BLANK")
        response = client.get(reverse("trailer-avi-pdf", kwargs={"pk": trailer.pk}))
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

    def test_filter_by_driver(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory, DriverFactory

        client, _ = auth_client
        driver = DriverFactory()
        AccidentFactory(driver=driver)
        AccidentFactory()
        response = client.get(reverse("accident-list") + f"?driver={driver.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(a["driver"] == driver.pk for a in response.data)

    def test_filter_by_trailer(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory, TrailerFactory

        client, _ = auth_client
        trailer = TrailerFactory()
        AccidentFactory(trailer=trailer)
        AccidentFactory()
        response = client.get(reverse("accident-list") + f"?trailer={trailer.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(a["trailer"] == trailer.pk for a in response.data)

    def test_filter_by_date_range(self, auth_client):
        import datetime
        from apps.fleet.tests.factories import AccidentFactory

        client, _ = auth_client
        AccidentFactory(
            date=datetime.datetime(2024, 1, 15, tzinfo=datetime.timezone.utc)
        )
        AccidentFactory(
            date=datetime.datetime(2024, 6, 1, tzinfo=datetime.timezone.utc)
        )
        AccidentFactory(
            date=datetime.datetime(2024, 12, 31, tzinfo=datetime.timezone.utc)
        )

        response = client.get(
            reverse("accident-list")
            + "?date_type=1&date_from=2024-01-01&date_to=2024-06-30"
        )
        assert response.status_code == status.HTTP_200_OK
        dates = [a["date"][:10] for a in response.data]
        assert all(d <= "2024-06-30" for d in dates)

    def test_date_type_show_all_ignores_date_range(self, auth_client):
        import datetime
        from apps.fleet.tests.factories import AccidentFactory

        client, _ = auth_client
        old = AccidentFactory(
            date=datetime.datetime(2023, 1, 15, tzinfo=datetime.timezone.utc)
        )
        current = AccidentFactory(
            date=datetime.datetime(2024, 6, 1, tzinfo=datetime.timezone.utc)
        )
        response = client.get(
            reverse("accident-list")
            + "?date_type=3&date_from=2024-01-01&date_to=2024-12-31"
        )
        assert response.status_code == status.HTTP_200_OK
        ids = {row["id"] for row in response.data}
        assert old.pk in ids
        assert current.pk in ids

    def test_filter_by_search_crash_number(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory

        client, _ = auth_client
        AccidentFactory(crash_number="FMCSA-SPECIAL-999")
        AccidentFactory(crash_number="OTHER-001")
        response = client.get(reverse("accident-list") + "?search=SPECIAL")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["crash_number"] == "FMCSA-SPECIAL-999"

    def test_filter_by_search_address(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory

        client, _ = auth_client
        AccidentFactory(address="Interstate 95 MM 42")
        AccidentFactory(address="Route 66")
        response = client.get(reverse("accident-list") + "?search=interstate")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert "Interstate" in response.data[0]["address"]

    def test_response_includes_driver_name(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory, DriverFactory

        client, _ = auth_client
        driver = DriverFactory(first_name="John", last_name="Doe")
        AccidentFactory(driver=driver)
        response = client.get(reverse("accident-list"))
        assert response.status_code == status.HTTP_200_OK
        row = next(a for a in response.data if a["driver"] == driver.pk)
        assert row["driver_name"] == "John Doe"

    def test_response_includes_truck_number(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory, TruckFactory

        client, _ = auth_client
        truck = TruckFactory(number="4279")
        AccidentFactory(truck=truck)
        response = client.get(reverse("accident-list"))
        assert response.status_code == status.HTTP_200_OK
        row = next(a for a in response.data if a["truck"] == truck.pk)
        assert row["truck_number"] == "4279"

    def test_response_includes_picture_count(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory
        from apps.fleet.models import AccidentPicture
        from django.core.files.base import ContentFile

        client, _ = auth_client
        accident = AccidentFactory()
        img = ContentFile(
            b"GIF87a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;",
            name="t.gif",
        )
        AccidentPicture.objects.create(accident=accident, file=img, rank=0)

        response = client.get(reverse("accident-list"))
        assert response.status_code == status.HTTP_200_OK
        row = next(a for a in response.data if a["id"] == accident.pk)
        assert row["picture_count"] == 1

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("accident-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestAccidentBulkDelete:
    def test_bulk_delete_removes_selected_accidents(self, auth_client):
        from apps.fleet.models import Accident
        from apps.fleet.tests.factories import AccidentFactory

        client, _ = auth_client
        first = AccidentFactory()
        second = AccidentFactory()
        response = client.post(
            reverse("accident-bulk-delete"),
            {"ids": [first.pk, second.pk]},
            format="json",
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Accident.objects.filter(pk__in=[first.pk, second.pk]).exists()

    def test_bulk_delete_empty_ids_rejected(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("accident-bulk-delete"), {"ids": []}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_bulk_delete_requires_list(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("accident-bulk-delete"),
            {"ids": "1,2"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_bulk_delete_unauthenticated_blocked(self, api_client):
        response = api_client.post(
            reverse("accident-bulk-delete"), {"ids": [1]}, format="json"
        )
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

    def test_detail_includes_resolved_names(self, auth_client):
        from apps.fleet.tests.factories import (
            AccidentFactory,
            TruckFactory,
            DriverFactory,
        )

        client, _ = auth_client
        truck = TruckFactory(number="8888")
        driver = DriverFactory(first_name="Maria", last_name="Lopez")
        accident = AccidentFactory(truck=truck, driver=driver)
        response = client.get(reverse("accident-detail", kwargs={"pk": accident.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["truck_number"] == "8888"
        assert response.data["driver_name"] == "Maria Lopez"


@pytest.mark.django_db
class TestAccidentFileSlots:
    def test_upload_police_report(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory
        from django.core.files.base import ContentFile

        client, _ = auth_client
        accident = AccidentFactory()
        img = ContentFile(b"%PDF-1.4 test", name="report.pdf")
        response = client.post(
            reverse(
                "accident-file", kwargs={"pk": accident.pk, "slot": "police_report"}
            ),
            {"file": img},
            format="multipart",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["police_report_file"] is not None

    def test_upload_post_accident(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory
        from django.core.files.base import ContentFile

        client, _ = auth_client
        accident = AccidentFactory()
        f = ContentFile(b"%PDF-1.4 test", name="post.pdf")
        response = client.post(
            reverse(
                "accident-file", kwargs={"pk": accident.pk, "slot": "post_accident"}
            ),
            {"file": f},
            format="multipart",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["post_accident_file"] is not None

    def test_clear_police_report(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory
        from django.core.files.base import ContentFile

        client, _ = auth_client
        accident = AccidentFactory()
        accident.police_report_file.save("r.pdf", ContentFile(b"%PDF"), save=True)

        response = client.delete(
            reverse(
                "accident-file", kwargs={"pk": accident.pk, "slot": "police_report"}
            )
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        accident.refresh_from_db()
        assert not accident.police_report_file

    def test_unknown_slot_returns_400(self, auth_client):
        from apps.fleet.tests.factories import AccidentFactory
        from django.core.files.base import ContentFile

        client, _ = auth_client
        accident = AccidentFactory()
        f = ContentFile(b"data", name="x.pdf")
        response = client.post(
            reverse(
                "accident-file", kwargs={"pk": accident.pk, "slot": "invalid_slot"}
            ),
            {"file": f},
            format="multipart",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_blocked(self, api_client):
        from apps.fleet.tests.factories import AccidentFactory

        accident = AccidentFactory()
        response = api_client.post(
            reverse(
                "accident-file", kwargs={"pk": accident.pk, "slot": "police_report"}
            )
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ── Standalone TruckMaintenance Views ─────────────────────────────────────────


@pytest.mark.django_db
class TestTruckMaintenanceList:
    def test_lists_all_records_descending(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 1, 1))
        TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 3, 1))
        response = client.get(reverse("truck-maint-list"))
        assert response.status_code == status.HTTP_200_OK
        dates = [r["date"] for r in response.data]
        assert dates == sorted(dates, reverse=True)

    def test_filter_by_truck(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        other = TruckFactory()
        TruckMaintenanceFactory(truck=truck)
        TruckMaintenanceFactory(truck=other)
        response = client.get(reverse("truck-maint-list") + f"?truck={truck.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(r["truck"] == truck.pk for r in response.data)

    def test_filter_by_date_range(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 1, 5))
        TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 3, 15))
        response = client.get(
            reverse("truck-maint-list") + "?date_from=2024-03-01&date_to=2024-03-31"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["date"] == "2024-03-15"

    def test_search_by_truck_number(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory(number="SEARCH-001")
        other = TruckFactory(number="OTHER-999")
        TruckMaintenanceFactory(truck=truck)
        TruckMaintenanceFactory(truck=other)
        response = client.get(reverse("truck-maint-list") + "?search=SEARCH")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1

    def test_response_includes_truck_number(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory(number="T-99")
        TruckMaintenanceFactory(truck=truck)
        response = client.get(reverse("truck-maint-list"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]["truck_number"] == "T-99"

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("truck-maint-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTruckMaintenanceCreate:
    def test_creates_record(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        payload = {
            "truck": truck.pk,
            "date": "2024-05-10",
            "detail": "Full service",
            "miles_alert": 1,
            "maintenance_miles": 13000.0,
            "time_alert": 0,
            "time_year": 0,
            "time_month": 0,
            "odometer_start": 100000.0,
            "odometer_current": 100000.0,
        }
        response = client.post(reverse("truck-maint-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["truck"] == truck.pk
        assert response.data["truck_number"] == truck.number

    def test_duplicate_date_rejected(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 5, 10))
        payload = {"truck": truck.pk, "date": "2024-05-10", "detail": "Dup"}
        response = client.post(reverse("truck-maint-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_truck_rejected(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("truck-maint-list"), {"date": "2024-05-10"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.post(reverse("truck-maint-list"), {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTruckMaintenanceRetrieve:
    def test_retrieves_record(self, auth_client):
        client, _ = auth_client
        record = TruckMaintenanceFactory(detail="Check up")
        response = client.get(reverse("truck-maint-detail", kwargs={"pk": record.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == record.pk
        assert "truck_number" in response.data
        assert "truck_odometer_current" in response.data
        assert "maintenance_miles" in response.data
        assert "is_done" in response.data
        assert "driven_miles" in response.data

    def test_returns_404_for_unknown(self, auth_client):
        client, _ = auth_client
        response = client.get(reverse("truck-maint-detail", kwargs={"pk": 99999}))
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestTruckMaintenanceUpdate:
    def test_updates_detail(self, auth_client):
        client, _ = auth_client
        record = TruckMaintenanceFactory(detail="Old")
        response = client.patch(
            reverse("truck-maint-detail", kwargs={"pk": record.pk}),
            {"detail": "New"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["detail"] == "New"

    def test_updates_alert_fields(self, auth_client):
        client, _ = auth_client
        record = TruckMaintenanceFactory(miles_alert=0, maintenance_miles=0.0)
        response = client.patch(
            reverse("truck-maint-detail", kwargs={"pk": record.pk}),
            {"miles_alert": 1, "maintenance_miles": 13000.0},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["miles_alert"] == 1
        assert response.data["maintenance_miles"] == 13000.0

    def test_duplicate_date_rejected(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 3, 1))
        m2 = TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 4, 1))
        response = client.patch(
            reverse("truck-maint-detail", kwargs={"pk": m2.pk}),
            {"date": "2024-03-01"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_404_for_unknown(self, auth_client):
        client, _ = auth_client
        response = client.patch(
            reverse("truck-maint-detail", kwargs={"pk": 99999}), {}, format="json"
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestTruckMaintenanceDelete:
    def test_deletes_record(self, auth_client):
        from apps.fleet.models import TruckMaintenance

        client, _ = auth_client
        record = TruckMaintenanceFactory()
        response = client.delete(
            reverse("truck-maint-detail", kwargs={"pk": record.pk})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not TruckMaintenance.objects.filter(pk=record.pk).exists()

    def test_returns_404_for_unknown(self, auth_client):
        client, _ = auth_client
        response = client.delete(reverse("truck-maint-detail", kwargs={"pk": 99999}))
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestTruckMaintenanceBulkDelete:
    def test_deletes_multiple_records(self, auth_client):
        from apps.fleet.models import TruckMaintenance

        client, _ = auth_client
        m1 = TruckMaintenanceFactory()
        m2 = TruckMaintenanceFactory()
        m3 = TruckMaintenanceFactory()
        response = client.post(
            reverse("truck-maint-bulk-delete"),
            {"ids": [m1.pk, m2.pk]},
            format="json",
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not TruckMaintenance.objects.filter(pk__in=[m1.pk, m2.pk]).exists()
        assert TruckMaintenance.objects.filter(pk=m3.pk).exists()

    def test_empty_ids_returns_400(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("truck-maint-bulk-delete"), {"ids": []}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTruckMaintenanceAlertInfo:
    def test_returns_alert_info(self, auth_client):
        client, _ = auth_client
        record = TruckMaintenanceFactory()
        response = client.get(
            reverse("truck-maint-alert-info", kwargs={"pk": record.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert "miles_since_maintenance" in response.data
        assert "is_last_maintenance" in response.data
        assert "total_miles_since_reset" in response.data

    def test_returns_404_for_unknown(self, auth_client):
        client, _ = auth_client
        response = client.get(reverse("truck-maint-alert-info", kwargs={"pk": 99999}))
        assert response.status_code == status.HTTP_404_NOT_FOUND


# ── Standalone TrailerMaintenance Views ───────────────────────────────────────


@pytest.mark.django_db
class TestTrailerMaintenanceList:
    def test_lists_all_records(self, auth_client):
        client, _ = auth_client
        TrailerMaintenanceFactory.create_batch(3)
        response = client.get(reverse("trailer-maint-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3

    def test_filter_by_trailer(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory()
        other = TrailerFactory()
        TrailerMaintenanceFactory(trailer=trailer)
        TrailerMaintenanceFactory(trailer=other)
        response = client.get(reverse("trailer-maint-list") + f"?trailer={trailer.pk}")
        assert all(r["trailer"] == trailer.pk for r in response.data)

    def test_response_includes_trailer_number(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory(number="TRL-99")
        TrailerMaintenanceFactory(trailer=trailer)
        response = client.get(reverse("trailer-maint-list"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]["trailer_number"] == "TRL-99"

    def test_excludes_inactive_trailers_like_legacy_index(self, auth_client):
        client, _ = auth_client
        active = TrailerFactory(status=Trailer.Status.ACTIVE)
        inactive = TrailerFactory(status=Trailer.Status.INACTIVE)
        TrailerMaintenanceFactory(trailer=active)
        inactive_record = TrailerMaintenanceFactory(trailer=inactive)

        response = client.get(reverse("trailer-maint-list"))

        assert response.status_code == status.HTTP_200_OK
        assert inactive_record.pk not in [row["id"] for row in response.data]

    def test_show_all_date_search_ignores_date_range(self, auth_client):
        client, _ = auth_client
        old = TrailerMaintenanceFactory(date=datetime.date(2023, 1, 1))

        response = client.get(
            reverse("trailer-maint-list")
            + "?date_search=3&date_from=2024-01-01&date_to=2024-01-31"
        )

        assert response.status_code == status.HTTP_200_OK
        assert old.pk in [row["id"] for row in response.data]

    def test_maintenance_date_search_applies_date_range(self, auth_client):
        client, _ = auth_client
        old = TrailerMaintenanceFactory(date=datetime.date(2023, 1, 1))
        current = TrailerMaintenanceFactory(date=datetime.date(2024, 1, 15))

        response = client.get(
            reverse("trailer-maint-list")
            + "?date_search=2&date_from=2024-01-01&date_to=2024-01-31"
        )

        ids = [row["id"] for row in response.data]
        assert current.pk in ids
        assert old.pk not in ids

    def test_response_includes_legacy_alert_messages(self, auth_client):
        client, _ = auth_client
        record = TrailerMaintenanceFactory(miles_alert=1, miles=7500)

        response = client.get(reverse("trailer-maint-list"))

        row = next(item for item in response.data if item["id"] == record.pk)
        assert row["is_last_maintenance"] is True
        assert row["miles_alert_message"].startswith("Active alert for 7500 miles")
        assert row["time_alert_message"] == "Not Alert"

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("trailer-maint-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTrailerMaintenanceCreate:
    def test_creates_record(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory()
        payload = {
            "trailer": trailer.pk,
            "date": "2024-06-20",
            "detail": "Inspection",
            "miles": 80000.0,
            "miles_alert": 1,
            "time_alert": 0,
            "time_year": 0,
            "time_month": 0,
        }
        response = client.post(reverse("trailer-maint-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["trailer"] == trailer.pk
        assert response.data["trailer_number"] == trailer.number

    def test_duplicate_date_rejected(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory()
        TrailerMaintenanceFactory(trailer=trailer, date=datetime.date(2024, 6, 20))
        payload = {"trailer": trailer.pk, "date": "2024-06-20", "detail": "Dup"}
        response = client.post(reverse("trailer-maint-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_miles_alert_requires_positive_miles(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory()
        payload = {
            "trailer": trailer.pk,
            "date": "2024-06-20",
            "detail": "Inspection",
            "miles": 0,
            "miles_alert": 1,
            "time_alert": 0,
            "time_year": 0,
            "time_month": 0,
        }
        response = client.post(reverse("trailer-maint-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "miles" in response.data

    def test_detail_required(self, auth_client):
        client, _ = auth_client
        trailer = TrailerFactory()
        payload = {
            "trailer": trailer.pk,
            "date": "2024-06-20",
            "detail": "",
            "miles": 13000,
            "miles_alert": 0,
            "time_alert": 0,
            "time_year": 0,
            "time_month": 0,
        }
        response = client.post(reverse("trailer-maint-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "detail" in response.data

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.post(reverse("trailer-maint-list"), {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTrailerMaintenanceUpdate:
    def test_updates_detail(self, auth_client):
        client, _ = auth_client
        record = TrailerMaintenanceFactory(detail="Old")
        response = client.patch(
            reverse("trailer-maint-detail", kwargs={"pk": record.pk}),
            {"detail": "New"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["detail"] == "New"


@pytest.mark.django_db
class TestTrailerMaintenanceDelete:
    def test_deletes_record(self, auth_client):
        from apps.fleet.models import TrailerMaintenance

        client, _ = auth_client
        record = TrailerMaintenanceFactory()
        response = client.delete(
            reverse("trailer-maint-detail", kwargs={"pk": record.pk})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not TrailerMaintenance.objects.filter(pk=record.pk).exists()

    def test_returns_404_for_unknown(self, auth_client):
        client, _ = auth_client
        response = client.delete(reverse("trailer-maint-detail", kwargs={"pk": 99999}))
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestTrailerMaintenanceBulkDelete:
    def test_deletes_multiple_records(self, auth_client):
        from apps.fleet.models import TrailerMaintenance

        client, _ = auth_client
        m1 = TrailerMaintenanceFactory()
        m2 = TrailerMaintenanceFactory()
        response = client.post(
            reverse("trailer-maint-bulk-delete"),
            {"ids": [m1.pk, m2.pk]},
            format="json",
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not TrailerMaintenance.objects.filter(pk__in=[m1.pk, m2.pk]).exists()


@pytest.mark.django_db
class TestTrailerMaintenanceAlertInfo:
    def test_returns_alert_info(self, auth_client):
        client, _ = auth_client
        record = TrailerMaintenanceFactory()
        response = client.get(
            reverse("trailer-maint-alert-info", kwargs={"pk": record.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert "miles_since_maintenance" in response.data
        assert "is_last_maintenance" in response.data
        assert "miles_alert_message" in response.data
        assert "time_alert_message" in response.data
