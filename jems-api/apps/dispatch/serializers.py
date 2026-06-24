from rest_framework import serializers

from .models import (
    DispatcherWork,
    DispatcherWorkInvoiceByHour,
    DispatcherWorkInvoiceByPercent,
)

# ── Percent Invoice ───────────────────────────────────────────────────────────


class DispatcherWorkInvoiceByPercentSerializer(serializers.ModelSerializer):
    dispatcher_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DispatcherWorkInvoiceByPercent
        fields = [
            "id",
            "number",
            "dispatcher",
            "dispatcher_name",
            "date",
            "start",
            "end",
            "percent",
            "status",
            "record",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "number", "created_at", "updated_at"]

    def get_dispatcher_name(self, obj: DispatcherWorkInvoiceByPercent) -> str | None:
        if obj.dispatcher:
            return f"{obj.dispatcher.first_name} {obj.dispatcher.last_name}".strip()
        return None


# ── Hour Invoice ──────────────────────────────────────────────────────────────


class DispatcherWorkInvoiceByHourSerializer(serializers.ModelSerializer):
    dispatcher_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = DispatcherWorkInvoiceByHour
        fields = [
            "id",
            "number",
            "dispatcher",
            "dispatcher_name",
            "date",
            "start",
            "end",
            "pay_per_hour",
            "status",
            "record",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "number", "created_at", "updated_at"]

    def get_dispatcher_name(self, obj: DispatcherWorkInvoiceByHour) -> str | None:
        if obj.dispatcher:
            return f"{obj.dispatcher.first_name} {obj.dispatcher.last_name}".strip()
        return None


# ── Dispatcher Work ───────────────────────────────────────────────────────────


class DispatcherWorkSerializer(serializers.ModelSerializer):
    dispatcher_name = serializers.SerializerMethodField(read_only=True)
    duration_hours = serializers.FloatField(read_only=True)

    class Meta:
        model = DispatcherWork
        fields = [
            "id",
            "title",
            "dispatcher",
            "dispatcher_name",
            "start",
            "end",
            "session",
            "is_finished",
            "is_paid",
            "invoice_percent",
            "invoice_hour",
            "duration_hours",
        ]
        read_only_fields = ["id", "is_finished", "is_paid"]

    def get_dispatcher_name(self, obj: DispatcherWork) -> str | None:
        if obj.dispatcher:
            return f"{obj.dispatcher.first_name} {obj.dispatcher.last_name}".strip()
        return None
