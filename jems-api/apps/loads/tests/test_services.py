import datetime

from django.utils import timezone

import pytest
from django.core.exceptions import ValidationError

from apps.accounting.models import Account, Record
from apps.drivers.models import DriverType
from apps.loads.exceptions import InvalidStatusTransition
from apps.loads.models import Load, LoadStop
from apps.loads.exceptions import NotReadyToExecute
from apps.loads.services import (
    FILE_SLOTS,
    _accounting_day_from,
    assign_load,
    bulk_delete_loads,
    cancel_load,
    clear_load_file,
    create_load,
    create_load_stop,
    delete_load,
    delete_load_stop,
    get_load_broker_contacts,
    set_executed,
    set_invoiced,
    set_load_file,
    set_load_rating,
    set_load_status,
    set_paid,
    update_load,
    update_load_stop,
)
from apps.brokers.tests.factories import BrokerContactFactory
from apps.loads.tests.factories import (
    BrokerFactory,
    BusinessFactory,
    CityFactory,
    DriverFactory,
    LoadFactory,
    LoadStopFactory,
    TrailerFactory,
    TruckFactory,
)


@pytest.fixture
def load_accounting_accounts(db):
    codes = {
        "90010": "Income by Rate",
        "90011": "Income by Detention",
        "10040": "% Factor dispatch by load",
        "80011": "Expenses By Detention",
    }
    return {
        code: Account.objects.get_or_create(code=code, defaults={"name": name})[0]
        for code, name in codes.items()
    }


@pytest.fixture
def solo_driver_type(db):
    return DriverType.objects.get_or_create(
        id=4, defaults={"name": "Solo Driver", "is_active": True}
    )[0]


class TestAccountingDayMapping:
    """Verify _accounting_day_from replicates the TMS ACCOUNTING_DAYS table exactly."""

    # Fixed week in ET: Sun 2024-01-07 … Sat 2024-01-13
    @pytest.mark.parametrize(
        "date_str,expected",
        [
            ("2024-01-07", 6),  # Sunday   → 6
            ("2024-01-08", 7),  # Monday   → 7
            ("2024-01-09", 1),  # Tuesday  → 1
            ("2024-01-10", 2),  # Wednesday→ 2
            ("2024-01-11", 3),  # Thursday → 3
            ("2024-01-12", 4),  # Friday   → 4
            ("2024-01-13", 5),  # Saturday → 5
        ],
    )
    def test_all_weekdays(self, date_str: str, expected: int) -> None:
        from zoneinfo import ZoneInfo

        dt = datetime.datetime.fromisoformat(f"{date_str}T10:00:00").replace(
            tzinfo=ZoneInfo("America/New_York")
        )
        assert _accounting_day_from(dt) == expected

    def test_late_night_et_uses_local_weekday(self) -> None:
        """A dropoff at 11 PM ET Sunday is UTC Monday — must still map to 6 (Sunday)."""
        from zoneinfo import ZoneInfo

        dt = datetime.datetime(2024, 1, 7, 23, 0, tzinfo=ZoneInfo("America/New_York"))
        assert _accounting_day_from(dt) == 6


