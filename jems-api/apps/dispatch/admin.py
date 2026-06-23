from django.contrib import admin

from .models import DispatcherWork, DispatcherWorkInvoiceByHour, DispatcherWorkInvoiceByPercent


@admin.register(DispatcherWorkInvoiceByPercent)
class DispatcherWorkInvoiceByPercentAdmin(admin.ModelAdmin):
    list_display = ["number", "dispatcher", "date", "percent", "status"]
    list_filter = ["status"]
    search_fields = ["dispatcher__first_name", "dispatcher__last_name"]


@admin.register(DispatcherWorkInvoiceByHour)
class DispatcherWorkInvoiceByHourAdmin(admin.ModelAdmin):
    list_display = ["number", "dispatcher", "date", "pay_per_hour", "status"]
    list_filter = ["status"]
    search_fields = ["dispatcher__first_name", "dispatcher__last_name"]


@admin.register(DispatcherWork)
class DispatcherWorkAdmin(admin.ModelAdmin):
    list_display = ["title", "dispatcher", "start", "end", "is_finished", "is_paid"]
    list_filter = ["is_finished", "is_paid"]
    search_fields = ["title", "dispatcher__first_name", "dispatcher__last_name"]
