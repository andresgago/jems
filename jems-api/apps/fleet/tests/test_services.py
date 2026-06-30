import datetime

import pytest
from rest_framework.exceptions import ValidationError

from apps.fleet.models import (
    Trailer,
    TrailerMaintenance,
    Truck,
    TruckMaintenance,
    TruckOwner,
)
from apps.fleet.services import (
    add_trailer_maintenance,
    add_truck_maintenance,
    add_truck_miles_reset,
    clear_trailer_file,
    clear_truck_file,
    create_trailer,
    create_truck,
    create_truck_owner,
    delete_trailer_maintenance,
    delete_truck_maintenance,
    get_trailer_miles_since_maintenance,
    get_trailer_miles_alert_message,
    get_trailer_time_alert_date,
    get_trailer_time_alert_message,
    get_truck_miles_since_maintenance,
    get_truck_total_miles_since_reset,
    is_last_trailer_maintenance,
    is_last_truck_maintenance,
    set_trailer_file,
    set_truck_file,
    toggle_trailer_status,
    toggle_truck_owner_status,
    toggle_truck_status,
    update_trailer,
    update_trailer_maintenance,
    update_truck,
    update_truck_maintenance,
    update_truck_miles_reset,
)
from apps.fleet.tests.factories import (
    TrailerFactory,
    TrailerMaintenanceFactory,
    TrailerTypeFactory,
    TruckFactory,
    TruckMaintenanceFactory,
    TruckMilesResetFactory,
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


# ── TruckMaintenance services ─────────────────────────────────────────────────


@pytest.mark.django_db
class TestAddTruckMaintenance:
    def test_creates_record(self):
        truck = TruckFactory()
        record = add_truck_maintenance(
            truck=truck, date=datetime.date(2024, 3, 1), detail="Oil change"
        )
        assert record.pk is not None
        assert record.truck == truck

    def test_duplicate_date_raises(self):
        truck = TruckFactory()
        add_truck_maintenance(
            truck=truck, date=datetime.date(2024, 3, 1), detail="First"
        )
        with pytest.raises(ValidationError):
            add_truck_maintenance(
                truck=truck, date=datetime.date(2024, 3, 1), detail="Duplicate"
            )

    def test_different_truck_same_date_allowed(self):
        t1 = TruckFactory()
        t2 = TruckFactory()
        add_truck_maintenance(truck=t1, date=datetime.date(2024, 3, 1), detail="First")
        record = add_truck_maintenance(
            truck=t2, date=datetime.date(2024, 3, 1), detail="Second"
        )
        assert record.pk is not None

    def test_different_dates_same_truck_allowed(self):
        truck = TruckFactory()
        add_truck_maintenance(
            truck=truck, date=datetime.date(2024, 3, 1), detail="First"
        )
        record = add_truck_maintenance(
            truck=truck, date=datetime.date(2024, 3, 15), detail="Second"
        )
        assert record.pk is not None


@pytest.mark.django_db
class TestUpdateTruckMaintenance:
    def test_updates_detail(self):
        m = TruckMaintenanceFactory(detail="Old")
        updated = update_truck_maintenance(maintenance=m, detail="New")
        assert updated.detail == "New"

    def test_update_date_duplicate_raises(self):
        truck = TruckFactory()
        TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 3, 1))
        m2 = TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 3, 15))
        with pytest.raises(ValidationError):
            update_truck_maintenance(maintenance=m2, date=datetime.date(2024, 3, 1))

    def test_update_same_date_noop(self):
        m = TruckMaintenanceFactory(date=datetime.date(2024, 3, 1))
        updated = update_truck_maintenance(
            maintenance=m, date=datetime.date(2024, 3, 1), detail="Same date OK"
        )
        assert updated.detail == "Same date OK"


