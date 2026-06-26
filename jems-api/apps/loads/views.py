from datetime import datetime, time

from django.core.exceptions import ValidationError
from django.db.models import OuterRef, Q, Subquery
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from django.db.models import Exists
from apps.integrations.models import RtlDriver, RtlDriverStatus
from apps.locations.models import City

from .exceptions import InvalidStatusTransition, NotReadyToExecute
from .models import Load, LoadStop
from .serializers import (
    LoadBrokerContactsSerializer,
    LoadFileSerializer,
    LoadListSerializer,
    LoadSerializer,
    LoadStopSerializer,
)
from .services import (
    FILE_SLOTS,
    assign_load,
    bulk_delete_loads,
    bulk_invoiced,
    bulk_paid,
    cancel_load,
    clear_load_file,
    create_load,
    create_load_stop,
    delete_load,
    delete_load_stop,
    get_load_broker_contacts,
    send_driver_info,
    set_executed,
    set_history,
    set_invoiced,
    set_load_file,
    set_load_rating,
    set_load_status,
    set_paid,
    update_load,
    update_load_stop,
)


def _datetime_bound(value, *, end=False):
    parsed_datetime = parse_datetime(value)
    if parsed_datetime:
        if timezone.is_naive(parsed_datetime):
            return timezone.make_aware(parsed_datetime, timezone.get_current_timezone())
        return parsed_datetime

    parsed_date = parse_date(value)
    if parsed_date:
        bound_time = time.max if end else time.min
        return timezone.make_aware(
            datetime.combine(parsed_date, bound_time),
            timezone.get_current_timezone(),
        )

    return value


def _query_bool(value):
    return str(value).lower() in {"1", "true", "yes"}


class LoadPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500


