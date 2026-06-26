import datetime
import zoneinfo

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.dispatch.models import (
    DispatcherWorkInvoiceByHour,
    DispatcherWorkInvoiceByPercent,
)
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
        response = client.get(
            reverse("dispatcher-work-list") + f"?dispatcher={user.pk}"
        )
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
        response = client.delete(
            reverse("dispatcher-work-detail", kwargs={"pk": work.pk})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestDispatcherWorkFinish:
    def test_finishes_work(self, auth_client):
        client, _ = auth_client
        work = DispatcherWorkFactory(is_finished=False)
        response = client.post(
            reverse("dispatcher-work-finish", kwargs={"pk": work.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_finished"] is True

    def test_finish_already_finished_returns_400(self, auth_client):
        client, _ = auth_client
        work = DispatcherWorkFactory(is_finished=True)
        response = client.post(
            reverse("dispatcher-work-finish", kwargs={"pk": work.pk})
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestDispatcherWorkMarkPaid:
    def test_marks_work_as_paid(self, auth_client):
        client, _ = auth_client
        work = DispatcherWorkFactory(is_paid=False)
        response = client.post(
            reverse("dispatcher-work-mark-paid", kwargs={"pk": work.pk})
        )
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
        DispatcherWorkInvoiceByPercentFactory(
            status=DispatcherWorkInvoiceByPercent.Status.OPEN
        )
        DispatcherWorkInvoiceByPercentFactory(
            status=DispatcherWorkInvoiceByPercent.Status.CLOSED
        )
        response = client.get(
            reverse("dispatch-invoice-percent-list")
            + f"?status={DispatcherWorkInvoiceByPercent.Status.OPEN}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert all(
            i["status"] == DispatcherWorkInvoiceByPercent.Status.OPEN
            for i in response.data
        )


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


# ── Calendar endpoint ─────────────────────────────────────────────────────────

CALENDAR_URL = "/api/v1/dispatch/work/calendar/"
UTC = zoneinfo.ZoneInfo("UTC")


@pytest.mark.django_db
def test_calendar_unauthenticated(api_client):
    response = api_client.get(
        CALENDAR_URL, {"start": "2024-01-01", "end": "2024-01-31"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_calendar_requires_start_and_end(auth_client):
    client, _ = auth_client
    assert client.get(CALENDAR_URL).status_code == status.HTTP_400_BAD_REQUEST
    assert (
        client.get(CALENDAR_URL, {"start": "2024-01-01"}).status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        client.get(CALENDAR_URL, {"end": "2024-01-31"}).status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_calendar_invalid_date_returns_400(auth_client):
    client, _ = auth_client
    response = client.get(CALENDAR_URL, {"start": "not-a-date", "end": "2024-01-31"})
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_calendar_returns_events_in_range(auth_client):
    client, user = auth_client
    DispatcherWorkFactory(
        dispatcher=user,
        start=datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC),
    )
    # Outside range — should be excluded
    DispatcherWorkFactory(
        dispatcher=user,
        start=datetime.datetime(2024, 2, 1, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 2, 1, 17, 0, tzinfo=UTC),
    )
    response = client.get(
        CALENDAR_URL, {"start": "2024-01-01", "end": "2024-01-31", "self_only": "true"}
    )
    assert response.status_code == status.HTTP_200_OK
    assert len(response.data) == 1


@pytest.mark.django_db
def test_calendar_event_shape(auth_client):
    client, user = auth_client
    DispatcherWorkFactory(
        dispatcher=user,
        start=datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC),
        is_paid=True,
        is_finished=True,
    )
    response = client.get(
        CALENDAR_URL, {"start": "2024-01-01", "end": "2024-01-31", "self_only": "true"}
    )
    event = response.data[0]
    assert "id" in event
    assert "title" in event
    assert "start" in event
    assert "end" in event
    assert "backgroundColor" in event
    assert "borderColor" in event
    assert "textColor" in event
    assert "extendedProps" in event
    assert event["extendedProps"]["is_paid"] is True
    assert event["extendedProps"]["is_finished"] is True


@pytest.mark.django_db
def test_calendar_paid_event_is_green(auth_client):
    client, user = auth_client
    DispatcherWorkFactory(
        dispatcher=user,
        start=datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC),
        is_paid=True,
    )
    response = client.get(
        CALENDAR_URL, {"start": "2024-01-01", "end": "2024-01-31", "self_only": "true"}
    )
    assert response.data[0]["backgroundColor"] == "#00a65a"


@pytest.mark.django_db
def test_calendar_unpaid_event_is_red(auth_client):
    client, user = auth_client
    DispatcherWorkFactory(
        dispatcher=user,
        start=datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC),
        is_paid=False,
    )
    response = client.get(
        CALENDAR_URL, {"start": "2024-01-01", "end": "2024-01-31", "self_only": "true"}
    )
    assert response.data[0]["backgroundColor"] == "red"


@pytest.mark.django_db
def test_calendar_unfinished_title_has_in_progress_suffix(auth_client):
    client, user = auth_client
    DispatcherWorkFactory(
        dispatcher=user,
        title="Session A",
        start=datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC),
        is_finished=False,
    )
    response = client.get(
        CALENDAR_URL, {"start": "2024-01-01", "end": "2024-01-31", "self_only": "true"}
    )
    assert response.data[0]["title"] == "Session A (In progress)"


@pytest.mark.django_db
def test_calendar_finished_title_has_no_suffix(auth_client):
    client, user = auth_client
    DispatcherWorkFactory(
        dispatcher=user,
        title="Session B",
        start=datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC),
        is_finished=True,
    )
    response = client.get(
        CALENDAR_URL, {"start": "2024-01-01", "end": "2024-01-31", "self_only": "true"}
    )
    assert response.data[0]["title"] == "Session B"


@pytest.mark.django_db
def test_calendar_self_only_filters_to_current_user(auth_client):
    client, user = auth_client
    other = UserFactory()
    DispatcherWorkFactory(
        dispatcher=user,
        start=datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC),
    )
    DispatcherWorkFactory(
        dispatcher=other,
        start=datetime.datetime(2024, 1, 16, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 1, 16, 17, 0, tzinfo=UTC),
    )
    response = client.get(
        CALENDAR_URL, {"start": "2024-01-01", "end": "2024-01-31", "self_only": "true"}
    )
    assert len(response.data) == 1
    assert response.data[0]["id"] != str(other.id)


@pytest.mark.django_db
def test_calendar_all_returns_all_users_events(auth_client):
    client, user = auth_client
    other = UserFactory()
    DispatcherWorkFactory(
        dispatcher=user,
        start=datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC),
    )
    DispatcherWorkFactory(
        dispatcher=other,
        start=datetime.datetime(2024, 1, 16, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 1, 16, 17, 0, tzinfo=UTC),
    )
    response = client.get(
        CALENDAR_URL, {"start": "2024-01-01", "end": "2024-01-31", "self_only": "false"}
    )
    assert len(response.data) == 2


