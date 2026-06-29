import datetime

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounting.models import DriverInvoice, OwnerInvoice
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
