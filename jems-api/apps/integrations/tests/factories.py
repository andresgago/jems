import datetime

import factory
from factory.django import DjangoModelFactory

from apps.integrations.models import (
    ReportIFTA,
    RtlDriver,
    RtlDriverStatus,
    RtlIfta,
    RtlTruck,
    RtlTruckStatus,
)


class RtlDriverFactory(DjangoModelFactory):
    class Meta:
        model = RtlDriver

    rtl_id = factory.Sequence(lambda n: f"rtl-driver-{n:04d}")
    company_id = "company-1"
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    email = factory.Sequence(lambda n: f"rtldriver{n}@example.com")
    active = True
    license_number = factory.Sequence(lambda n: f"LIC{n:06d}")
    license_state = "TX"


class RtlTruckFactory(DjangoModelFactory):
    class Meta:
        model = RtlTruck

    rtl_id = factory.Sequence(lambda n: f"rtl-truck-{n:04d}")
    company_id = "company-1"
    name = factory.Sequence(lambda n: f"Truck {n}")
    vin = factory.Sequence(lambda n: f"VIN{n:017d}")
    active = True


class RtlDriverStatusFactory(DjangoModelFactory):
    class Meta:
        model = RtlDriverStatus

    rtl_id = factory.Sequence(lambda n: f"rtl-dstatus-{n:04d}")
    rtl_driver = factory.SubFactory(RtlDriverFactory)
    location_lat = 29.7604
    location_lon = -95.3698
    location_state = "TX"
    location_calculated = "2.0mi NNE from Houston, TX"
    hos_event_code = "1"


class RtlTruckStatusFactory(DjangoModelFactory):
    class Meta:
        model = RtlTruckStatus

    rtl_id = factory.Sequence(lambda n: f"rtl-tstatus-{n:04d}")
    rtl_truck = factory.SubFactory(RtlTruckFactory)
    lat = 29.7604
    lon = -95.3698
    speed = 65.0


class RtlIftaFactory(DjangoModelFactory):
    class Meta:
        model = RtlIfta

    rtl_id = factory.Sequence(lambda n: f"rtl-ifta-{n:04d}")
    from_date = datetime.date(2024, 1, 1)
    to_date = datetime.date(2024, 3, 31)
    vehicle_vin = "VIN00000000000000001"
    vehicle_name = "Truck 1"


class ReportIFTAFactory(DjangoModelFactory):
    class Meta:
        model = ReportIFTA

    status = "pending"
    from_date = datetime.date(2024, 1, 1)
    to_date = datetime.date(2024, 3, 31)
    vehicles = "[]"
    report = factory.Sequence(lambda n: f"report-{n:04d}")
    processed = False
