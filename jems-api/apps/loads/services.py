from datetime import datetime as _Datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.db import transaction

from .exceptions import InvalidStatusTransition
from .models import Load, LoadStop

# Maps PHP date('w') weekday (0=Sun…6=Sat) to TMS accounting_day (Tue=1…Mon=7, Sun=6).
_ACCOUNTING_DAYS: dict[int, int] = {0: 6, 1: 7, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5}
_ET = ZoneInfo("America/New_York")


def _accounting_day_from(dropoff: Any) -> int:
    """Return the TMS accounting_day for the given dropoff datetime."""
    if isinstance(dropoff, _Datetime) and dropoff.tzinfo is not None:
        dropoff = dropoff.astimezone(_ET)
    weekday = int(dropoff.strftime("%w"))  # 0=Sun … 6=Sat
    return _ACCOUNTING_DAYS[weekday]


# Valid status transitions: current -> allowed next statuses
_ALLOWED_TRANSITIONS: dict[int, set[int]] = {
    Load.Status.REGISTERED: {Load.Status.STARTED, Load.Status.CANCELLED},
    Load.Status.STARTED: {
        Load.Status.FINISHED,
        Load.Status.DETENTION_PENDING,
        Load.Status.CANCELLED,
    },
    Load.Status.DETENTION_PENDING: {Load.Status.FINISHED, Load.Status.CANCELLED},
    Load.Status.FINISHED: set(),
    Load.Status.CANCELLED: set(),
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


def assign_load(
    *,
    load: Load,
    truck: Optional[Any] = None,
    trailer: Optional[Any] = None,
    driver: Optional[Any] = None,
    dispatcher: Optional[Any] = None,
    updated_by: Optional[Any] = None,
) -> Load:
    if truck is not None:
        load.truck = truck
    if trailer is not None:
        load.trailer = trailer
    if driver is not None:
        load.driver = driver
        # Auto-assign team driver if driver type is "team" (type 5 in legacy)
        if hasattr(driver, "team_driver") and driver.team_driver:
            load.team_driver = driver.team_driver
        else:
            load.team_driver = None
    if dispatcher is not None:
        load.dispatcher = dispatcher
    if updated_by is not None:
        load.updated_by = updated_by
    load.execute = True
    load.save()
    return load


def set_load_status(
    *, load: Load, new_status: int, updated_by: Optional[Any] = None
) -> Load:
    allowed = _ALLOWED_TRANSITIONS.get(load.status, set())
    if new_status not in allowed:
        raise InvalidStatusTransition(
            f"Cannot transition from {load.get_status_display()} to {Load.Status(new_status).label}."
        )
    load.status = new_status
    if updated_by is not None:
        load.updated_by = updated_by
    load.save(update_fields=["status", "updated_by"])
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


def delete_load(*, load: Load) -> None:
    load.delete()


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
