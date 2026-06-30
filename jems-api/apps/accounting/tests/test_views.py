import datetime

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounting.models import Account, DriverInvoice, OwnerInvoice, Record
from apps.accounting.tests.factories import (
    AccountFactory,
    CategoryFactory,
    DriverFactory,
    DriverInvoiceFactory,
    RecordFactory,
    TruckOwnerFactory,
    TruckOwnerInvoiceFactory,
    UserFactory,
)
from apps.loads.tests.factories import CarrierFactory, LoadFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


# ── Accounts ──────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestAccountList:
    def test_lists_accounts(self, auth_client):
        client, _ = auth_client
        AccountFactory.create_batch(3)
        response = client.get(reverse("account-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("account-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestAccountCreate:
    def test_create_account(self, auth_client):
        client, _ = auth_client
        payload = {"code": "99001", "name": "Test Account", "is_active": True}
        response = client.post(reverse("account-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["code"] == "99001"

    def test_duplicate_code_rejected(self, auth_client):
        client, _ = auth_client
        AccountFactory(code="DUP001")
        response = client.post(
            reverse("account-list"), {"code": "DUP001", "name": "Dup"}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Categories ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCategoryList:
    def test_lists_active_categories(self, auth_client):
        client, _ = auth_client
        CategoryFactory.create_batch(2, is_active=True)
        CategoryFactory(is_active=False)
        response = client.get(reverse("category-list"))
        assert response.status_code == status.HTTP_200_OK
        assert all(c["is_active"] for c in response.data)


# ── Records ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestRecordList:
    def test_lists_records(self, auth_client):
        client, _ = auth_client
        RecordFactory.create_batch(3)
        response = client.get(reverse("record-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3

    def test_filter_by_driver(self, auth_client):
        client, _ = auth_client
        driver = DriverFactory()
        RecordFactory(driver=driver)
        RecordFactory()
        response = client.get(reverse("record-list") + f"?driver={driver.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(r["driver"] == driver.pk for r in response.data)


@pytest.mark.django_db
class TestRecordCreate:
    def test_create_record(self, auth_client):
        client, _ = auth_client
        account = AccountFactory()
        payload = {
            "date": str(datetime.date.today()),
            "amount": 300.0,
            "account": account.pk,
            "record_type": 2,
        }
        response = client.post(reverse("record-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["amount"] == 300.0


@pytest.mark.django_db
class TestRecordDelete:
    def test_deletes_record(self, auth_client):
        client, _ = auth_client
        record = RecordFactory()
        response = client.delete(reverse("record-detail", kwargs={"pk": record.pk}))
        assert response.status_code == status.HTTP_204_NO_CONTENT


# ── Driver Invoices ───────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestDriverInvoiceList:
    def test_lists_invoices(self, auth_client):
        client, _ = auth_client
        DriverInvoiceFactory.create_batch(2)
        response = client.get(reverse("driver-invoice-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 2

    def test_filter_by_status(self, auth_client):
        client, _ = auth_client
        DriverInvoiceFactory(status=DriverInvoice.Status.OPEN)
        DriverInvoiceFactory(status=DriverInvoice.Status.CLOSED)
        response = client.get(
            reverse("driver-invoice-list") + f"?status={DriverInvoice.Status.OPEN}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert all(i["status"] == DriverInvoice.Status.OPEN for i in response.data)


@pytest.mark.django_db
class TestDriverInvoiceCreate:
    def test_creates_invoice(self, auth_client):
        client, _ = auth_client
        driver = DriverFactory()
        payload = {
            "driver": driver.pk,
            "date": str(datetime.date.today()),
            "percent": 25.0,
        }
        response = client.post(reverse("driver-invoice-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["percent"] == 25.0


@pytest.mark.django_db
class TestDriverInvoiceClose:
    def test_closes_invoice(self, auth_client):
        client, _ = auth_client
        invoice = DriverInvoiceFactory(status=DriverInvoice.Status.OPEN)
        response = client.post(
            reverse("driver-invoice-close", kwargs={"pk": invoice.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == DriverInvoice.Status.CLOSED

    def test_opens_invoice(self, auth_client):
        client, _ = auth_client
        invoice = DriverInvoiceFactory(status=DriverInvoice.Status.CLOSED)
        response = client.post(
            reverse("driver-invoice-open", kwargs={"pk": invoice.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == DriverInvoice.Status.OPEN


# ── Driver Invoice Options ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestDriverInvoiceOptions:
    url = "/api/v1/accounting/driver-invoices/options/"

    def test_unauthenticated_rejected(self, client):
        resp = client.get(self.url)
        assert resp.status_code == 401

    def test_returns_all_invoices_without_filters(self, auth_client):
        client, _ = auth_client
        DriverInvoiceFactory.create_batch(3)
        resp = client.get(self.url)
        assert resp.status_code == 200
        assert len(resp.json()) >= 3

    def test_returns_only_open_invoices(self, auth_client):
        client, _ = auth_client
        open_invoice = DriverInvoiceFactory(status=DriverInvoice.Status.OPEN)
        DriverInvoiceFactory(status=DriverInvoice.Status.CLOSED)
        resp = client.get(self.url)
        assert resp.status_code == 200
        ids = {item["id"] for item in resp.json()}
        assert open_invoice.pk in ids
        assert len(ids) == 1

    def test_filters_by_date_range(self, auth_client):
        client, _ = auth_client
        DriverInvoiceFactory(date=datetime.date(2024, 3, 1))
        DriverInvoiceFactory(date=datetime.date(2023, 1, 1))
        resp = client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1

    def test_filters_by_driver(self, auth_client):
        client, _ = auth_client
        driver = DriverFactory()
        other = DriverFactory()
        DriverInvoiceFactory(driver=driver, date=datetime.date(2024, 1, 1))
        DriverInvoiceFactory(driver=other, date=datetime.date(2024, 1, 1))
        resp = client.get(
            self.url,
            {"date_begin": "2024-01-01", "date_end": "2024-12-31", "driver": driver.pk},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1

    def test_filters_by_comma_separated_drivers(self, auth_client):
        client, _ = auth_client
        driver = DriverFactory()
        other = DriverFactory()
        outside = DriverFactory()
        DriverInvoiceFactory(driver=driver, date=datetime.date(2024, 1, 1))
        DriverInvoiceFactory(driver=other, date=datetime.date(2024, 1, 1))
        DriverInvoiceFactory(driver=outside, date=datetime.date(2024, 1, 1))
        resp = client.get(
            self.url,
            {
                "date_begin": "2024-01-01",
                "date_end": "2024-12-31",
                "driver": f"{driver.pk},{other.pk}",
            },
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_filters_by_carrier(self, auth_client):
        from apps.carriers.tests.factories import CarrierFactory

        client, _ = auth_client
        carrier = CarrierFactory()
        other_carrier = CarrierFactory()
        driver = DriverFactory(carrier=carrier)
        other_driver = DriverFactory(carrier=other_carrier)
        DriverInvoiceFactory(driver=driver, date=datetime.date(2024, 1, 1))
        DriverInvoiceFactory(driver=other_driver, date=datetime.date(2024, 1, 1))
        resp = client.get(
            self.url,
            {
                "date_begin": "2024-01-01",
                "date_end": "2024-12-31",
                "carrier": carrier.pk,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["driver_name"] == driver.full_name

    def test_returns_id_and_number_fields(self, auth_client):
        client, _ = auth_client
        inv = DriverInvoiceFactory(date=datetime.date(2024, 6, 1))
        resp = client.get(
            self.url, {"date_begin": "2024-01-01", "date_end": "2024-12-31"}
        )
        assert resp.status_code == 200
        entry = next(e for e in resp.json() if e["id"] == inv.pk)
        assert "id" in entry
        assert "number" in entry
        assert "driver_name" in entry


# ── Owner Invoices ────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestOwnerInvoiceList:
    def test_lists_invoices(self, auth_client):
        client, _ = auth_client
        TruckOwnerInvoiceFactory.create_batch(2)
        response = client.get(reverse("owner-invoice-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 2


@pytest.mark.django_db
class TestOwnerInvoiceCreate:
    def test_creates_invoice(self, auth_client):
        client, _ = auth_client
        owner = TruckOwnerFactory()
        payload = {
            "owner": owner.pk,
            "date": str(datetime.date.today()),
            "percent": 80.0,
        }
        response = client.post(reverse("owner-invoice-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["percent"] == 80.0


@pytest.mark.django_db
class TestOwnerInvoiceClose:
    def test_closes_invoice(self, auth_client):
        client, _ = auth_client
        invoice = TruckOwnerInvoiceFactory(status=OwnerInvoice.Status.OPEN)
        response = client.post(
            reverse("owner-invoice-close", kwargs={"pk": invoice.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == OwnerInvoice.Status.CLOSED


# ── Category search ───────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCategorySearch:
    url = "/api/v1/accounting/categories/search/"

    def test_unauthenticated_rejected(self, api_client):
        response = api_client.get(self.url, {"q": "oil"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_short_query_returns_empty(self, auth_client):
        client, _ = auth_client
        CategoryFactory(name="Oil Filter", code="OF001")
        response = client.get(self.url, {"q": "oi"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_matches_by_name(self, auth_client):
        client, _ = auth_client
        CategoryFactory(name="Oil Filter", code="OF001")
        CategoryFactory(name="Brake Shoe", code="BS001")
        response = client.get(self.url, {"q": "oil"})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Oil Filter"

    def test_matches_by_code(self, auth_client):
        client, _ = auth_client
        CategoryFactory(name="Fuel Filter", code="FF001")
        CategoryFactory(name="Oil Change", code="OC002")
        response = client.get(self.url, {"q": "FF0"})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["code"] == "FF001"

    def test_includes_unit_of_measure_in_label(self, auth_client):
        from apps.accounting.tests.factories import CategoryTypeFactory

        client, _ = auth_client
        ct = CategoryTypeFactory(unit_of_measure="Gallons")
        CategoryFactory(name="Transmission Oil", code="TO001", category_type=ct)
        response = client.get(self.url, {"q": "Trans"})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert "Gallons" in response.data[0]["label"]

    def test_excludes_inactive_categories(self, auth_client):
        client, _ = auth_client
        CategoryFactory(name="Old Part", code="OP001", is_active=False)
        response = client.get(self.url, {"q": "Old"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_response_has_id_label_name_code_fields(self, auth_client):
        client, _ = auth_client
        CategoryFactory(name="Air Filter", code="AIR001")
        response = client.get(self.url, {"q": "Air"})
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        item = response.data[0]
        assert "id" in item
        assert "label" in item
        assert "name" in item
        assert "code" in item


# ── Driver Invoice Analysis ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestDriverInvoiceAnalysis:
    TODAY = datetime.date.today()
    URL = "/api/v1/accounting/driver-invoices/analysis/"

    def _params(self, **extra):
        return {"date_begin": str(self.TODAY), "date_end": str(self.TODAY), **extra}

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(self.URL, self._params())
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_date_begin_returns_400(self, auth_client):
        client, _ = auth_client
        response = client.get(self.URL, {"date_end": str(self.TODAY)})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_date_end_returns_400(self, auth_client):
        client, _ = auth_client
        response = client.get(self.URL, {"date_begin": str(self.TODAY)})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_invoices_in_date_range(self, auth_client):
        client, _ = auth_client
        inv = DriverInvoiceFactory(date=self.TODAY)
        response = client.get(self.URL, self._params())
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert inv.id in ids

    def test_excludes_invoices_outside_range(self, auth_client):
        client, _ = auth_client
        old_date = self.TODAY - datetime.timedelta(days=10)
        inv = DriverInvoiceFactory(date=old_date)
        response = client.get(self.URL, self._params())
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert inv.id not in ids

    def test_row_has_financial_fields(self, auth_client):
        client, _ = auth_client
        DriverInvoiceFactory(date=self.TODAY)
        response = client.get(self.URL, self._params())
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1
        row = response.data[0]
        for key in (
            "id",
            "number",
            "date",
            "driver_name",
            "carrier_name",
            "dispatcher_names",
            "load_count",
            "gross",
            "net",
            "acc_90010",
            "acc_90011",
            "acc_80030",
            "acc_80084",
        ):
            assert key in row, f"Missing field: {key}"

    def test_filter_by_driver(self, auth_client):
        client, _ = auth_client
        driver_a = DriverFactory()
        driver_b = DriverFactory()
        inv_a = DriverInvoiceFactory(date=self.TODAY, driver=driver_a)
        inv_b = DriverInvoiceFactory(date=self.TODAY, driver=driver_b)
        response = client.get(self.URL, self._params(driver=driver_a.id))
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert inv_a.id in ids
        assert inv_b.id not in ids

    def test_filter_by_carrier(self, auth_client):
        client, _ = auth_client
        carrier_a = CarrierFactory()
        carrier_b = CarrierFactory()
        driver_a = DriverFactory(carrier=carrier_a)
        driver_b = DriverFactory(carrier=carrier_b)
        inv_a = DriverInvoiceFactory(date=self.TODAY, driver=driver_a)
        inv_b = DriverInvoiceFactory(date=self.TODAY, driver=driver_b)
        response = client.get(self.URL, self._params(carrier=carrier_a.id))
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert inv_a.id in ids
        assert inv_b.id not in ids

    def test_filter_by_dispatcher(self, auth_client):
        client, _ = auth_client
        disp = UserFactory()
        inv = DriverInvoiceFactory(date=self.TODAY, load_list="")
        load = LoadFactory(dispatcher=disp)
        inv.load_list = str(load.id)
        inv.save()
        other_inv = DriverInvoiceFactory(date=self.TODAY, load_list="")
        response = client.get(self.URL, self._params(dispatcher=disp.id))
        assert response.status_code == status.HTTP_200_OK
        ids = [r["id"] for r in response.data]
        assert inv.id in ids
        assert other_inv.id not in ids

    def test_load_count_reflects_load_list(self, auth_client):
        client, _ = auth_client
        load1 = LoadFactory()
        load2 = LoadFactory()
        load3 = LoadFactory()
        inv = DriverInvoiceFactory(
            date=self.TODAY, load_list=f"|{load1.id}|{load2.id}|{load3.id}|"
        )
        response = client.get(self.URL, self._params())
        row = next(r for r in response.data if r["id"] == inv.id)
        assert row["load_count"] == 3

    def test_aggregated_account_amounts(self, auth_client):
        client, _ = auth_client
        acct, _ = Account.objects.get_or_create(
            code="90010", defaults={"name": "Income by Rate"}
        )
        inv = DriverInvoiceFactory(date=self.TODAY, load_list="")
        load = LoadFactory(payment=5000.0)
        inv.load_list = str(load.id)
        inv.save()
        Record.objects.create(
            date=self.TODAY, account=acct, amount=5000.0, load=load, is_automatic=True
        )
        response = client.get(self.URL, self._params())
        row = next(r for r in response.data if r["id"] == inv.id)
        assert row["acc_90010"] == 5000.0
        assert row["gross"] == 5000.0
