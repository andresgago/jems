from django.contrib import admin

from .models import Load, LoadStop


class LoadStopInline(admin.TabularInline):
    model = LoadStop
    extra = 0
    fields = ["stop_type", "from_date", "to_date", "business", "address", "city"]


@admin.register(Load)
class LoadAdmin(admin.ModelAdmin):
    list_display = ["number", "status", "pickup_date", "dropoff_date", "broker", "driver", "invoiced", "paid"]
    list_filter = ["status", "invoiced", "paid"]
    search_fields = ["number"]
    inlines = [LoadStopInline]


@admin.register(LoadStop)
class LoadStopAdmin(admin.ModelAdmin):
    list_display = ["load", "stop_type", "from_date", "to_date", "business", "city"]
    search_fields = ["load__number"]
