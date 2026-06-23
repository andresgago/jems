from django.contrib import admin

from .models import (
    ReportIFTA,
    RtlDriver,
    RtlDriverStatus,
    RtlIfta,
    RtlTruck,
    RtlTruckStatus,
)

admin.site.register(RtlDriver)
admin.site.register(RtlTruck)
admin.site.register(RtlDriverStatus)
admin.site.register(RtlTruckStatus)
admin.site.register(RtlIfta)
admin.site.register(ReportIFTA)
