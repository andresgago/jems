from rest_framework import serializers

from .models import Account, CardGain, Category, CategoryType, DriverInvoice, OwnerInvoice, Record


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ["id", "code", "name", "is_active", "is_main", "is_assistant", "no_tax"]
        read_only_fields = ["id"]


class CategoryTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoryType
        fields = ["id", "name", "unit_of_measure", "is_active"]
        read_only_fields = ["id"]


class CategorySerializer(serializers.ModelSerializer):
    category_type_name = serializers.CharField(source="category_type.name", read_only=True)

    class Meta:
        model = Category
        fields = [
            "id", "code", "name", "category_type", "category_type_name",
            "is_active", "is_truck_part", "engine_type", "cabin_type",
            "transmission_type", "photo",
        ]
        read_only_fields = ["id", "category_type_name"]


class RecordSerializer(serializers.ModelSerializer):
    record_type_display = serializers.CharField(source="get_record_type_display", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)
    account_code = serializers.CharField(source="account.code", read_only=True)

    class Meta:
        model = Record
        fields = [
            "id", "date", "account", "account_code", "account_name",
            "quantity", "amount", "detail", "record_type", "record_type_display",
            "load", "truck", "trailer", "driver", "team_driver", "owner",
            "category", "category_expire", "category_expire_date",
            "dispatcher", "city", "card",
            "is_automatic", "progress", "follow", "position",
            "product", "transaction_number",
            "created_at", "updated_at", "created_by", "updated_by",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by", "updated_by",
                            "record_type_display", "account_name", "account_code"]


class RecordListSerializer(serializers.ModelSerializer):
    """Lightweight for list views."""
    account_code = serializers.CharField(source="account.code", read_only=True)

    class Meta:
        model = Record
        fields = ["id", "date", "account_code", "amount", "detail", "record_type",
                  "load", "driver", "truck", "created_at"]


class DriverInvoiceSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    driver_name = serializers.SerializerMethodField()

    def get_driver_name(self, obj):
        return obj.driver.full_name if obj.driver else ""

    class Meta:
        model = DriverInvoice
        fields = [
            "id", "number", "driver", "driver_name", "date",
            "invoice_type", "contract", "miles_empty", "miles_full", "percent",
            "vacation_now", "vacation_pay", "status", "status_display",
            "load_list", "created_at", "updated_at", "created_by", "updated_by",
        ]
        read_only_fields = ["id", "number", "created_at", "updated_at",
                            "created_by", "updated_by", "status_display", "driver_name"]


class OwnerInvoiceSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = OwnerInvoice
        fields = [
            "id", "number", "owner", "date", "owner_type", "contract", "percent",
            "status", "status_display",
            "worker_comp", "factor_dispatch", "factor_fee", "check_amount",
            "income_by_rate", "income_by_detention", "income_by_lumper", "income_by_driver",
            "fuel_expenses", "scale_expenses", "insurance_expenses", "yard_expenses",
            "factor_expenses", "toll_expenses", "eld_expenses",
            "load_list", "record",
            "created_at", "updated_at", "created_by", "updated_by",
        ]
        read_only_fields = ["id", "number", "created_at", "updated_at",
                            "created_by", "updated_by", "status_display"]


class CardGainSerializer(serializers.ModelSerializer):
    class Meta:
        model = CardGain
        fields = ["id", "card", "date", "gain"]
        read_only_fields = ["id"]
