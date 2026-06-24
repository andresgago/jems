import pytest

from apps.fleet.models import Trailer, Truck, TruckOwner
from apps.fleet.services import (
    clear_trailer_file,
    clear_truck_file,
    create_trailer,
    create_truck,
    create_truck_owner,
    set_trailer_file,
    set_truck_file,
    toggle_trailer_status,
    toggle_truck_owner_status,
    toggle_truck_status,
    update_trailer,
    update_truck,
)
from apps.fleet.tests.factories import (
    TrailerFactory,
    TrailerTypeFactory,
    TruckFactory,
    TruckTypeFactory,
)
from apps.fleet.tests.test_views import make_pdf_file


@pytest.mark.django_db
class TestCreateTruck:
    def test_creates_truck_with_number(self):
        truck_type = TruckTypeFactory()
        truck = create_truck(number="T-0001", truck_type=truck_type)
        assert truck.pk is not None
        assert truck.number == "T-0001"
        assert truck.status == Truck.Status.ACTIVE

    def test_duplicate_number_raises(self):
        TruckFactory(number="T-DUP")
        with pytest.raises(Exception):
            create_truck(number="T-DUP")


@pytest.mark.django_db
class TestToggleTruckStatus:
    def test_active_becomes_inactive(self):
        truck = TruckFactory(status=Truck.Status.ACTIVE)
        updated = toggle_truck_status(truck=truck)
        assert updated.status == Truck.Status.INACTIVE

    def test_inactive_becomes_active(self):
        truck = TruckFactory(status=Truck.Status.INACTIVE)
        updated = toggle_truck_status(truck=truck)
        assert updated.status == Truck.Status.ACTIVE


@pytest.mark.django_db
class TestUpdateTruck:
    def test_updates_fields(self):
        truck = TruckFactory(plate="OLD-001")
        updated = update_truck(truck=truck, plate="NEW-999", odometer_current=150000.0)
        assert updated.plate == "NEW-999"
        assert updated.odometer_current == 150000.0


@pytest.mark.django_db
class TestCreateTrailer:
    def test_creates_trailer(self):
        trailer_type = TrailerTypeFactory()
        trailer = create_trailer(number="TRL-001", trailer_type=trailer_type)
        assert trailer.pk is not None
        assert trailer.status == Trailer.Status.ACTIVE

    def test_duplicate_number_raises(self):
        TrailerFactory(number="TRL-DUP")
        with pytest.raises(Exception):
            create_trailer(number="TRL-DUP")

    def test_creates_with_is_rented_false_by_default(self):
        trailer = create_trailer(number="TRL-RENT")
        assert trailer.is_rented is False


@pytest.mark.django_db
class TestUpdateTrailer:
    def test_updates_fields(self):
        trailer = TrailerFactory(plate_number="OLD-001")
        updated = update_trailer(trailer=trailer, plate_number="NEW-999")
        assert updated.plate_number == "NEW-999"


@pytest.mark.django_db
class TestToggleTrailerStatus:
    def test_active_becomes_inactive(self):
        trailer = TrailerFactory(status=Trailer.Status.ACTIVE)
        updated = toggle_trailer_status(trailer=trailer)
        assert updated.status == Trailer.Status.INACTIVE

    def test_inactive_becomes_active(self):
        trailer = TrailerFactory(status=Trailer.Status.INACTIVE)
        updated = toggle_trailer_status(trailer=trailer)
        assert updated.status == Trailer.Status.ACTIVE


