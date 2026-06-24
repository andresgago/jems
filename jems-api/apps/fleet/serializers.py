from rest_framework import serializers

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
    class Meta:
        model = TruckMaintenance
        fields = [
            "id",
            "date",
            "miles_alert",
            "time_alert",
            "time_year",
            "time_month",
            "odometer_start",
            "odometer_current",
            "detail",
            "created_at",
        ]
        read_only_fields = ["created_at"]


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
    class Meta:
        model = TrailerMaintenance
        fields = [
            "id",
            "date",
            "miles",
            "miles_alert",
            "time_alert",
            "time_year",
            "time_month",
            "detail",
            "created_at",
        ]
        read_only_fields = ["created_at"]


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
            "annual_inspection_file",
            "annual_inspection_expiration",
            "registration_file",
            "agreement_file",
            "purchase_date",
            "purchase_cost",
            "is_rented",
            "loss_payee",
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
        ]


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
    class Meta:
        model = TruckMilesReset
        fields = ["id", "truck", "date", "created_at"]
        read_only_fields = ["id", "created_at"]
