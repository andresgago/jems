import datetime

import factory
from django.core.files.base import ContentFile
from factory.django import DjangoModelFactory

from apps.documents.models import DriverFile, ImportRecordFile, TrailerFile, TruckFile
from apps.drivers.tests.factories import DriverFactory
from apps.fleet.tests.factories import TrailerFactory, TruckFactory


class DriverFileFactory(DjangoModelFactory):
    class Meta:
        model = DriverFile

    driver = factory.SubFactory(DriverFactory)
    type = DriverFile.Type.LICENSE
    file = factory.LazyAttribute(lambda _: ContentFile(b"fake", name="license.pdf"))
    expiry_date = factory.LazyFunction(lambda: datetime.date(2026, 1, 1))


class TruckFileFactory(DjangoModelFactory):
    class Meta:
        model = TruckFile

    truck = factory.SubFactory(TruckFactory)
    type = TruckFile.Type.REGISTRATION
    file = factory.LazyAttribute(lambda _: ContentFile(b"fake", name="reg.pdf"))
    expiry_date = factory.LazyFunction(lambda: datetime.date(2026, 6, 1))


class TrailerFileFactory(DjangoModelFactory):
    class Meta:
        model = TrailerFile

    trailer = factory.SubFactory(TrailerFactory)
    type = TrailerFile.Type.AVI
    file = factory.LazyAttribute(lambda _: ContentFile(b"fake", name="avi.pdf"))
    expiry_date = factory.LazyFunction(lambda: datetime.date(2026, 3, 1))


class ImportRecordFileFactory(DjangoModelFactory):
    class Meta:
        model = ImportRecordFile

    type = ImportRecordFile.Type.PILOT
    filename = factory.Sequence(lambda n: f"import_{n}.xlsx")
    sha1_file = factory.Sequence(lambda n: f"{'a' * 40}")