@pytest.mark.django_db
class TestDeleteTruckMaintenance:
    def test_deletes_record(self):
        m = TruckMaintenanceFactory()
        pk = m.pk
        delete_truck_maintenance(maintenance=m)
        assert not TruckMaintenance.objects.filter(pk=pk).exists()


@pytest.mark.django_db
class TestGetTruckMilesSinceMaintenance:
    def test_returns_zero_when_no_loads(self):
        truck = TruckFactory()
        miles = get_truck_miles_since_maintenance(truck, datetime.date(2024, 1, 1))
        assert miles == 0.0

    def test_sums_miles_and_miles_empty_after_date(self):
        from apps.loads.tests.factories import LoadFactory
        import django.utils.timezone as tz

        truck = TruckFactory()
        maint_date = datetime.date(2024, 3, 1)
        LoadFactory(
            truck=truck,
            miles=500.0,
            miles_empty=50.0,
            dropoff_date=tz.make_aware(datetime.datetime(2024, 3, 5)),
        )
        LoadFactory(
            truck=truck,
            miles=300.0,
            miles_empty=30.0,
            dropoff_date=tz.make_aware(datetime.datetime(2024, 3, 10)),
        )
        miles = get_truck_miles_since_maintenance(truck, maint_date)
        assert miles == pytest.approx(880.0)

    def test_excludes_loads_before_or_on_date(self):
        from apps.loads.tests.factories import LoadFactory
        import django.utils.timezone as tz

        truck = TruckFactory()
        maint_date = datetime.date(2024, 3, 1)
        LoadFactory(
            truck=truck,
            miles=999.0,
            miles_empty=0.0,
            dropoff_date=tz.make_aware(datetime.datetime(2024, 2, 28)),
        )
        miles = get_truck_miles_since_maintenance(truck, maint_date)
        assert miles == 0.0

    def test_excludes_loads_for_other_trucks(self):
        from apps.loads.tests.factories import LoadFactory
        import django.utils.timezone as tz

        truck = TruckFactory()
        other_truck = TruckFactory()
        maint_date = datetime.date(2024, 3, 1)
        LoadFactory(
            truck=other_truck,
            miles=1000.0,
            miles_empty=0.0,
            dropoff_date=tz.make_aware(datetime.datetime(2024, 3, 5)),
        )
        miles = get_truck_miles_since_maintenance(truck, maint_date)
        assert miles == 0.0


@pytest.mark.django_db
class TestGetTruckTotalMilesSinceReset:
    def test_returns_all_miles_when_no_reset(self):
        from apps.loads.tests.factories import LoadFactory
        import django.utils.timezone as tz

        truck = TruckFactory()
        LoadFactory(
            truck=truck,
            miles=200.0,
            miles_empty=20.0,
            dropoff_date=tz.make_aware(datetime.datetime(2024, 1, 10)),
        )
        total = get_truck_total_miles_since_reset(truck)
        assert total == pytest.approx(220.0)

    def test_counts_only_since_last_reset(self):
        from apps.loads.tests.factories import LoadFactory
        import django.utils.timezone as tz

        truck = TruckFactory()
        TruckMilesResetFactory(
            truck=truck,
            date=datetime.datetime(2024, 2, 1, tzinfo=datetime.timezone.utc),
        )
        LoadFactory(
            truck=truck,
            miles=100.0,
            miles_empty=0.0,
            dropoff_date=tz.make_aware(datetime.datetime(2024, 1, 15)),
        )
        LoadFactory(
            truck=truck,
            miles=300.0,
            miles_empty=30.0,
            dropoff_date=tz.make_aware(datetime.datetime(2024, 3, 1)),
        )
        total = get_truck_total_miles_since_reset(truck)
        assert total == pytest.approx(330.0)