@pytest.mark.django_db
class TestCreateLoad:
    def test_creates_with_required_fields(self):
        city = CityFactory()
        broker = BrokerFactory()
        load = create_load(
            number="LD-001",
            pickup_date=timezone.now(),
            dropoff_date=timezone.now() + datetime.timedelta(days=1),
            pickup_city=city,
            dropoff_city=city,
            pickup_address="123 Main",
            dropoff_address="456 Oak",
            payment=1000.0,
            broker=broker,
        )
        assert load.pk is not None
        assert load.status == Load.Status.REGISTERED
        assert load.details == "Must be on time."

    def test_details_is_required(self):
        city = CityFactory()
        broker = BrokerFactory()
        with pytest.raises(ValidationError):
            create_load(
                number="LD-NO-DETAILS",
                pickup_date=timezone.now(),
                dropoff_date=timezone.now() + datetime.timedelta(days=1),
                pickup_city=city,
                dropoff_city=city,
                pickup_address="123 Main",
                dropoff_address="456 Oak",
                payment=1000.0,
                broker=broker,
                details="",
            )

    def test_details_max_length_is_800(self):
        city = CityFactory()
        broker = BrokerFactory()
        with pytest.raises(ValidationError):
            create_load(
                number="LD-LONG-DETAILS",
                pickup_date=timezone.now(),
                dropoff_date=timezone.now() + datetime.timedelta(days=1),
                pickup_city=city,
                dropoff_city=city,
                pickup_address="123 Main",
                dropoff_address="456 Oak",
                payment=1000.0,
                broker=broker,
                details="x" * 801,
            )

    def test_sets_accounting_day_from_dropoff(self):
        from zoneinfo import ZoneInfo

        city = CityFactory()
        broker = BrokerFactory()
        # Tuesday dropoff → accounting_day = 1
        dropoff = datetime.datetime(
            2024, 1, 9, 10, 0, tzinfo=ZoneInfo("America/New_York")
        )
        load = create_load(
            number="LD-ACC-01",
            pickup_date=dropoff - datetime.timedelta(days=1),
            dropoff_date=dropoff,
            pickup_city=city,
            dropoff_city=city,
            pickup_address="123 Main",
            dropoff_address="456 Oak",
            payment=1000.0,
            broker=broker,
        )
        assert load.accounting_day == 1  # Tuesday

    def test_duplicate_number_raises(self):
        LoadFactory(number="LD-DUP")
        with pytest.raises(ValidationError):
            create_load(
                number="LD-DUP",
                pickup_date=timezone.now(),
                dropoff_date=timezone.now(),
                pickup_address="x",
                dropoff_address="x",
            )


@pytest.mark.django_db
class TestGetLoadBrokerContacts:
    def test_returns_selected_contacts_sorted_by_name(self):
        broker = BrokerFactory()
        zed = BrokerContactFactory(broker=broker, name="Zed Contact")
        amy = BrokerContactFactory(broker=broker, name="Amy Contact")
        BrokerContactFactory(broker=broker, name="Other Contact")
        load = LoadFactory(broker=broker, broker_contacts=f"{zed.id},{amy.id}")

        contacts = list(get_load_broker_contacts(load=load))

        assert contacts == [amy, zed]

    def test_ignores_blank_and_non_numeric_csv_values(self):
        broker = BrokerFactory()
        contact = BrokerContactFactory(broker=broker, name="Selected Contact")
        load = LoadFactory(broker=broker, broker_contacts=f",abc,{contact.id},")

        contacts = list(get_load_broker_contacts(load=load))

        assert contacts == [contact]

    def test_empty_csv_returns_no_contacts(self):
        load = LoadFactory(broker_contacts="")

        assert list(get_load_broker_contacts(load=load)) == []


