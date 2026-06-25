"""
Sync services for RTL ELD integration.

The RTL API client is instantiated per-carrier using credentials stored on
the Carrier model (eld_user, eld_password).  All write operations are
upserts keyed on rtl_id so repeated syncs are idempotent.
"""

from __future__ import annotations

from typing import Any

from .models import RtlDriver, RtlDriverStatus, RtlIfta, RtlTruck, RtlTruckStatus

_RTL_DRIVER_FIELD_MAP = {
    "companyId": "company_id",
    "email": "email",
    "firstName": "first_name",
    "lastName": "last_name",
    "active": "active",
    "phoneNum": "phone_num",
    "driverInfoLicenseNumber": "license_number",
    "driverInfoLicenseState": "license_state",
    "createdAt": "rtl_created_at",
    "updatedAt": "rtl_updated_at",
}


def upsert_rtl_driver(*, data: dict[str, Any]) -> RtlDriver:
    defaults = {
        _RTL_DRIVER_FIELD_MAP[k]: v
        for k, v in data.items()
        if k in _RTL_DRIVER_FIELD_MAP
    }
    driver, _ = RtlDriver.objects.update_or_create(
        rtl_id=data["_id"], defaults=defaults
    )
    return driver


def upsert_rtl_truck(*, data: dict[str, Any]) -> RtlTruck:
    truck, _ = RtlTruck.objects.update_or_create(
        rtl_id=data["_id"],
        defaults={
            "company_id": data.get("companyId", ""),
            "name": data.get("name", ""),
            "make": data.get("make", ""),
            "model": data.get("model", ""),
            "year": data.get("year", ""),
            "vin": data.get("vin", ""),
            "plate_number": data.get("plateNumber", ""),
            "active": data.get("active", True),
            "eld_serial_number": data.get("eldserialNumber", ""),
            "rtl_updated_at": data.get("updatedAt", ""),
        },
    )
    return truck


def upsert_rtl_driver_status(*, data: dict[str, Any]) -> RtlDriverStatus:
    driver_rtl_id = data.get("userId", "")
    driver = RtlDriver.objects.filter(rtl_id=driver_rtl_id).first()
    status, _ = RtlDriverStatus.objects.update_or_create(
        rtl_id=data["_id"],
        defaults={
            "rtl_driver": driver,
            "location_lat": data.get("locationLat"),
            "location_lon": data.get("locationLon"),
            "location_state": data.get("locationState", ""),
            "location_timestamp": data.get("locationTimestamp", ""),
            "vehicle_id": data.get("vehicleId", ""),
            "vehicle_vin": data.get("vehicleVin", ""),
            "hos_event_code": data.get("hosEventCode", ""),
            "hos_event_time": data.get("hosEventTime", ""),
            "daily_hours_driven": data.get("dailyLogSummaryTimeDriven"),
            "daily_hours_on_duty": data.get("dailyLogSummaryTimeOnDuty"),
            "eta": data.get("eta", ""),
            "violations": data.get("dailyLogSummaryViolations", ""),
            "rtl_updated_at": data.get("updatedAt", ""),
        },
    )
    return status


def upsert_rtl_truck_status(*, data: dict[str, Any]) -> RtlTruckStatus:
    truck_rtl_id = data.get("v", "")
    truck = RtlTruck.objects.filter(rtl_id=truck_rtl_id).first()
    status, _ = RtlTruckStatus.objects.update_or_create(
        rtl_id=data["_id"],
        defaults={
            "rtl_truck": truck,
            "vin": data.get("vin", ""),
            "odometer": data.get("odometer"),
            "speed": data.get("speed"),
            "lat": data.get("lat"),
            "lon": data.get("lon"),
            "timestamp": data.get("timestamp", ""),
            "calculated_location": data.get("calculatedLocation", ""),
            "rtl_updated_at": data.get("updatedAt", ""),
        },
    )
    return status


def upsert_rtl_ifta(*, data: dict[str, Any]) -> RtlIfta:
    from datetime import date

    def parse_date(val: str | None) -> date | None:
        if not val:
            return None
        try:
            return date.fromisoformat(val[:10])
        except (ValueError, TypeError):
            return None

    ifta, _ = RtlIfta.objects.update_or_create(
        rtl_id=data["_id"],
        defaults={
            "company_id": data.get("companyId", ""),
            "type_id": data.get("typeid", ""),
            "status_id": data.get("statusid", ""),
            "time_submitted": data.get("timeSubmitted", ""),
            "time_generated": data.get("timeGenerated", ""),
            "url": data.get("url", ""),
            "csv_url": data.get("csvUrl", ""),
            "from_date": parse_date(data.get("fromDate")),
            "to_date": parse_date(data.get("toDate")),
            "vehicle_vin": data.get("vehiclevin", ""),
            "vehicle_id": data.get("vehicleid", ""),
            "vehicle_name": data.get("vehiclename", ""),
        },
    )
    return ifta
