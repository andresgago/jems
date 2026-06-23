from django.contrib import admin

from .models import Carrier


@admin.register(Carrier)
class CarrierAdmin(admin.ModelAdmin):
    list_display = ["name", "mc", "dot_number", "active", "created_at"]
    list_filter = ["active"]
    search_fields = ["name", "mc", "dot_number"]