@pytest.mark.django_db
class TestUpdateLoad:
    def test_updates_payment(self):
        load = LoadFactory(payment=1000.0)
        updated = update_load(load=load, payment=2500.0)
        assert updated.payment == 2500.0

    def test_clears_lumper_paid_by_when_lumper_is_zero(self):
        load = LoadFactory(lumper=100.0, lumper_paid_by=Load.LumperPaidBy.DRIVER)
        updated = update_load(load=load, lumper=0.0)
        assert updated.lumper_paid_by == ""

    def test_requires_lumper_paid_by_when_lumper_is_positive(self):
        load = LoadFactory(lumper=0.0, lumper_paid_by="")
        with pytest.raises(ValidationError):
            update_load(load=load, lumper=100.0, lumper_paid_by="")

    def test_recalculates_accounting_day_when_dropoff_changes(self):
        from zoneinfo import ZoneInfo

        # Start with a Tuesday dropoff (accounting_day=1)
        tue = datetime.datetime(2024, 1, 9, 10, 0, tzinfo=ZoneInfo("America/New_York"))
        load = LoadFactory(dropoff_date=tue)
        assert load.accounting_day == 1

        # Change to Friday (accounting_day=4)
        fri = datetime.datetime(2024, 1, 12, 10, 0, tzinfo=ZoneInfo("America/New_York"))
        updated = update_load(load=load, dropoff_date=fri)
        assert updated.accounting_day == 4

    def test_recalculates_accounting_day_even_when_dropoff_unchanged(self):
        """Every save must refresh accounting_day, matching TMS controller behavior."""
        from zoneinfo import ZoneInfo

        fri = datetime.datetime(2024, 1, 12, 10, 0, tzinfo=ZoneInfo("America/New_York"))
        load = LoadFactory(dropoff_date=fri)
        # Corrupt accounting_day to simulate stale data
        load.accounting_day = 99
        updated = update_load(load=load, payment=999.0)
        assert updated.accounting_day == 4  # Friday

    def test_recreates_accounting_records_when_invoiced_load_detention_changes(
        self, load_accounting_accounts, solo_driver_type
    ):
        driver = DriverFactory(driver_type=solo_driver_type, factor=25.0)
        load = LoadFactory(
            driver=driver, payment=2000.0, detention=200.0, invoiced=False
        )
        set_invoiced(load=load)

        updated = update_load(load=load, detention=300.0)

        assert updated.invoiced is True
        records = Record.objects.filter(load=load, is_automatic=True)
        assert records.count() == 4
        assert sorted(records.values_list("account__code", "amount")) == [
            ("10040", 75.0),
            ("10040", 500.0),
            ("90010", 2000.0),
            ("90011", 300.0),
        ]


@pytest.mark.django_db
class TestAssignLoad:
    def test_assigns_truck_trailer_driver(self):
        load = LoadFactory()
        truck = TruckFactory()
        trailer = TrailerFactory()
        driver = DriverFactory()
        updated = assign_load(load=load, truck=truck, trailer=trailer, driver=driver)
        assert updated.truck == truck
        assert updated.trailer == trailer
        assert updated.driver == driver

    def test_does_not_auto_set_execute(self):
        load = LoadFactory(execute=False)
        truck = TruckFactory()
        driver = DriverFactory()
        updated = assign_load(load=load, truck=truck, driver=driver)
        assert updated.execute is False

    def test_clears_team_driver_when_no_team(self):
        load = LoadFactory()
        driver = DriverFactory()
        updated = assign_load(load=load, driver=driver)
        assert updated.team_driver is None

    def test_clears_driver_when_passed_none(self):
        driver = DriverFactory()
        load = LoadFactory(driver=driver)
        updated = assign_load(load=load, driver=None)
        assert updated.driver is None
        assert updated.team_driver is None

    def test_untouched_fields_unchanged(self):
        truck = TruckFactory()
        load = LoadFactory(truck=truck)
        updated = assign_load(load=load, driver=DriverFactory())
        assert updated.truck == truck

    def test_drop_fields_saved(self):
        load = LoadFactory()
        updated = assign_load(
            load=load,
            is_drop=True,
            drop_place=1,
            drop_trailer=150.0,
            days_in_drop=3,
        )
        assert updated.is_drop is True
        assert updated.drop_place == 1
        assert updated.drop_trailer == 150.0
        assert updated.days_in_drop == 3

    def test_clearing_is_drop_resets_amount(self):
        load = LoadFactory(is_drop=True, drop_trailer=200.0, drop_place=0)
        updated = assign_load(
            load=load, is_drop=False, drop_trailer=0.0, drop_place=None
        )
        assert updated.is_drop is False
        assert updated.drop_trailer == 0.0
        assert updated.drop_place is None


