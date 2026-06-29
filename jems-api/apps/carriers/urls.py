from django.urls import path

from .views import CarrierViewSet, FactorViewSet

carrier_list = CarrierViewSet.as_view({"get": "list", "post": "create"})
carrier_detail = CarrierViewSet.as_view(
    {"get": "retrieve", "put": "update", "delete": "destroy"}
)
carrier_toggle_status = CarrierViewSet.as_view({"post": "toggle_status"})
carrier_search = CarrierViewSet.as_view({"get": "search"})
carrier_options = CarrierViewSet.as_view({"get": "options_list"})
carrier_available_files = CarrierViewSet.as_view({"get": "available_files"})
carrier_send_packet = CarrierViewSet.as_view({"post": "send_packet"})

factor_list = FactorViewSet.as_view({"get": "list", "post": "create"})
factor_detail = FactorViewSet.as_view({"patch": "partial_update", "delete": "destroy"})

urlpatterns = [
    path("", carrier_list, name="carrier-list"),
    path("<int:pk>/", carrier_detail, name="carrier-detail"),
    path(
        "<int:pk>/toggle-status/", carrier_toggle_status, name="carrier-toggle-status"
    ),
    path("search/", carrier_search, name="carrier-search"),
    path("options/", carrier_options, name="carrier-options"),
    path(
        "<int:pk>/available-files/",
        carrier_available_files,
        name="carrier-available-files",
    ),
    path(
        "<int:pk>/send-packet/",
        carrier_send_packet,
        name="carrier-send-packet",
    ),
    path("factors/", factor_list, name="factor-list"),
    path("factors/<int:pk>/", factor_detail, name="factor-detail"),
]
