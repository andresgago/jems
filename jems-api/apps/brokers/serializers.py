from rest_framework import serializers

from .models import Broker, BrokerContact, Business


class BrokerContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrokerContact
        fields = [
            "id",
            "broker",
            "name",
            "email",
            "phone",
            "team",
            "confirmed",
            "is_scam",
            "details",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "broker", "created_at", "updated_at"]


class BrokerListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — omits nested contacts."""

    carrier_name = serializers.CharField(
        source="carrier.name", read_only=True, default=None
    )

    class Meta:
        model = Broker
        fields = [
            "id",
            "mc",
            "name",
            "dba_name",
            "email",
            "phone",
            "status",
            "checked_at",
            "carrier",
            "carrier_name",
            "created_at",
        ]


class BrokerSerializer(serializers.ModelSerializer):
    contacts = BrokerContactSerializer(many=True, read_only=True)
    carrier_name = serializers.CharField(
        source="carrier.name", read_only=True, default=None
    )
    city_name = serializers.SerializerMethodField()
    state_name = serializers.SerializerMethodField()

    class Meta:
        model = Broker
        fields = [
            "id",
            "mc",
            "name",
            "dba_name",
            "email",
            "phone",
            "accounting_email",
            "status",
            "setup_packet_file",
            "factor_company",
            "factor_account_id",
            "buy_status",
            "debtor_buy_status",
            "details",
            "checked_at",
            "physical_address",
            "mailing_address",
            "city",
            "city_name",
            "state",
            "state_name",
            "zip",
            "usdot_number",
            "safer_operating_status",
            "carrier",
            "carrier_name",
            "contacts",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
        ]
        read_only_fields = [
            "id",
            "setup_packet_file",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "contacts",
            "carrier_name",
            "city_name",
            "state_name",
        ]

    def get_city_name(self, obj: Broker) -> str | None:
        return obj.city.name if obj.city else None

    def get_state_name(self, obj: Broker) -> str | None:
        if obj.state:
            return f"{obj.state.name} ({obj.state.abbreviation})"
        return None


class BrokerFileUploadSerializer(serializers.Serializer):
    file = serializers.FileField()


class BusinessSerializer(serializers.ModelSerializer):
    city_display = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = ["id", "name", "address", "city", "city_display", "status", "rating"]
        read_only_fields = ["id", "rating", "city_display"]

    def get_city_display(self, obj: Business) -> str:
        return str(obj.city) if obj.city else ""