@pytest.mark.django_db
class TestSetLoadStatus:
    def test_registered_to_started(self):
        load = LoadFactory(status=Load.Status.REGISTERED)
        updated = set_load_status(load=load, new_status=Load.Status.STARTED)
        assert updated.status == Load.Status.STARTED

    def test_registered_to_finished(self):
        load = LoadFactory(status=Load.Status.REGISTERED)
        updated = set_load_status(load=load, new_status=Load.Status.FINISHED)
        assert updated.status == Load.Status.FINISHED

    def test_registered_to_detention(self):
        load = LoadFactory(status=Load.Status.REGISTERED)
        updated = set_load_status(load=load, new_status=Load.Status.DETENTION_PENDING)
        assert updated.status == Load.Status.DETENTION_PENDING

    def test_registered_to_cancelled_via_set_status_raises(self):
        # CANCELLED is no longer in _ALLOWED_TRANSITIONS[REGISTERED]; cancellation
        # must go through cancel_load() to apply legacy side effects.
        load = LoadFactory(status=Load.Status.REGISTERED)
        with pytest.raises(InvalidStatusTransition):
            set_load_status(load=load, new_status=Load.Status.CANCELLED)

    def test_invalid_transition_raises(self):
        load = LoadFactory(status=Load.Status.FINISHED)
        with pytest.raises(InvalidStatusTransition):
            set_load_status(load=load, new_status=Load.Status.STARTED)

    def test_finished_to_finished_is_allowed_for_legacy_delivered_action(self):
        load = LoadFactory(status=Load.Status.FINISHED)
        updated = set_load_status(load=load, new_status=Load.Status.FINISHED)
        assert updated.status == Load.Status.FINISHED

    def test_finished_to_detention_matches_legacy_dropdown(self):
        load = LoadFactory(status=Load.Status.FINISHED)
        updated = set_load_status(load=load, new_status=Load.Status.DETENTION_PENDING)
        assert updated.status == Load.Status.DETENTION_PENDING

    def test_cancelled_to_finished_matches_legacy_dropdown(self):
        load = LoadFactory(status=Load.Status.CANCELLED)
        updated = set_load_status(load=load, new_status=Load.Status.FINISHED)
        assert updated.status == Load.Status.FINISHED

    def test_cancelled_to_detention_matches_legacy_dropdown(self):
        load = LoadFactory(status=Load.Status.CANCELLED)
        updated = set_load_status(load=load, new_status=Load.Status.DETENTION_PENDING)
        assert updated.status == Load.Status.DETENTION_PENDING

    def test_cannot_reopen_cancelled_to_registered(self):
        load = LoadFactory(status=Load.Status.CANCELLED)
        with pytest.raises(InvalidStatusTransition):
            set_load_status(load=load, new_status=Load.Status.REGISTERED)


@pytest.mark.django_db
class TestCancelLoad:
    def test_registered_load_becomes_cancelled(self):
        load = LoadFactory(status=Load.Status.REGISTERED, execute=False, history=False)
        updated = cancel_load(load=load)
        assert updated.status == Load.Status.CANCELLED

    def test_execute_flips_to_true_when_not_yet_executed(self):
        load = LoadFactory(status=Load.Status.REGISTERED, execute=False)
        updated = cancel_load(load=load)
        assert updated.execute is True

    def test_history_flips_to_true_when_not_yet_executed(self):
        load = LoadFactory(status=Load.Status.REGISTERED, execute=False)
        updated = cancel_load(load=load)
        assert updated.history is True

    def test_miles_zeroed_out(self):
        load = LoadFactory(
            status=Load.Status.REGISTERED, miles=1250.5, miles_empty=80.0
        )
        updated = cancel_load(load=load)
        assert updated.miles == 0.0
        assert updated.miles_empty == 0.0

    def test_executed_by_set_when_user_provided(self):
        from apps.users.tests.factories import UserFactory

        user = UserFactory()
        load = LoadFactory(status=Load.Status.REGISTERED)
        updated = cancel_load(load=load, updated_by=user)
        assert updated.executed_by == user

    def test_non_registered_load_raises(self):
        for bad_status in (
            Load.Status.STARTED,
            Load.Status.FINISHED,
            Load.Status.DETENTION_PENDING,
            Load.Status.CANCELLED,
        ):
            load = LoadFactory(status=bad_status)
            with pytest.raises(InvalidStatusTransition):
                cancel_load(load=load)

    def test_persisted_to_db(self):
        load = LoadFactory(status=Load.Status.REGISTERED, execute=False, miles=500.0)
        cancel_load(load=load)
        load.refresh_from_db()
        assert load.status == Load.Status.CANCELLED
        assert load.execute is True
        assert load.miles == 0.0


