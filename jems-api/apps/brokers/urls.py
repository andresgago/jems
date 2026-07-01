from django.urls import path

from .views import (
    BrokerContactGlobalViewSet,
    BrokerContactViewSet,
    BrokerViewSet,
    BusinessViewSet,
)

# Brokers
broker_list = BrokerViewSet.as_view({"get": "list", "post": "create"})
broker_detail = BrokerViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "update", "delete": "destroy"}
)
broker_toggle_status = BrokerViewSet.as_view({"post": "toggle_status"})
broker_search = BrokerViewSet.as_view({"get": "search"})
broker_status_search = BrokerViewSet.as_view({"get": "status_search"})
broker_status_search_create = BrokerViewSet.as_view({"post": "status_search_create"})
broker_options = BrokerViewSet.as_view({"get": "options_list"})
broker_file = BrokerViewSet.as_view({"post": "file", "delete": "file"})
# Broker Contacts (nested under broker)
contact_list = BrokerContactViewSet.as_view({"get": "list", "post": "create"})
contact_detail = BrokerContactViewSet.as_view(
    {"get": "retrieve", "patch": "update", "delete": "destroy"}
)
global_contact_list = BrokerContactGlobalViewSet.as_view(
    {"get": "list", "post": "create"}
)
global_contact_detail = BrokerContactGlobalViewSet.as_view(
    {"get": "retrieve", "patch": "update", "delete": "destroy"}
)

# Business
business_list = BusinessViewSet.as_view({"get": "list", "post": "create"})
business_detail = BusinessViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "update", "delete": "destroy"}
)
business_search = BusinessViewSet.as_view({"get": "search"})
business_toggle_status = BusinessViewSet.as_view({"post": "toggle_status"})

urlpatterns = [
    path("business/", business_list, name="business-list"),
    path("business/search/", business_search, name="business-search"),
    path(
        "business/<int:pk>/toggle-status/",
        business_toggle_status,
        name="business-toggle-status",
    ),
    path("business/<int:pk>/", business_detail, name="business-detail"),
    path("contacts/", global_contact_list, name="broker-contact-global-list"),
    path(
        "contacts/<int:pk>/",
        global_contact_detail,
        name="broker-contact-global-detail",
    ),
    path("", broker_list, name="broker-list"),
    path("search/", broker_search, name="broker-search"),
    path("status-search/", broker_status_search, name="broker-status-search"),
    path(
        "status-search/create/",
        broker_status_search_create,
        name="broker-status-search-create",
    ),
    path("options/", broker_options, name="broker-options"),
    path("<int:pk>/", broker_detail, name="broker-detail"),
    path("<int:pk>/toggle-status/", broker_toggle_status, name="broker-toggle-status"),
    path("<int:pk>/files/<str:slot>/", broker_file, name="broker-file"),
    path("<int:broker_pk>/contacts/", contact_list, name="broker-contact-list"),
    path(
        "<int:broker_pk>/contacts/<int:pk>/",
        contact_detail,
        name="broker-contact-detail",
    ),
]
