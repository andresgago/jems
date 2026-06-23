from rest_framework import serializers

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
    pickup_city_display = serializers.CharField(source="pickup_city.__str__", read_only=True)
    dropoff_city_display = serializers.CharField(source="dropoff_city.__str__", read_only=True)

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
            "broker_contacts",
            "dispatcher",
            "carrier",
            "truck",
            "trailer",
            "driver",
            "team_driver",
            "shipper",
            "receiver",
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
            "pickup_city_display",
            "dropoff_city_display",
            "stops",
        ]


class LoadListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    pickup_city_display = serializers.CharField(source="pickup_city.__str__", read_only=True)
    dropoff_city_display = serializers.CharField(source="dropoff_city.__str__", read_only=True)

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
