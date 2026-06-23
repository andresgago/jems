from django.contrib import admin

from .models import Account, Category, CategoryType, DriverInvoice, OwnerInvoice, Record


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "is_active", "is_main", "is_assistant"]
    list_filter = ["is_active", "is_main"]
    search_fields = ["code", "name"]


@admin.register(CategoryType)
class CategoryTypeAdmin(admin.ModelAdmin):
    list_display = ["name", "unit_of_measure", "is_active"]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "category_type", "is_active", "is_truck_part"]
    list_filter = ["is_active", "is_truck_part"]
    search_fields = ["code", "name"]


@admin.register(Record)
class RecordAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "date",
        "account",
        "amount",
        "record_type",
        "driver",
        "truck",
        "load",
    ]
    list_filter = ["record_type", "is_automatic"]
    search_fields = ["detail", "transaction_number"]
    date_hierarchy = "date"


@admin.register(DriverInvoice)
class DriverInvoiceAdmin(admin.ModelAdmin):
    list_display = ["number", "driver", "date", "status", "percent"]
    list_filter = ["status"]
    search_fields = ["number"]


@admin.register(OwnerInvoice)
class OwnerInvoiceAdmin(admin.ModelAdmin):
    list_display = ["number", "owner", "date", "status", "check_amount"]
    list_filter = ["status"]
    search_fields = ["number"]
