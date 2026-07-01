import factory
from factory.django import DjangoModelFactory

from apps.carriers.tests.factories import CarrierFactory, StateFactory
from apps.drivers.models import Driver, DriverType
from apps.fleet.models import Card, TruckOwner
from apps.users.tests.factories import UserFactory


class DriverTypeFactory(DjangoModelFactory):
    class Meta:
        model = DriverType

    name = factory.Sequence(lambda n: f"Driver Type {n}")
    is_active = True


class CardFactory(DjangoModelFactory):
    class Meta:
        model = Card

    number = factory.Sequence(lambda n: f"589355322232420{n:03d}")
    is_active = True


class TruckOwnerFactory(DjangoModelFactory):
    class Meta:
        model = TruckOwner

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    email = factory.Sequence(lambda n: f"driver-owner{n}@example.com")
    status = TruckOwner.Status.ACTIVE


class DriverFactory(DjangoModelFactory):
    class Meta:
        model = Driver

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    driver_type = factory.SubFactory(DriverTypeFactory)
    status = Driver.Status.ACTIVE
    phone = factory.Faker("phone_number")
    email = factory.Sequence(lambda n: f"driver{n}@example.com")
    birth_date = factory.Faker("date_object")
    hire_date = factory.Faker("date_object")
    license_number = factory.Sequence(lambda n: f"LIC{n:06d}")
    license_state = factory.SubFactory(StateFactory)
    license_expiration = factory.Faker("future_date")
    fuel_card = factory.SubFactory(CardFactory)
    carrier = factory.SubFactory(CarrierFactory)
    created_by = factory.SubFactory(UserFactory)
