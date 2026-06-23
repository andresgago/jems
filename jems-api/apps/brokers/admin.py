from django.contrib import admin

from .models import Broker, BrokerContact


class BrokerContactInline(admin.TabularInline):
    model = BrokerContact
    extra = 0
    fields = ["name", "email", "phone", "team"]


@admin.register(Broker)
class BrokerAdmin(admin.ModelAdmin):
    list_display = ["name", "mc", "status", "checked_at", "created_at"]
    list_filter = ["status"]
    search_fields = ["name", "mc", "dba_name"]
    inlines = [BrokerContactInline]


@admin.register(BrokerContact)
class BrokerContactAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "phone", "broker", "team"]
    search_fields = ["name", "email"]
