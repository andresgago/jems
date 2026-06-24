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

    miles = serializers.FloatField(required=True, min_value=0)
    details = serializers.CharField(
        required=False,
        allow_blank=False,
        max_length=800,
        default="Must be on time.",
    )

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
        instance = getattr(self, "instance", None)
        if "details" in self.initial_data and self.initial_data.get("details") == "":
            raise serializers.ValidationError(
                {"details": "This field may not be blank."}
            )

        lumper = attrs.get("lumper", instance.lumper if instance else 0)
        lumper_paid_by = attrs.get(
            "lumper_paid_by", instance.lumper_paid_by if instance else ""
        )
        if lumper <= 0:
            attrs["lumper_paid_by"] = ""
        elif not lumper_paid_by:
            raise serializers.ValidationError(
                {
                    "lumper_paid_by": "Lumper Paid By is required when lumper is greater than 0."
                }
            )

        pickup = attrs.get(
            "pickup_date",
            getattr(instance, "pickup_date", None),
        )
        dropoff = attrs.get(
            "dropoff_date",
            getattr(instance, "dropoff_date", None),
        )
        if pickup and dropoff and dropoff < pickup:
            raise serializers.ValidationError(
                {"dropoff_date": "Dropoff date must be on or after pickup date."}
            )
        return attrs


class LoadListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    broker_name = serializers.SerializerMethodField()
    broker_buy_status = serializers.CharField(
        source="broker.buy_status", read_only=True
    )
    broker_debtor_buy_status = serializers.CharField(
        source="broker.debtor_buy_status", read_only=True
    )
    broker_denied = serializers.SerializerMethodField()
    carrier_name = serializers.CharField(source="carrier.name", read_only=True)
    dispatcher_name = serializers.CharField(
        source="dispatcher.full_name", read_only=True
    )
    driver_name = serializers.CharField(source="driver.full_name", read_only=True)
    team_driver_name = serializers.CharField(
        source="team_driver.full_name", read_only=True
    )
    driver_photo = serializers.SerializerMethodField()
    truck_number = serializers.CharField(source="truck.number", read_only=True)
    trailer_number = serializers.CharField(source="trailer.number", read_only=True)
    trailer_type_short_name = serializers.CharField(
        source="trailer.trailer_type.short_name", read_only=True
    )
    load_trailer_type_short_name = serializers.CharField(
        source="trailer_type.short_name", read_only=True
    )
    pickup_city_display = serializers.SerializerMethodField()
    pickup_city_zip = serializers.CharField(source="pickup_city.zip", read_only=True)
    dropoff_city_display = serializers.SerializerMethodField()
    dropoff_city_zip = serializers.CharField(source="dropoff_city.zip", read_only=True)
    assignment_complete = serializers.SerializerMethodField()
    ready_to_execute = serializers.SerializerMethodField()

    def get_broker_name(self, obj):
        if not obj.broker:
            return ""
        return obj.broker.dba_name or obj.broker.name

    def get_broker_denied(self, obj):
        if not obj.broker:
            return False
        buy_status = str(obj.broker.buy_status or "").strip().lower()
        debtor_status = str(obj.broker.debtor_buy_status or "").strip().lower()
        return buy_status in {"", "0", "false", "no"} or "no buy" in debtor_status

    def get_driver_photo(self, obj):
        if not obj.driver or not obj.driver.photo:
            return ""
        request = self.context.get("request")
        url = obj.driver.photo.url
        return request.build_absolute_uri(url) if request else url

    def get_pickup_city_display(self, obj):
        return self._city_display(obj.pickup_city)

    def get_dropoff_city_display(self, obj):
        return self._city_display(obj.dropoff_city)

    def get_assignment_complete(self, obj):
        return bool(obj.driver_id and obj.truck_id and obj.trailer_id)

    def get_ready_to_execute(self, obj):
        return bool(
            self.get_assignment_complete(obj) and obj.rate_file and obj.bill_file
        )

    @staticmethod
    def _city_display(city):
        if not city:
            return ""
        state = city.state.abbreviation if city.state else ""
        return f"{city.name} ({state})" if state else city.name

    class Meta:
        model = Load
        fields = [
            "id",
            "number",
            "pickup_date",
            "pickup_city",
            "pickup_city_display",
            "pickup_city_zip",
            "dropoff_date",
            "dropoff_city",
            "dropoff_city_display",
            "dropoff_city_zip",
            "payment",
            "status",
            "status_display",
            "broker",
            "broker_name",
            "broker_contacts",
            "broker_buy_status",
            "broker_debtor_buy_status",
            "broker_denied",
            "carrier_name",
            "dispatcher",
            "dispatcher_name",
            "driver",
            "driver_name",
            "team_driver",
            "team_driver_name",
            "driver_photo",
            "truck",
            "truck_number",
            "trailer",
            "trailer_number",
            "trailer_type_short_name",
            "trailer_type",
            "load_trailer_type_short_name",
            "rate_file",
            "bill_file",
            "lumper_file",
            "detention_file",
            "shipper_rating",
            "receiver_rating",
            "assignment_complete",
            "ready_to_execute",
            "is_drop",
            "drop_place",
            "days_in_drop",
            "invoiced",
            "paid",
            "created_at",
        ]