@pytest.mark.django_db
class TestIsLastTruckMaintenance:
    def test_single_record_is_last(self):
        m = TruckMaintenanceFactory()
        assert is_last_truck_maintenance(m) is True

    def test_earlier_record_is_not_last(self):
        truck = TruckFactory()
        m1 = TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 1, 1))
        TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 2, 1))
        assert is_last_truck_maintenance(m1) is False

    def test_later_record_is_last(self):
        truck = TruckFactory()
        TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 1, 1))
        m2 = TruckMaintenanceFactory(truck=truck, date=datetime.date(2024, 2, 1))
        assert is_last_truck_maintenance(m2) is True


@pytest.mark.django_db
class TestTruckMilesResetServices:
    def test_add_creates_datetime_reset(self):
        truck = TruckFactory()
        date = datetime.datetime(2024, 4, 1, 9, 30, tzinfo=datetime.timezone.utc)

        reset = add_truck_miles_reset(truck=truck, date=date)

        assert reset.pk is not None
        assert reset.truck == truck
        assert reset.date == date

    def test_duplicate_exact_truck_datetime_raises(self):
        truck = TruckFactory()
        date = datetime.datetime(2024, 4, 1, tzinfo=datetime.timezone.utc)
        TruckMilesResetFactory(truck=truck, date=date)

        with pytest.raises(ValidationError):
            add_truck_miles_reset(truck=truck, date=date)

    def test_same_datetime_allowed_for_different_trucks(self):
        date = datetime.datetime(2024, 4, 1, tzinfo=datetime.timezone.utc)
        TruckMilesResetFactory(date=date)

        reset = add_truck_miles_reset(truck=TruckFactory(), date=date)

        assert reset.pk is not None

    def test_update_duplicate_exact_datetime_raises(self):
        truck = TruckFactory()
        date = datetime.datetime(2024, 4, 1, tzinfo=datetime.timezone.utc)
        target = TruckMilesResetFactory(
            truck=truck,
            date=datetime.datetime(2024, 5, 1, tzinfo=datetime.timezone.utc),
        )
        TruckMilesResetFactory(truck=truck, date=date)

        with pytest.raises(ValidationError):
            update_truck_miles_reset(reset=target, date=date)


# ── TrailerMaintenance services ───────────────────────────────────────────────


@pytest.mark.django_db
class TestAddTrailerMaintenance:
    def test_creates_record(self):
        trailer = TrailerFactory()
        record = add_trailer_maintenance(
            trailer=trailer, date=datetime.date(2024, 3, 1), detail="Tire rotation"
        )
        assert record.pk is not None
        assert record.trailer == trailer

    def test_duplicate_date_raises(self):
        trailer = TrailerFactory()
        add_trailer_maintenance(
            trailer=trailer, date=datetime.date(2024, 3, 1), detail="First"
        )
        with pytest.raises(ValidationError):
            add_trailer_maintenance(
                trailer=trailer, date=datetime.date(2024, 3, 1), detail="Duplicate"
            )

    def test_different_trailer_same_date_allowed(self):
        t1 = TrailerFactory()
        t2 = TrailerFactory()
        add_trailer_maintenance(
            trailer=t1, date=datetime.date(2024, 3, 1), detail="First"
        )
        record = add_trailer_maintenance(
            trailer=t2, date=datetime.date(2024, 3, 1), detail="Second"
        )
        assert record.pk is not None

    def test_miles_alert_requires_positive_threshold(self):
        trailer = TrailerFactory()
        with pytest.raises(ValidationError):
            add_trailer_maintenance(
                trailer=trailer,
                date=datetime.date(2024, 3, 1),
                detail="Inspection",
                miles_alert=1,
                miles=0,
            )


