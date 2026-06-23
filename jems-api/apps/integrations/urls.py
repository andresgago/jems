from django.urls import path

from .views import (
    ReportIFTAViewSet,
    RtlDriverViewSet,
    RtlIftaViewSet,
    RtlSyncView,
    RtlTruckViewSet,
)

rtl_driver_list = RtlDriverViewSet.as_view({"get": "list"})
rtl_driver_detail = RtlDriverViewSet.as_view({"get": "retrieve"})

rtl_truck_list = RtlTruckViewSet.as_view({"get": "list"})
rtl_truck_detail = RtlTruckViewSet.as_view({"get": "retrieve"})

rtl_ifta_list = RtlIftaViewSet.as_view({"get": "list"})
rtl_ifta_detail = RtlIftaViewSet.as_view({"get": "retrieve"})

report_ifta_list = ReportIFTAViewSet.as_view({"get": "list", "post": "create"})
report_ifta_detail = ReportIFTAViewSet.as_view({"delete": "destroy"})

urlpatterns = [
    path("rtl/sync/", RtlSyncView.as_view(), name="rtl-sync"),
    path("rtl/drivers/", rtl_driver_list, name="rtl-driver-list"),
    path("rtl/drivers/<int:pk>/", rtl_driver_detail, name="rtl-driver-detail"),
    path("rtl/trucks/", rtl_truck_list, name="rtl-truck-list"),
    path("rtl/trucks/<int:pk>/", rtl_truck_detail, name="rtl-truck-detail"),
    path("rtl/ifta/", rtl_ifta_list, name="rtl-ifta-list"),
    path("rtl/ifta/<int:pk>/", rtl_ifta_detail, name="rtl-ifta-detail"),
    path("ifta-reports/", report_ifta_list, name="ifta-report-list"),
    path("ifta-reports/<int:pk>/", report_ifta_detail, name="ifta-report-detail"),
]
