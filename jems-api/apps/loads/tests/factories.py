import datetime

from django.utils import timezone

import factory
from factory.django import DjangoModelFactory

from apps.brokers.models import Broker, Business
from apps.carriers.models import Carrier
from apps.drivers.models import Driver
from apps.fleet.models import Trailer, TrailerType, Truck
from apps.loads.models import Load, LoadStop
from apps.loads.services import _accounting_day_from
from apps.locations.models import City, State
from apps.users.tests.factories import UserFactory  # noqa: F401


class StateFactory(DjangoModelFactory):
    class Meta:
        model = State
        django_get_or_create = ("abbreviation",)

    name = factory.Sequence(lambda n: f"State {n}")
    abbreviation = factory.Sequence(lambda n: f"ST{n:02d}")


class CityFactory(DjangoModelFactory):
    class Meta:
        model = City

    name = factory.Sequence(lambda n: f"City {n}")
    state = factory.SubFactory(StateFactory)
    active = True


class CarrierFactory(DjangoModelFactory):
    class Meta:
        model = Carrier

    mc = factory.Sequence(lambda n: f"LMC{n:06d}")
    dot_number = factory.Sequence(lambda n: f"LDOT{n:06d}")
    name = factory.Sequence(lambda n: f"Carrier {n}")
    active = True


class BrokerFactory(DjangoModelFactory):
    class Meta:
        model = Broker

    mc = factory.Sequence(lambda n: f"BRK{n:06d}")
    name = factory.Sequence(lambda n: f"Broker {n}")
    status = Broker.Status.ACTIVE


class BusinessFactory(DjangoModelFactory):
    class Meta:
        model = Business

    name = factory.Sequence(lambda n: f"Business {n}")
    status = Business.Status.ACTIVE
    city = factory.SubFactory(CityFactory)


class TrailerTypeFactory(DjangoModelFactory):
    class Meta:
        model = TrailerType

    name = factory.Sequence(lambda n: f"Trailer Type {n}")
    is_active = True


class DriverFactory(DjangoModelFactory):
    class Meta:
        model = Driver

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    status = Driver.Status.ACTIVE


class TruckFactory(DjangoModelFactory):
    class Meta:
        model = Truck

    number = factory.Sequence(lambda n: f"TRK-{n:04d}")
    status = Truck.Status.ACTIVE


class TrailerFactory(DjangoModelFactory):
    class Meta:
        model = Trailer

    number = factory.Sequence(lambda n: f"TRL-{n:04d}")
    status = Trailer.Status.ACTIVE


class LoadFactory(DjangoModelFactory):
    class Meta:
        model = Load

    number = factory.Sequence(lambda n: f"LD-{n:05d}")
    pickup_date = factory.LazyFunction(lambda: timezone.now())
    dropoff_date = factory.LazyFunction(
        lambda: timezone.now() + datetime.timedelta(days=2)
    )
    accounting_day = factory.LazyAttribute(
        lambda o: _accounting_day_from(o.dropoff_date)
    )
    pickup_city = factory.SubFactory(CityFactory)
    dropoff_city = factory.SubFactory(CityFactory)
    pickup_address = "123 Main St"
    dropoff_address = "456 Oak Ave"
    payment = 1500.00
    broker = factory.SubFactory(BrokerFactory)
    dispatcher = factory.SubFactory(UserFactory)
    carrier = factory.SubFactory(CarrierFactory)
    status = Load.Status.REGISTERED


class LoadStopFactory(DjangoModelFactory):
    class Meta:
        model = LoadStop

    load = factory.SubFactory(LoadFactory)
    stop_type = LoadStop.StopType.PICKUP
    from_date = factory.LazyFunction(lambda: datetime.date.today())
    to_date = factory.LazyFunction(
        lambda: datetime.date.today() + datetime.timedelta(days=1)
    )
    address = "789 Stop Rd"
    city = factory.SubFactory(CityFactory)
    business = factory.SubFactory(BusinessFactory)
