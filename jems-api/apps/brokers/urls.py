from django.urls import path

from .views import BrokerContactViewSet, BrokerViewSet

# Brokers
broker_list = BrokerViewSet.as_view({"get": "list", "post": "create"})
broker_detail = BrokerViewSet.as_view(
    {"get": "retrieve", "put": "update", "delete": "destroy"}
)
broker_toggle_status = BrokerViewSet.as_view({"post": "toggle_status"})
broker_search = BrokerViewSet.as_view({"get": "search"})
broker_options = BrokerViewSet.as_view({"get": "options_list"})
# Broker Contacts (nested under broker)
contact_list = BrokerContactViewSet.as_view({"get": "list", "post": "create"})
contact_detail = BrokerContactViewSet.as_view(
    {"get": "retrieve", "put": "update", "delete": "destroy"}
)

urlpatterns = [
    path("", broker_list, name="broker-list"),
    path("search/", broker_search, name="broker-search"),
    path("options/", broker_options, name="broker-options"),
    path("<int:pk>/", broker_detail, name="broker-detail"),
    path("<int:pk>/toggle-status/", broker_toggle_status, name="broker-toggle-status"),
    path("<int:broker_pk>/contacts/", contact_list, name="broker-contact-list"),
    path(
        "<int:broker_pk>/contacts/<int:pk>/",
        contact_detail,
        name="broker-contact-detail",
    ),
]
