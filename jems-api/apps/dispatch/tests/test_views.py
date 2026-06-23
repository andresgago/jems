import datetime

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.dispatch.models import DispatcherWorkInvoiceByHour, DispatcherWorkInvoiceByPercent
from apps.dispatch.tests.factories import (
    DispatcherWorkFactory,
    DispatcherWorkInvoiceByHourFactory,
    DispatcherWorkInvoiceByPercentFactory,
    UserFactory,
)

START = "2024-01-01T08:00:00Z"
END = "2024-01-31T17:00:00Z"
DATE = str(datetime.date(2024, 1, 31))


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


# ── Dispatcher Work ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestDispatcherWorkList:
    def test_lists_work_sessions(self, auth_client):
        client, _ = auth_client
        DispatcherWorkFactory.create_batch(3)
        response = client.get(reverse("dispatcher-work-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("dispatcher-work-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_filter_by_dispatcher(self, auth_client):
        client, _ = auth_client
        user = UserFactory()
        DispatcherWorkFactory(dispatcher=user)
        DispatcherWorkFactory()
        response = client.get(reverse("dispatcher-work-list") + f"?dispatcher={user.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(w["dispatcher"] == user.pk for w in response.data)


@pytest.mark.django_db
class TestDispatcherWorkCreate:
    def test_creates_work_session(self, auth_client):
        client, user = auth_client
        payload = {
            "title": "Morning session",
            "dispatcher": user.pk,
            "start": "2024-01-15T09:00:00Z",
            "end": "2024-01-15T17:00:00Z",
        }
        response = client.post(reverse("dispatcher-work-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["title"] == "Morning session"
        assert response.data["is_finished"] is False


@pytest.mark.django_db
class TestDispatcherWorkDetail:
    def test_retrieves_work(self, auth_client):
        client, _ = auth_client
        work = DispatcherWorkFactory()
        response = client.get(reverse("dispatcher-work-detail", kwargs={"pk": work.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == work.pk

    def test_updates_title(self, auth_client):
        client, _ = auth_client
        work = DispatcherWorkFactory(title="Old")
        response = client.patch(
            reverse("dispatcher-work-detail", kwargs={"pk": work.pk}),
            {"title": "New"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["title"] == "New"

    def test_deletes_work(self, auth_client):
        client, _ = auth_client
        work = DispatcherWorkFactory()
        response = client.delete(reverse("dispatcher-work-detail", kwargs={"pk": work.pk}))
        assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestDispatcherWorkFinish:
    def test_finishes_work(self, auth_client):
        client, _ = auth_client
        work = DispatcherWorkFactory(is_finished=False)
        response = client.post(reverse("dispatcher-work-finish", kwargs={"pk": work.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_finished"] is True

    def test_finish_already_finished_returns_400(self, auth_client):
        client, _ = auth_client
        work = DispatcherWorkFactory(is_finished=True)
        response = client.post(reverse("dispatcher-work-finish", kwargs={"pk": work.pk}))
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestDispatcherWorkMarkPaid:
    def test_marks_work_as_paid(self, auth_client):
        client, _ = auth_client
        work = DispatcherWorkFactory(is_paid=False)
        response = client.post(reverse("dispatcher-work-mark-paid", kwargs={"pk": work.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_paid"] is True


# ── Invoice By Percent ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestInvoiceByPercentList:
    def test_lists_invoices(self, auth_client):
        client, _ = auth_client
        DispatcherWorkInvoiceByPercentFactory.create_batch(2)
        response = client.get(reverse("dispatch-invoice-percent-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 2

    def test_filter_by_status(self, auth_client):
        client, _ = auth_client
        DispatcherWorkInvoiceByPercentFactory(status=DispatcherWorkInvoiceByPercent.Status.OPEN)
        DispatcherWorkInvoiceByPercentFactory(status=DispatcherWorkInvoiceByPercent.Status.CLOSED)
        response = client.get(
            reverse("dispatch-invoice-percent-list")
            + f"?status={DispatcherWorkInvoiceByPercent.Status.OPEN}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert all(i["status"] == DispatcherWorkInvoiceByPercent.Status.OPEN for i in response.data)


@pytest.mark.django_db
class TestInvoiceByPercentCreate:
    def test_creates_invoice(self, auth_client):
        client, user = auth_client
        payload = {
            "dispatcher": user.pk,
            "date": DATE,
            "start": START,
            "end": END,
            "percent": "5.00",
        }
        response = client.post(reverse("dispatch-invoice-percent-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert float(response.data["percent"]) == 5.0


@pytest.mark.django_db
class TestInvoiceByPercentCloseOpen:
    def test_closes_invoice(self, auth_client):
        client, _ = auth_client
        invoice = DispatcherWorkInvoiceByPercentFactory(
            status=DispatcherWorkInvoiceByPercent.Status.OPEN
        )
        response = client.post(
            reverse("dispatch-invoice-percent-close", kwargs={"pk": invoice.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == DispatcherWorkInvoiceByPercent.Status.CLOSED

    def test_opens_invoice(self, auth_client):
        client, _ = auth_client
        invoice = DispatcherWorkInvoiceByPercentFactory(
            status=DispatcherWorkInvoiceByPercent.Status.CLOSED
        )
        response = client.post(
            reverse("dispatch-invoice-percent-open", kwargs={"pk": invoice.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == DispatcherWorkInvoiceByPercent.Status.OPEN


# ── Invoice By Hour ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestInvoiceByHourList:
    def test_lists_invoices(self, auth_client):
        client, _ = auth_client
        DispatcherWorkInvoiceByHourFactory.create_batch(2)
        response = client.get(reverse("dispatch-invoice-hour-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 2


@pytest.mark.django_db
class TestInvoiceByHourCreate:
    def test_creates_invoice(self, auth_client):
        client, user = auth_client
        payload = {
            "dispatcher": user.pk,
            "date": DATE,
            "start": START,
            "end": END,
            "pay_per_hour": "15.00",
        }
        response = client.post(reverse("dispatch-invoice-hour-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert float(response.data["pay_per_hour"]) == 15.0


@pytest.mark.django_db
class TestInvoiceByHourCloseOpen:
    def test_closes_invoice(self, auth_client):
        client, _ = auth_client
        invoice = DispatcherWorkInvoiceByHourFactory(
            status=DispatcherWorkInvoiceByHour.Status.OPEN
        )
        response = client.post(
            reverse("dispatch-invoice-hour-close", kwargs={"pk": invoice.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == DispatcherWorkInvoiceByHour.Status.CLOSED

    def test_opens_invoice(self, auth_client):
        client, _ = auth_client
        invoice = DispatcherWorkInvoiceByHourFactory(
            status=DispatcherWorkInvoiceByHour.Status.CLOSED
        )
        response = client.post(
            reverse("dispatch-invoice-hour-open", kwargs={"pk": invoice.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == DispatcherWorkInvoiceByHour.Status.OPEN