# ── Move endpoint ─────────────────────────────────────────────────────────────

MOVE_URL = "/api/v1/dispatch/work/{pk}/move/"


@pytest.mark.django_db
def test_move_unauthenticated(api_client):
    work = DispatcherWorkFactory()
    response = api_client.post(
        MOVE_URL.format(pk=work.pk), {"start": "2024-01-20T09:00:00Z"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_move_not_found(auth_client):
    client, _ = auth_client
    response = client.post(MOVE_URL.format(pk=99999), {"start": "2024-01-20T09:00:00Z"})
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_move_requires_start(auth_client):
    client, _ = auth_client
    work = DispatcherWorkFactory()
    response = client.post(MOVE_URL.format(pk=work.pk), {})
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_move_invalid_datetime_returns_400(auth_client):
    client, _ = auth_client
    work = DispatcherWorkFactory()
    response = client.post(MOVE_URL.format(pk=work.pk), {"start": "not-a-datetime"})
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_move_shifts_start_and_end_by_same_delta(auth_client):
    client, _ = auth_client
    original_start = datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC)
    original_end = datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC)  # 8h duration
    work = DispatcherWorkFactory(start=original_start, end=original_end)

    new_start = datetime.datetime(2024, 1, 16, 9, 0, tzinfo=UTC)  # +1 day
    response = client.post(
        MOVE_URL.format(pk=work.pk), {"start": "2024-01-16T09:00:00Z"}
    )
    assert response.status_code == status.HTTP_200_OK

    work.refresh_from_db()
    assert work.start == new_start
    assert work.end == datetime.datetime(2024, 1, 16, 17, 0, tzinfo=UTC)


@pytest.mark.django_db
def test_move_backwards_preserves_duration(auth_client):
    client, _ = auth_client
    original_start = datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC)
    original_end = datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC)
    work = DispatcherWorkFactory(start=original_start, end=original_end)

    response = client.post(
        MOVE_URL.format(pk=work.pk), {"start": "2024-01-14T09:00:00Z"}
    )
    assert response.status_code == status.HTTP_200_OK

    work.refresh_from_db()
    assert work.start == datetime.datetime(2024, 1, 14, 9, 0, tzinfo=UTC)
    assert work.end == datetime.datetime(2024, 1, 14, 17, 0, tzinfo=UTC)


@pytest.mark.django_db
def test_move_returns_updated_work_serialized(auth_client):
    client, _ = auth_client
    work = DispatcherWorkFactory(
        start=datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
        end=datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC),
    )
    response = client.post(
        MOVE_URL.format(pk=work.pk), {"start": "2024-01-16T09:00:00Z"}
    )
    assert response.status_code == status.HTTP_200_OK
    assert response.data["id"] == work.pk
    assert "2024-01-16" in response.data["start"]