@pytest.mark.django_db
class TestSetInvoiced:
    def test_toggles_invoiced(self):
        load = LoadFactory(invoiced=False)
        updated = set_invoiced(load=load)
        assert updated.invoiced is True
        updated = set_invoiced(load=updated)
        assert updated.invoiced is False

    def test_creates_accounting_records_when_marking_invoiced(
        self, load_accounting_accounts, solo_driver_type
    ):
        driver = DriverFactory(driver_type=solo_driver_type, factor=25.0)
        load = LoadFactory(
            driver=driver, payment=2000.0, detention=200.0, invoiced=False
        )

        updated = set_invoiced(load=load)

        assert updated.invoiced is True
        records = Record.objects.filter(load=load, is_automatic=True)
        assert records.count() == 4
        assert sorted(records.values_list("account__code", "amount")) == [
            ("10040", 50.0),
            ("10040", 500.0),
            ("90010", 2000.0),
            ("90011", 200.0),
        ]

    def test_removes_only_automatic_records_when_unmarking_invoiced(
        self, load_accounting_accounts, solo_driver_type
    ):
        driver = DriverFactory(driver_type=solo_driver_type, factor=25.0)
        load = LoadFactory(
            driver=driver, payment=1500.0, detention=100.0, invoiced=False
        )
        set_invoiced(load=load)
        manual_account = Account.objects.create(code="99991", name="Manual")
        Record.objects.create(
            date=datetime.date.today(),
            account=manual_account,
            amount=999.0,
            load=load,
            is_automatic=False,
        )

        updated = set_invoiced(load=load)

        assert updated.invoiced is False
        remaining = Record.objects.filter(load=load)
        assert remaining.count() == 1
        assert remaining.get().is_automatic is False

    def test_does_not_mark_invoiced_when_accounting_records_cannot_be_created(
        self, load_accounting_accounts
    ):
        unknown_type = DriverType.objects.create(name="Unknown", is_active=True)
        driver = DriverFactory(driver_type=unknown_type, factor=25.0)
        load = LoadFactory(driver=driver, payment=1500.0, detention=100.0)

        with pytest.raises(ValueError, match="Unsupported driver type"):
            set_invoiced(load=load)

        load.refresh_from_db()
        assert load.invoiced is False
        assert not Record.objects.filter(load=load, is_automatic=True).exists()


@pytest.mark.django_db
class TestSetPaid:
    def test_toggles_paid(self):
        load = LoadFactory(paid=False)
        updated = set_paid(load=load)
        assert updated.paid is True


@pytest.mark.django_db
class TestLoadStops:
    def test_creates_stop(self):
        load = LoadFactory()
        stop = create_load_stop(
            load=load,
            stop_type=LoadStop.StopType.PICKUP,
            from_date=datetime.date.today(),
            to_date=datetime.date.today() + datetime.timedelta(days=1),
            address="100 Stop St",
        )
        assert stop.pk is not None
        assert stop.load == load

    def test_updates_stop_address(self):
        stop = LoadStopFactory(address="Old Addr")
        updated = update_load_stop(stop=stop, address="New Addr")
        assert updated.address == "New Addr"

    def test_deletes_stop(self):
        stop = LoadStopFactory()
        pk = stop.pk
        delete_load_stop(stop=stop)
        assert not LoadStop.objects.filter(pk=pk).exists()


