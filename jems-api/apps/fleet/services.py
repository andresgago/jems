from apps.users.models import User

from .models import (
    Accident,
    AccidentPicture,
    Trailer,
    TrailerMaintenance,
    Truck,
    TruckMaintenance,
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


def add_truck_maintenance(*, truck: Truck, **fields) -> TruckMaintenance:
    record = TruckMaintenance(truck=truck, **fields)
    record.full_clean()
    record.save()
    return record


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
    record = TrailerMaintenance(trailer=trailer, **fields)
    record.full_clean()
    record.save()
    return record


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
    picture.delete()