@pytest.mark.django_db
class TestTrailerFileServices:
    def test_set_trailer_file_assigns_slot(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        trailer = TrailerFactory()
        updated = set_trailer_file(
            trailer=trailer, slot="annual_inspection", file=make_pdf_file()
        )
        assert updated.annual_inspection_file

    def test_set_trailer_file_replaces_previous(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        trailer = TrailerFactory(registration_file=make_pdf_file("old.pdf"))
        old_name = trailer.registration_file.name
        updated = set_trailer_file(
            trailer=trailer, slot="registration", file=make_pdf_file("new.pdf")
        )
        assert updated.registration_file.name != old_name

    def test_clear_trailer_file_removes_it(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        trailer = TrailerFactory(agreement_file=make_pdf_file())
        updated = clear_trailer_file(trailer=trailer, slot="agreement")
        assert not updated.agreement_file

    def test_clear_trailer_file_is_noop_when_absent(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        trailer = TrailerFactory()
        updated = clear_trailer_file(trailer=trailer, slot="registration")
        assert not updated.registration_file


@pytest.mark.django_db
class TestTruckOwner:
    def test_creates_owner(self):
        owner = create_truck_owner(first_name="Bob", last_name="Smith", percent=10.0)
        assert owner.full_name == "Bob Smith"
        assert owner.status == TruckOwner.Status.ACTIVE

    def test_toggle_owner_status(self):
        owner = create_truck_owner(first_name="Jane", last_name="Doe")
        updated = toggle_truck_owner_status(owner=owner)
        assert updated.status == TruckOwner.Status.INACTIVE


# ── Accident ──────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCreateAccident:
    def test_creates_accident(self):
        from apps.fleet.tests.factories import (
            TruckFactory,
            TrailerFactory,
            DriverFactory,
        )
        from apps.fleet.services import create_accident
        import datetime
        import zoneinfo

        truck = TruckFactory()
        trailer = TrailerFactory()
        driver = DriverFactory()
        accident = create_accident(
            date=datetime.datetime(
                2024, 3, 15, 14, 30, tzinfo=zoneinfo.ZoneInfo("UTC")
            ),
            truck=truck,
            trailer=trailer,
            driver=driver,
            address="I-10 Mile 45",
            crash_number="FMCSA-001",
        )
        assert accident.pk is not None
        assert accident.tow_aways is False
        assert accident.death_count == 0

    def test_update_accident(self):
        from apps.fleet.tests.factories import AccidentFactory
        from apps.fleet.services import update_accident

        accident = AccidentFactory(crash_number="OLD-001")
        updated = update_accident(accident=accident, crash_number="NEW-002")
        assert updated.crash_number == "NEW-002"

    def test_delete_accident(self):
        from apps.fleet.tests.factories import AccidentFactory
        from apps.fleet.services import delete_accident
        from apps.fleet.models import Accident

        accident = AccidentFactory()
        pk = accident.pk
        delete_accident(accident=accident)
        assert not Accident.objects.filter(pk=pk).exists()

    def test_add_picture(self):
        from apps.fleet.tests.factories import AccidentFactory
        from apps.fleet.services import add_accident_picture
        from django.core.files.uploadedfile import SimpleUploadedFile

        accident = AccidentFactory()
        img = SimpleUploadedFile(
            "photo.jpg", b"fake-image-data", content_type="image/jpeg"
        )
        picture = add_accident_picture(
            accident=accident, file=img, description="Scene photo"
        )
        assert picture.pk is not None
        assert picture.accident == accident


@pytest.mark.django_db
class TestTruckFileServices:
    def test_set_truck_file_assigns_slot(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        truck = TruckFactory()
        updated = set_truck_file(truck=truck, slot="leased", file=make_pdf_file())
        assert updated.leased_file

    def test_set_truck_file_replaces_previous(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        truck = TruckFactory(avi_file=make_pdf_file("old.pdf"))
        old_name = truck.avi_file.name
        updated = set_truck_file(truck=truck, slot="avi", file=make_pdf_file("new.pdf"))
        assert updated.avi_file.name != old_name

    def test_clear_truck_file_removes_it(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        truck = TruckFactory(registration_file=make_pdf_file())
        updated = clear_truck_file(truck=truck, slot="registration")
        assert not updated.registration_file

    def test_clear_truck_file_is_noop_when_absent(self, settings, tmp_path):
        settings.MEDIA_ROOT = str(tmp_path)
        truck = TruckFactory()
        updated = clear_truck_file(truck=truck, slot="agreement")
        assert not updated.agreement_file
