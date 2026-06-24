from django.urls import path

from .views import CityViewSet, StateViewSet

state_list = StateViewSet.as_view({"get": "list"})

city_list = CityViewSet.as_view({"get": "list", "post": "create"})
city_detail = CityViewSet.as_view({"get": "retrieve", "patch": "partial_update"})
city_toggle_status = CityViewSet.as_view({"post": "toggle_status"})

urlpatterns = [
    path("states/", state_list, name="state-list"),
    path("cities/", city_list, name="city-list"),
    path("cities/<int:pk>/", city_detail, name="city-detail"),
    path(
        "cities/<int:pk>/toggle-status/", city_toggle_status, name="city-toggle-status"
    ),
]
