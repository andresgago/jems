from django.contrib import admin

from .models import DriverFile, ImportRecordFile, TrailerFile, TruckFile

admin.site.register(DriverFile)
admin.site.register(TruckFile)
admin.site.register(TrailerFile)
admin.site.register(ImportRecordFile)
