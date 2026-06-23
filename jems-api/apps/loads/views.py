from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from apps.locations.models import City

from .exceptions import InvalidStatusTransition
from .models import Load, LoadStop
from .serializers import LoadListSerializer, LoadSerializer, LoadStopSerializer
from .services import (
    assign_load,
    create_load,
    create_load_stop,
    delete_load,
    delete_load_stop,
    set_history,
    set_invoiced,
    set_load_status,
    set_paid,
    update_load,
    update_load_stop,
)


class LoadViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def _base_queryset(self):
        return Load.objects.select_related(
            "broker", "dispatcher", "driver", "team_driver",
            "truck", "trailer", "trailer_type",
            "pickup_city", "dropoff_city",
            "shipper", "receiver", "carrier",
        ).prefetch_related("stops")

    def list(self, request):
        qs = self._base_queryset()
        # Filters
        s = request.query_params.get("status")
        if s:
            qs = qs.filter(status=s)
        broker = request.query_params.get("broker")
        if broker:
            qs = qs.filter(broker_id=broker)
        dispatcher = request.query_params.get("dispatcher")
        if dispatcher:
            qs = qs.filter(dispatcher_id=dispatcher)
        driver = request.query_params.get("driver")
        if driver:
            qs = qs.filter(driver_id=driver)
        invoiced = request.query_params.get("invoiced")
        if invoiced is not None:
            qs = qs.filter(invoiced=invoiced.lower() == "true")
        paid = request.query_params.get("paid")
        if paid is not None:
            qs = qs.filter(paid=paid.lower() == "true")
        date_from = request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(pickup_date__gte=date_from)
        date_to = request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(pickup_date__lte=date_to)
        serializer = LoadListSerializer(qs, many=True)
        return Response(serializer.data)

    def create(self, request):
        serializer = LoadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        load = create_load(
            created_by=request.user,
            **serializer.validated_data,
        )
        return Response(LoadSerializer(load).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        try:
            load = self._base_queryset().get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(LoadSerializer(load).data)

    def update(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = LoadSerializer(load, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        load = update_load(
            load=load,
            updated_by=request.user,
            **serializer.validated_data,
        )
        return Response(LoadSerializer(load).data)

    def destroy(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        delete_load(load=load)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        from apps.fleet.models import Truck, Trailer
        from apps.drivers.models import Driver

        truck_id = request.data.get("truck")
        trailer_id = request.data.get("trailer")
        driver_id = request.data.get("driver")

        truck = Truck.objects.get(pk=truck_id) if truck_id else None
        trailer = Trailer.objects.get(pk=trailer_id) if trailer_id else None
        driver = Driver.objects.get(pk=driver_id) if driver_id else None

        load = assign_load(
            load=load,
            truck=truck,
            trailer=trailer,
            driver=driver,
            updated_by=request.user,
        )
        return Response(LoadSerializer(load).data)

    @action(detail=True, methods=["post"], url_path="set-status")
    def set_status(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        new_status = request.data.get("status")
        if new_status is None:
            return Response({"error": "status is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            load = set_load_status(load=load, new_status=int(new_status), updated_by=request.user)
        except InvalidStatusTransition as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(LoadSerializer(load).data)

    @action(detail=True, methods=["post"], url_path="set-invoiced")
    def toggle_invoiced(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        load = set_invoiced(load=load)
        return Response(LoadSerializer(load).data)

    @action(detail=True, methods=["post"], url_path="set-paid")
    def toggle_paid(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        load = set_paid(load=load)
        return Response(LoadSerializer(load).data)

    @action(detail=True, methods=["post"], url_path="set-history")
    def toggle_history(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        load = set_history(load=load)
        return Response(LoadSerializer(load).data)

    # --- Stops nested ---

    @action(detail=True, methods=["get", "post"], url_path="stops")
    def stops(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if request.method == "GET":
            stops = LoadStop.objects.filter(load=load).order_by("from_date", "stop_type")
            return Response(LoadStopSerializer(stops, many=True).data)

        # POST — create stop
        serializer = LoadStopSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        data.pop("load", None)
        stop = create_load_stop(
            load=load,
            created_by=request.user,
            **data,
        )
        return Response(LoadStopSerializer(stop).data, status=status.HTTP_201_CREATED)


class LoadStopViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_stop(self, load_pk, pk):
        try:
            return LoadStop.objects.get(pk=pk, load_id=load_pk)
        except LoadStop.DoesNotExist:
            return None

    def retrieve(self, request, load_pk=None, pk=None):
        stop = self._get_stop(load_pk, pk)
        if stop is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(LoadStopSerializer(stop).data)

    def update(self, request, load_pk=None, pk=None):
        stop = self._get_stop(load_pk, pk)
        if stop is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = LoadStopSerializer(stop, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        data.pop("load", None)
        stop = update_load_stop(stop=stop, updated_by=request.user, **data)
        return Response(LoadStopSerializer(stop).data)

    def destroy(self, request, load_pk=None, pk=None):
        stop = self._get_stop(load_pk, pk)
        if stop is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        delete_load_stop(stop=stop)
        return Response(status=status.HTTP_204_NO_CONTENT)


class CitySearchView(ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response([])
        cities = City.objects.filter(active=True, name__icontains=q).select_related("state")[:20]
        data = [
            {"id": c.pk, "name": c.name, "state": c.state.abbreviation if c.state else "", "zip": c.zip}
            for c in cities
        ]
        return Response(data)
