from django.urls import path

from .views import (
    BalanceSheetReportView,
    BrokerSummaryReportView,
    CategoryTrackingReportView,
    FinancialReportView,
    IftaReportView,
    InvoiceReportView,
    ShipperReceiverReportView,
    TaxReportView,
    TruckPartsReportView,
)

urlpatterns = [
    path("financial/", FinancialReportView.as_view(), name="report-financial"),
    path("invoice/", InvoiceReportView.as_view(), name="report-invoice"),
    path(
        "balance-sheet/",
        BalanceSheetReportView.as_view(),
        name="report-balance-sheet",
    ),
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
    path(
        "truck-parts/",
        TruckPartsReportView.as_view(),
        name="report-truck-parts",
    ),
]
