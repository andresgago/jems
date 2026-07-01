import datetime
import zoneinfo

import factory
from factory.django import DjangoModelFactory

from apps.drivers.models import Driver
from apps.fleet.models import (
    Accident,
    Trailer,
    TrailerMaintenance,
    TrailerType,
    Truck,
    TruckMaintenance,
    TruckMilesReset,
    TruckOwner,
    TruckStoredFile,
    TruckType,
)
from apps.users.tests.factories import UserFactory

UTC = zoneinfo.ZoneInfo("UTC")


class TruckTypeFactory(DjangoModelFactory):
    class Meta:
        model = TruckType

    name = factory.Sequence(lambda n: f"Truck Type {n}")
    is_active = True


class TrailerTypeFactory(DjangoModelFactory):
    class Meta:
        model = TrailerType

    name = factory.Sequence(lambda n: f"Trailer Type {n}")
    short_name = factory.Sequence(lambda n: f"T{n % 100:02d}")
    is_active = True


class TruckOwnerFactory(DjangoModelFactory):
    class Meta:
        model = TruckOwner

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    email = factory.Sequence(lambda n: f"owner{n}@example.com")
    status = TruckOwner.Status.ACTIVE


class TruckFactory(DjangoModelFactory):
    class Meta:
        model = Truck

    number = factory.Sequence(lambda n: f"T-{n:04d}")
    vin = factory.Sequence(lambda n: f"VIN{n:017d}")
    year = 2022
    truck_type = factory.SubFactory(TruckTypeFactory)
    status = Truck.Status.ACTIVE
    created_by = factory.SubFactory(UserFactory)


class TrailerFactory(DjangoModelFactory):
    class Meta:
        model = Trailer

    number = factory.Sequence(lambda n: f"TRL-{n:04d}")
    year = 2021
    trailer_type = factory.SubFactory(TrailerTypeFactory)
    status = Trailer.Status.ACTIVE
    created_by = factory.SubFactory(UserFactory)


class DriverFactory(DjangoModelFactory):
    class Meta:
        model = Driver

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")


class TruckMaintenanceFactory(DjangoModelFactory):
    class Meta:
        model = TruckMaintenance

    truck = factory.SubFactory(TruckFactory)
    date = factory.Sequence(
        lambda n: datetime.date(2024, 1, 1) + datetime.timedelta(days=n)
    )
    miles_alert = 0
    maintenance_miles = 0.0
    time_alert = 0
    time_year = 0
    time_month = 0
    odometer_start = 0.0
    odometer_current = 0.0
    is_done = False
    driven_miles = 0.0
    detail = factory.Sequence(lambda n: f"Maintenance {n}")


class TrailerMaintenanceFactory(DjangoModelFactory):
    class Meta:
        model = TrailerMaintenance

    trailer = factory.SubFactory(TrailerFactory)
    date = factory.Sequence(
        lambda n: datetime.date(2024, 1, 1) + datetime.timedelta(days=n)
    )
    miles = 0.0
    miles_alert = 0
    time_alert = 0
    time_year = 0
    time_month = 0
    detail = factory.Sequence(lambda n: f"Trailer Maintenance {n}")


class TruckMilesResetFactory(DjangoModelFactory):
    class Meta:
        model = TruckMilesReset

    truck = factory.SubFactory(TruckFactory)
    date = factory.Sequence(
        lambda n: datetime.datetime(2024, 1, 1, tzinfo=UTC)
        + datetime.timedelta(days=n * 30)
    )


class TruckStoredFileFactory(DjangoModelFactory):
    class Meta:
        model = TruckStoredFile

    truck = factory.SubFactory(TruckFactory)
    type = TruckStoredFile.Type.AVI
    file = factory.django.FileField(filename="stored.pdf", data=b"%PDF-1.4 fake")
    date = factory.Sequence(
        lambda n: datetime.date(2024, 1, 1) + datetime.timedelta(days=n)
    )


class AccidentFactory(DjangoModelFactory):
    class Meta:
        model = Accident

    date = factory.LazyFunction(
        lambda: datetime.datetime(2024, 3, 15, 14, 30, tzinfo=UTC)
    )
    driver = factory.SubFactory(DriverFactory)
    truck = factory.SubFactory(TruckFactory)
    trailer = factory.SubFactory(TrailerFactory)
    address = "123 Highway 10, Mile 45"
    crash_number = factory.Sequence(lambda n: f"FMCSA-{n:06d}")
    tow_aways = False
    death_count = 0
    fatal_injuries = 0
    created_by = factory.SubFactory(UserFactory)