@pytest.mark.django_db
class TestSendDriverInfo:
    def test_sends_email_to_broker(self):
        from unittest.mock import patch, MagicMock
        from apps.loads.services import send_driver_info
        from apps.loads.tests.factories import (
            CarrierFactory,
            DriverFactory,
            TruckFactory,
            TrailerFactory,
        )
        from apps.fleet.models import Truck, Trailer

        carrier = CarrierFactory(
            no_reply_email="noreply@test.com",
            no_reply_password="secret",
            cc_email=None,
        )
        driver = DriverFactory(first_name="John", last_name="Doe", phone="555-1234")
        truck = TruckFactory(number="T-001", status=Truck.Status.ACTIVE)
        trailer = TrailerFactory(number="TR-001", status=Trailer.Status.ACTIVE)

        with patch("apps.loads.services.get_connection") as mock_conn, patch(
            "apps.loads.services.EmailMessage"
        ) as mock_msg_cls:
            mock_connection = MagicMock()
            mock_conn.return_value = mock_connection
            mock_msg = MagicMock()
            mock_msg_cls.return_value = mock_msg

            send_driver_info(
                carrier_id=carrier.pk,
                driver_id=driver.pk,
                truck_id=truck.pk,
                trailer_id=trailer.pk,
                broker_email="broker@example.com",
            )

        mock_conn.assert_called_once_with(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host="smtp.gmail.com",
            port=587,
            username="noreply@test.com",
            password="secret",
            use_tls=True,
            fail_silently=False,
        )
        mock_msg_cls.assert_called_once()
        call_kwargs = mock_msg_cls.call_args.kwargs
        assert call_kwargs["to"] == ["broker@example.com"]
        assert call_kwargs["cc"] == []
        mock_msg.send.assert_called_once()

    def test_cc_email_included_when_set(self):
        from unittest.mock import patch, MagicMock
        from apps.loads.services import send_driver_info
        from apps.loads.tests.factories import (
            CarrierFactory,
            DriverFactory,
            TruckFactory,
            TrailerFactory,
        )
        from apps.fleet.models import Truck, Trailer

        carrier = CarrierFactory(
            no_reply_email="noreply@test.com",
            no_reply_password="secret",
            cc_email="cc@test.com",
        )
        driver = DriverFactory()
        truck = TruckFactory(status=Truck.Status.ACTIVE)
        trailer = TrailerFactory(status=Trailer.Status.ACTIVE)

        with patch("apps.loads.services.get_connection"), patch(
            "apps.loads.services.EmailMessage"
        ) as mock_msg_cls:
            mock_msg_cls.return_value = MagicMock()
            send_driver_info(
                carrier_id=carrier.pk,
                driver_id=driver.pk,
                truck_id=truck.pk,
                trailer_id=trailer.pk,
                broker_email="broker@example.com",
            )

        call_kwargs = mock_msg_cls.call_args.kwargs
        assert "cc@test.com" in call_kwargs["cc"]

    def test_team_driver_name_in_email_body(self):
        from unittest.mock import patch, MagicMock
        from apps.loads.services import send_driver_info
        from apps.loads.tests.factories import (
            CarrierFactory,
            DriverFactory,
            TruckFactory,
            TrailerFactory,
        )
        from apps.fleet.models import Truck, Trailer

        carrier = CarrierFactory(no_reply_email="nr@t.com", no_reply_password="x")
        team = DriverFactory(first_name="Jane", last_name="Smith")
        driver = DriverFactory(first_name="John", last_name="Doe", team_driver=team)
        truck = TruckFactory(status=Truck.Status.ACTIVE)
        trailer = TrailerFactory(status=Trailer.Status.ACTIVE)

        captured_body = {}

        def capture(*args, **kwargs):
            captured_body["body"] = kwargs.get("body", "")
            return MagicMock()

        with patch("apps.loads.services.get_connection"), patch(
            "apps.loads.services.EmailMessage", side_effect=capture
        ):
            send_driver_info(
                carrier_id=carrier.pk,
                driver_id=driver.pk,
                truck_id=truck.pk,
                trailer_id=trailer.pk,
                broker_email="b@b.com",
            )

        assert "Jane Smith" in captured_body["body"]


