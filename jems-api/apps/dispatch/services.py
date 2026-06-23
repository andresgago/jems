from __future__ import annotations

import datetime
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import Sum

from .exceptions import (
    InvoiceAlreadyClosedError,
    InvoiceAlreadyOpenError,
    WorkAlreadyFinishedError,
)
from .models import (
    DispatcherWork,
    DispatcherWorkInvoiceByHour,
    DispatcherWorkInvoiceByPercent,
)

User = get_user_model()


# ── Dispatcher Work ───────────────────────────────────────────────────────────


def create_dispatcher_work(
    *,
    start: datetime.datetime,
    end: datetime.datetime,
    title: str,
    dispatcher: Any | None = None,
    session: str = "",
    invoice_percent: DispatcherWorkInvoiceByPercent | None = None,
    invoice_hour: DispatcherWorkInvoiceByHour | None = None,
) -> DispatcherWork:
    work = DispatcherWork(
        start=start,
        end=end,
        title=title,
        dispatcher=dispatcher,
        session=session,
        invoice_percent=invoice_percent,
        invoice_hour=invoice_hour,
    )
    work.full_clean()
    work.save()
    return work


def update_dispatcher_work(*, work: DispatcherWork, **kwargs: Any) -> DispatcherWork:
    for field, value in kwargs.items():
        setattr(work, field, value)
    work.full_clean()
    work.save()
    return work


def finish_dispatcher_work(*, work: DispatcherWork) -> DispatcherWork:
    if work.is_finished:
        raise WorkAlreadyFinishedError("Work session is already finished.")
    work.is_finished = True
    work.save(update_fields=["is_finished"])
    return work


def mark_dispatcher_work_paid(*, work: DispatcherWork) -> DispatcherWork:
    work.is_paid = True
    work.save(update_fields=["is_paid"])
    return work


def delete_dispatcher_work(*, work: DispatcherWork) -> None:
    work.delete()


# ── Invoice By Percent ────────────────────────────────────────────────────────


def create_invoice_by_percent(
    *,
    dispatcher: Any | None = None,
    date: datetime.date,
    start: datetime.datetime,
    end: datetime.datetime,
    percent: Decimal | float,
    **kwargs: Any,
) -> DispatcherWorkInvoiceByPercent:
    last = (
        DispatcherWorkInvoiceByPercent.objects.order_by("-number")
        .values_list("number", flat=True)
        .first()
    )
    number = (last or 0) + 1
    invoice = DispatcherWorkInvoiceByPercent(
        number=number,
        dispatcher=dispatcher,
        date=date,
        start=start,
        end=end,
        percent=percent,
        **kwargs,
    )
    invoice.full_clean()
    invoice.save()
    return invoice


def update_invoice_by_percent(
    *, invoice: DispatcherWorkInvoiceByPercent, **kwargs: Any
) -> DispatcherWorkInvoiceByPercent:
    for field, value in kwargs.items():
        setattr(invoice, field, value)
    invoice.full_clean()
    invoice.save()
    return invoice


def close_invoice_by_percent(
    *,
    invoice: DispatcherWorkInvoiceByPercent,
) -> DispatcherWorkInvoiceByPercent:
    if invoice.status == DispatcherWorkInvoiceByPercent.Status.CLOSED:
        raise InvoiceAlreadyClosedError("Invoice is already closed.")
    invoice.status = DispatcherWorkInvoiceByPercent.Status.CLOSED
    invoice.save(update_fields=["status"])
    return invoice


def open_invoice_by_percent(
    *,
    invoice: DispatcherWorkInvoiceByPercent,
) -> DispatcherWorkInvoiceByPercent:
    if invoice.status == DispatcherWorkInvoiceByPercent.Status.OPEN:
        raise InvoiceAlreadyOpenError("Invoice is already open.")
    invoice.status = DispatcherWorkInvoiceByPercent.Status.OPEN
    invoice.save(update_fields=["status"])
    return invoice


def calculate_amount_by_percent(*, invoice: DispatcherWorkInvoiceByPercent) -> Decimal:
    from apps.loads.models import Load  # avoid circular import at module level

    aggregate = Load.objects.filter(dispatch_invoice_percent=invoice).aggregate(
        total_payment=Sum("payment"),
        total_detention=Sum("detention"),
        total_drop_trailer=Sum("drop_trailer"),
    )
    total = (
        (aggregate["total_payment"] or 0)
        + (aggregate["total_detention"] or 0)
        + (aggregate["total_drop_trailer"] or 0)
    )
    return Decimal(str(total)) * invoice.percent / Decimal("100")


# ── Invoice By Hour ───────────────────────────────────────────────────────────


def create_invoice_by_hour(
    *,
    dispatcher: Any | None = None,
    date: datetime.date,
    start: datetime.datetime,
    end: datetime.datetime,
    pay_per_hour: Decimal | float,
    **kwargs: Any,
) -> DispatcherWorkInvoiceByHour:
    last = (
        DispatcherWorkInvoiceByHour.objects.order_by("-number")
        .values_list("number", flat=True)
        .first()
    )
    number = (last or 0) + 1
    invoice = DispatcherWorkInvoiceByHour(
        number=number,
        dispatcher=dispatcher,
        date=date,
        start=start,
        end=end,
        pay_per_hour=pay_per_hour,
        **kwargs,
    )
    invoice.full_clean()
    invoice.save()
    return invoice


def update_invoice_by_hour(
    *, invoice: DispatcherWorkInvoiceByHour, **kwargs: Any
) -> DispatcherWorkInvoiceByHour:
    for field, value in kwargs.items():
        setattr(invoice, field, value)
    invoice.full_clean()
    invoice.save()
    return invoice


def close_invoice_by_hour(
    *,
    invoice: DispatcherWorkInvoiceByHour,
) -> DispatcherWorkInvoiceByHour:
    if invoice.status == DispatcherWorkInvoiceByHour.Status.CLOSED:
        raise InvoiceAlreadyClosedError("Invoice is already closed.")
    invoice.status = DispatcherWorkInvoiceByHour.Status.CLOSED
    invoice.save(update_fields=["status"])
    return invoice


def open_invoice_by_hour(
    *,
    invoice: DispatcherWorkInvoiceByHour,
) -> DispatcherWorkInvoiceByHour:
    if invoice.status == DispatcherWorkInvoiceByHour.Status.OPEN:
        raise InvoiceAlreadyOpenError("Invoice is already open.")
    invoice.status = DispatcherWorkInvoiceByHour.Status.OPEN
    invoice.save(update_fields=["status"])
    return invoice


def calculate_amount_by_hour(*, invoice: DispatcherWorkInvoiceByHour) -> Decimal:
    sessions = DispatcherWork.objects.filter(
        invoice_hour=invoice, is_paid=True, is_finished=True
    )
    total_hours = sum(session.duration_hours for session in sessions)
    return Decimal(str(total_hours)) * Decimal(str(invoice.pay_per_hour))
