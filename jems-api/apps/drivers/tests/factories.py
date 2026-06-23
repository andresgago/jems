import factory
from factory.django import DjangoModelFactory

from apps.drivers.models import Driver, DriverType
from apps.users.tests.factories import UserFactory


class DriverTypeFactory(DjangoModelFactory):
    class Meta:
        model = DriverType

    name = factory.Sequence(lambda n: f"Driver Type {n}")
    is_active = True


class DriverFactory(DjangoModelFactory):
    class Meta:
        model = Driver

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    driver_type = factory.SubFactory(DriverTypeFactory)
    status = Driver.Status.ACTIVE
    phone = factory.Faker("phone_number")
    email = factory.Sequence(lambda n: f"driver{n}@example.com")
    created_by = factory.SubFactory(UserFactory)
