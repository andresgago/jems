from __future__ import annotations

import datetime

from django.db.models import Sum

from apps.users.models import User

from .models import (
    Accident,
    AccidentPicture,
    Trailer,
    TrailerMaintenance,
    Truck,
    TruckMaintenance,
    TruckMilesReset,
    TruckOwner,
)


def create_truck(*, created_by: User | None = None, **fields) -> Truck:
    truck = Truck(created_by=created_by, **fields)
    truck.full_clean()
    truck.save()
    return truck


def update_truck(*, truck: Truck, **fields) -> Truck:
    for field, value in fields.items():
        setattr(truck, field, value)
    truck.full_clean()
    truck.save()
    return truck


def toggle_truck_status(*, truck: Truck) -> Truck:
    truck.status = (
        Truck.Status.INACTIVE
        if truck.status == Truck.Status.ACTIVE
        else Truck.Status.ACTIVE
    )
    truck.save(update_fields=["status", "updated_at"])
    return truck


# Maps the public file "slot" to the Truck model field. Each slot mirrors a
# legacy truck file column (avi, registration, contract, leased agreement, photo).
TRUCK_FILE_SLOTS = {
    "avi": "avi_file",
    "registration": "registration_file",
    "agreement": "agreement_file",
    "leased": "leased_file",
    "photo": "photo",
}


def set_truck_file(*, truck: Truck, slot: str, file) -> Truck:
    field = TRUCK_FILE_SLOTS[slot]
    existing = getattr(truck, field)
    if existing:
        existing.delete(save=False)
    setattr(truck, field, file)
    truck.save(update_fields=[field, "updated_at"])
    return truck


def clear_truck_file(*, truck: Truck, slot: str) -> Truck:
    field = TRUCK_FILE_SLOTS[slot]
    existing = getattr(truck, field)
    if existing:
        existing.delete(save=False)
        setattr(truck, field, None)
        truck.save(update_fields=[field, "updated_at"])
    return truck


def add_truck_maintenance(*, truck: Truck, **fields) -> TruckMaintenance:
    _validate_maintenance_date_unique(
        TruckMaintenance, lookup={"truck": truck, "date": fields.get("date")}
    )
    record = TruckMaintenance(truck=truck, **fields)
    record.full_clean()
    record.save()
    return record


def update_truck_maintenance(
    *, maintenance: TruckMaintenance, **fields
) -> TruckMaintenance:
    if "date" in fields and fields["date"] != maintenance.date:
        _validate_maintenance_date_unique(
            TruckMaintenance,
            lookup={"truck": maintenance.truck, "date": fields["date"]},
        )
    for field, value in fields.items():
        setattr(maintenance, field, value)
    maintenance.full_clean()
    maintenance.save()
    return maintenance


def delete_truck_maintenance(*, maintenance: TruckMaintenance) -> None:
    maintenance.delete()


def get_truck_miles_since_maintenance(truck: Truck, since_date: datetime.date) -> float:
    from apps.loads.models import Load  # avoid circular import

    result = Load.objects.filter(
        truck=truck,
        dropoff_date__date__gt=since_date,
    ).aggregate(total=Sum("miles") + Sum("miles_empty"))
    return result["total"] or 0.0


def get_truck_total_miles_since_reset(truck: Truck) -> float:
    """Miles driven since the most recent TruckMilesReset (or ever if none)."""
    from apps.loads.models import Load  # avoid circular import

    last_reset = (
        TruckMilesReset.objects.filter(truck=truck).order_by("-date", "-id").first()
    )
    qs = Load.objects.filter(truck=truck)
    if last_reset:
        qs = qs.filter(dropoff_date__date__gt=last_reset.date)
    result = qs.aggregate(total=Sum("miles") + Sum("miles_empty"))
    return result["total"] or 0.0


def is_last_truck_maintenance(maintenance: TruckMaintenance) -> bool:
    last = (
        TruckMaintenance.objects.filter(truck=maintenance.truck)
        .order_by("-date", "-id")
        .first()
    )
    return last is not None and last.pk == maintenance.pk


def create_trailer(*, created_by: User | None = None, **fields) -> Trailer:
    trailer = Trailer(created_by=created_by, **fields)
    trailer.full_clean()
    trailer.save()
    return trailer


def update_trailer(*, trailer: Trailer, **fields) -> Trailer:
    for field, value in fields.items():
        setattr(trailer, field, value)
    trailer.full_clean()
    trailer.save()
    return trailer


