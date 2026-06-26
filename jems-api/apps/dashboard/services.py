from datetime import date, timedelta
from typing import Any

from apps.drivers.models import Driver
from apps.fleet.models import Trailer, Truck
from apps.loads.models import Load

# Loads counted as "in dispatch": started through detention-pending (legacy parity)
_IN_DISPATCH_STATUSES = [
    Load.Status.STARTED,
    Load.Status.FINISHED,
    Load.Status.DETENTION_PENDING,
]

# Window for expiration alerts shown in detail lists
_ALERT_DAYS = 60

# Window for the summary counts shown as badge numbers
_COUNT_DAYS = 30


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
        ("mvr", "MVR", "mvr_expiration"),
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


def get_dashboard_data() -> dict[str, Any]:
    today = date.today()
    # --- Load stats ---
    loads_in_dispatch = Load.objects.filter(status__in=_IN_DISPATCH_STATUSES).count()
    executed_loads = Load.objects.filter(status=Load.Status.FINISHED).count()
    invoiced = Load.objects.filter(invoiced=True).count()

    # --- Expiration alerts ---
    driver_alerts = _driver_alerts(today)
    truck_alerts = _truck_alerts(today)
    trailer_alerts = _trailer_alerts(today)

    # --- Summary counts (30-day window) ---
    def _count_expiring(alerts: list[dict[str, Any]]) -> int:
        return sum(
            1
            for entity in alerts
            if any(a["days_until"] <= _COUNT_DAYS for a in entity["alerts"])
        )

    trucks_in_maintenance = (
        Truck.objects.filter(
            status=Truck.Status.ACTIVE,
            maintenance_records__isnull=False,
        )
        .distinct()
        .count()
    )

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
        },
        "counts": {
            "drivers_expiring": _count_expiring(driver_alerts),
            "trucks_expiring": _count_expiring(truck_alerts),
            "trucks_in_maintenance": trucks_in_maintenance,
            "trailers_expiring": _count_expiring(trailer_alerts),
        },
    }
