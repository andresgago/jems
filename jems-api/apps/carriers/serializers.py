from rest_framework import serializers

from .models import Carrier, Factor


class CarrierSerializer(serializers.ModelSerializer):
    state_code = serializers.CharField(source="state.abbreviation", read_only=True)

    class Meta:
        model = Carrier
        fields = [
            "id",
            "mc",
            "dot_number",
            "name",
            "dba_name",
            "email",
            "phone",
            "no_reply_email",
            "cc_email",
            "accounting_email",
            "address",
            "city",
            "state",
            "state_code",
            "zip",
            "active",
            "factor_company",
            "factor_account_id",
            "debtor_buy_status",
            "buy_status",
            "sister_companies",
            "power_units",
            "operating_status",
            "eld_user",
            "eld_password",
            "w9_file",
            "noa_file",
            "coi_file",
            "mcc_file",
            "safety_letter_file",
            "last_inspection_file",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "state_code",
        ]


class SendCarrierPacketSerializer(serializers.Serializer):
    broker_email = serializers.EmailField(
        max_length=50, required=False, allow_blank=True
    )
    broker_id = serializers.IntegerField(required=False, allow_null=True)
    contact_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )
    file_slots = serializers.ListField(
        child=serializers.CharField(trim_whitespace=True),
        allow_empty=False,
    )

    def validate_contact_ids(self, value):
        seen = set()
        duplicates = []
        for contact_id in value:
            if contact_id in seen and contact_id not in duplicates:
                duplicates.append(contact_id)
            seen.add(contact_id)
        if duplicates:
            raise serializers.ValidationError(
                f"Duplicate contact id(s): {', '.join(str(i) for i in duplicates)}."
            )
        return value

    def validate_file_slots(self, value):
        empty_slots = [slot for slot in value if not slot]
        if empty_slots:
            raise serializers.ValidationError("File slots cannot be blank.")

        seen = set()
        duplicates = []
        for slot in value:
            if slot in seen and slot not in duplicates:
                duplicates.append(slot)
            seen.add(slot)
        if duplicates:
            raise serializers.ValidationError(
                f"Duplicate file slot(s): {', '.join(duplicates)}."
            )
        return value

    def validate(self, attrs):
        broker_email = attrs.get("broker_email", "").strip()
        contact_ids = attrs.get("contact_ids", [])
        broker_id = attrs.get("broker_id")

        if contact_ids and not broker_id:
            raise serializers.ValidationError(
                {"broker_id": "broker_id is required when contact_ids are selected."}
            )
        if not broker_email and not contact_ids:
            raise serializers.ValidationError(
                {"recipients": "Select at least one broker contact or enter an email."}
            )
        attrs["broker_email"] = broker_email
        attrs["contact_ids"] = contact_ids
        return attrs


class FactorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Factor
        fields = ["id", "value", "percent"]
