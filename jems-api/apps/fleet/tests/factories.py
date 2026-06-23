import datetime
import zoneinfo

import factory
from factory.django import DjangoModelFactory

from apps.drivers.models import Driver
from apps.fleet.models import Accident, Trailer, TrailerType, Truck, TruckOwner, TruckType
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


class AccidentFactory(DjangoModelFactory):
    class Meta:
        model = Accident

    date = factory.LazyFunction(lambda: datetime.datetime(2024, 3, 15, 14, 30, tzinfo=UTC))
    driver = factory.SubFactory(DriverFactory)
    truck = factory.SubFactory(TruckFactory)
    trailer = factory.SubFactory(TrailerFactory)
    address = "123 Highway 10, Mile 45"
    crash_number = factory.Sequence(lambda n: f"FMCSA-{n:06d}")
    tow_aways = False
    death_count = 0
    fatal_injuries = 0
    created_by = factory.SubFactory(UserFactory)
