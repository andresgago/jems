from django.urls import path

from .views import (
    DriverDocumentViewSet,
    DriverTypeViewSet,
    DriverVacationViewSet,
    DriverViewSet,
)

driver_list = DriverViewSet.as_view({"get": "list", "post": "create"})
driver_detail = DriverViewSet.as_view(
    {"get": "retrieve", "put": "update", "delete": "destroy"}
)
driver_toggle_status = DriverViewSet.as_view({"post": "toggle_status"})
driver_photo = DriverViewSet.as_view({"post": "upload_photo", "delete": "delete_photo"})
driver_documents = DriverViewSet.as_view(
    {"get": "list_documents", "post": "upload_document"}
)
document_detail = DriverDocumentViewSet.as_view({"delete": "destroy"})
type_list = DriverTypeViewSet.as_view({"get": "list", "post": "create"})
vacation_list = DriverVacationViewSet.as_view({"get": "list", "post": "create"})
vacation_detail = DriverVacationViewSet.as_view({"delete": "destroy"})

driver_last_loads = DriverViewSet.as_view({"get": "last_loads"})
driver_bulk_delete = DriverViewSet.as_view({"post": "bulk_delete"})

urlpatterns = [
    path("", driver_list, name="driver-list"),
    path("last-loads/", driver_last_loads, name="driver-last-loads"),
    path("bulk-delete/", driver_bulk_delete, name="driver-bulk-delete"),
    path("<int:pk>/", driver_detail, name="driver-detail"),
    path("<int:pk>/toggle-status/", driver_toggle_status, name="driver-toggle-status"),
    path("<int:pk>/photo/", driver_photo, name="driver-photo"),
    path("<int:pk>/documents/", driver_documents, name="driver-documents"),
    path("documents/<int:pk>/", document_detail, name="driver-document-detail"),
    path("<int:driver_pk>/vacations/", vacation_list, name="driver-vacation-list"),
    path(
        "<int:driver_pk>/vacations/<int:pk>/",
        vacation_detail,
        name="driver-vacation-detail",
    ),
    path("types/", type_list, name="driver-type-list"),
    path(
        "<int:pk>/last-vehicle/",
        DriverViewSet.as_view({"get": "last_vehicle"}),
        name="driver-last-vehicle",
    ),
]
