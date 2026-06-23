from rest_framework import serializers

from apps.brokers.models import Business
from .models import Load, LoadStop


class LoadStopSerializer(serializers.ModelSerializer):
    class Meta:
        model = LoadStop
        fields = [
            "id",
            "load",
            "stop_type",
            "from_date",
            "to_date",
            "bol_file",
            "truck",
            "trailer",
            "driver",
            "business",
            "business_rating",
            "is_drop",
            "address",
            "city",
            "details",
            "is_fcfs",
            "po_number",
            "commodity",
            "temperature",
            "driver_notes",
            "arrived_at",
            "departed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "load", "created_at", "updated_at"]


class LoadSerializer(serializers.ModelSerializer):
    stops = LoadStopSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    broker_name = serializers.CharField(source="broker.name", read_only=True)
    carrier_name = serializers.CharField(source="carrier.name", read_only=True)
    shipper_name = serializers.CharField(source="shipper.name", read_only=True)
    receiver_name = serializers.CharField(source="receiver.name", read_only=True)
    pickup_city_display = serializers.CharField(
        source="pickup_city.__str__", read_only=True
    )
    dropoff_city_display = serializers.CharField(
        source="dropoff_city.__str__", read_only=True
    )

    class Meta:
        model = Load
        fields = [
            "id",
            "number",
            "miles",
            "miles_empty",
            "weight",
            "trailer_type",
            "pickup_date",
            "pickup_city",
            "pickup_city_display",
            "pickup_address",
            "dropoff_date",
            "dropoff_city",
            "dropoff_city_display",
            "dropoff_address",
            "payment",
            "detention",
            "lumper",
            "lumper_paid_by",
            "drop_trailer",
            "broker",
            "broker_name",
            "broker_contacts",
            "dispatcher",
            "carrier",
            "carrier_name",
            "truck",
            "trailer",
            "driver",
            "team_driver",
            "shipper",
            "shipper_name",
            "receiver",
            "receiver_name",
            "shipper_rating",
            "receiver_rating",
            "rate_file",
            "bill_file",
            "lumper_file",
            "detention_file",
            "status",
            "status_display",
            "execute",
            "invoiced",
            "paid",
            "owner_invoiced",
            "owner_invoice_number",
            "owner_paid",
            "history",
            "move",
            "drivers_paid",
            "is_drop",
            "drop_place",
            "days_in_drop",
            "rc_notified",
            "bol_notified",
            "lumper_notified",
            "detention_notified",
            "lat",
            "lon",
            "eta",
            "accounting_day",
            "details",
            "stops",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "executed_by",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "created_by",
            "updated_by",
            "executed_by",
            "status_display",
            "broker_name",
            "carrier_name",
            "shipper_name",
            "receiver_name",
            "pickup_city_display",
            "dropoff_city_display",
            "stops",
        ]

    shipper = serializers.PrimaryKeyRelatedField(
        queryset=Business.objects.all(),
        required=True,
        allow_null=False,
    )
    receiver = serializers.PrimaryKeyRelatedField(
        queryset=Business.objects.all(),
        required=True,
        allow_null=False,
    )

    def validate(self, attrs: dict) -> dict:
        pickup = attrs.get(
            "pickup_date",
            getattr(self.instance, "pickup_date", None),
        )
        dropoff = attrs.get(
            "dropoff_date",
            getattr(self.instance, "dropoff_date", None),
        )
        if pickup and dropoff and dropoff < pickup:
            raise serializers.ValidationError(
                {"dropoff_date": "Dropoff date must be on or after pickup date."}
            )
        return attrs


class LoadListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    pickup_city_display = serializers.CharField(
        source="pickup_city.__str__", read_only=True
    )
    dropoff_city_display = serializers.CharField(
        source="dropoff_city.__str__", read_only=True
    )

    class Meta:
        model = Load
        fields = [
            "id",
            "number",
            "pickup_date",
            "pickup_city_display",
            "dropoff_date",
            "dropoff_city_display",
            "payment",
            "status",
            "status_display",
            "broker",
            "dispatcher",
            "driver",
            "truck",
            "invoiced",
            "paid",
            "created_at",
        ]
