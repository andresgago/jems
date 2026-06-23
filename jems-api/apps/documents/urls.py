from django.urls import path

from .views import (
    DriverFileViewSet,
    ImportRecordFileViewSet,
    TrailerFileViewSet,
    TruckFileViewSet,
)

driver_file_list = DriverFileViewSet.as_view({"get": "list", "post": "create"})
driver_file_detail = DriverFileViewSet.as_view({"delete": "destroy"})

truck_file_list = TruckFileViewSet.as_view({"get": "list", "post": "create"})
truck_file_detail = TruckFileViewSet.as_view({"delete": "destroy"})

trailer_file_list = TrailerFileViewSet.as_view({"get": "list", "post": "create"})
trailer_file_detail = TrailerFileViewSet.as_view({"delete": "destroy"})

import_record_file_list = ImportRecordFileViewSet.as_view({"get": "list", "post": "create"})
import_record_file_detail = ImportRecordFileViewSet.as_view({"delete": "destroy"})

urlpatterns = [
    path("driver-files/", driver_file_list, name="driver-file-list"),
    path("driver-files/<int:pk>/", driver_file_detail, name="driver-file-detail"),
    path("truck-files/", truck_file_list, name="truck-file-list"),
    path("truck-files/<int:pk>/", truck_file_detail, name="truck-file-detail"),
    path("trailer-files/", trailer_file_list, name="trailer-file-list"),
    path("trailer-files/<int:pk>/", trailer_file_detail, name="trailer-file-detail"),
    path("import-record-files/", import_record_file_list, name="import-record-file-list"),
    path("import-record-files/<int:pk>/", import_record_file_detail, name="import-record-file-detail"),
]
