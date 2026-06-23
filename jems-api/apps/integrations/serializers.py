from rest_framework import serializers

from .models import (
    ReportIFTA,
    RtlDriver,
    RtlDriverStatus,
    RtlIfta,
    RtlTruck,
    RtlTruckStatus,
)


class RtlDriverStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = RtlDriverStatus
        fields = [
            "rtl_id",
            "location_lat",
            "location_lon",
            "location_state",
            "location_timestamp",
            "vehicle_id",
            "vehicle_vin",
            "hos_event_code",
            "hos_event_time",
            "daily_hours_driven",
            "daily_hours_on_duty",
            "eta",
            "synced_at",
        ]


class RtlDriverSerializer(serializers.ModelSerializer):
    latest_status = RtlDriverStatusSerializer(read_only=True)

    class Meta:
        model = RtlDriver
        fields = [
            "id",
            "rtl_id",
            "company_id",
            "email",
            "first_name",
            "last_name",
            "active",
            "phone_num",
            "license_number",
            "license_state",
            "synced_at",
            "latest_status",
        ]


class RtlTruckStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = RtlTruckStatus
        fields = [
            "rtl_id",
            "vin",
            "odometer",
            "speed",
            "lat",
            "lon",
            "timestamp",
            "calculated_location",
            "synced_at",
        ]


class RtlTruckSerializer(serializers.ModelSerializer):
    latest_status = RtlTruckStatusSerializer(read_only=True)

    class Meta:
        model = RtlTruck
        fields = [
            "id",
            "rtl_id",
            "company_id",
            "name",
            "make",
            "model",
            "year",
            "vin",
            "plate_number",
            "active",
            "eld_serial_number",
            "synced_at",
            "latest_status",
        ]


class RtlIftaSerializer(serializers.ModelSerializer):
    class Meta:
        model = RtlIfta
        fields = [
            "id",
            "rtl_id",
            "company_id",
            "type_id",
            "status_id",
            "time_submitted",
            "time_generated",
            "url",
            "csv_url",
            "from_date",
            "to_date",
            "vehicle_vin",
            "vehicle_id",
            "vehicle_name",
            "synced_at",
        ]


class ReportIFTASerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportIFTA
        fields = [
            "id",
            "status",
            "from_date",
            "to_date",
            "vehicles",
            "report",
            "processed",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
