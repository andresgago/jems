"""Tests for report endpoints."""

import datetime

import pytest

from apps.accounting.models import Account
from apps.accounting.tests.factories import (
    DriverInvoiceFactory,
    RecordFactory,
)
from apps.brokers.tests.factories import BrokerFactory
from apps.drivers.models import DriverType
from apps.drivers.tests.factories import DriverFactory, DriverTypeFactory
from apps.fleet.models import Card, Truck
from apps.loads.tests.factories import (
    BusinessFactory,
    CityFactory,
    LoadFactory,
    StateFactory,
)
from apps.users.tests.factories import AdminUserFactory, DispatcherFactory


def _make_account(
    code: str, name: str = "Test", is_main: bool = False, no_tax: bool = False
) -> Account:
    obj, _ = Account.objects.get_or_create(
        code=code,
        defaults={
            "name": name,
            "is_active": True,
            "is_main": is_main,
            "no_tax": no_tax,
        },
    )
    return obj


@pytest.fixture()
def admin(db):
    return AdminUserFactory(password="pass")


@pytest.fixture()
def auth_client(admin, client):
    client.force_login(admin)
    return client


@pytest.fixture()
def api_client(admin):
    from rest_framework.test import APIClient

    c = APIClient()
    c.force_authenticate(user=admin)
    return c


# ---------------------------------------------------------------------------
# Financial report
# ---------------------------------------------------------------------------


