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


class FactorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Factor
        fields = ["id", "value", "percent"]
