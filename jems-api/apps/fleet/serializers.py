import datetime
import re

from rest_framework import serializers

from . import services
from .models import (
    Accident,
    AccidentPicture,
    Card,
    CabinType,
    EngineType,
    LossPayee,
    Make,
    Trailer,
    TrailerMaintenance,
    TrailerType,
    TireSize,
    TransmissionType,
    Truck,
    TruckMaintenance,
    TruckMilesReset,
    TruckOwner,
    TruckType,
)


class LegacyFlexibleDateTimeField(serializers.DateTimeField):
    """Accept legacy date-only input while preserving datetime storage."""

    DATE_ONLY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

    def __init__(self, **kwargs):
        kwargs.setdefault("default_timezone", datetime.timezone.utc)
        super().__init__(**kwargs)

    def to_internal_value(self, value):
        if isinstance(value, str) and self.DATE_ONLY_RE.match(value):
            year, month, day = (int(part) for part in value.split("-"))
            return datetime.datetime(year, month, day, tzinfo=datetime.timezone.utc)
        return super().to_internal_value(value)


class TruckTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TruckType
        fields = ["id", "name", "is_active"]


class TrailerTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrailerType
        fields = ["id", "name", "short_name", "is_active"]


class TruckOwnerSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = TruckOwner
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone",
            "status",
            "owner_type",
            "worker_comp",
            "factor_dispatch",
            "factor_fee",
            "percent",
            "insurance",
            "truck_amount",
            "driver_amount",
            "truck_yard_rent",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class TruckOwnerCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TruckOwner
        fields = [
            "first_name",
            "last_name",
            "email",
            "phone",
            "status",
            "owner_type",
            "worker_comp",
            "factor_dispatch",
            "factor_fee",
            "percent",
            "insurance",
            "truck_amount",
            "driver_amount",
            "truck_yard_rent",
        ]


class TruckMaintenanceSerializer(serializers.ModelSerializer):
    """Read serializer — nested inside TruckSerializer and standalone list/detail.

    truck is read_only so that nested writes (where truck comes from URL) still work
    without requiring it in the request body.
    """

    truck_number = serializers.CharField(source="truck.number", read_only=True)
    truck_vin = serializers.CharField(source="truck.vin", read_only=True)
    truck_odometer_current = serializers.FloatField(
        source="truck.odometer_current", read_only=True
    )

    class Meta:
        model = TruckMaintenance
        fields = [
            "id",
            "truck",
            "truck_number",
            "truck_vin",
            "truck_odometer_current",
            "date",
            "miles_alert",
            "maintenance_miles",
            "time_alert",
            "time_year",
            "time_month",
            "odometer_start",
            "odometer_current",
            "is_done",
            "driven_miles",
            "detail",
            "created_at",
        ]
        read_only_fields = [
            "created_at",
            "truck",
            "truck_number",
            "truck_vin",
            "truck_odometer_current",
        ]


class TruckMaintenanceCreateUpdateSerializer(serializers.ModelSerializer):
    """Write serializer for standalone truck-maintenance endpoints."""

    class Meta:
        model = TruckMaintenance
        fields = [
            "truck",
            "date",
            "miles_alert",
            "maintenance_miles",
            "time_alert",
            "time_year",
            "time_month",
            "odometer_start",
            "odometer_current",
            "is_done",
            "driven_miles",
            "detail",
        ]


class TruckListSerializer(serializers.ModelSerializer):
    truck_type_name = serializers.CharField(source="truck_type.name", read_only=True)

    class Meta:
        model = Truck
        fields = [
            "id",
            "number",
            "vin",
            "year",
            "status",
            "truck_type",
            "truck_type_name",
            "plate",
            "avi_expiration",
            "registration_expiration",
            "odometer_current",
            "carrier",
        ]