class TestFinancialReport:
    url = "/api/v1/reports/financial/"

    def test_unauthenticated_rejected(self, db, client):
        resp = client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 401

    def test_missing_dates_returns_400(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == 400

    def test_empty_range_returns_zeroes(self, api_client, db):
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["net_profit"] == 0.0
        assert data["revenues"] == []
        assert data["expenses"] == []

    def test_revenue_appears_in_results(self, api_client, db):
        account = _make_account("90010", "Freight Income")
        RecordFactory(
            account=account, amount=1000.0, date=datetime.date(2024, 6, 15), progress=0
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert len(data["revenues"]) == 1
        assert data["revenues"][0]["amount"] == 1000.0
        assert data["total_revenues"] == 1000.0

    def test_expense_appears_in_results(self, api_client, db):
        account = _make_account("80050", "Driver Pay")
        RecordFactory(
            account=account, amount=-500.0, date=datetime.date(2024, 6, 15), progress=0
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert len(data["expenses"]) == 1
        assert data["expenses"][0]["amount"] == -500.0

    def test_net_profit_calculation(self, api_client, db):
        rev_account = _make_account("90010", "Freight Income")
        exp_account = _make_account("80050", "Driver Pay")
        RecordFactory(
            account=rev_account,
            amount=3000.0,
            date=datetime.date(2024, 3, 1),
            progress=0,
        )
        RecordFactory(
            account=exp_account,
            amount=-1000.0,
            date=datetime.date(2024, 3, 1),
            progress=0,
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert data["net_profit"] == pytest.approx(2000.0)

    def test_records_outside_date_range_excluded(self, api_client, db):
        account = _make_account("90010", "Freight Income")
        RecordFactory(
            account=account, amount=999.0, date=datetime.date(2023, 12, 31), progress=0
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert data["total_revenues"] == 0.0

    def test_driver_filter_narrows_results(self, api_client, db):
        account = _make_account("90010", "Freight Income")
        dt = DriverTypeFactory()
        driver = DriverFactory(driver_type=dt)
        other = DriverFactory(driver_type=dt)
        RecordFactory(
            account=account,
            amount=1000.0,
            date=datetime.date(2024, 1, 1),
            progress=0,
            driver=driver,
        )
        RecordFactory(
            account=account,
            amount=2000.0,
            date=datetime.date(2024, 1, 1),
            progress=0,
            driver=other,
        )
        resp = api_client.get(
            self.url,
            {
                "date_begin": "2024-01-01",
                "date_end": "2024-12-31",
                "driver": str(driver.pk),
            },
        )
        data = resp.json()
        assert data["total_revenues"] == pytest.approx(1000.0)

    def test_in_progress_records_excluded(self, api_client, db):
        account = _make_account("90010", "Freight Income")
        RecordFactory(
            account=account, amount=500.0, date=datetime.date(2024, 6, 1), progress=1
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert data["total_revenues"] == 0.0


# ---------------------------------------------------------------------------
# Invoice report
# ---------------------------------------------------------------------------


class TestInvoiceReport:
    url = "/api/v1/reports/invoice/"

    def test_unauthenticated_rejected(self, db, client):
        resp = client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 401

    def test_missing_dates_returns_400(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == 400

    def test_empty_returns_zero(self, api_client, db):
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["net_profit"] == 0.0

    def test_invoice_filtering_by_load_list(self, api_client, db):
        account = _make_account("90010", "Freight Income")
        solo_type, _ = DriverType.objects.get_or_create(
            pk=4, defaults={"name": "Solo Driver", "is_active": True}
        )
        driver = DriverFactory(driver_type=solo_type)
        load = LoadFactory(payment=2000.0)
        invoice = DriverInvoiceFactory(
            driver=driver, date=datetime.date(2024, 1, 10), load_list=str(load.pk)
        )
        RecordFactory(
            account=account,
            amount=2000.0,
            date=datetime.date(2024, 1, 5),
            progress=0,
            driver=driver,
            load=load,
            is_automatic=False,
        )

        resp = api_client.get(
            self.url,
            {
                "date_begin": "2024-01-01",
                "date_end": "2024-01-31",
                "invoice": str(invoice.pk),
            },
        )
        data = resp.json()
        assert data["total_revenues"] == pytest.approx(2000.0)


# ---------------------------------------------------------------------------
# IFTA report
# ---------------------------------------------------------------------------


class TestIftaReport:
    url = "/api/v1/reports/ifta/"

    def test_unauthenticated_rejected(self, db, client):
        resp = client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 401

    def test_missing_dates_returns_400(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == 400

    def test_empty_returns_zero(self, api_client, db):
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_gallons"] == 0.0
        assert data["rows"] == []

    def test_gallons_grouped_by_state(self, api_client, db):
        state = StateFactory()
        city = CityFactory(state=state)
        account = _make_account("80030", "Fuel")
        RecordFactory(
            account=account,
            quantity=55.5,
            date=datetime.date(2024, 3, 1),
            city=city,
            progress=0,
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert len(data["rows"]) == 1
        assert data["rows"][0]["state_abbreviation"] == state.abbreviation
        assert data["rows"][0]["gallons"] == pytest.approx(55.5)
        assert data["total_gallons"] == pytest.approx(55.5)

    def test_gallons_outside_date_range_excluded(self, api_client, db):
        state = StateFactory()
        city = CityFactory(state=state)
        account = _make_account("80030", "Fuel")
        RecordFactory(
            account=account,
            quantity=10.0,
            date=datetime.date(2023, 12, 31),
            city=city,
            progress=0,
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert data["total_gallons"] == 0.0

    def test_card_breakdown_nested(self, api_client, db):
        state = StateFactory()
        city = CityFactory(state=state)
        card = Card.objects.create(number="CARD001")
        account = _make_account("80030", "Fuel")
        RecordFactory(
            account=account,
            quantity=20.0,
            date=datetime.date(2024, 4, 1),
            city=city,
            card=card,
            progress=0,
        )
        RecordFactory(
            account=account,
            quantity=30.0,
            date=datetime.date(2024, 4, 2),
            city=city,
            card=None,
            progress=0,
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert data["rows"][0]["gallons"] == pytest.approx(50.0)
        assert len(data["rows"][0]["cards"]) == 1
        assert data["rows"][0]["cards"][0]["card_number"] == "CARD001"
        assert data["rows"][0]["cards"][0]["gallons"] == pytest.approx(20.0)


# ---------------------------------------------------------------------------
# Tax report
# ---------------------------------------------------------------------------


class TestTaxReport:
    url = "/api/v1/reports/tax/"

    def test_unauthenticated_rejected(self, db, client):
        resp = client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 401

    def test_missing_dates_returns_400(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == 400

    def test_empty_returns_all_sections(self, api_client, db):
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "drivers" in data
        assert "owners" in data
        assert "dispatchers" in data

    def test_driver_tax_in_correct_section(self, api_client, db):
        _make_account("80050", "Driver Pay")
        solo_type, _ = DriverType.objects.get_or_create(
            pk=4, defaults={"name": "Solo Driver", "is_active": True}
        )
        driver = DriverFactory(driver_type=solo_type)
        tax_account = Account.objects.get(code="80050")
        RecordFactory(
            account=tax_account,
            amount=-800.0,
            date=datetime.date(2024, 5, 1),
            driver=driver,
            progress=0,
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert len(data["drivers"]["rows"]) >= 1
        driver_row = next(
            (r for r in data["drivers"]["rows"] if r["id"] == driver.pk), None
        )
        assert driver_row is not None
        assert driver_row["tax"] == pytest.approx(-800.0)

    def test_option_1_includes_revenues(self, api_client, db):
        resp = api_client.get(
            self.url,
            {"date_begin": "2024-01-01", "date_end": "2024-12-31", "option": "1"},
        )
        data = resp.json()
        assert "total_revenue" in data["drivers"]
        assert "total_revenue" in data["owners"]
        assert "total_revenue" in data["dispatchers"]

    def test_dispatcher_tax_in_correct_section(self, api_client, db):
        _make_account("80052", "Dispatcher Pay")
        dispatcher = DispatcherFactory()
        disp_account = Account.objects.get(code="80052")
        RecordFactory(
            account=disp_account,
            amount=-300.0,
            date=datetime.date(2024, 2, 1),
            dispatcher=dispatcher,
            progress=0,
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        disp_row = next(
            (r for r in data["dispatchers"]["rows"] if r["id"] == dispatcher.pk), None
        )
        assert disp_row is not None
        assert disp_row["tax"] == pytest.approx(-300.0)


# ---------------------------------------------------------------------------
# Category Tracking report
# ---------------------------------------------------------------------------


class TestCategoryTrackingReport:
    url = "/api/v1/reports/category-tracking/"

    def test_unauthenticated_rejected(self, db, client):
        resp = client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 401

    def test_missing_dates_returns_400(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == 400

    def test_empty_returns_empty_rows(self, api_client, db):
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["rows"] == []
        assert data["total_amount"] == 0.0

    def test_only_follow_1_records_included(self, api_client, db):
        account = _make_account("80060", "Parts")
        RecordFactory(
            account=account,
            amount=200.0,
            date=datetime.date(2024, 5, 1),
            follow=1,
            progress=0,
        )
        RecordFactory(
            account=account,
            amount=300.0,
            date=datetime.date(2024, 5, 1),
            follow=0,
            progress=0,
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert len(data["rows"]) == 1
        assert data["total_amount"] == pytest.approx(200.0)

    def test_totals_are_correct(self, api_client, db):
        account = _make_account("80060", "Parts")
        RecordFactory(
            account=account,
            amount=100.0,
            quantity=2.0,
            date=datetime.date(2024, 1, 1),
            follow=1,
            progress=0,
        )
        RecordFactory(
            account=account,
            amount=50.0,
            quantity=1.0,
            date=datetime.date(2024, 1, 2),
            follow=1,
            progress=0,
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert data["total_amount"] == pytest.approx(150.0)
        assert data["total_quantity"] == pytest.approx(3.0)

    def test_truck_filter_works(self, api_client, db):
        account = _make_account("80060", "Parts")
        from apps.fleet.models import TruckType

        truck_type = TruckType.objects.create(name="Test Type")
        truck = Truck.objects.create(number="T001", truck_type=truck_type, status=1)
        other_truck = Truck.objects.create(
            number="T002", truck_type=truck_type, status=1
        )
        RecordFactory(
            account=account,
            amount=100.0,
            date=datetime.date(2024, 1, 1),
            follow=1,
            progress=0,
            truck=truck,
        )
        RecordFactory(
            account=account,
            amount=200.0,
            date=datetime.date(2024, 1, 1),
            follow=1,
            progress=0,
            truck=other_truck,
        )
        resp = api_client.get(
            self.url,
            {
                "date_begin": "2024-01-01",
                "date_end": "2024-12-31",
                "truck": str(truck.pk),
            },
        )
        data = resp.json()
        assert len(data["rows"]) == 1
        assert data["total_amount"] == pytest.approx(100.0)

    def test_date_range_filter_works(self, api_client, db):
        account = _make_account("80060", "Parts")
        RecordFactory(
            account=account,
            amount=500.0,
            date=datetime.date(2024, 7, 1),
            follow=1,
            progress=0,
        )
        RecordFactory(
            account=account,
            amount=100.0,
            date=datetime.date(2023, 12, 31),
            follow=1,
            progress=0,
        )
        resp = api_client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        data = resp.json()
        assert len(data["rows"]) == 1
        assert data["total_amount"] == pytest.approx(500.0)


# ---------------------------------------------------------------------------
# Broker Summary report
# ---------------------------------------------------------------------------


class TestBrokerSummaryReport:
    url = "/api/v1/reports/broker-summary/"

    def test_unauthenticated_rejected(self, db, client):
        resp = client.get(self.url, {"year": "2024"})
        assert resp.status_code == 401

    def test_missing_year_returns_400(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == 400

    def test_invalid_year_returns_400(self, api_client):
        resp = api_client.get(self.url, {"year": "abc"})
        assert resp.status_code == 400

    def test_empty_returns_empty_brokers(self, api_client, db):
        resp = api_client.get(self.url, {"year": "2024"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["brokers"] == []

    def test_broker_with_revenue_appears(self, api_client, db):
        _make_account("90010", "Freight Income")
        broker = BrokerFactory()
        load = LoadFactory(broker=broker, payment=5000.0)
        rev_account = Account.objects.get(code="90010")
        RecordFactory(
            account=rev_account,
            amount=5000.0,
            date=datetime.date(2024, 6, 1),
            load=load,
            progress=0,
        )
        resp = api_client.get(self.url, {"year": "2024"})
        data = resp.json()
        assert len(data["brokers"]) >= 1
        row = next((b for b in data["brokers"] if b["id"] == broker.pk), None)
        assert row is not None
        assert row["revenue"] == pytest.approx(5000.0)

    def test_option_1_returns_total(self, api_client, db):
        resp = api_client.get(self.url, {"year": "2024", "option": "1"})
        data = resp.json()
        assert "total_revenue" in data
        assert "total_prior_revenue" in data

    def test_broker_without_revenue_excluded(self, api_client, db):
        BrokerFactory()
        resp = api_client.get(self.url, {"year": "2024"})
        data = resp.json()
        assert data["brokers"] == []

    def test_brokers_sorted_by_revenue_desc(self, api_client, db):
        _make_account("90010", "Freight Income")
        b1 = BrokerFactory()
        b2 = BrokerFactory()
        rev_account = Account.objects.get(code="90010")
        for broker, amount in [(b1, 1000.0), (b2, 3000.0)]:
            load = LoadFactory(broker=broker, payment=amount)
            RecordFactory(
                account=rev_account,
                amount=amount,
                date=datetime.date(2024, 3, 1),
                load=load,
                progress=0,
            )
        resp = api_client.get(self.url, {"year": "2024"})
        data = resp.json()
        revenues = [r["revenue"] for r in data["brokers"] if r["id"] in (b1.pk, b2.pk)]
        assert revenues == sorted(revenues, reverse=True)


# ---------------------------------------------------------------------------
# Shipper-Receiver report
# ---------------------------------------------------------------------------


class TestShipperReceiverReport:
    url = "/api/v1/reports/shipper-receiver/"

    def test_unauthenticated_rejected(self, db, client):
        resp = client.get(self.url, {"year": "2024"})
        assert resp.status_code == 401

    def test_missing_year_returns_400(self, api_client):
        resp = api_client.get(self.url)
        assert resp.status_code == 400

    def test_invalid_year_returns_400(self, api_client):
        resp = api_client.get(self.url, {"year": "xyz"})
        assert resp.status_code == 400

    def test_empty_returns_empty_pairs(self, api_client, db):
        resp = api_client.get(self.url, {"year": "2024"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["pairs"] == []
        assert data["total_deliveries"] == 0

    def test_pairs_counted_correctly(self, api_client, db):
        shipper = BusinessFactory()
        receiver = BusinessFactory()
        for _ in range(3):
            LoadFactory(
                execute=True,
                shipper=shipper,
                receiver=receiver,
                pickup_date=datetime.datetime(
                    2024, 4, 10, tzinfo=datetime.timezone.utc
                ),
            )
        resp = api_client.get(self.url, {"year": "2024"})
        data = resp.json()
        assert len(data["pairs"]) == 1
        assert data["pairs"][0]["total"] == 3
        assert data["total_deliveries"] == 3

    def test_option_1_monthly_breakdown(self, api_client, db):
        resp = api_client.get(self.url, {"year": "2024", "option": "1"})
        data = resp.json()
        assert data["option"] == 1

    def test_non_executed_loads_excluded(self, api_client, db):
        shipper = BusinessFactory()
        receiver = BusinessFactory()
        LoadFactory(
            execute=False,
            shipper=shipper,
            receiver=receiver,
            pickup_date=datetime.datetime(2024, 4, 10, tzinfo=datetime.timezone.utc),
        )
        resp = api_client.get(self.url, {"year": "2024"})
        data = resp.json()
        assert data["pairs"] == []

    def test_same_shipper_and_receiver_excluded(self, api_client, db):
        biz = BusinessFactory()
        LoadFactory(
            execute=True,
            shipper=biz,
            receiver=biz,
            pickup_date=datetime.datetime(2024, 4, 10, tzinfo=datetime.timezone.utc),
        )
        resp = api_client.get(self.url, {"year": "2024"})
        data = resp.json()
        assert data["pairs"] == []
