from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from . import services
from .models import ReportIFTA, RtlDriver, RtlIfta, RtlTruck
from .rtl_client import RtlApiError
from .serializers import (
    ReportIFTASerializer,
    RtlDriverSerializer,
    RtlIftaSerializer,
    RtlTruckSerializer,
)


class RtlDriverViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = RtlDriver.objects.select_related("latest_status").all()
        active = request.query_params.get("active")
        if active is not None:
            qs = qs.filter(active=active.lower() == "true")
        return Response(RtlDriverSerializer(qs, many=True).data)

    def retrieve(self, request: Request, pk: int) -> Response:
        driver = get_object_or_404(
            RtlDriver.objects.select_related("latest_status"), pk=pk
        )
        return Response(RtlDriverSerializer(driver).data)


class RtlTruckViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = RtlTruck.objects.select_related("latest_status").all()
        active = request.query_params.get("active")
        if active is not None:
            qs = qs.filter(active=active.lower() == "true")
        return Response(RtlTruckSerializer(qs, many=True).data)

    def retrieve(self, request: Request, pk: int) -> Response:
        truck = get_object_or_404(
            RtlTruck.objects.select_related("latest_status"), pk=pk
        )
        return Response(RtlTruckSerializer(truck).data)


class RtlIftaViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = RtlIfta.objects.all()
        vehicle_vin = request.query_params.get("vin")
        if vehicle_vin:
            qs = qs.filter(vehicle_vin=vehicle_vin)
        return Response(RtlIftaSerializer(qs, many=True).data)

    def retrieve(self, request: Request, pk: int) -> Response:
        ifta = get_object_or_404(RtlIfta, pk=pk)
        return Response(RtlIftaSerializer(ifta).data)


class ReportIFTAViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = ReportIFTA.objects.all()
        return Response(ReportIFTASerializer(qs, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = ReportIFTASerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def destroy(self, request: Request, pk: int) -> Response:
        report = get_object_or_404(ReportIFTA, pk=pk)
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RtlFetchSyncView(APIView):
    """
    Actively fetch fresh data from the ApexHOS/RTL ELD API for all active
    carriers and upsert it into the local database.

    Equivalent to the legacy RtlDriver::updateLocation() action triggered by
    the "Update location" button on the loads grid.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        try:
            synced = services.fetch_and_sync_all_carriers()
        except RtlApiError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"synced": synced})


class RtlSyncView(APIView):
    """
    Trigger a manual sync of all RTL ELD data.

    Accepts a JSON payload with driver/truck/status lists — used by the
    Celery task or by tests.  In production the Celery task calls the RTL
    API client and posts results here.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        drivers = request.data.get("drivers", [])
        trucks = request.data.get("trucks", [])
        driver_statuses = request.data.get("driver_statuses", [])
        truck_statuses = request.data.get("truck_statuses", [])
        ifta_reports = request.data.get("ifta_reports", [])

        synced = {
            "drivers": 0,
            "trucks": 0,
            "driver_statuses": 0,
            "truck_statuses": 0,
            "ifta_reports": 0,
        }

        for d in drivers:
            services.upsert_rtl_driver(data=d)
            synced["drivers"] += 1

        for t in trucks:
            services.upsert_rtl_truck(data=t)
            synced["trucks"] += 1

        for ds in driver_statuses:
            services.upsert_rtl_driver_status(data=ds)
            synced["driver_statuses"] += 1

        for ts in truck_statuses:
            services.upsert_rtl_truck_status(data=ts)
            synced["truck_statuses"] += 1

        for ifta in ifta_reports:
            services.upsert_rtl_ifta(data=ifta)
            synced["ifta_reports"] += 1

        return Response({"synced": synced})
