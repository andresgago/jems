from django.urls import path

from .views import (
    AccidentViewSet,
    CardViewSet,
    CabinTypeViewSet,
    EngineTypeViewSet,
    LossPayeeViewSet,
    MakeViewSet,
    TireSizeViewSet,
    TrailerMaintenanceViewSet,
    TrailerTypeViewSet,
    TrailerViewSet,
    TransmissionTypeViewSet,
    TruckMaintenanceViewSet,
    TruckMilesResetViewSet,
    TruckOwnerViewSet,
    TruckTypeViewSet,
    TruckViewSet,
)

# Trucks
truck_list = TruckViewSet.as_view({"get": "list", "post": "create"})
truck_options = TruckViewSet.as_view({"get": "options"})
truck_detail = TruckViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
)
truck_toggle_status = TruckViewSet.as_view({"post": "toggle_status"})
truck_maintenance = TruckViewSet.as_view({"get": "maintenance", "post": "maintenance"})
truck_file = TruckViewSet.as_view({"post": "set_file", "delete": "clear_file"})

# Trailers
trailer_list = TrailerViewSet.as_view({"get": "list", "post": "create"})
trailer_detail = TrailerViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "update", "delete": "destroy"}
)
trailer_toggle_status = TrailerViewSet.as_view({"post": "toggle_status"})
trailer_maintenance = TrailerViewSet.as_view(
    {"get": "maintenance", "post": "maintenance"}
)
trailer_options = TrailerViewSet.as_view({"get": "options"})
trailer_file = TrailerViewSet.as_view({"post": "set_file", "delete": "clear_file"})

# Truck owners
owner_list = TruckOwnerViewSet.as_view({"get": "list", "post": "create"})
owner_detail = TruckOwnerViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}
)
owner_toggle_status = TruckOwnerViewSet.as_view({"post": "toggle_status"})

# Lookup types
truck_types = TruckTypeViewSet.as_view({"get": "list", "post": "create"})
trailer_types = TrailerTypeViewSet.as_view({"get": "list", "post": "create"})

# Catalog lookups
makes = MakeViewSet.as_view({"get": "list", "post": "create"})
make_detail = MakeViewSet.as_view({"patch": "partial_update"})
engine_types = EngineTypeViewSet.as_view({"get": "list", "post": "create"})
engine_type_detail = EngineTypeViewSet.as_view({"patch": "partial_update"})
cabin_types = CabinTypeViewSet.as_view({"get": "list", "post": "create"})
cabin_type_detail = CabinTypeViewSet.as_view({"patch": "partial_update"})
transmission_types = TransmissionTypeViewSet.as_view({"get": "list", "post": "create"})
transmission_type_detail = TransmissionTypeViewSet.as_view({"patch": "partial_update"})
tire_sizes = TireSizeViewSet.as_view({"get": "list", "post": "create"})
tire_size_detail = TireSizeViewSet.as_view({"patch": "partial_update"})
cards = CardViewSet.as_view({"get": "list", "post": "create"})
card_detail = CardViewSet.as_view({"patch": "partial_update"})
loss_payees = LossPayeeViewSet.as_view({"get": "list", "post": "create"})
loss_payee_detail = LossPayeeViewSet.as_view({"patch": "partial_update"})

# Accidents
accident_list = AccidentViewSet.as_view({"get": "list", "post": "create"})
accident_detail = AccidentViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
accident_pictures = AccidentViewSet.as_view({"post": "add_picture"})
accident_picture_detail = AccidentViewSet.as_view({"delete": "delete_picture"})

# Miles reset
miles_reset_list = TruckMilesResetViewSet.as_view({"get": "list", "post": "create"})
miles_reset_detail = TruckMilesResetViewSet.as_view({"delete": "destroy"})

# Standalone truck maintenance
truck_maint_list = TruckMaintenanceViewSet.as_view({"get": "list", "post": "create"})
truck_maint_detail = TruckMaintenanceViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
truck_maint_bulk_delete = TruckMaintenanceViewSet.as_view({"post": "bulk_delete"})
truck_maint_alert_info = TruckMaintenanceViewSet.as_view({"get": "alert_info"})

# Standalone trailer maintenance
trailer_maint_list = TrailerMaintenanceViewSet.as_view(
    {"get": "list", "post": "create"}
)
trailer_maint_detail = TrailerMaintenanceViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
trailer_maint_bulk_delete = TrailerMaintenanceViewSet.as_view({"post": "bulk_delete"})
trailer_maint_alert_info = TrailerMaintenanceViewSet.as_view({"get": "alert_info"})

