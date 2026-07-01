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
    fuel_card_number = serializers.CharField(source="fuel_card.number", read_only=True)
    carrier_name = serializers.CharField(source="carrier.name", read_only=True)
    owner_name = serializers.CharField(source="owner.full_name", read_only=True)
    contract_display = serializers.CharField(
        source="get_contract_display", read_only=True
    )
    pay_vacation_display = serializers.CharField(
        source="get_pay_vacation_display", read_only=True
    )
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
            "social_security_number",
            "hire_date",
            "termination_date",
            "license_number",
            "license_state",
            "license_expiration",
            "medical_card_expiration",
            "mvr_expiration",
            "contract",
            "contract_display",
            "miles_empty",
            "miles_full",
            "percent",
            "weekly_rate",
            "insurance",
            "eld",
            "worker_comp",
            "factor",
            "factor_fee",
            "pay_vacation",
            "pay_vacation_display",
            "fuel_card",
            "fuel_card_number",
            "team_driver",
            "owner",
            "owner_name",
            "carrier",
            "carrier_name",
            "carrier_start_date",
            "carrier_end_date",
            "carrier_end_reason",
            "eld_id",
            "factoring_account_id",
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
    fuel_card_number = serializers.CharField(source="fuel_card.number", read_only=True)
    carrier_name = serializers.CharField(source="carrier.name", read_only=True)
    has_license_document = serializers.SerializerMethodField()

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
            "photo",
            "license_expiration",
            "medical_card_expiration",
            "mvr_expiration",
            "on_vacation",
            "pay_vacation",
            "fuel_card",
            "fuel_card_number",
            "carrier",
            "carrier_name",
            "has_license_document",
        ]

    def get_has_license_document(self, obj: Driver) -> bool:
        if getattr(obj, "license_file", None):
            return True
        documents = getattr(obj, "documents", None)
        if documents is None or not hasattr(documents, "all"):
            return False
        return any(
            document.document_type == DriverDocument.DocumentType.LICENSE
            for document in documents.all()
        )


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
            "weekly_rate",
            "insurance",
            "eld",
            "worker_comp",
            "factor",
            "factor_fee",
            "pay_vacation",
            "fuel_card",
            "team_driver",
            "owner",
            "carrier",
            "carrier_start_date",
            "carrier_end_date",
            "carrier_end_reason",
            "eld_id",
            "factoring_account_id",
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


class PhotoUploadSerializer(serializers.Serializer):
    photo = serializers.ImageField()
