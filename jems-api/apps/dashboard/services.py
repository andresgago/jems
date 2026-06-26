from datetime import date, timedelta
from typing import TYPE_CHECKING, Any

from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db.models import Sum

from apps.accounting.models import Record
from apps.drivers.models import Driver
from apps.fleet.models import Trailer, TrailerMaintenance, Truck, TruckMaintenance
from apps.loads.models import Load

if TYPE_CHECKING:
    from apps.users.models import User

# Window for expiration alerts shown in detail lists (matches legacy 60-day rule)
_ALERT_DAYS = 60


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
    cutoff = today + timedelta(days=settings.CATEGORY_ALERT_DAYS)

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


def _compute_miles_since(entity_id: int, since_date: date, entity: str) -> float:
    """
    Sum miles + miles_empty from loads for the given truck/trailer after since_date.
    Mirrors legacy getMilesForAlert() logic.
    """
    filter_kwargs = {
        f"{entity}_id": entity_id,
        "dropoff_date__date__gt": since_date,
    }
    data = Load.objects.filter(**filter_kwargs).aggregate(
        m=Sum("miles"),
        me=Sum("miles_empty"),
    )
    return (data["m"] or 0.0) + (data["me"] or 0.0)


def _maintenance_detail_trucks(today: date) -> list[dict[str, Any]]:
    """
    Legacy parity (getAlertedWithMaintenance): for each active truck check only the
    most-recent maintenance record. Include the truck if its time-based alert has
    triggered OR its miles-based alert has triggered. One row per truck, never per record.
    """
    result: list[dict[str, Any]] = []

    seen_trucks: set[int] = set()
    from django.db.models import Q

    records = (
        TruckMaintenance.objects.filter(
            truck__status=Truck.Status.ACTIVE,
        )
        .filter(Q(time_alert=1) | Q(miles_alert=1))
        .select_related("truck")
        .order_by("-date", "-id")
    )

    for record in records:
        if record.truck_id in seen_trucks:
            continue
        seen_trucks.add(record.truck_id)

        # Time-based alert check
        time_triggered = False
        alert_date: date | None = None
        if record.time_alert == 1 and (record.time_year != 0 or record.time_month != 0):
            alert_date = date.fromisoformat(str(record.date)) + relativedelta(
                years=record.time_year, months=record.time_month
            )
            if today >= alert_date:
                time_triggered = True

        # Miles-based alert check — compare miles traveled since maintenance against threshold
        miles_triggered = False
        miles_traveled: float | None = None
        miles_threshold: float | None = None
        if record.miles_alert == 1 and record.maintenance_miles > 0:
            miles_traveled = _compute_miles_since(record.truck_id, record.date, "truck")
            miles_threshold = record.maintenance_miles
            if miles_traveled >= miles_threshold:
                miles_triggered = True

        if not time_triggered and not miles_triggered:
            continue

        result.append(
            {
                "truck_id": record.truck_id,
                "truck_number": record.truck.number,
                "maintenance_id": record.id,
                "date": record.date.isoformat(),
                "detail": record.detail,
                "time_alert_triggered": time_triggered,
                "alert_date": alert_date.isoformat() if alert_date else None,
                "miles_alert_triggered": miles_triggered,
                "miles_traveled": (
                    round(miles_traveled, 1) if miles_traveled is not None else None
                ),
                "miles_threshold": miles_threshold,
            }
        )

    result.sort(key=lambda r: r["alert_date"] or "9999-99-99")
    return result


def _maintenance_detail_trailers(today: date) -> list[dict[str, Any]]:
    """
    Legacy parity (getAlertedWithMaintenance): for each active trailer check only the
    most-recent maintenance record. Include if time-based OR miles-based alert triggered.
    One row per trailer, never per record.
    """
    result: list[dict[str, Any]] = []

    seen_trailers: set[int] = set()
    from django.db.models import Q

    records = (
        TrailerMaintenance.objects.filter(
            trailer__status=Trailer.Status.ACTIVE,
        )
        .filter(Q(time_alert=1) | Q(miles_alert=1))
        .select_related("trailer")
        .order_by("-date", "-id")
    )

    for record in records:
        if record.trailer_id in seen_trailers:
            continue
        seen_trailers.add(record.trailer_id)

        # Time-based alert check
        time_triggered = False
        alert_date: date | None = None
        if record.time_alert == 1 and (record.time_year != 0 or record.time_month != 0):
            alert_date = date.fromisoformat(str(record.date)) + relativedelta(
                years=record.time_year, months=record.time_month
            )
            if today >= alert_date:
                time_triggered = True

        # Miles-based alert check — trailer uses the `miles` field as threshold
        miles_triggered = False
        miles_traveled: float | None = None
        miles_threshold: float | None = None
        if record.miles_alert == 1 and record.miles > 0:
            miles_traveled = _compute_miles_since(
                record.trailer_id, record.date, "trailer"
            )
            miles_threshold = record.miles
            if miles_traveled >= miles_threshold:
                miles_triggered = True

        if not time_triggered and not miles_triggered:
            continue

        result.append(
            {
                "trailer_id": record.trailer_id,
                "trailer_number": record.trailer.number,
                "maintenance_id": record.id,
                "date": record.date.isoformat(),
                "detail": record.detail,
                "time_alert_triggered": time_triggered,
                "alert_date": alert_date.isoformat() if alert_date else None,
                "miles_alert_triggered": miles_triggered,
                "miles_traveled": (
                    round(miles_traveled, 1) if miles_traveled is not None else None
                ),
                "miles_threshold": miles_threshold,
            }
        )

    result.sort(key=lambda r: r["alert_date"] or "9999-99-99")
    return result


def _get_maintenance_alert_trucks(today: date) -> int:
    return len(_maintenance_detail_trucks(today))


def _get_maintenance_alert_trailers(today: date) -> int:
    return len(_maintenance_detail_trailers(today))


def get_dashboard_data(user: "User") -> dict[str, Any]:
    today = date.today()

    # --- Load stats (role-based, legacy parity) ---
    # Legacy: loads_in_dispatch visible to admin OR dispatcher (_isAD)
    #         executed_loads + invoiced visible to admin only
    is_admin = user.is_staff or user.is_superuser
    is_dispatcher = user.is_dispatcher

    loads_in_dispatch: int | None = None
    executed_loads: int | None = None
    invoiced: int | None = None

    if is_admin or is_dispatcher:
        loads_in_dispatch = Load.objects.filter(
            execute=False,
            history=False,
        ).count()

    if is_admin:
        executed_loads = Load.objects.filter(
            execute=True,
            history=False,
            drivers_paid=False,
        ).count()

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

    # --- Maintenance alerts (detail list + count) ---
    truck_maintenance = _maintenance_detail_trucks(today)
    trailer_maintenance = _maintenance_detail_trailers(today)

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
        "maintenance_alerts": {
            "trucks": truck_maintenance,
            "trailers": trailer_maintenance,
        },
        "counts": {
            # Badge count = length of 60-day alert list (matches legacy behavior)
            "drivers_expiring": len(driver_alerts),
            "trucks_expiring": len(truck_alerts),
            "trucks_maintenance_alerts": len(truck_maintenance),
            "trailers_expiring": len(trailer_alerts),
            "trailers_maintenance_alerts": len(trailer_maintenance),
            "categories_expiring": len(category_alerts),
        },
    }
