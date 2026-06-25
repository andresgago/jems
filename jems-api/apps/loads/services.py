from datetime import datetime as _Datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.core.mail import EmailMessage, get_connection
from django.db import transaction
from django.db.models import Count, Sum
from django.template.loader import render_to_string
from django.utils import timezone

from .exceptions import InvalidStatusTransition
from .models import Load, LoadStop


def send_driver_info(
    carrier_id: int,
    driver_id: int,
    truck_id: int,
    trailer_id: int,
    broker_email: str,
) -> None:
    from apps.carriers.models import Carrier
    from apps.drivers.models import Driver
    from apps.fleet.models import Truck, Trailer

    carrier = Carrier.objects.get(pk=carrier_id)
    driver = Driver.objects.select_related("team_driver").get(pk=driver_id)
    truck = Truck.objects.get(pk=truck_id)
    trailer = Trailer.objects.get(pk=trailer_id)

    hour = timezone.localtime(timezone.now()).hour
    if hour < 12:
        greeting = "Good morning,"
    elif hour < 17:
        greeting = "Good afternoon,"
    else:
        greeting = "Good evening,"

    body = render_to_string(
        "loads/driver_info_email.html",
        {
            "greeting": greeting,
            "driver_name": driver.full_name,
            "driver_phone": driver.phone,
            "team_driver_name": (
                driver.team_driver.full_name if driver.team_driver else None
            ),
            "team_driver_phone": (
                driver.team_driver.phone if driver.team_driver else None
            ),
            "truck_number": truck.number,
            "trailer_number": trailer.number,
            "carrier_name": carrier.name,
            "carrier_mc": carrier.mc,
            "carrier_dot": carrier.dot_number,
        },
    )

    connection = get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend",
        host="smtp.gmail.com",
        port=587,
        username=carrier.no_reply_email,
        password=carrier.no_reply_password,
        use_tls=True,
        fail_silently=False,
    )

    recipients = [broker_email]
    cc = [carrier.cc_email] if carrier.cc_email else []

    msg = EmailMessage(
        subject="Driver information",
        body=body,
        from_email=f"{carrier.name} <{carrier.no_reply_email}>",
        to=recipients,
        cc=cc,
        connection=connection,
    )
    msg.content_subtype = "html"
    msg.send()


def get_load_broker_contacts(*, load: Load):
    """Return the selected broker contacts stored on a load, matching TMS CSV IDs."""
    from apps.brokers.models import BrokerContact

    contact_ids = [
        int(value)
        for value in str(load.broker_contacts or "").split(",")
        if value.strip().isdigit()
    ]
    if not contact_ids:
        return BrokerContact.objects.none()
    return BrokerContact.objects.filter(id__in=contact_ids).order_by("name")


# Maps PHP date('w') weekday (0=Sun…6=Sat) to TMS accounting_day (Tue=1…Mon=7, Sun=6).
_ACCOUNTING_DAYS: dict[int, int] = {0: 6, 1: 7, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5}
_ET = ZoneInfo("America/New_York")


def _accounting_day_from(dropoff: Any) -> int:
    """Return the TMS accounting_day for the given dropoff datetime."""
    if isinstance(dropoff, _Datetime) and dropoff.tzinfo is not None:
        dropoff = dropoff.astimezone(_ET)
    weekday = int(dropoff.strftime("%w"))  # 0=Sun … 6=Sat
    return _ACCOUNTING_DAYS[weekday]


# Status actions mirror the legacy loads grid dropdown, not a strict workflow state
# machine. The legacy UI shows Delivered and Detention for every non-detention load.
# Cancellation is intentionally absent here — it goes through cancel_load() which
# mirrors the legacy cancel() side effects (execute, history, miles flags).
_ALLOWED_TRANSITIONS: dict[int, set[int]] = {
    Load.Status.REGISTERED: {
        Load.Status.STARTED,
        Load.Status.FINISHED,
        Load.Status.DETENTION_PENDING,
    },
    Load.Status.STARTED: {
        Load.Status.FINISHED,
        Load.Status.DETENTION_PENDING,
    },
    Load.Status.DETENTION_PENDING: {Load.Status.FINISHED, Load.Status.CANCELLED},
    Load.Status.FINISHED: {
        Load.Status.FINISHED,
        Load.Status.DETENTION_PENDING,
    },
    Load.Status.CANCELLED: {
        Load.Status.FINISHED,
        Load.Status.DETENTION_PENDING,
    },
}


