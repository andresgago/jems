from django.urls import path

from .views import CitySearchView, LoadStopViewSet, LoadViewSet

# Loads
load_list = LoadViewSet.as_view({"get": "list", "post": "create"})
load_detail = LoadViewSet.as_view({"get": "retrieve", "put": "update", "patch": "update", "delete": "destroy"})
load_assign = LoadViewSet.as_view({"post": "assign"})
load_set_status = LoadViewSet.as_view({"post": "set_status"})
load_set_invoiced = LoadViewSet.as_view({"post": "toggle_invoiced"})
load_set_paid = LoadViewSet.as_view({"post": "toggle_paid"})
load_set_history = LoadViewSet.as_view({"post": "toggle_history"})
load_stops = LoadViewSet.as_view({"get": "stops", "post": "stops"})

# Stops detail
stop_detail = LoadStopViewSet.as_view({"get": "retrieve", "put": "update", "delete": "destroy"})

# City search
city_search = CitySearchView.as_view({"get": "search"})

urlpatterns = [
    path("", load_list, name="load-list"),
    path("<int:pk>/", load_detail, name="load-detail"),
    path("<int:pk>/assign/", load_assign, name="load-assign"),
    path("<int:pk>/set-status/", load_set_status, name="load-set-status"),
    path("<int:pk>/set-invoiced/", load_set_invoiced, name="load-set-invoiced"),
    path("<int:pk>/set-paid/", load_set_paid, name="load-set-paid"),
    path("<int:pk>/set-history/", load_set_history, name="load-set-history"),
    path("<int:pk>/stops/", load_stops, name="load-stops"),
    path("<int:load_pk>/stops/<int:pk>/", stop_detail, name="load-stop-detail"),
    path("cities/search/", city_search, name="city-search"),
]
