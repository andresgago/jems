from django.urls import path, re_path

from .views import CitySearchView, LoadStopViewSet, LoadViewSet

# Loads
load_list = LoadViewSet.as_view({"get": "list", "post": "create"})
load_detail = LoadViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "update", "delete": "destroy"}
)
load_assign = LoadViewSet.as_view({"post": "assign"})
load_set_status = LoadViewSet.as_view({"post": "set_status"})
load_set_invoiced = LoadViewSet.as_view({"post": "toggle_invoiced"})
load_set_paid = LoadViewSet.as_view({"post": "toggle_paid"})
load_set_history = LoadViewSet.as_view({"post": "toggle_history"})
load_set_executed = LoadViewSet.as_view({"post": "set_executed_action"})
load_set_rating = LoadViewSet.as_view({"post": "set_rating_action"})
load_set_file = LoadViewSet.as_view({"post": "set_file", "delete": "clear_file"})
load_bulk_delete = LoadViewSet.as_view({"post": "bulk_delete"})
load_bulk_invoiced = LoadViewSet.as_view({"post": "bulk_invoiced_action"})
load_bulk_paid = LoadViewSet.as_view({"post": "bulk_paid_action"})
load_stops = LoadViewSet.as_view({"get": "stops", "post": "stops"})
load_broker_contacts = LoadViewSet.as_view({"get": "broker_contacts"})

# Stops detail
stop_detail = LoadStopViewSet.as_view(
    {"get": "retrieve", "put": "update", "delete": "destroy"}
)

# City search
city_search = CitySearchView.as_view({"get": "search"})

urlpatterns = [
    path("", load_list, name="load-list"),
    path("bulk-delete/", load_bulk_delete, name="load-bulk-delete"),
    path("bulk-invoiced/", load_bulk_invoiced, name="load-bulk-invoiced"),
    path("bulk-paid/", load_bulk_paid, name="load-bulk-paid"),
    path("<int:pk>/", load_detail, name="load-detail"),
    path("<int:pk>/assign/", load_assign, name="load-assign"),
    path("<int:pk>/set-status/", load_set_status, name="load-set-status"),
    path("<int:pk>/set-invoiced/", load_set_invoiced, name="load-set-invoiced"),
    path("<int:pk>/set-paid/", load_set_paid, name="load-set-paid"),
    path("<int:pk>/set-history/", load_set_history, name="load-set-history"),
    path("<int:pk>/set-executed/", load_set_executed, name="load-set-executed"),
    path("<int:pk>/set-rating/", load_set_rating, name="load-set-rating"),
    path(
        "<int:pk>/broker-contacts/",
        load_broker_contacts,
        name="load-broker-contacts",
    ),
    re_path(
        r"^(?P<pk>\d+)/files/(?P<slot>[^/.]+)/$", load_set_file, name="load-set-file"
    ),
    path("<int:pk>/stops/", load_stops, name="load-stops"),
    path("<int:load_pk>/stops/<int:pk>/", stop_detail, name="load-stop-detail"),
    path("cities/search/", city_search, name="city-search"),
    path(
        "send-driver-info/",
        LoadViewSet.as_view({"post": "send_driver_info_action"}),
        name="load-send-driver-info",
    ),
]