urlpatterns = [
    path("trucks/", truck_list, name="truck-list"),
    path("trucks/options/", truck_options, name="truck-options"),
    path("trucks/<int:pk>/", truck_detail, name="truck-detail"),
    path(
        "trucks/<int:pk>/toggle-status/",
        truck_toggle_status,
        name="truck-toggle-status",
    ),
    path("trucks/<int:pk>/maintenance/", truck_maintenance, name="truck-maintenance"),
    path("trucks/<int:pk>/files/<str:slot>/", truck_file, name="truck-file"),
    path("trailers/", trailer_list, name="trailer-list"),
    path("trailers/options/", trailer_options, name="trailer-options"),
    path("trailers/<int:pk>/", trailer_detail, name="trailer-detail"),
    path(
        "trailers/<int:pk>/toggle-status/",
        trailer_toggle_status,
        name="trailer-toggle-status",
    ),
    path(
        "trailers/<int:pk>/maintenance/",
        trailer_maintenance,
        name="trailer-maintenance",
    ),
    path("trailers/<int:pk>/files/<str:slot>/", trailer_file, name="trailer-file"),
    path("owners/", owner_list, name="truck-owner-list"),
    path("owners/<int:pk>/", owner_detail, name="truck-owner-detail"),
    path(
        "owners/<int:pk>/toggle-status/",
        owner_toggle_status,
        name="truck-owner-toggle-status",
    ),
    path("truck-types/", truck_types, name="truck-type-list"),
    path("trailer-types/", trailer_types, name="trailer-type-list"),
    # Catalog lookups
    path("makes/", makes, name="make-list"),
    path("makes/<int:pk>/", make_detail, name="make-detail"),
    path("engine-types/", engine_types, name="engine-type-list"),
    path("engine-types/<int:pk>/", engine_type_detail, name="engine-type-detail"),
    path("cabin-types/", cabin_types, name="cabin-type-list"),
    path("cabin-types/<int:pk>/", cabin_type_detail, name="cabin-type-detail"),
    path("transmission-types/", transmission_types, name="transmission-type-list"),
    path(
        "transmission-types/<int:pk>/",
        transmission_type_detail,
        name="transmission-type-detail",
    ),
    path("tire-sizes/", tire_sizes, name="tire-size-list"),
    path("tire-sizes/<int:pk>/", tire_size_detail, name="tire-size-detail"),
    path("cards/", cards, name="card-list"),
    path("cards/<int:pk>/", card_detail, name="card-detail"),
    path("loss-payees/", loss_payees, name="loss-payee-list"),
    path("loss-payees/<int:pk>/", loss_payee_detail, name="loss-payee-detail"),
    # Accidents
    path("accidents/", accident_list, name="accident-list"),
    path("accidents/<int:pk>/", accident_detail, name="accident-detail"),
    path("accidents/<int:pk>/pictures/", accident_pictures, name="accident-pictures"),
    path(
        "accidents/<int:pk>/pictures/<int:picture_pk>/",
        accident_picture_detail,
        name="accident-picture-detail",
    ),
    # Miles reset
    path("miles-resets/", miles_reset_list, name="truck-miles-reset-list"),
    path("miles-resets/<int:pk>/", miles_reset_detail, name="truck-miles-reset-detail"),
    # Standalone truck maintenance
    path(
        "truck-maintenance/bulk-delete/",
        truck_maint_bulk_delete,
        name="truck-maint-bulk-delete",
    ),
    path("truck-maintenance/", truck_maint_list, name="truck-maint-list"),
    path("truck-maintenance/<int:pk>/", truck_maint_detail, name="truck-maint-detail"),
    path(
        "truck-maintenance/<int:pk>/alert-info/",
        truck_maint_alert_info,
        name="truck-maint-alert-info",
    ),
    # Standalone trailer maintenance
    path(
        "trailer-maintenance/bulk-delete/",
        trailer_maint_bulk_delete,
        name="trailer-maint-bulk-delete",
    ),
    path("trailer-maintenance/", trailer_maint_list, name="trailer-maint-list"),
    path(
        "trailer-maintenance/<int:pk>/",
        trailer_maint_detail,
        name="trailer-maint-detail",
    ),
    path(
        "trailer-maintenance/<int:pk>/alert-info/",
        trailer_maint_alert_info,
        name="trailer-maint-alert-info",
    ),
]
