import datetime
import zoneinfo

import pytest
from django.core.exceptions import ValidationError

UTC = zoneinfo.ZoneInfo("UTC")

from apps.dispatch.models import DispatcherWork, DispatcherWorkInvoiceByHour, DispatcherWorkInvoiceByPercent
from apps.dispatch.services import (
    calculate_amount_by_hour,
    close_invoice_by_hour,
    close_invoice_by_percent,
    create_dispatcher_work,
    create_invoice_by_hour,
    create_invoice_by_percent,
    delete_dispatcher_work,
    finish_dispatcher_work,
    mark_dispatcher_work_paid,
    open_invoice_by_hour,
    open_invoice_by_percent,
    update_dispatcher_work,
    update_invoice_by_hour,
    update_invoice_by_percent,
)
from apps.dispatch.exceptions import (
    InvoiceAlreadyClosedError,
    InvoiceAlreadyOpenError,
    WorkAlreadyFinishedError,
)
from apps.dispatch.tests.factories import (
    DispatcherWorkFactory,
    DispatcherWorkInvoiceByHourFactory,
    DispatcherWorkInvoiceByPercentFactory,
    UserFactory,
)

START = datetime.datetime(2024, 1, 1, 8, 0, tzinfo=UTC)
END = datetime.datetime(2024, 1, 31, 17, 0, tzinfo=UTC)
DATE = datetime.date(2024, 1, 31)


# ── DispatcherWork ────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCreateDispatcherWork:
    def test_creates_work_session(self):
        user = UserFactory()
        work = create_dispatcher_work(
            start=datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
            end=datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC),
            title="Dispatch session",
            dispatcher=user,
        )
        assert work.pk is not None
        assert work.is_finished is False
        assert work.is_paid is False

    def test_work_starts_unfinished_and_unpaid(self):
        work = create_dispatcher_work(
            start=datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC),
            end=datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC),
            title="Test",
        )
        assert not work.is_finished
        assert not work.is_paid


@pytest.mark.django_db
class TestUpdateDispatcherWork:
    def test_updates_title(self):
        work = DispatcherWorkFactory(title="Old")
        updated = update_dispatcher_work(work=work, title="New")
        assert updated.title == "New"


@pytest.mark.django_db
class TestFinishDispatcherWork:
    def test_finishes_work(self):
        work = DispatcherWorkFactory(is_finished=False)
        finished = finish_dispatcher_work(work=work)
        assert finished.is_finished is True

    def test_cannot_finish_twice(self):
        work = DispatcherWorkFactory(is_finished=True)
        with pytest.raises(WorkAlreadyFinishedError):
            finish_dispatcher_work(work=work)


@pytest.mark.django_db
class TestMarkDispatcherWorkPaid:
    def test_marks_as_paid(self):
        work = DispatcherWorkFactory(is_paid=False)
        paid = mark_dispatcher_work_paid(work=work)
        assert paid.is_paid is True


@pytest.mark.django_db
class TestDeleteDispatcherWork:
    def test_deletes_work(self):
        work = DispatcherWorkFactory()
        pk = work.pk
        delete_dispatcher_work(work=work)
        assert not DispatcherWork.objects.filter(pk=pk).exists()


# ── Invoice By Percent ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCreateInvoiceByPercent:
    def test_creates_with_auto_number(self):
        invoice = create_invoice_by_percent(date=DATE, start=START, end=END, percent=5.0)
        assert invoice.pk is not None
        assert invoice.number >= 1
        assert invoice.status == DispatcherWorkInvoiceByPercent.Status.OPEN

    def test_sequential_numbers(self):
        inv1 = create_invoice_by_percent(date=DATE, start=START, end=END, percent=5.0)
        inv2 = create_invoice_by_percent(date=DATE, start=START, end=END, percent=6.0)
        assert inv2.number == inv1.number + 1


@pytest.mark.django_db
class TestUpdateInvoiceByPercent:
    def test_updates_percent(self):
        invoice = DispatcherWorkInvoiceByPercentFactory(percent=5.0)
        updated = update_invoice_by_percent(invoice=invoice, percent=7.5)
        assert float(updated.percent) == 7.5


