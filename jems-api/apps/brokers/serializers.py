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
            "details",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "broker", "created_at", "updated_at"]


class BrokerSerializer(serializers.ModelSerializer):
    contacts = BrokerContactSerializer(many=True, read_only=True)

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
            "carrier",
            "contacts",
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
            "contacts",
        ]


class BusinessSerializer(serializers.ModelSerializer):
    city_display = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = ["id", "name", "address", "city", "city_display", "status", "rating"]
        read_only_fields = ["id", "rating", "city_display"]

    def get_city_display(self, obj: Business) -> str:
        return str(obj.city) if obj.city else ""


class BrokerListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — omits nested contacts."""

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
            "created_at",
        ]