@pytest.mark.django_db
class TestSetExecuted:
    def test_sets_execute_true_when_ready(self):
        truck = TruckFactory()
        trailer = TrailerFactory()
        driver = DriverFactory()
        load = LoadFactory(
            driver=driver,
            truck=truck,
            trailer=trailer,
            rate_file="loads/rates/rate.pdf",
            bill_file="loads/bills/bill.pdf",
            execute=False,
        )
        result = set_executed(load=load)
        assert result.execute is True
        load.refresh_from_db()
        assert load.execute is True

    def test_raises_when_driver_missing(self):
        truck = TruckFactory()
        trailer = TrailerFactory()
        load = LoadFactory(
            driver=None,
            truck=truck,
            trailer=trailer,
            rate_file="loads/rates/rate.pdf",
            bill_file="loads/bills/bill.pdf",
            execute=False,
        )
        with pytest.raises(NotReadyToExecute):
            set_executed(load=load)

    def test_raises_when_rate_file_missing(self):
        truck = TruckFactory()
        trailer = TrailerFactory()
        driver = DriverFactory()
        load = LoadFactory(
            driver=driver,
            truck=truck,
            trailer=trailer,
            rate_file="",
            bill_file="loads/bills/bill.pdf",
            execute=False,
        )
        with pytest.raises(NotReadyToExecute):
            set_executed(load=load)

    def test_raises_when_bill_file_missing(self):
        truck = TruckFactory()
        trailer = TrailerFactory()
        driver = DriverFactory()
        load = LoadFactory(
            driver=driver,
            truck=truck,
            trailer=trailer,
            rate_file="loads/rates/rate.pdf",
            bill_file="",
            execute=False,
        )
        with pytest.raises(NotReadyToExecute):
            set_executed(load=load)

    def test_raises_when_already_executed(self):
        truck = TruckFactory()
        trailer = TrailerFactory()
        driver = DriverFactory()
        load = LoadFactory(
            driver=driver,
            truck=truck,
            trailer=trailer,
            rate_file="loads/rates/rate.pdf",
            bill_file="loads/bills/bill.pdf",
            execute=True,
        )
        with pytest.raises(NotReadyToExecute):
            set_executed(load=load)


@pytest.mark.django_db
class TestSetLoadRating:
    def test_saves_ratings_on_load(self):
        load = LoadFactory()
        result = set_load_rating(load=load, shipper_rating=8, receiver_rating=6)
        load.refresh_from_db()
        assert result.shipper_rating == 8
        assert load.shipper_rating == 8
        assert load.receiver_rating == 6

    def test_recalculates_business_rating_for_shipper(self):
        shipper = BusinessFactory()
        load = LoadFactory(shipper=shipper)
        set_load_rating(load=load, shipper_rating=10, receiver_rating=0)
        shipper.refresh_from_db()
        # 1 load as shipper (rating=10), 0 as receiver → 10/1 = 10
        assert shipper.rating == 10

    def test_recalculates_business_rating_for_receiver(self):
        receiver = BusinessFactory()
        load = LoadFactory(receiver=receiver)
        set_load_rating(load=load, shipper_rating=0, receiver_rating=8)
        receiver.refresh_from_db()
        # 0 loads as shipper, 1 as receiver (rating=8) → 8/1 = 8
        assert receiver.rating == 8

    def test_raises_on_shipper_rating_out_of_range(self):
        load = LoadFactory()
        with pytest.raises(ValidationError):
            set_load_rating(load=load, shipper_rating=11, receiver_rating=5)

    def test_raises_on_receiver_rating_out_of_range(self):
        load = LoadFactory()
        with pytest.raises(ValidationError):
            set_load_rating(load=load, shipper_rating=5, receiver_rating=-1)

    def test_zero_is_valid(self):
        load = LoadFactory()
        result = set_load_rating(load=load, shipper_rating=0, receiver_rating=0)
        assert result.shipper_rating == 0
        assert result.receiver_rating == 0