def toggle_trailer_status(*, trailer: Trailer) -> Trailer:
    trailer.status = (
        Trailer.Status.INACTIVE
        if trailer.status == Trailer.Status.ACTIVE
        else Trailer.Status.ACTIVE
    )
    trailer.save(update_fields=["status", "updated_at"])
    return trailer


def add_trailer_maintenance(*, trailer: Trailer, **fields) -> TrailerMaintenance:
    _validate_maintenance_date_unique(
        TrailerMaintenance, lookup={"trailer": trailer, "date": fields.get("date")}
    )
    record = TrailerMaintenance(trailer=trailer, **fields)
    record.full_clean()
    record.save()
    return record


def update_trailer_maintenance(
    *, maintenance: TrailerMaintenance, **fields
) -> TrailerMaintenance:
    if "date" in fields and fields["date"] != maintenance.date:
        _validate_maintenance_date_unique(
            TrailerMaintenance,
            lookup={"trailer": maintenance.trailer, "date": fields["date"]},
        )
    for field, value in fields.items():
        setattr(maintenance, field, value)
    maintenance.full_clean()
    maintenance.save()
    return maintenance


def delete_trailer_maintenance(*, maintenance: TrailerMaintenance) -> None:
    maintenance.delete()


def get_trailer_miles_since_maintenance(
    trailer: Trailer, since_date: datetime.date
) -> float:
    from apps.loads.models import Load  # avoid circular import

    result = Load.objects.filter(
        trailer=trailer,
        dropoff_date__date__gt=since_date,
    ).aggregate(total=Sum("miles") + Sum("miles_empty"))
    return result["total"] or 0.0


def is_last_trailer_maintenance(maintenance: TrailerMaintenance) -> bool:
    last = (
        TrailerMaintenance.objects.filter(trailer=maintenance.trailer)
        .order_by("-date", "-id")
        .first()
    )
    return last is not None and last.pk == maintenance.pk


def _validate_maintenance_date_unique(model_class, *, lookup: dict) -> None:
    if lookup.get("date") is None:
        return
    if model_class.objects.filter(**lookup).exists():
        from rest_framework.exceptions import ValidationError

        raise ValidationError(
            {
                "date": "A maintenance record already exists for this vehicle on that date."
            }
        )


# Maps the public file "slot" to the Trailer model field. Mirrors legacy slots:
# aifile (annual_inspection), registrationfile, agreementfile.
TRAILER_FILE_SLOTS = {
    "annual_inspection": "annual_inspection_file",
    "registration": "registration_file",
    "agreement": "agreement_file",
}


def set_trailer_file(*, trailer: Trailer, slot: str, file) -> Trailer:
    field = TRAILER_FILE_SLOTS[slot]
    existing = getattr(trailer, field)
    if existing:
        existing.delete(save=False)
    setattr(trailer, field, file)
    trailer.save(update_fields=[field, "updated_at"])
    return trailer


def clear_trailer_file(*, trailer: Trailer, slot: str) -> Trailer:
    field = TRAILER_FILE_SLOTS[slot]
    existing = getattr(trailer, field)
    if existing:
        existing.delete(save=False)
        setattr(trailer, field, None)
        trailer.save(update_fields=[field, "updated_at"])
    return trailer


def create_truck_owner(**fields) -> TruckOwner:
    owner = TruckOwner(**fields)
    owner.full_clean()
    owner.save()
    return owner


def update_truck_owner(*, owner: TruckOwner, **fields) -> TruckOwner:
    for field, value in fields.items():
        setattr(owner, field, value)
    owner.full_clean()
    owner.save()
    return owner


def toggle_truck_owner_status(*, owner: TruckOwner) -> TruckOwner:
    owner.status = (
        TruckOwner.Status.INACTIVE
        if owner.status == TruckOwner.Status.ACTIVE
        else TruckOwner.Status.ACTIVE
    )
    owner.save(update_fields=["status", "updated_at"])
    return owner


def create_accident(*, created_by: User | None = None, **fields) -> Accident:
    accident = Accident(created_by=created_by, **fields)
    accident.full_clean()
    accident.save()
    return accident


def update_accident(*, accident: Accident, **fields) -> Accident:
    for field, value in fields.items():
        setattr(accident, field, value)
    accident.full_clean()
    accident.save()
    return accident


def delete_accident(*, accident: Accident) -> None:
    accident.delete()


def add_accident_picture(*, accident: Accident, **fields) -> AccidentPicture:
    picture = AccidentPicture(accident=accident, **fields)
    picture.full_clean()
    picture.save()
    return picture


def delete_accident_picture(*, picture: AccidentPicture) -> None:
    picture.file.delete(save=False)
    picture.delete()
