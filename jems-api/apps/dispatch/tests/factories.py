import datetime
import zoneinfo

import factory
from factory.django import DjangoModelFactory

from apps.dispatch.models import (
    DispatcherWork,
    DispatcherWorkInvoiceByHour,
    DispatcherWorkInvoiceByPercent,
)
from apps.users.tests.factories import UserFactory  # noqa: F401

UTC = zoneinfo.ZoneInfo("UTC")


class DispatcherWorkInvoiceByPercentFactory(DjangoModelFactory):
    class Meta:
        model = DispatcherWorkInvoiceByPercent

    number = factory.Sequence(lambda n: n + 1)
    dispatcher = factory.SubFactory(UserFactory)
    date = factory.LazyFunction(lambda: datetime.date.today())
    start = factory.LazyFunction(
        lambda: datetime.datetime(2024, 1, 1, 8, 0, tzinfo=UTC)
    )
    end = factory.LazyFunction(
        lambda: datetime.datetime(2024, 1, 31, 17, 0, tzinfo=UTC)
    )
    percent = 5.0
    status = DispatcherWorkInvoiceByPercent.Status.OPEN


class DispatcherWorkInvoiceByHourFactory(DjangoModelFactory):
    class Meta:
        model = DispatcherWorkInvoiceByHour

    number = factory.Sequence(lambda n: n + 1)
    dispatcher = factory.SubFactory(UserFactory)
    date = factory.LazyFunction(lambda: datetime.date.today())
    start = factory.LazyFunction(
        lambda: datetime.datetime(2024, 1, 1, 8, 0, tzinfo=UTC)
    )
    end = factory.LazyFunction(
        lambda: datetime.datetime(2024, 1, 31, 17, 0, tzinfo=UTC)
    )
    pay_per_hour = 15.0
    status = DispatcherWorkInvoiceByHour.Status.OPEN


class DispatcherWorkFactory(DjangoModelFactory):
    class Meta:
        model = DispatcherWork

    title = factory.Sequence(lambda n: f"Work Session {n}")
    dispatcher = factory.SubFactory(UserFactory)
    start = factory.LazyFunction(
        lambda: datetime.datetime(2024, 1, 15, 9, 0, tzinfo=UTC)
    )
    end = factory.LazyFunction(
        lambda: datetime.datetime(2024, 1, 15, 17, 0, tzinfo=UTC)
    )
    session = ""
    is_finished = False
    is_paid = False
