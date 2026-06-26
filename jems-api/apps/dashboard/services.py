from datetime import date, timedelta
from typing import Any

from dateutil.relativedelta import relativedelta

from apps.accounting.models import Record
from apps.drivers.models import Driver
from apps.fleet.models import Trailer, TrailerMaintenance, Truck, TruckMaintenance
from apps.loads.models import Load

# Window for expiration alerts shown in detail lists (matches legacy 60-day rule)
_ALERT_DAYS = 60

# Category expiration window (legacy default: 30 days)
_CATEGORY_ALERT_DAYS = 30


def _alert_entry(
    field_type: str, label: str, expires_on: date, today: date
) -> dict[str, Any]:
    delta = (expires_on - today).days
    return {
        "type": field_type,
        "label": label,
        "expires_on": expires_on.isoformat(),
        "days_until": delta,
        "expired": delta < 0,
    }


def _driver_alerts(today: date) -> list[dict[str, Any]]:
    cutoff = today + timedelta(days=_ALERT_DAYS)
    slots = [
        ("license", "License", "license_expiration"),
        ("medical_card", "Medical Card", "medical_card_expiration"),
        # Legacy field is recordexpiration, displayed as "Record" in dashboard
        ("record", "Record", "mvr_expiration"),
    ]

    drivers = Driver.objects.filter(status=Driver.Status.ACTIVE).order_by(
        "first_name", "last_name"
    )

    result = []
    for driver in drivers:
        alerts = []
        for field_type, label, field_name in slots:
            expires_on: date | None = getattr(driver, field_name)
            if expires_on is None:
                continue
            if expires_on <= cutoff:
                alerts.append(_alert_entry(field_type, label, expires_on, today))
        if alerts:
            alerts.sort(key=lambda a: a["days_until"])
            result.append(
                {
                    "id": driver.id,
                    "name": driver.full_name,
                    "alerts": alerts,
                }
            )
    return result


def _truck_alerts(today: date) -> list[dict[str, Any]]:
    cutoff = today + timedelta(days=_ALERT_DAYS)
    slots = [
        ("avi", "AVI", "avi_expiration"),
        ("registration", "Registration", "registration_expiration"),
    ]

    trucks = Truck.objects.filter(status=Truck.Status.ACTIVE).order_by("number")

    result = []
    for truck in trucks:
        alerts = []
        for field_type, label, field_name in slots:
            expires_on: date | None = getattr(truck, field_name)
            if expires_on is None:
                continue
            if expires_on <= cutoff:
                alerts.append(_alert_entry(field_type, label, expires_on, today))
        if alerts:
            alerts.sort(key=lambda a: a["days_until"])
            result.append(
                {
                    "id": truck.id,
                    "name": f"Truck #{truck.number}",
                    "alerts": alerts,
                }
            )
    return result


def _trailer_alerts(today: date) -> list[dict[str, Any]]:
    cutoff = today + timedelta(days=_ALERT_DAYS)

    trailers = Trailer.objects.filter(status=Trailer.Status.ACTIVE).order_by("number")

    result: list[dict[str, Any]] = []
    for trailer in trailers:
        expires_on: date | None = trailer.annual_inspection_expiration
        if expires_on is None:
            continue
        if expires_on <= cutoff:
            result.append(
                {
                    "id": trailer.id,
                    "name": f"Trailer #{trailer.number}",
                    "alerts": [
                        _alert_entry(
                            "annual_inspection", "Annual Inspection", expires_on, today
                        )
                    ],
                }
            )
    result.sort(key=lambda t: t["alerts"][0]["days_until"])
    return result


