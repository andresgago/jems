import datetime

import factory
from factory.django import DjangoModelFactory

from apps.accounting.models import Account, Category, CategoryType, DriverInvoice, OwnerInvoice, Record
from apps.drivers.models import Driver
from apps.fleet.models import TruckOwner
from apps.users.tests.factories import UserFactory  # noqa: F401


class AccountFactory(DjangoModelFactory):
    class Meta:
        model = Account

    code = factory.Sequence(lambda n: f"9{n:04d}")
    name = factory.Sequence(lambda n: f"Account {n}")
    is_active = True
    is_main = False
    is_assistant = False


class CategoryTypeFactory(DjangoModelFactory):
    class Meta:
        model = CategoryType

    name = factory.Sequence(lambda n: f"Cat Type {n}")
    is_active = True


class CategoryFactory(DjangoModelFactory):
    class Meta:
        model = Category

    code = factory.Sequence(lambda n: f"CAT{n:04d}")
    name = factory.Sequence(lambda n: f"Category {n}")
    category_type = factory.SubFactory(CategoryTypeFactory)
    is_active = True


class DriverFactory(DjangoModelFactory):
    class Meta:
        model = Driver

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    status = Driver.Status.ACTIVE


class TruckOwnerFactory(DjangoModelFactory):
    class Meta:
        model = TruckOwner

    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    status = TruckOwner.Status.ACTIVE


class RecordFactory(DjangoModelFactory):
    class Meta:
        model = Record

    date = factory.LazyFunction(lambda: datetime.date.today())
    account = factory.SubFactory(AccountFactory)
    amount = 500.0
    quantity = 1.0
    detail = "Test record"
    record_type = Record.RecordType.EXPENSE


class DriverInvoiceFactory(DjangoModelFactory):
    class Meta:
        model = DriverInvoice

    number = factory.Sequence(lambda n: n + 1)
    driver = factory.SubFactory(DriverFactory)
    date = factory.LazyFunction(lambda: datetime.date.today())
    status = DriverInvoice.Status.OPEN
    percent = 25.0


class TruckOwnerInvoiceFactory(DjangoModelFactory):
    class Meta:
        model = OwnerInvoice

    number = factory.Sequence(lambda n: n + 1)
    owner = factory.SubFactory(TruckOwnerFactory)
    date = factory.LazyFunction(lambda: datetime.date.today())
    status = OwnerInvoice.Status.OPEN
    percent = 80.0
