from django.urls import path

from .views import (
    BrokerSummaryReportView,
    CategoryTrackingReportView,
    FinancialReportView,
    IftaReportView,
    InvoiceReportView,
    ShipperReceiverReportView,
    TaxReportView,
)

urlpatterns = [
    path("financial/", FinancialReportView.as_view(), name="report-financial"),
    path("invoice/", InvoiceReportView.as_view(), name="report-invoice"),
    path("ifta/", IftaReportView.as_view(), name="report-ifta"),
    path("tax/", TaxReportView.as_view(), name="report-tax"),
    path(
        "category-tracking/",
        CategoryTrackingReportView.as_view(),
        name="report-category-tracking",
    ),
    path(
        "broker-summary/",
        BrokerSummaryReportView.as_view(),
        name="report-broker-summary",
    ),
    path(
        "shipper-receiver/",
        ShipperReceiverReportView.as_view(),
        name="report-shipper-receiver",
    ),
]