def _category_alerts(today: date) -> list[dict[str, Any]]:
    """Records with a category expiration within the next 30 days (legacy parity)."""
    cutoff = today + timedelta(days=_CATEGORY_ALERT_DAYS)

    records = (
        Record.objects.filter(
            category_expire=True,
            category_expire_date__isnull=False,
            category_expire_date__lte=cutoff,
        )
        .select_related("category", "truck", "trailer")
        .order_by("category_expire_date")
    )

    result: list[dict[str, Any]] = []
    for rec in records:
        expires_on = rec.category_expire_date
        if expires_on is None:
            continue
        delta = (expires_on - today).days
        cat = rec.category

        # Build descriptive name: Category / Truck / Trailer (whichever are set)
        parts = []
        if cat:
            parts.append(f"{cat.code} - {cat.name}")
        if rec.truck:
            parts.append(f"Truck #{rec.truck.number}")
        if rec.trailer:
            parts.append(f"Trailer #{rec.trailer.number}")
        name = " / ".join(parts) if parts else f"Record #{rec.pk}"

        result.append(
            {
                "id": rec.id,
                "name": name,
                "category_name": cat.name if cat else "",
                "category_code": cat.code if cat else "",
                "truck_number": rec.truck.number if rec.truck else None,
                "trailer_number": rec.trailer.number if rec.trailer else None,
                "alerts": [
                    {
                        "type": "category",
                        "label": "Category",
                        "expires_on": expires_on.isoformat(),
                        "days_until": delta,
                        "expired": delta < 0,
                    }
                ],
            }
        )
    return result


def _get_maintenance_alert_trucks(today: date) -> int:
    """Count active trucks with at least one time-based maintenance alert due today."""
    alerted_ids: set[int] = set()
    records = TruckMaintenance.objects.filter(
        truck__status=Truck.Status.ACTIVE,
        time_alert=1,
    ).select_related("truck")

    for record in records:
        if record.time_year == 0 and record.time_month == 0:
            continue
        alert_date = date.fromisoformat(str(record.date)) + relativedelta(
            years=record.time_year, months=record.time_month
        )
        if today >= alert_date:
            alerted_ids.add(record.truck_id)

    return len(alerted_ids)


def _get_maintenance_alert_trailers(today: date) -> int:
    """Count active trailers with at least one time-based maintenance alert due today."""
    alerted_ids: set[int] = set()
    records = TrailerMaintenance.objects.filter(
        trailer__status=Trailer.Status.ACTIVE,
        time_alert=1,
    ).select_related("trailer")

    for record in records:
        if record.time_year == 0 and record.time_month == 0:
            continue
        alert_date = date.fromisoformat(str(record.date)) + relativedelta(
            years=record.time_year, months=record.time_month
        )
        if today >= alert_date:
            alerted_ids.add(record.trailer_id)

    return len(alerted_ids)


def get_dashboard_data() -> dict[str, Any]:
    today = date.today()

    # --- Load stats (legacy parity: uses execute/history/drivers_paid flags) ---
    # "In dispatch" = not yet executed and not archived
    loads_in_dispatch = Load.objects.filter(
        execute=False,
        history=False,
    ).count()

    # "Executed" = marked executed, not archived, driver not yet paid
    executed_loads = Load.objects.filter(
        execute=True,
        history=False,
        drivers_paid=False,
    ).count()

    # "Invoiced" = subset of executed that also have an invoice
    invoiced = Load.objects.filter(
        execute=True,
        history=False,
        drivers_paid=False,
        invoiced=True,
    ).count()

    # --- Expiration alerts ---
    driver_alerts = _driver_alerts(today)
    truck_alerts = _truck_alerts(today)
    trailer_alerts = _trailer_alerts(today)
    category_alerts = _category_alerts(today)

    # --- Maintenance alerts ---
    trucks_maintenance_alerts = _get_maintenance_alert_trucks(today)
    trailers_maintenance_alerts = _get_maintenance_alert_trailers(today)

    return {
        "stats": {
            "loads_in_dispatch": loads_in_dispatch,
            "executed_loads": executed_loads,
            "invoiced": invoiced,
        },
        "expiration_alerts": {
            "drivers": driver_alerts,
            "trucks": truck_alerts,
            "trailers": trailer_alerts,
            "categories": category_alerts,
        },
        "counts": {
            # Badge count = length of 60-day alert list (matches legacy behavior)
            "drivers_expiring": len(driver_alerts),
            "trucks_expiring": len(truck_alerts),
            "trucks_maintenance_alerts": trucks_maintenance_alerts,
            "trailers_expiring": len(trailer_alerts),
            "trailers_maintenance_alerts": trailers_maintenance_alerts,
            "categories_expiring": len(category_alerts),
        },
    }