@pytest.mark.django_db
class TestCloseOpenInvoiceByPercent:
    def test_closes_open_invoice(self):
        invoice = DispatcherWorkInvoiceByPercentFactory(
            status=DispatcherWorkInvoiceByPercent.Status.OPEN
        )
        closed = close_invoice_by_percent(invoice=invoice)
        assert closed.status == DispatcherWorkInvoiceByPercent.Status.CLOSED

    def test_cannot_close_twice(self):
        invoice = DispatcherWorkInvoiceByPercentFactory(
            status=DispatcherWorkInvoiceByPercent.Status.CLOSED
        )
        with pytest.raises(InvoiceAlreadyClosedError):
            close_invoice_by_percent(invoice=invoice)

    def test_opens_closed_invoice(self):
        invoice = DispatcherWorkInvoiceByPercentFactory(
            status=DispatcherWorkInvoiceByPercent.Status.CLOSED
        )
        opened = open_invoice_by_percent(invoice=invoice)
        assert opened.status == DispatcherWorkInvoiceByPercent.Status.OPEN

    def test_cannot_open_twice(self):
        invoice = DispatcherWorkInvoiceByPercentFactory(
            status=DispatcherWorkInvoiceByPercent.Status.OPEN
        )
        with pytest.raises(InvoiceAlreadyOpenError):
            open_invoice_by_percent(invoice=invoice)


# ── Invoice By Hour ───────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestCreateInvoiceByHour:
    def test_creates_with_auto_number(self):
        invoice = create_invoice_by_hour(date=DATE, start=START, end=END, pay_per_hour=15.0)
        assert invoice.pk is not None
        assert invoice.number >= 1
        assert invoice.status == DispatcherWorkInvoiceByHour.Status.OPEN

    def test_sequential_numbers(self):
        inv1 = create_invoice_by_hour(date=DATE, start=START, end=END, pay_per_hour=15.0)
        inv2 = create_invoice_by_hour(date=DATE, start=START, end=END, pay_per_hour=20.0)
        assert inv2.number == inv1.number + 1


@pytest.mark.django_db
class TestUpdateInvoiceByHour:
    def test_updates_pay_per_hour(self):
        invoice = DispatcherWorkInvoiceByHourFactory(pay_per_hour=15.0)
        updated = update_invoice_by_hour(invoice=invoice, pay_per_hour=18.0)
        assert float(updated.pay_per_hour) == 18.0


@pytest.mark.django_db
class TestCloseOpenInvoiceByHour:
    def test_closes_open_invoice(self):
        invoice = DispatcherWorkInvoiceByHourFactory(
            status=DispatcherWorkInvoiceByHour.Status.OPEN
        )
        closed = close_invoice_by_hour(invoice=invoice)
        assert closed.status == DispatcherWorkInvoiceByHour.Status.CLOSED

    def test_cannot_close_twice(self):
        invoice = DispatcherWorkInvoiceByHourFactory(
            status=DispatcherWorkInvoiceByHour.Status.CLOSED
        )
        with pytest.raises(InvoiceAlreadyClosedError):
            close_invoice_by_hour(invoice=invoice)

    def test_opens_closed_invoice(self):
        invoice = DispatcherWorkInvoiceByHourFactory(
            status=DispatcherWorkInvoiceByHour.Status.CLOSED
        )
        opened = open_invoice_by_hour(invoice=invoice)
        assert opened.status == DispatcherWorkInvoiceByHour.Status.OPEN


@pytest.mark.django_db
class TestCalculateAmountByHour:
    def test_calculates_hours_times_rate(self):
        invoice = DispatcherWorkInvoiceByHourFactory(pay_per_hour=10.0)
        DispatcherWorkFactory(
            invoice_hour=invoice,
            is_finished=True,
            is_paid=True,
            start=datetime.datetime(2024, 1, 15, 8, 0, tzinfo=UTC),
            end=datetime.datetime(2024, 1, 15, 10, 0, tzinfo=UTC),
        )
        amount = calculate_amount_by_hour(invoice=invoice)
        assert float(amount) == 20.0

    def test_only_counts_finished_and_paid_sessions(self):
        invoice = DispatcherWorkInvoiceByHourFactory(pay_per_hour=10.0)
        DispatcherWorkFactory(
            invoice_hour=invoice,
            is_finished=True,
            is_paid=True,
            start=datetime.datetime(2024, 1, 15, 8, 0, tzinfo=UTC),
            end=datetime.datetime(2024, 1, 15, 10, 0, tzinfo=UTC),
        )
        DispatcherWorkFactory(
            invoice_hour=invoice,
            is_finished=False,
            is_paid=False,
            start=datetime.datetime(2024, 1, 15, 8, 0, tzinfo=UTC),
            end=datetime.datetime(2024, 1, 15, 12, 0, tzinfo=UTC),
        )
        amount = calculate_amount_by_hour(invoice=invoice)
        assert float(amount) == 20.0

    def test_empty_invoice_returns_zero(self):
        invoice = DispatcherWorkInvoiceByHourFactory(pay_per_hour=10.0)
        amount = calculate_amount_by_hour(invoice=invoice)
        assert float(amount) == 0.0
