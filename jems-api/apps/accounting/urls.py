from django.urls import path

from .views import (
    AccountViewSet,
    CardGainViewSet,
    CategoryTypeViewSet,
    CategoryViewSet,
    DriverInvoiceViewSet,
    OwnerInvoiceViewSet,
    RecordViewSet,
)

# Accounts
account_list = AccountViewSet.as_view({"get": "list", "post": "create"})
account_detail = AccountViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "update"}
)

# Category types
category_type_list = CategoryTypeViewSet.as_view({"get": "list", "post": "create"})

# Categories
category_list = CategoryViewSet.as_view({"get": "list", "post": "create"})
category_detail = CategoryViewSet.as_view(
    {"get": "retrieve", "put": "update", "patch": "update"}
)

# Records
record_list = RecordViewSet.as_view({"get": "list", "post": "create"})
record_detail = RecordViewSet.as_view(
    {"get": "retrieve", "put": "update", "delete": "destroy"}
)

# Driver invoices
di_list = DriverInvoiceViewSet.as_view({"get": "list", "post": "create"})
di_detail = DriverInvoiceViewSet.as_view(
    {"get": "retrieve", "put": "update", "delete": "destroy"}
)
di_close = DriverInvoiceViewSet.as_view({"post": "close"})
di_open = DriverInvoiceViewSet.as_view({"post": "open"})

# Owner invoices
oi_list = OwnerInvoiceViewSet.as_view({"get": "list", "post": "create"})
oi_detail = OwnerInvoiceViewSet.as_view(
    {"get": "retrieve", "put": "update", "delete": "destroy"}
)
oi_close = OwnerInvoiceViewSet.as_view({"post": "close"})
oi_open = OwnerInvoiceViewSet.as_view({"post": "open"})

# Card gains
card_gain_list = CardGainViewSet.as_view({"get": "list", "post": "create"})
card_gain_detail = CardGainViewSet.as_view({"get": "retrieve", "delete": "destroy"})

urlpatterns = [
    path("accounts/", account_list, name="account-list"),
    path("accounts/<int:pk>/", account_detail, name="account-detail"),
    path("category-types/", category_type_list, name="category-type-list"),
    path("categories/", category_list, name="category-list"),
    path("categories/<int:pk>/", category_detail, name="category-detail"),
    path("records/", record_list, name="record-list"),
    path("records/<int:pk>/", record_detail, name="record-detail"),
    path("driver-invoices/", di_list, name="driver-invoice-list"),
    path("driver-invoices/<int:pk>/", di_detail, name="driver-invoice-detail"),
    path("driver-invoices/<int:pk>/close/", di_close, name="driver-invoice-close"),
    path("driver-invoices/<int:pk>/open/", di_open, name="driver-invoice-open"),
    path("owner-invoices/", oi_list, name="owner-invoice-list"),
    path("owner-invoices/<int:pk>/", oi_detail, name="owner-invoice-detail"),
    path("owner-invoices/<int:pk>/close/", oi_close, name="owner-invoice-close"),
    path("owner-invoices/<int:pk>/open/", oi_open, name="owner-invoice-open"),
    path("card-gains/", card_gain_list, name="card-gain-list"),
    path("card-gains/<int:pk>/", card_gain_detail, name="card-gain-detail"),
]