@pytest.mark.django_db
class TestSetLoadFile:
    def test_sets_rate_file(self, tmp_path):
        load = LoadFactory()
        fake = tmp_path / "rate.pdf"
        fake.write_bytes(b"PDF")
        from django.core.files import File as DjangoFile

        with open(fake, "rb") as fh:
            set_load_file(
                load=load, slot="rate_file", file=DjangoFile(fh, name="rate.pdf")
            )
        load.refresh_from_db()
        assert load.rate_file

    def test_sets_bill_file(self, tmp_path):
        load = LoadFactory()
        fake = tmp_path / "bill.pdf"
        fake.write_bytes(b"PDF")
        from django.core.files import File as DjangoFile

        with open(fake, "rb") as fh:
            set_load_file(
                load=load, slot="bill_file", file=DjangoFile(fh, name="bill.pdf")
            )
        load.refresh_from_db()
        assert load.bill_file

    def test_raises_on_unknown_slot(self):
        load = LoadFactory()
        with pytest.raises(ValidationError):
            set_load_file(load=load, slot="unknown_slot", file=None)

    def test_all_slots_are_valid(self):
        assert set(FILE_SLOTS.keys()) == {
            "rate_file",
            "bill_file",
            "lumper_file",
            "detention_file",
        }


@pytest.mark.django_db
class TestClearLoadFile:
    def test_clears_slot(self, tmp_path):
        load = LoadFactory()
        fake = tmp_path / "rate.pdf"
        fake.write_bytes(b"PDF")
        from django.core.files import File as DjangoFile

        with open(fake, "rb") as fh:
            set_load_file(
                load=load, slot="rate_file", file=DjangoFile(fh, name="rate.pdf")
            )
        load.refresh_from_db()
        assert load.rate_file

        clear_load_file(load=load, slot="rate_file")
        load.refresh_from_db()
        assert not load.rate_file

    def test_raises_on_unknown_slot(self):
        load = LoadFactory()
        with pytest.raises(ValidationError):
            clear_load_file(load=load, slot="bad_slot")


@pytest.mark.django_db
class TestDeleteLoad:
    def test_deletes_load(self):
        load = LoadFactory()
        pk = load.pk
        delete_load(load=load)
        assert not Load.objects.filter(pk=pk).exists()

    def test_load_no_longer_retrievable_after_delete(self):
        load = LoadFactory()
        pk = load.pk
        delete_load(load=load)
        with pytest.raises(Load.DoesNotExist):
            Load.objects.get(pk=pk)


@pytest.mark.django_db
class TestBulkDeleteLoads:
    def test_empty_list_returns_zero(self):
        LoadFactory.create_batch(3)
        count_before = Load.objects.count()
        deleted = bulk_delete_loads(ids=[])
        assert deleted == 0
        assert Load.objects.count() == count_before

    def test_deletes_all_specified_loads(self):
        loads = LoadFactory.create_batch(3)
        ids = [load.pk for load in loads]
        deleted = bulk_delete_loads(ids=ids)
        assert deleted == 3
        assert not Load.objects.filter(pk__in=ids).exists()

    def test_ignores_nonexistent_ids(self):
        load = LoadFactory()
        deleted = bulk_delete_loads(ids=[load.pk, 99999, 88888])
        assert deleted == 1
        assert not Load.objects.filter(pk=load.pk).exists()

    def test_does_not_delete_loads_not_in_ids(self):
        keep = LoadFactory()
        remove = LoadFactory()
        bulk_delete_loads(ids=[remove.pk])
        assert Load.objects.filter(pk=keep.pk).exists()
