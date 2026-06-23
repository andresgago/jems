from rest_framework import serializers

from .models import (
    DispatcherWork,
    DispatcherWorkInvoiceByHour,
    DispatcherWorkInvoiceByPercent,
)


class DispatcherWorkInvoiceByPercentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DispatcherWorkInvoiceByPercent
        fields = [
            "id",
            "number",
            "dispatcher",
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


class DispatcherWorkInvoiceByHourSerializer(serializers.ModelSerializer):
    class Meta:
        model = DispatcherWorkInvoiceByHour
        fields = [
            "id",
            "number",
            "dispatcher",
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


class DispatcherWorkSerializer(serializers.ModelSerializer):
    duration_hours = serializers.FloatField(read_only=True)

    class Meta:
        model = DispatcherWork
        fields = [
            "id",
            "title",
            "dispatcher",
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
