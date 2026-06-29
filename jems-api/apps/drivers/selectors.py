from typing import Any

from django.db.models import Subquery, OuterRef
from django.utils import timezone

from .models import Driver


def _serialize_load(load: Any) -> dict[str, Any]:
    truck = load.truck
    trailer = load.trailer
    trailer_type = load.trailer_type
    pickup_city = load.pickup_city
    dropoff_city = load.dropoff_city
    return {
        "id": load.id,
        "number": load.number,
        "payment": load.payment,
        "trailer_type": trailer_type.short_name if trailer_type else None,
        "pickup_date": load.pickup_date.isoformat() if load.pickup_date else None,
        "pickup_city": pickup_city.name if pickup_city else None,
        "pickup_state": (
            pickup_city.state.abbreviation
            if pickup_city and pickup_city.state
            else None
        ),
        "pickup_zip": pickup_city.zip if pickup_city else None,
        "dropoff_date": load.dropoff_date.isoformat() if load.dropoff_date else None,
        "dropoff_city": dropoff_city.name if dropoff_city else None,
        "dropoff_state": (
            dropoff_city.state.abbreviation
            if dropoff_city and dropoff_city.state
            else None
        ),
        "dropoff_zip": dropoff_city.zip if dropoff_city else None,
        "truck": truck.number if truck else None,
        "trailer": trailer.number if trailer else None,
    }


def get_drivers_last_loads(
    dispatcher_id: int | None = None,
) -> list[dict[str, Any]]:
    """
    Return active drivers that have at least one executed load, each paired with
    their last executed load and (optionally) their current active load.

    Optionally filter to only loads dispatched by a specific dispatcher.

    Mirrors the legacy driver/current-info view (searchCurrentInfo query).
    """
    from apps.loads.models import Load
    from apps.integrations.models import RtlDriver

    today = timezone.now().date()

    dispatcher_filter: dict[str, Any] = {}
    if dispatcher_id is not None:
        dispatcher_filter["dispatcher_id"] = dispatcher_id

    last_executed_subquery = (
        Load.objects.filter(driver=OuterRef("pk"), execute=True, **dispatcher_filter)
        .order_by("-dropoff_date")
        .values("id")[:1]
    )

    current_load_subquery = (
        Load.objects.filter(
            driver=OuterRef("pk"),
            execute=False,
            dropoff_date__date__gte=today,
            status__in=[
                Load.Status.REGISTERED,
                Load.Status.STARTED,
                Load.Status.FINISHED,
            ],
            **dispatcher_filter,
        )
        .order_by("-dropoff_date")
        .values("id")[:1]
    )

    drivers = (
        Driver.objects.filter(status=Driver.Status.ACTIVE)
        .annotate(
            last_load_id=Subquery(last_executed_subquery),
            current_load_id=Subquery(current_load_subquery),
        )
        .filter(last_load_id__isnull=False)
        .order_by("first_name", "last_name")
    )

    driver_list = list(drivers)

    all_load_ids = []
    for d in driver_list:
        if d.last_load_id:
            all_load_ids.append(d.last_load_id)
        if d.current_load_id:
            all_load_ids.append(d.current_load_id)

    loads_by_id = {
        load.id: load
        for load in Load.objects.filter(id__in=all_load_ids).select_related(
            "pickup_city__state",
            "dropoff_city__state",
            "trailer_type",
            "truck",
            "trailer",
        )
    }

    # Batch-fetch RTL location data keyed by driver license_number
    license_numbers = [d.license_number for d in driver_list if d.license_number]
    rtl_by_license: dict[str, RtlDriver] = {}
    if license_numbers:
        for rtl_rec in RtlDriver.objects.filter(
            license_number__in=license_numbers
        ).select_related("latest_status"):
            rtl_by_license[rtl_rec.license_number] = rtl_rec

    result = []
    for driver in driver_list:
        last_load = loads_by_id.get(driver.last_load_id)
        current_load = (
            loads_by_id.get(driver.current_load_id) if driver.current_load_id else None
        )

        location: dict[str, Any] | None = None
        rtl: RtlDriver | None = rtl_by_license.get(driver.license_number or "")
        if rtl is not None:
            try:
                rtl_status = rtl.latest_status
                if (
                    rtl_status.location_state
                    or rtl_status.location_calculated
                    or rtl_status.location_timestamp
                ):
                    location = {
                        "state": rtl_status.location_state or None,
                        "calculated": rtl_status.location_calculated or None,
                        "timestamp": rtl_status.location_timestamp or None,
                    }
            except Exception:
                pass

        result.append(
            {
                "id": driver.id,
                "full_name": driver.full_name,
                "location": location,
                "last_load": _serialize_load(last_load) if last_load else None,
                "current_load": _serialize_load(current_load) if current_load else None,
            }
        )

    return result