class TruckSerializer(serializers.ModelSerializer):
    truck_type_name = serializers.CharField(source="truck_type.name", read_only=True)
    maintenance_records = TruckMaintenanceSerializer(many=True, read_only=True)

    class Meta:
        model = Truck
        fields = [
            "id",
            "number",
            "vin",
            "year",
            "status",
            "truck_type",
            "truck_type_name",
            "plate",
            "transponder",
            "make",
            "engine_type",
            "cabin_type",
            "transmission_type",
            "tire_size",
            "gross_weight",
            "odometer_current",
            "avi_file",
            "avi_expiration",
            "registration_file",
            "registration_expiration",
            "agreement_file",
            "leased_file",
            "photo",
            "purchase_date",
            "purchase_cost",
            "is_leased",
            "leased_name",
            "loan_term",
            "interest_rate",
            "monthly_bill",
            "remaining_balance",
            "dispatcher",
            "owner",
            "fuel_card",
            "carrier",
            "carrier_start_date",
            "carrier_end_date",
            "carrier_end_reason",
            "loss_payee",
            "mac_address",
            "serial_number",
            "eld_company",
            "maintenance_records",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class TruckFileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()


class TruckPhotoUploadSerializer(serializers.Serializer):
    file = serializers.ImageField()


class TruckCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Truck
        fields = [
            "number",
            "vin",
            "year",
            "status",
            "truck_type",
            "plate",
            "transponder",
            "make",
            "engine_type",
            "cabin_type",
            "transmission_type",
            "tire_size",
            "gross_weight",
            "odometer_current",
            "avi_expiration",
            "registration_expiration",
            "purchase_date",
            "purchase_cost",
            "is_leased",
            "leased_name",
            "loan_term",
            "interest_rate",
            "monthly_bill",
            "remaining_balance",
            "dispatcher",
            "owner",
            "fuel_card",
            "carrier",
            "carrier_start_date",
            "carrier_end_date",
            "carrier_end_reason",
            "loss_payee",
            "mac_address",
            "serial_number",
            "eld_company",
        ]


class TrailerMaintenanceSerializer(serializers.ModelSerializer):
    """Read serializer — nested inside TrailerSerializer and standalone list/detail.

    trailer is read_only so that nested writes (where trailer comes from URL) still work.
    """

    trailer_number = serializers.CharField(source="trailer.number", read_only=True)
    trailer_vin = serializers.CharField(source="trailer.vin", read_only=True)
    is_last_maintenance = serializers.SerializerMethodField()
    miles_since_maintenance = serializers.SerializerMethodField()
    miles_alert_message = serializers.SerializerMethodField()
    time_alert_message = serializers.SerializerMethodField()
    time_alert_date = serializers.SerializerMethodField()

    class Meta:
        model = TrailerMaintenance
        fields = [
            "id",
            "trailer",
            "trailer_number",
            "trailer_vin",
            "date",
            "miles",
            "miles_alert",
            "time_alert",
            "time_year",
            "time_month",
            "detail",
            "created_at",
            "is_last_maintenance",
            "miles_since_maintenance",
            "miles_alert_message",
            "time_alert_message",
            "time_alert_date",
        ]
        read_only_fields = ["created_at", "trailer", "trailer_number", "trailer_vin"]

    def get_is_last_maintenance(self, obj):
        return services.is_last_trailer_maintenance(obj)

    def get_miles_since_maintenance(self, obj):
        if obj.miles_alert != 1:
            return None
        return services.get_trailer_miles_since_maintenance(obj.trailer, obj.date)

    def get_miles_alert_message(self, obj):
        return services.get_trailer_miles_alert_message(obj)

    def get_time_alert_message(self, obj):
        return services.get_trailer_time_alert_message(obj)

    def get_time_alert_date(self, obj):
        alert_date = services.get_trailer_time_alert_date(obj)
        return alert_date.isoformat() if alert_date else None


class TrailerMaintenanceCreateUpdateSerializer(serializers.ModelSerializer):
    """Write serializer for standalone trailer-maintenance endpoints."""

    class Meta:
        model = TrailerMaintenance
        fields = [
            "trailer",
            "date",
            "miles",
            "miles_alert",
            "time_alert",
            "time_year",
            "time_month",
            "detail",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        miles_alert = attrs.get("miles_alert", getattr(self.instance, "miles_alert", 0))
        miles = attrs.get("miles", getattr(self.instance, "miles", 0))
        if miles_alert == 1 and (miles in (None, "") or float(miles) <= 0):
            raise serializers.ValidationError({"miles": "Miles cannot be blank."})

        time_year = attrs.get("time_year", getattr(self.instance, "time_year", 0))
        time_month = attrs.get("time_month", getattr(self.instance, "time_month", 0))
        if time_year < 0 or time_year > 15:
            raise serializers.ValidationError(
                {"time_year": "Years must be between 0 and 15."}
            )
        if time_month < 0 or time_month > 11:
            raise serializers.ValidationError(
                {"time_month": "Months must be between 0 and 11."}
            )

        detail = attrs.get("detail", getattr(self.instance, "detail", ""))
        if not str(detail).strip():
            raise serializers.ValidationError({"detail": "Details cannot be blank."})
        if len(str(detail)) > 500:
            raise serializers.ValidationError(
                {"detail": "Details cannot exceed 500 characters."}
            )
        return attrs


class TrailerListSerializer(serializers.ModelSerializer):
    trailer_type_name = serializers.CharField(
        source="trailer_type.name", read_only=True
    )

    class Meta:
        model = Trailer
        fields = [
            "id",
            "number",
            "vin",
            "year",
            "status",
            "trailer_type",
            "trailer_type_name",
            "plate_number",
            "annual_inspection_expiration",
            "is_rented",
        ]


class TrailerSerializer(serializers.ModelSerializer):
    trailer_type_name = serializers.CharField(
        source="trailer_type.name", read_only=True
    )
    plate_state_name = serializers.CharField(source="plate_state.name", read_only=True)
    owner_name = serializers.CharField(source="owner.name", read_only=True)
    carrier_name = serializers.CharField(source="carrier.name", read_only=True)
    maintenance_records = TrailerMaintenanceSerializer(many=True, read_only=True)

    class Meta:
        model = Trailer
        fields = [
            "id",
            "number",
            "vin",
            "year",
            "status",
            "width",
            "height",
            "trailer_type",
            "trailer_type_name",
            "plate_number",
            "plate_state",
            "plate_state_name",
            "annual_inspection_file",
            "annual_inspection_expiration",
            "registration_file",
            "agreement_file",
            "purchase_date",
            "purchase_cost",
            "is_rented",
            "loss_payee",
            "owner",
            "owner_name",
            "carrier",
            "carrier_name",
            "carrier_start_date",
            "carrier_end_date",
            "carrier_end_reason",
            "maintenance_records",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class TrailerCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trailer
        fields = [
            "number",
            "vin",
            "year",
            "status",
            "width",
            "height",
            "trailer_type",
            "plate_number",
            "plate_state",
            "annual_inspection_expiration",
            "purchase_date",
            "purchase_cost",
            "is_rented",
            "loss_payee",
            "owner",
            "carrier",
            "carrier_start_date",
            "carrier_end_date",
            "carrier_end_reason",
        ]


class TrailerFileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()


class AccidentPictureSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccidentPicture
        fields = ["id", "accident", "file", "description", "rank", "created_at"]
        read_only_fields = ["id", "accident", "created_at"]


class AccidentSerializer(serializers.ModelSerializer):
    pictures = AccidentPictureSerializer(many=True, read_only=True)

    class Meta:
        model = Accident
        fields = [
            "id",
            "date",
            "driver",
            "truck",
            "trailer",
            "city",
            "address",
            "state",
            "police_report_file",
            "post_accident_file",
            "crash_number",
            "tow_aways",
            "death_count",
            "fatal_injuries",
            "pictures",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AccidentCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Accident
        fields = [
            "date",
            "driver",
            "truck",
            "trailer",
            "city",
            "address",
            "state",
            "police_report_file",
            "post_accident_file",
            "crash_number",
            "tow_aways",
            "death_count",
            "fatal_injuries",
        ]


class MakeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Make
        fields = ["id", "name"]


class EngineTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EngineType
        fields = ["id", "name"]


class CabinTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CabinType
        fields = ["id", "name"]


class TransmissionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransmissionType
        fields = ["id", "name"]


class TireSizeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TireSize
        fields = ["id", "name"]


class CardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Card
        fields = ["id", "number", "is_active"]


class LossPayeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LossPayee
        fields = ["id", "name", "address", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class TruckMilesResetSerializer(serializers.ModelSerializer):
    date = LegacyFlexibleDateTimeField()
    truck_number = serializers.CharField(source="truck.number", read_only=True)
    truck_vin = serializers.CharField(source="truck.vin", read_only=True)
    truck_status = serializers.IntegerField(source="truck.status", read_only=True)
    is_last_reset = serializers.SerializerMethodField()

    def get_is_last_reset(self, obj: TruckMilesReset) -> bool:
        latest_ids = self.context.get("latest_reset_ids")
        if latest_ids is not None:
            return obj.pk in latest_ids
        latest = (
            TruckMilesReset.objects.filter(truck=obj.truck)
            .order_by("-date", "-id")
            .first()
        )
        return latest is not None and latest.pk == obj.pk

    class Meta:
        model = TruckMilesReset
        fields = [
            "id",
            "truck",
            "truck_number",
            "truck_vin",
            "truck_status",
            "date",
            "is_last_reset",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