def create_load(
    *, number: str, pickup_date: Any, dropoff_date: Any, **kwargs: Any
) -> Load:
    if Load.objects.filter(number=number).exists():
        raise ValidationError(f"Load number '{number}' already exists.")
    load = Load(
        number=number, pickup_date=pickup_date, dropoff_date=dropoff_date, **kwargs
    )
    load.accounting_day = _accounting_day_from(dropoff_date)
    load.full_clean()
    load.save()
    return load


def update_load(*, load: Load, **kwargs: Any) -> Load:
    was_invoiced = load.invoiced
    for field, value in kwargs.items():
        setattr(load, field, value)
    load.accounting_day = _accounting_day_from(load.dropoff_date)
    load.full_clean()
    with transaction.atomic():
        load.save()
        if was_invoiced or load.invoiced:
            from apps.accounting.services import (
                create_load_accounting_records,
                delete_load_accounting_records,
            )

            if load.invoiced:
                create_load_accounting_records(load=load)
            else:
                delete_load_accounting_records(load=load)
    return load


_UNSET: Any = object()


def assign_load(
    *,
    load: Load,
    truck: Any = _UNSET,
    trailer: Any = _UNSET,
    driver: Any = _UNSET,
    is_drop: Any = _UNSET,
    drop_place: Any = _UNSET,
    drop_trailer: Any = _UNSET,
    days_in_drop: Any = _UNSET,
    dispatcher: Any = _UNSET,
    updated_by: Optional[Any] = None,
) -> Load:
    if driver is not _UNSET:
        load.driver = driver
        if driver is not None and hasattr(driver, "team_driver") and driver.team_driver:
            load.team_driver = driver.team_driver
        else:
            load.team_driver = None
    if truck is not _UNSET:
        load.truck = truck
    if trailer is not _UNSET:
        load.trailer = trailer
    if is_drop is not _UNSET:
        load.is_drop = bool(is_drop)
    if drop_place is not _UNSET:
        load.drop_place = drop_place  # Trailer instance or None
    if drop_trailer is not _UNSET:
        load.drop_trailer = float(drop_trailer)
    if days_in_drop is not _UNSET:
        load.days_in_drop = int(days_in_drop)
    if dispatcher is not _UNSET:
        load.dispatcher = dispatcher
    if updated_by is not None:
        load.updated_by = updated_by
    load.save()
    return load


def set_load_status(
    *, load: Load, new_status: int, updated_by: Optional[Any] = None
) -> Load:
    allowed = _ALLOWED_TRANSITIONS.get(load.status, set())
    if new_status not in allowed:
        try:
            new_status_label = Load.Status(new_status).label
        except ValueError:
            new_status_label = str(new_status)
        raise InvalidStatusTransition(
            f"Cannot transition from {load.get_status_display()} to {new_status_label}."
        )
    load.status = new_status
    if updated_by is not None:
        load.updated_by = updated_by
    load.save(update_fields=["status", "updated_by"])
    return load


def cancel_load(*, load: Load, updated_by: Optional[Any] = None) -> Load:
    """Cancel a REGISTERED load with the same side effects as the legacy cancel().

    Legacy cancel() toggles execute and history flags so that a cancelled load
    is hidden from the dispatch grid (execute=True, history=True) and its mileage
    is zeroed out.  This mirrors that exact behaviour.
    """
    if load.status != Load.Status.REGISTERED:
        raise InvalidStatusTransition(
            f"Cannot cancel a load with status {load.get_status_display()}. "
            "Only Registered loads can be cancelled from the grid."
        )
    was_executed = load.execute
    load.status = Load.Status.CANCELLED
    # Mirror legacy: not-yet-executed loads move to history so they disappear
    # from the dispatch grid (history filter = False hides them).
    load.history = not was_executed
    load.execute = not was_executed
    load.miles = 0.0
    load.miles_empty = 0.0
    if updated_by is not None:
        load.updated_by = updated_by
        load.executed_by = updated_by
    load.save()
    return load


def set_invoiced(*, load: Load) -> Load:
    from apps.accounting.services import (
        create_load_accounting_records,
        delete_load_accounting_records,
    )

    if load.invoiced:
        delete_load_accounting_records(load=load)
    else:
        create_load_accounting_records(load=load)
    load.invoiced = not load.invoiced
    load.save(update_fields=["invoiced"])
    return load


