from django.urls import path

from .views import (
    DispatcherWorkDetailView,
    DispatcherWorkFinishView,
    DispatcherWorkListView,
    DispatcherWorkMarkPaidView,
    InvoiceByHourAmountView,
    InvoiceByHourCloseView,
    InvoiceByHourDetailView,
    InvoiceByHourListView,
    InvoiceByHourOpenView,
    InvoiceByPercentAmountView,
    InvoiceByPercentCloseView,
    InvoiceByPercentDetailView,
    InvoiceByPercentListView,
    InvoiceByPercentOpenView,
)

urlpatterns = [
    # Dispatcher Work
    path("work/", DispatcherWorkListView.as_view(), name="dispatcher-work-list"),
    path(
        "work/<int:pk>/",
        DispatcherWorkDetailView.as_view(),
        name="dispatcher-work-detail",
    ),
    path(
        "work/<int:pk>/finish/",
        DispatcherWorkFinishView.as_view(),
        name="dispatcher-work-finish",
    ),
    path(
        "work/<int:pk>/mark-paid/",
        DispatcherWorkMarkPaidView.as_view(),
        name="dispatcher-work-mark-paid",
    ),
    # Invoices By Percent
    path(
        "invoices/percent/",
        InvoiceByPercentListView.as_view(),
        name="dispatch-invoice-percent-list",
    ),
    path(
        "invoices/percent/<int:pk>/",
        InvoiceByPercentDetailView.as_view(),
        name="dispatch-invoice-percent-detail",
    ),
    path(
        "invoices/percent/<int:pk>/close/",
        InvoiceByPercentCloseView.as_view(),
        name="dispatch-invoice-percent-close",
    ),
    path(
        "invoices/percent/<int:pk>/open/",
        InvoiceByPercentOpenView.as_view(),
        name="dispatch-invoice-percent-open",
    ),
    path(
        "invoices/percent/<int:pk>/amount/",
        InvoiceByPercentAmountView.as_view(),
        name="dispatch-invoice-percent-amount",
    ),
    # Invoices By Hour
    path(
        "invoices/hour/",
        InvoiceByHourListView.as_view(),
        name="dispatch-invoice-hour-list",
    ),
    path(
        "invoices/hour/<int:pk>/",
        InvoiceByHourDetailView.as_view(),
        name="dispatch-invoice-hour-detail",
    ),
    path(
        "invoices/hour/<int:pk>/close/",
        InvoiceByHourCloseView.as_view(),
        name="dispatch-invoice-hour-close",
    ),
    path(
        "invoices/hour/<int:pk>/open/",
        InvoiceByHourOpenView.as_view(),
        name="dispatch-invoice-hour-open",
    ),
    path(
        "invoices/hour/<int:pk>/amount/",
        InvoiceByHourAmountView.as_view(),
        name="dispatch-invoice-hour-amount",
    ),
]