class LoadViewSet(ViewSet):
    class IsAdminOrDispatcher(BasePermission):
        def has_permission(self, request, view):
            user = request.user
            return bool(
                user
                and user.is_authenticated
                and (user.is_superuser or user.is_staff or user.is_dispatcher)
            )

    permission_classes = [IsAdminOrDispatcher]

    def _base_queryset(self):
        _rtl_event_sq = Subquery(
            RtlDriverStatus.objects.filter(
                rtl_driver__license_number=OuterRef("driver__license_number")
            ).values("hos_event_code")[:1]
        )
        _rtl_id_sq = Subquery(
            RtlDriver.objects.filter(
                license_number=OuterRef("driver__license_number")
            ).values("id")[:1]
        )
        _rtl_violations_sq = Exists(
            RtlDriverStatus.objects.filter(
                rtl_driver__license_number=OuterRef("driver__license_number")
            ).exclude(violations="")
        )
        return (
            Load.objects.select_related(
                "broker",
                "dispatcher",
                "driver",
                "driver__fuel_card",
                "team_driver",
                "truck",
                "trailer",
                "trailer__trailer_type",
                "trailer_type",
                "pickup_city",
                "pickup_city__state",
                "dropoff_city",
                "dropoff_city__state",
                "shipper",
                "receiver",
                "carrier",
            )
            .annotate(
                _driver_rtl_event_code=_rtl_event_sq,
                _driver_rtl_id=_rtl_id_sq,
                _driver_rtl_has_violations=_rtl_violations_sq,
            )
            .prefetch_related("stops")
        )

    def list(self, request):
        qs = self._base_queryset()
        # Filters
        payroll = _query_bool(request.query_params.get("payroll", "false"))
        history_search = _query_bool(
            request.query_params.get("history_search", "false")
        )
        if payroll:
            qs = qs.filter(execute=True, history=False, drivers_paid=False)
        elif history_search:
            qs = qs.filter(execute=True)

            submitted_filter_keys = {
                "date_type",
                "date_from",
                "date_to",
                "broker",
                "dispatcher",
                "driver",
                "number",
                "truck",
                "trailer",
                "trailer_type",
                "pickup_city",
                "dropoff_city",
            }
            if not any(
                str(request.query_params.get(key, "")).strip()
                for key in submitted_filter_keys
            ):
                qs = qs.none()

        history = request.query_params.get("history")
        if history is not None and not payroll and not history_search:
            qs = qs.filter(history=_query_bool(history))
        s = request.query_params.get("status")
        if s:
            qs = qs.filter(status=s)
        number = request.query_params.get("number")
        if number:
            qs = qs.filter(number__icontains=number)
        broker = request.query_params.get("broker")
        if broker:
            if history_search and broker.isdigit():
                broker_filter = Q(broker_id=broker)
            else:
                broker_filter = (
                    Q(broker__name__icontains=broker)
                    | Q(broker__dba_name__icontains=broker)
                    | Q(broker__mc__icontains=broker)
                    | Q(carrier__name__icontains=broker)
                )
                if broker.isdigit():
                    broker_filter |= Q(broker_id=broker)
            qs = qs.filter(broker_filter)
        dispatcher = request.query_params.get("dispatcher")
        if dispatcher:
            if dispatcher.isdigit():
                qs = qs.filter(dispatcher_id=dispatcher)
            else:
                qs = qs.filter(
                    Q(dispatcher__first_name__icontains=dispatcher)
                    | Q(dispatcher__last_name__icontains=dispatcher)
                    | Q(dispatcher__username__icontains=dispatcher)
                )
        driver = request.query_params.get("driver")
        if driver:
            if history_search:
                driver_filter = (
                    Q(driver_id=driver) | Q(team_driver_id=driver)
                    if driver.isdigit()
                    else (
                        Q(driver__first_name__icontains=driver)
                        | Q(driver__last_name__icontains=driver)
                        | Q(team_driver__first_name__icontains=driver)
                        | Q(team_driver__last_name__icontains=driver)
                    )
                )
            else:
                driver_filter = (
                    Q(driver__first_name__icontains=driver)
                    | Q(driver__last_name__icontains=driver)
                    | Q(team_driver__first_name__icontains=driver)
                    | Q(team_driver__last_name__icontains=driver)
                    | Q(truck__number__icontains=driver)
                    | Q(trailer__number__icontains=driver)
                )
                if driver.isdigit():
                    driver_filter |= Q(driver_id=driver) | Q(team_driver_id=driver)
            qs = qs.filter(driver_filter)
        truck = request.query_params.get("truck")
        if truck:
            qs = (
                qs.filter(truck_id=truck)
                if truck.isdigit()
                else qs.filter(truck__number__icontains=truck)
            )
        trailer = request.query_params.get("trailer")
        if trailer:
            qs = (
                qs.filter(trailer_id=trailer)
                if trailer.isdigit()
                else qs.filter(trailer__number__icontains=trailer)
            )
        trailer_type = request.query_params.get("trailer_type")
        if trailer_type:
            qs = (
                qs.filter(
                    Q(trailer_type_id=trailer_type)
                    | Q(trailer__trailer_type_id=trailer_type)
                )
                if trailer_type.isdigit()
                else qs.filter(
                    Q(trailer_type__name__icontains=trailer_type)
                    | Q(trailer__trailer_type__name__icontains=trailer_type)
                )
            )
        pickup_city = request.query_params.get("pickup_city")
        if pickup_city:
            pickup_city_filter = (
                Q(pickup_city__name__icontains=pickup_city)
                | Q(pickup_city__zip__icontains=pickup_city)
                | Q(pickup_city__state__abbreviation__icontains=pickup_city)
            )
            if pickup_city.isdigit():
                pickup_city_filter |= Q(pickup_city_id=pickup_city)
            qs = qs.filter(pickup_city_filter)
        dropoff_city = request.query_params.get("dropoff_city")
        if dropoff_city:
            dropoff_city_filter = (
                Q(dropoff_city__name__icontains=dropoff_city)
                | Q(dropoff_city__zip__icontains=dropoff_city)
                | Q(dropoff_city__state__abbreviation__icontains=dropoff_city)
            )
            if dropoff_city.isdigit():
                dropoff_city_filter |= Q(dropoff_city_id=dropoff_city)
            qs = qs.filter(dropoff_city_filter)
        index_view = request.query_params.get("index_view")
        if index_view and str(index_view).lower() in {"1", "true", "yes"}:
            # Legacy main-index filter: show non-executed (excluding cancelled)
            # and executed loads only when in detention status.
            # Mirrors PHP: (execute=1 AND status=4) OR (execute=0 AND status<>5)
            qs = qs.filter(
                Q(execute=True, status=Load.Status.DETENTION_PENDING)
                | (Q(execute=False) & ~Q(status=Load.Status.CANCELLED))
            )
        else:
            execute = request.query_params.get("execute")
            if execute is not None and not payroll:
                qs = qs.filter(execute=_query_bool(execute))
        invoiced = request.query_params.get("invoiced")
        if invoiced is not None:
            qs = qs.filter(invoiced=_query_bool(invoiced))
        paid = request.query_params.get("paid")
        if paid is not None:
            qs = qs.filter(paid=_query_bool(paid))
        drivers_paid = request.query_params.get("drivers_paid")
        if drivers_paid is not None and not payroll:
            qs = qs.filter(drivers_paid=_query_bool(drivers_paid))
        date_type = request.query_params.get(
            "date_type", "all" if payroll else "pickup"
        )
        date_field = {
            "1": "pickup_date",
            "pickup": "pickup_date",
            "pickup_date": "pickup_date",
            "2": "dropoff_date",
            "dropoff": "dropoff_date",
            "dropoff_date": "dropoff_date",
            "created": "created_at",
            "created_at": "created_at",
            "3": None,
            "all": None,
            "ignore": None,
        }.get(date_type, "pickup_date")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_field and date_from:
            qs = qs.filter(**{f"{date_field}__gte": _datetime_bound(date_from)})
        if date_field and date_to:
            qs = qs.filter(**{f"{date_field}__lte": _datetime_bound(date_to, end=True)})
        qs = (
            qs.order_by("pickup_date", "id")
            if payroll
            else qs.order_by("-pickup_date", "-id")
        )
        if request.query_params.get("all", "").lower() in {"1", "true", "yes"}:
            serializer = LoadListSerializer(qs, many=True, context={"request": request})
            return Response(
                {
                    "count": qs.count(),
                    "next": None,
                    "previous": None,
                    "results": serializer.data,
                }
            )

        paginator = LoadPagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        serializer = LoadListSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

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

    @action(detail=True, methods=["get"], url_path="broker-contacts")
    def broker_contacts(self, request, pk=None):
        try:
            load = self._base_queryset().get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if load.broker is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        contacts = get_load_broker_contacts(load=load)
        serializer = LoadBrokerContactsSerializer(
            {"broker": load.broker, "contacts": contacts},
            context={"request": request},
        )
        return Response(serializer.data)

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
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(status=status.HTTP_403_FORBIDDEN)
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

        truck_id = request.data.get("truck") or None
        trailer_id = request.data.get("trailer") or None
        driver_id = request.data.get("driver") or None
        drop_place_raw = request.data.get("drop_place")
        drop_place = (
            int(drop_place_raw)
            if drop_place_raw is not None and str(drop_place_raw).strip() != ""
            else None
        )

        try:
            truck = Truck.objects.get(pk=truck_id) if truck_id else None
            trailer = Trailer.objects.get(pk=trailer_id) if trailer_id else None
            driver = Driver.objects.get(pk=driver_id) if driver_id else None
        except (Truck.DoesNotExist, Trailer.DoesNotExist, Driver.DoesNotExist) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        load = assign_load(
            load=load,
            truck=truck,
            trailer=trailer,
            driver=driver,
            is_drop=request.data.get("is_drop", 0),
            drop_place=drop_place,
            drop_trailer=request.data.get("drop_trailer", 0.0),
            days_in_drop=request.data.get("days_in_drop", 0),
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
            return Response(
                {"error": "status is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            if int(new_status) == Load.Status.CANCELLED:
                load = cancel_load(load=load, updated_by=request.user)
            else:
                load = set_load_status(
                    load=load, new_status=int(new_status), updated_by=request.user
                )
        except InvalidStatusTransition as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(LoadSerializer(load).data)

    @action(detail=True, methods=["post"], url_path="set-invoiced")
    def toggle_invoiced(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            load = set_invoiced(load=load)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
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

    @action(detail=True, methods=["post"], url_path="set-rating")
    def set_rating_action(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        shipper_rating = request.data.get("shipper_rating")
        receiver_rating = request.data.get("receiver_rating")
        if shipper_rating is None or receiver_rating is None:
            return Response(
                {"error": "shipper_rating and receiver_rating are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            load = set_load_rating(
                load=load,
                shipper_rating=int(shipper_rating),
                receiver_rating=int(receiver_rating),
                updated_by=request.user,
            )
        except (ValidationError, ValueError) as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(LoadSerializer(load).data)

    @action(detail=True, methods=["post"], url_path="set-executed")
    def set_executed_action(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            load = set_executed(load=load, updated_by=request.user)
        except NotReadyToExecute as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(LoadSerializer(load).data)

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(status=status.HTTP_403_FORBIDDEN)
        ids = request.data.get("ids", [])
        if not isinstance(ids, list):
            return Response(
                {"detail": "'ids' must be a list."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        deleted = bulk_delete_loads(ids=ids)
        return Response({"deleted": deleted})

    @action(detail=False, methods=["post"], url_path="bulk-invoiced")
    def bulk_invoiced_action(self, request):
        ids = request.data.get("ids", [])
        if not isinstance(ids, list):
            return Response(
                {"detail": "'ids' must be a list."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        updated = bulk_invoiced(ids=ids)
        return Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="bulk-paid")
    def bulk_paid_action(self, request):
        ids = request.data.get("ids", [])
        if not isinstance(ids, list):
            return Response(
                {"detail": "'ids' must be a list."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        updated = bulk_paid(ids=ids)
        return Response({"updated": updated})

    # --- Stops nested ---

    @action(detail=True, methods=["get", "post"], url_path="stops")
    def stops(self, request, pk=None):
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if request.method == "GET":
            stops = LoadStop.objects.filter(load=load).order_by(
                "from_date", "stop_type"
            )
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

    @action(detail=False, methods=["post"], url_path="send-driver-info")
    def send_driver_info_action(self, request):
        required = ["carrier_id", "driver_id", "truck_id", "trailer_id", "broker_email"]
        missing = [f for f in required if not request.data.get(f)]
        if missing:
            return Response(
                {"detail": f"Missing fields: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            send_driver_info(
                carrier_id=request.data["carrier_id"],
                driver_id=request.data["driver_id"],
                truck_id=request.data["truck_id"],
                trailer_id=request.data["trailer_id"],
                broker_email=request.data["broker_email"],
            )
        except Exception as exc:
            return Response(
                {"detail": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        return Response({"detail": "Driver information sent successfully."})

    def set_file(self, request, pk=None, slot=None):
        if slot not in FILE_SLOTS:
            return Response(
                {"detail": f"Unknown file slot: '{slot}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = LoadFileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        load = set_load_file(
            load=load, slot=slot, file=serializer.validated_data["file"]
        )
        return Response(LoadSerializer(load).data)

    def clear_file(self, request, pk=None, slot=None):
        if slot not in FILE_SLOTS:
            return Response(
                {"detail": f"Unknown file slot: '{slot}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            load = Load.objects.get(pk=pk)
        except Load.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        load = clear_load_file(load=load, slot=slot)
        return Response(LoadSerializer(load).data)


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
        from django.db.models import Q

        cities = City.objects.filter(
            Q(active=True) & (Q(name__icontains=q) | Q(zip__icontains=q))
        ).select_related("state")[:20]
        data = [
            {
                "id": c.pk,
                "name": c.name,
                "state": c.state.abbreviation if c.state else "",
                "zip": c.zip,
            }
            for c in cities
        ]
        return Response(data)