def set_paid(*, load: Load) -> Load:
    load.paid = not load.paid
    load.save(update_fields=["paid"])
    return load


def set_history(*, load: Load) -> Load:
    load.history = not load.history
    load.save(update_fields=["history"])
    return load


def set_executed(*, load: Load, updated_by: Optional[Any] = None) -> Load:
    """Move a load from dispatch to executed (requires assignment + rate + bill)."""
    from .exceptions import NotReadyToExecute

    if not (load.driver_id and load.truck_id and load.trailer_id):
        raise NotReadyToExecute("Load must have driver, truck, and trailer assigned.")
    if not load.rate_file:
        raise NotReadyToExecute("Rate confirmation file is required.")
    if not load.bill_file:
        raise NotReadyToExecute("Bill of lading file is required.")
    if load.execute:
        raise NotReadyToExecute("Load is already executed.")
    load.execute = True
    if updated_by is not None:
        load.updated_by = updated_by
    load.save(update_fields=["execute", "updated_by"])
    return load


def set_load_rating(
    *,
    load: Load,
    shipper_rating: int,
    receiver_rating: int,
    updated_by: Optional[Any] = None,
) -> Load:
    """Save shipper/receiver ratings and recalculate Business.rating for each."""
    from apps.brokers.models import Business

    if not (0 <= shipper_rating <= 10):
        raise ValidationError("shipper_rating must be between 0 and 10.")
    if not (0 <= receiver_rating <= 10):
        raise ValidationError("receiver_rating must be between 0 and 10.")

    load.shipper_rating = shipper_rating
    load.receiver_rating = receiver_rating
    if updated_by is not None:
        load.updated_by = updated_by
    load.save(update_fields=["shipper_rating", "receiver_rating", "updated_by"])

    for business_id in (
        bid for bid in (load.shipper_id, load.receiver_id) if bid is not None
    ):
        shipper_agg = Load.objects.filter(shipper_id=business_id).aggregate(
            total=Sum("shipper_rating"), cnt=Count("id")
        )
        receiver_agg = Load.objects.filter(receiver_id=business_id).aggregate(
            total=Sum("receiver_rating"), cnt=Count("id")
        )
        total = (shipper_agg["total"] or 0) + (receiver_agg["total"] or 0)
        count = (shipper_agg["cnt"] or 0) + (receiver_agg["cnt"] or 0)
        rating = round(total / count) if count else 0
        Business.objects.filter(pk=business_id).update(rating=rating)

    return load


def delete_load(*, load: Load) -> None:
    load.delete()


def bulk_delete_loads(*, ids: list[int]) -> int:
    """Delete all loads whose pk is in ids. Returns the number deleted."""
    if not ids:
        return 0
    deleted, _ = Load.objects.filter(pk__in=ids).delete()
    return deleted


FILE_SLOTS: dict[str, str] = {
    "rate_file": "rate_file",
    "bill_file": "bill_file",
    "lumper_file": "lumper_file",
    "detention_file": "detention_file",
}


def set_load_file(*, load: Load, slot: str, file: Any) -> Load:
    if slot not in FILE_SLOTS:
        raise ValidationError(f"Unknown file slot: '{slot}'.")
    field = FILE_SLOTS[slot]
    old = getattr(load, field)
    if old:
        old.delete(save=False)
    setattr(load, field, file)
    load.save(update_fields=[field])
    return load


def clear_load_file(*, load: Load, slot: str) -> Load:
    if slot not in FILE_SLOTS:
        raise ValidationError(f"Unknown file slot: '{slot}'.")
    field = FILE_SLOTS[slot]
    old = getattr(load, field)
    if old:
        old.delete(save=False)
    setattr(load, field, None)
    load.save(update_fields=[field])
    return load


# --- Load Stops ---


def create_load_stop(
    *, load: Load, from_date: Any, to_date: Any, address: str, **kwargs: Any
) -> LoadStop:
    stop = LoadStop(
        load=load, from_date=from_date, to_date=to_date, address=address, **kwargs
    )
    stop.full_clean()
    stop.save()
    return stop


def update_load_stop(*, stop: LoadStop, **kwargs: Any) -> LoadStop:
    for field, value in kwargs.items():
        setattr(stop, field, value)
    stop.full_clean()
    stop.save()
    return stop


def delete_load_stop(*, stop: LoadStop) -> None:
    stop.delete()
