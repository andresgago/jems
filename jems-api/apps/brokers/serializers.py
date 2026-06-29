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


class BrokerStatusLastLoadSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    number = serializers.CharField()
    pickup_city = serializers.CharField()
    dropoff_city = serializers.CharField()
    payment = serializers.CharField()
    pickup_date = serializers.CharField(allow_null=True)
    dropoff_date = serializers.CharField(allow_null=True)
    driver = serializers.CharField(allow_blank=True)
    truck = serializers.CharField(allow_blank=True)
    trailer = serializers.CharField(allow_blank=True)


class BrokerStatusSerializer(serializers.Serializer):
    id = serializers.IntegerField(allow_null=True)
    broker_id = serializers.IntegerField(allow_null=True)
    mc = serializers.CharField()
    mc_number = serializers.CharField()
    name = serializers.CharField()
    legal_name = serializers.CharField(allow_blank=True)
    debtor_name = serializers.CharField(allow_blank=True)
    dba_name = serializers.CharField()
    phone = serializers.CharField(allow_blank=True)
    status = serializers.IntegerField()
    exists = serializers.BooleanField()
    source = serializers.CharField()
    buy_status = serializers.CharField()
    debtor_buy_status = serializers.CharField()
    debtor_rating = serializers.CharField(allow_blank=True)
    debtor_credit_limit = serializers.CharField(allow_blank=True)
    safer_operating_status = serializers.CharField()
    operating_status = serializers.CharField(allow_blank=True)
    factor_company = serializers.CharField()
    factor_account_id = serializers.CharField(allow_blank=True)
    checked_at = serializers.CharField(allow_null=True)
    last_load = BrokerStatusLastLoadSerializer(allow_null=True)


class BrokerStatusCreateSerializer(serializers.Serializer):
    mc = serializers.CharField(required=False, allow_blank=True)
    mc_number = serializers.CharField(required=False, allow_blank=True)
    name = serializers.CharField(required=False, allow_blank=True)
    legal_name = serializers.CharField(required=False, allow_blank=True)
    debtor_name = serializers.CharField(required=False, allow_blank=True)
    dba_name = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    factor_company = serializers.CharField(required=False, allow_blank=True)
    factor_account_id = serializers.CharField(required=False, allow_blank=True)
    account_id = serializers.CharField(required=False, allow_blank=True)
    debtor_buy_status = serializers.CharField(required=False, allow_blank=True)
    safer_operating_status = serializers.CharField(required=False, allow_blank=True)
    operating_status = serializers.CharField(required=False, allow_blank=True)


class BusinessSerializer(serializers.ModelSerializer):
    city_display = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = ["id", "name", "address", "city", "city_display", "status", "rating"]
        read_only_fields = ["id", "rating", "city_display"]

    def get_city_display(self, obj: Business) -> str:
        return str(obj.city) if obj.city else ""
