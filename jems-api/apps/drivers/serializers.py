from rest_framework import serializers

from .models import Driver, DriverDocument, DriverType, DriverVacation


class DriverTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverType
        fields = ["id", "name", "is_active"]


class DriverDocumentSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(
        source="get_document_type_display", read_only=True
    )

    class Meta:
        model = DriverDocument
        fields = [
            "id",
            "document_type",
            "document_type_display",
            "file",
            "expiration_date",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class DriverSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    driver_type_name = serializers.CharField(source="driver_type.name", read_only=True)
    documents = DriverDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = Driver
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "driver_type",
            "driver_type_name",
            "status",
            "phone",
            "email",
            "address",
            "birth_date",
            "hire_date",
            "termination_date",
            "license_number",
            "license_state",
            "license_expiration",
            "medical_card_expiration",
            "mvr_expiration",
            "contract",
            "miles_empty",
            "miles_full",
            "percent",
            "insurance",
            "eld",
            "worker_comp",
            "factor",
            "factor_fee",
            "fuel_card",
            "team_driver",
            "carrier",
            "carrier_start_date",
            "carrier_end_date",
            "carrier_end_reason",
            "endorsements",
            "restrictions",
            "on_vacation",
            "photo",
            "documents",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class DriverListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    driver_type_name = serializers.CharField(source="driver_type.name", read_only=True)

    class Meta:
        model = Driver
        fields = [
            "id",
            "first_name",
            "last_name",
            "full_name",
            "driver_type",
            "driver_type_name",
            "status",
            "phone",
            "email",
            "license_expiration",
            "medical_card_expiration",
            "on_vacation",
            "carrier",
        ]


class DriverCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Driver
        fields = [
            "first_name",
            "last_name",
            "driver_type",
            "status",
            "phone",
            "email",
            "address",
            "birth_date",
            "hire_date",
            "termination_date",
            "license_number",
            "license_state",
            "license_expiration",
            "medical_card_expiration",
            "mvr_expiration",
            "contract",
            "miles_empty",
            "miles_full",
            "percent",
            "insurance",
            "eld",
            "worker_comp",
            "factor",
            "factor_fee",
            "fuel_card",
            "team_driver",
            "carrier",
            "carrier_start_date",
            "carrier_end_date",
            "carrier_end_reason",
            "endorsements",
            "restrictions",
            "on_vacation",
            "social_security_number",
        ]


class DriverVacationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriverVacation
        fields = ["id", "start", "end", "note", "created_at"]
        read_only_fields = ["created_at"]


class DocumentUploadSerializer(serializers.Serializer):
    document_type = serializers.ChoiceField(choices=DriverDocument.DocumentType.choices)
    file = serializers.FileField()
    expiration_date = serializers.DateField(required=False, allow_null=True)