@pytest.mark.django_db
class TestUpdateTrailerMaintenance:
    def test_updates_miles(self):
        m = TrailerMaintenanceFactory(miles=0.0)
        updated = update_trailer_maintenance(maintenance=m, miles=50000.0)
        assert updated.miles == 50000.0

    def test_update_date_duplicate_raises(self):
        trailer = TrailerFactory()
        TrailerMaintenanceFactory(trailer=trailer, date=datetime.date(2024, 3, 1))
        m2 = TrailerMaintenanceFactory(trailer=trailer, date=datetime.date(2024, 3, 15))
        with pytest.raises(ValidationError):
            update_trailer_maintenance(maintenance=m2, date=datetime.date(2024, 3, 1))

    def test_turning_on_miles_alert_uses_existing_threshold(self):
        m = TrailerMaintenanceFactory(miles=7500.0, miles_alert=0)
        updated = update_trailer_maintenance(maintenance=m, miles_alert=1)
        assert updated.miles_alert == 1


@pytest.mark.django_db
class TestDeleteTrailerMaintenance:
    def test_deletes_record(self):
        m = TrailerMaintenanceFactory()
        pk = m.pk
        delete_trailer_maintenance(maintenance=m)
        assert not TrailerMaintenance.objects.filter(pk=pk).exists()


@pytest.mark.django_db
class TestGetTrailerMilesSinceMaintenance:
    def test_returns_zero_when_no_loads(self):
        trailer = TrailerFactory()
        miles = get_trailer_miles_since_maintenance(trailer, datetime.date(2024, 1, 1))
        assert miles == 0.0

    def test_sums_miles_for_trailer(self):
        from apps.loads.tests.factories import LoadFactory
        import django.utils.timezone as tz

        trailer = TrailerFactory()
        maint_date = datetime.date(2024, 3, 1)
        LoadFactory(
            trailer=trailer,
            miles=400.0,
            miles_empty=40.0,
            dropoff_date=tz.make_aware(datetime.datetime(2024, 3, 5)),
        )
        miles = get_trailer_miles_since_maintenance(trailer, maint_date)
        assert miles == pytest.approx(440.0)


@pytest.mark.django_db
class TestTrailerMaintenanceAlertMessages:
    def test_active_miles_message_matches_legacy_text(self):
        from apps.loads.tests.factories import LoadFactory
        import django.utils.timezone as tz

        trailer = TrailerFactory()
        record = TrailerMaintenanceFactory(
            trailer=trailer,
            date=datetime.date(2024, 3, 1),
            miles_alert=1,
            miles=7500,
        )
        LoadFactory(
            trailer=trailer,
            miles=7000,
            miles_empty=500,
            dropoff_date=tz.make_aware(datetime.datetime(2024, 3, 2)),
        )

        assert (
            get_trailer_miles_alert_message(record)
            == "Active alert for 7500 miles (Miles traveled 7500 miles)"
        )

    def test_inactive_miles_message_for_older_record(self):
        trailer = TrailerFactory()
        old = TrailerMaintenanceFactory(
            trailer=trailer,
            date=datetime.date(2024, 3, 1),
            miles_alert=1,
            miles=7500,
        )
        TrailerMaintenanceFactory(trailer=trailer, date=datetime.date(2024, 3, 2))

        assert get_trailer_miles_alert_message(old) == "Inactive alert for 7500 miles"

    def test_time_message_and_date(self):
        record = TrailerMaintenanceFactory(
            date=datetime.date(2024, 1, 15),
            time_alert=1,
            time_year=1,
            time_month=2,
        )

        assert get_trailer_time_alert_date(record) == datetime.date(2025, 3, 15)
        assert (
            get_trailer_time_alert_message(record)
            == "Active alert for 1 year and 2 months (at 2025-03-15)"
        )


@pytest.mark.django_db
class TestIsLastTrailerMaintenance:
    def test_single_record_is_last(self):
        m = TrailerMaintenanceFactory()
        assert is_last_trailer_maintenance(m) is True

    def test_earlier_record_is_not_last(self):
        trailer = TrailerFactory()
        m1 = TrailerMaintenanceFactory(trailer=trailer, date=datetime.date(2024, 1, 1))
        TrailerMaintenanceFactory(trailer=trailer, date=datetime.date(2024, 2, 1))
        assert is_last_trailer_maintenance(m1) is False
