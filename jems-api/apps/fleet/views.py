from typing import Any, ClassVar

from django.db.models import Max
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from . import services
from .models import (
    Accident,
    AccidentPicture,
    Card,
    CabinType,
    EngineType,
    LossPayee,
    Make,
    Trailer,
    TrailerMaintenance,
    TransmissionType,
    Truck,
    TruckMaintenance,
    TruckMilesReset,
    TruckOwner,
    TruckType,
    TrailerType,
    TireSize,
)
from .serializers import (
    AccidentCreateUpdateSerializer,
    AccidentPictureSerializer,
    AccidentSerializer,
    CardSerializer,
    CabinTypeSerializer,
    EngineTypeSerializer,
    LossPayeeSerializer,
    MakeSerializer,
    TireSizeSerializer,
    TransmissionTypeSerializer,
    TruckMilesResetSerializer,
    TrailerCreateUpdateSerializer,
    TrailerFileUploadSerializer,
    TrailerListSerializer,
    TrailerMaintenanceCreateUpdateSerializer,
    TrailerMaintenanceSerializer,
    TrailerSerializer,
    TrailerTypeSerializer,
    TruckCreateUpdateSerializer,
    TruckFileUploadSerializer,
    TruckListSerializer,
    TruckMaintenanceCreateUpdateSerializer,
    TruckMaintenanceSerializer,
    TruckOwnerCreateUpdateSerializer,
    TruckOwnerSerializer,
    TruckPhotoUploadSerializer,
    TruckSerializer,
    TruckTypeSerializer,
)


class TruckTypeViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        types = TruckType.objects.filter(is_active=True).order_by("name")
        return Response(TruckTypeSerializer(types, many=True).data)

    def create(self, request: Request) -> Response:
        name = request.data.get("name", "").strip()
        truck_type = TruckType.objects.create(name=name)
        return Response(
            TruckTypeSerializer(truck_type).data, status=status.HTTP_201_CREATED
        )


class TrailerTypeViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        types = TrailerType.objects.filter(is_active=True).order_by("name")
        return Response(TrailerTypeSerializer(types, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = TrailerTypeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trailer_type = serializer.save()
        return Response(
            TrailerTypeSerializer(trailer_type).data, status=status.HTTP_201_CREATED
        )


class TruckOwnerViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        owners = TruckOwner.objects.filter(status=TruckOwner.Status.ACTIVE).order_by(
            "first_name"
        )
        return Response(TruckOwnerSerializer(owners, many=True).data)

    def retrieve(self, request: Request, pk: int) -> Response:
        try:
            owner = TruckOwner.objects.get(pk=pk)
        except TruckOwner.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(TruckOwnerSerializer(owner).data)

    def create(self, request: Request) -> Response:
        serializer = TruckOwnerCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        owner = services.create_truck_owner(**serializer.validated_data)
        return Response(
            TruckOwnerSerializer(owner).data, status=status.HTTP_201_CREATED
        )

    def update(self, request: Request, pk: int) -> Response:
        owner = TruckOwner.objects.get(pk=pk)
        serializer = TruckOwnerCreateUpdateSerializer(
            owner, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        owner = services.update_truck_owner(owner=owner, **serializer.validated_data)
        return Response(TruckOwnerSerializer(owner).data)

    def partial_update(self, request: Request, pk: int) -> Response:
        owner = TruckOwner.objects.get(pk=pk)
        serializer = TruckOwnerCreateUpdateSerializer(
            owner, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        owner = services.update_truck_owner(owner=owner, **serializer.validated_data)
        return Response(TruckOwnerSerializer(owner).data)

    def destroy(self, request: Request, pk: int) -> Response:
        owner = TruckOwner.objects.get(pk=pk)
        owner.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request: Request, pk: int) -> Response:
        owner = TruckOwner.objects.get(pk=pk)
        owner = services.toggle_truck_owner_status(owner=owner)
        return Response(TruckOwnerSerializer(owner).data)


class TruckViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        trucks = (
            Truck.objects.filter(status=Truck.Status.ACTIVE)
            .select_related("truck_type", "carrier", "owner")
            .order_by("number")
        )
        return Response(TruckListSerializer(trucks, many=True).data)

    def retrieve(self, request: Request, pk: int) -> Response:
        truck = (
            Truck.objects.select_related(
                "truck_type",
                "make",
                "engine_type",
                "cabin_type",
                "transmission_type",
                "tire_size",
                "dispatcher",
                "owner",
                "fuel_card",
                "carrier",
                "loss_payee",
            )
            .prefetch_related("maintenance_records")
            .get(pk=pk)
        )
        return Response(TruckSerializer(truck).data)

    def create(self, request: Request) -> Response:
        serializer = TruckCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        truck = services.create_truck(
            created_by=request.user, **serializer.validated_data
        )
        return Response(TruckSerializer(truck).data, status=status.HTTP_201_CREATED)

    def update(self, request: Request, pk: int) -> Response:
        truck = Truck.objects.get(pk=pk)
        serializer = TruckCreateUpdateSerializer(truck, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        truck = services.update_truck(truck=truck, **serializer.validated_data)
        return Response(TruckSerializer(truck).data)

    def partial_update(self, request: Request, pk: int) -> Response:
        truck = Truck.objects.get(pk=pk)
        serializer = TruckCreateUpdateSerializer(truck, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        truck = services.update_truck(truck=truck, **serializer.validated_data)
        return Response(TruckSerializer(truck).data)

    def destroy(self, request: Request, pk: int) -> Response:
        truck = Truck.objects.get(pk=pk)
        truck.status = Truck.Status.INACTIVE
        truck.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="options")
    def options(self, request: Request) -> Response:
        trucks = Truck.objects.filter(status=Truck.Status.ACTIVE).order_by("number")
        data = [{"id": t.pk, "number": t.number, "vin": t.vin} for t in trucks]
        return Response(data)

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request: Request, pk: int) -> Response:
        truck = Truck.objects.get(pk=pk)
        truck = services.toggle_truck_status(truck=truck)
        return Response(TruckListSerializer(truck).data)

    @action(detail=True, methods=["get", "post"], url_path="maintenance")
    def maintenance(self, request: Request, pk: int) -> Response:
        truck = Truck.objects.get(pk=pk)
        if request.method == "GET":
            records = TruckMaintenance.objects.filter(truck=truck)
            return Response(TruckMaintenanceSerializer(records, many=True).data)
        serializer = TruckMaintenanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = services.add_truck_maintenance(
            truck=truck, **serializer.validated_data
        )
        return Response(
            TruckMaintenanceSerializer(record).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["post"], url_path=r"files/(?P<slot>[^/.]+)")
    def set_file(self, request: Request, pk: int, slot: str) -> Response:
        if slot not in services.TRUCK_FILE_SLOTS:
            return Response(
                {"error": f"Unknown file slot '{slot}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        truck = Truck.objects.get(pk=pk)
        serializer_class = (
            TruckPhotoUploadSerializer if slot == "photo" else TruckFileUploadSerializer
        )
        serializer = serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        truck = services.set_truck_file(
            truck=truck, slot=slot, file=serializer.validated_data["file"]
        )
        return Response(TruckSerializer(truck).data)

    @action(detail=True, methods=["delete"], url_path=r"files/(?P<slot>[^/.]+)")
    def clear_file(self, request: Request, pk: int, slot: str) -> Response:
        if slot not in services.TRUCK_FILE_SLOTS:
            return Response(
                {"error": f"Unknown file slot '{slot}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        truck = Truck.objects.get(pk=pk)
        truck = services.clear_truck_file(truck=truck, slot=slot)
        return Response(TruckSerializer(truck).data)


class TrailerViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_trailer_detail(self, pk: int) -> Trailer:
        return (
            Trailer.objects.select_related(
                "trailer_type", "plate_state", "owner", "carrier"
            )
            .prefetch_related("maintenance_records")
            .get(pk=pk)
        )

    def list(self, request: Request) -> Response:
        trailers = (
            Trailer.objects.filter(status=Trailer.Status.ACTIVE)
            .select_related("trailer_type", "plate_state")
            .order_by("number")
        )
        return Response(TrailerListSerializer(trailers, many=True).data)

    def retrieve(self, request: Request, pk: int) -> Response:
        return Response(TrailerSerializer(self._get_trailer_detail(pk)).data)

    def create(self, request: Request) -> Response:
        serializer = TrailerCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trailer = services.create_trailer(
            created_by=request.user, **serializer.validated_data
        )
        return Response(TrailerSerializer(trailer).data, status=status.HTTP_201_CREATED)

    def update(self, request: Request, pk: int) -> Response:
        trailer = Trailer.objects.get(pk=pk)
        serializer = TrailerCreateUpdateSerializer(
            trailer, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        trailer = services.update_trailer(trailer=trailer, **serializer.validated_data)
        return Response(TrailerSerializer(trailer).data)

    def destroy(self, request: Request, pk: int) -> Response:
        trailer = Trailer.objects.get(pk=pk)
        trailer.status = Trailer.Status.INACTIVE
        trailer.save(update_fields=["status", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="options")
    def options(self, request: Request) -> Response:
        trailers = (
            Trailer.objects.filter(status=Trailer.Status.ACTIVE, is_rented=False)
            .select_related("trailer_type")
            .order_by("number")
        )
        data = [
            {
                "id": t.id,
                "number": t.number,
                "vin": t.vin,
                "trailer_type_name": t.trailer_type.name if t.trailer_type else "",
            }
            for t in trailers
        ]
        return Response(data)

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request: Request, pk: int) -> Response:
        trailer = Trailer.objects.get(pk=pk)
        trailer = services.toggle_trailer_status(trailer=trailer)
        return Response(TrailerListSerializer(trailer).data)

    @action(detail=True, methods=["get", "post"], url_path="maintenance")
    def maintenance(self, request: Request, pk: int) -> Response:
        trailer = Trailer.objects.get(pk=pk)
        if request.method == "GET":
            records = TrailerMaintenance.objects.filter(trailer=trailer)
            return Response(TrailerMaintenanceSerializer(records, many=True).data)
        payload = request.data.copy()
        payload["trailer"] = trailer.pk
        serializer = TrailerMaintenanceCreateUpdateSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        fields = dict(serializer.validated_data)
        fields.pop("trailer", None)
        record = services.add_trailer_maintenance(trailer=trailer, **fields)
        return Response(
            TrailerMaintenanceSerializer(record).data, status=status.HTTP_201_CREATED
        )

    @action(
        detail=True,
        methods=["post"],
        url_path=r"files/(?P<slot>[^/.]+)",
        url_name="file-set",
    )
    def set_file(self, request: Request, pk: int, slot: str) -> Response:
        trailer = Trailer.objects.get(pk=pk)
        if slot not in services.TRAILER_FILE_SLOTS:
            return Response(
                {"detail": f"Unknown slot '{slot}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = TrailerFileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trailer = services.set_trailer_file(
            trailer=trailer, slot=slot, file=serializer.validated_data["file"]
        )
        return Response(TrailerSerializer(trailer).data)

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"files/(?P<slot>[^/.]+)",
        url_name="file-clear",
    )
    def clear_file(self, request: Request, pk: int, slot: str) -> Response:
        trailer = Trailer.objects.get(pk=pk)
        if slot not in services.TRAILER_FILE_SLOTS:
            return Response(
                {"detail": f"Unknown slot '{slot}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        services.clear_trailer_file(trailer=trailer, slot=slot)
        return Response(TrailerSerializer(trailer).data)


class AccidentViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = Accident.objects.select_related("driver", "truck", "trailer").all()
        driver_id = request.query_params.get("driver")
        if driver_id:
            qs = qs.filter(driver_id=driver_id)
        truck_id = request.query_params.get("truck")
        if truck_id:
            qs = qs.filter(truck_id=truck_id)
        return Response(AccidentSerializer(qs, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = AccidentCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        accident = services.create_accident(
            created_by=request.user, **serializer.validated_data
        )
        return Response(
            AccidentSerializer(accident).data, status=status.HTTP_201_CREATED
        )

    def retrieve(self, request: Request, pk: int) -> Response:
        try:
            accident = Accident.objects.prefetch_related("pictures").get(pk=pk)
        except Accident.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(AccidentSerializer(accident).data)

    def partial_update(self, request: Request, pk: int) -> Response:
        try:
            accident = Accident.objects.get(pk=pk)
        except Accident.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = AccidentCreateUpdateSerializer(
            accident, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        accident = services.update_accident(
            accident=accident, **serializer.validated_data
        )
        return Response(AccidentSerializer(accident).data)

    def destroy(self, request: Request, pk: int) -> Response:
        try:
            accident = Accident.objects.get(pk=pk)
        except Accident.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        services.delete_accident(accident=accident)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="pictures")
    def add_picture(self, request: Request, pk: int) -> Response:
        try:
            accident = Accident.objects.get(pk=pk)
        except Accident.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = AccidentPictureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        picture = services.add_accident_picture(
            accident=accident, **serializer.validated_data
        )
        return Response(
            AccidentPictureSerializer(picture).data, status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=["delete"], url_path=r"pictures/(?P<picture_pk>\d+)")
    def delete_picture(self, request: Request, pk: int, picture_pk: int) -> Response:
        try:
            picture = AccidentPicture.objects.get(pk=picture_pk, accident_id=pk)
        except AccidentPicture.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        services.delete_accident_picture(picture=picture)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Standalone Maintenance ViewSets ──────────────────────────────────────────


class TruckMaintenanceViewSet(ViewSet):
    """Standalone CRUD for truck maintenance records across all trucks."""

    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = TruckMaintenance.objects.select_related("truck").order_by("-date", "-id")
        truck_id = request.query_params.get("truck")
        if truck_id:
            qs = qs.filter(truck_id=truck_id)
        date_from = request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        date_to = request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(date__lte=date_to)
        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(truck__number__icontains=search)
        return Response(TruckMaintenanceSerializer(qs, many=True).data)

    def retrieve(self, request: Request, pk: int) -> Response:
        try:
            record = TruckMaintenance.objects.select_related("truck").get(pk=pk)
        except TruckMaintenance.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(TruckMaintenanceSerializer(record).data)

    def create(self, request: Request) -> Response:
        serializer = TruckMaintenanceCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        truck = serializer.validated_data.pop("truck")
        record = services.add_truck_maintenance(
            truck=truck, **serializer.validated_data
        )
        record.refresh_from_db()
        return Response(
            TruckMaintenanceSerializer(
                TruckMaintenance.objects.select_related("truck").get(pk=record.pk)
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request: Request, pk: int) -> Response:
        try:
            record = TruckMaintenance.objects.select_related("truck").get(pk=pk)
        except TruckMaintenance.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = TruckMaintenanceCreateUpdateSerializer(
            record, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        fields = dict(serializer.validated_data)
        if "truck" in fields:
            fields.pop("truck")
        record = services.update_truck_maintenance(maintenance=record, **fields)
        return Response(
            TruckMaintenanceSerializer(
                TruckMaintenance.objects.select_related("truck").get(pk=record.pk)
            ).data
        )

    def destroy(self, request: Request, pk: int) -> Response:
        try:
            record = TruckMaintenance.objects.get(pk=pk)
        except TruckMaintenance.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        services.delete_truck_maintenance(maintenance=record)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request: Request) -> Response:
        pks = request.data.get("ids", [])
        if not pks:
            return Response(
                {"detail": "No ids provided."}, status=status.HTTP_400_BAD_REQUEST
            )
        TruckMaintenance.objects.filter(pk__in=pks).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="alert-info")
    def alert_info(self, request: Request, pk: int) -> Response:
        try:
            record = TruckMaintenance.objects.select_related("truck").get(pk=pk)
        except TruckMaintenance.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        miles_since = services.get_truck_miles_since_maintenance(
            record.truck, record.date
        )
        total_since_reset = services.get_truck_total_miles_since_reset(record.truck)
        is_last = services.is_last_truck_maintenance(record)
        return Response(
            {
                "miles_since_maintenance": miles_since,
                "total_miles_since_reset": total_since_reset,
                "is_last_maintenance": is_last,
            }
        )


class TrailerMaintenanceViewSet(ViewSet):
    """Standalone CRUD for trailer maintenance records across all trailers."""

    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = (
            TrailerMaintenance.objects.select_related("trailer")
            .filter(trailer__status=Trailer.Status.ACTIVE)
            .order_by("-date", "-id")
        )
        trailer_id = request.query_params.get("trailer")
        if trailer_id:
            qs = qs.filter(trailer_id=trailer_id)
        date_search = request.query_params.get("date_search")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_search != "3":
            if date_from:
                qs = qs.filter(date__gte=date_from)
            if date_to:
                qs = qs.filter(date__lte=date_to)
        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(trailer__number__icontains=search)
        return Response(TrailerMaintenanceSerializer(qs, many=True).data)

    def retrieve(self, request: Request, pk: int) -> Response:
        try:
            record = TrailerMaintenance.objects.select_related("trailer").get(pk=pk)
        except TrailerMaintenance.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(TrailerMaintenanceSerializer(record).data)

    def create(self, request: Request) -> Response:
        serializer = TrailerMaintenanceCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trailer = serializer.validated_data.pop("trailer")
        record = services.add_trailer_maintenance(
            trailer=trailer, **serializer.validated_data
        )
        return Response(
            TrailerMaintenanceSerializer(
                TrailerMaintenance.objects.select_related("trailer").get(pk=record.pk)
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request: Request, pk: int) -> Response:
        try:
            record = TrailerMaintenance.objects.select_related("trailer").get(pk=pk)
        except TrailerMaintenance.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = TrailerMaintenanceCreateUpdateSerializer(
            record, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        fields = dict(serializer.validated_data)
        if "trailer" in fields:
            fields.pop("trailer")
        record = services.update_trailer_maintenance(maintenance=record, **fields)
        return Response(
            TrailerMaintenanceSerializer(
                TrailerMaintenance.objects.select_related("trailer").get(pk=record.pk)
            ).data
        )

    def destroy(self, request: Request, pk: int) -> Response:
        try:
            record = TrailerMaintenance.objects.get(pk=pk)
        except TrailerMaintenance.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        services.delete_trailer_maintenance(maintenance=record)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request: Request) -> Response:
        pks = request.data.get("ids", [])
        if not pks:
            return Response(
                {"detail": "No ids provided."}, status=status.HTTP_400_BAD_REQUEST
            )
        TrailerMaintenance.objects.filter(pk__in=pks).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="alert-info")
    def alert_info(self, request: Request, pk: int) -> Response:
        try:
            record = TrailerMaintenance.objects.select_related("trailer").get(pk=pk)
        except TrailerMaintenance.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        miles_since = services.get_trailer_miles_since_maintenance(
            record.trailer, record.date
        )
        is_last = services.is_last_trailer_maintenance(record)
        time_alert_date = services.get_trailer_time_alert_date(record)
        return Response(
            {
                "miles_since_maintenance": miles_since,
                "is_last_maintenance": is_last,
                "miles_alert_message": services.get_trailer_miles_alert_message(record),
                "time_alert_message": services.get_trailer_time_alert_message(record),
                "time_alert_date": (
                    time_alert_date.isoformat() if time_alert_date else None
                ),
            }
        )


# ── Catalog ViewSets ──────────────────────────────────────────────────────────


class _SimpleCatalogViewSet(ViewSet):
    """Base for name-only lookup tables."""

    permission_classes = [IsAuthenticated]
    model: ClassVar[Any] = None
    serializer_class: ClassVar[Any] = None

    def list(self, request: Request) -> Response:
        qs = self.model.objects.all().order_by("name")
        return Response(self.serializer_class(qs, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = self.model.objects.create(**serializer.validated_data)
        return Response(self.serializer_class(obj).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, pk: int) -> Response:
        try:
            obj = self.model.objects.get(pk=pk)
        except self.model.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = self.serializer_class(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(obj, field, value)
        obj.save()
        return Response(self.serializer_class(obj).data)


class MakeViewSet(_SimpleCatalogViewSet):
    model = Make
    serializer_class = MakeSerializer


class EngineTypeViewSet(_SimpleCatalogViewSet):
    model = EngineType
    serializer_class = EngineTypeSerializer


class CabinTypeViewSet(_SimpleCatalogViewSet):
    model = CabinType
    serializer_class = CabinTypeSerializer


class TransmissionTypeViewSet(_SimpleCatalogViewSet):
    model = TransmissionType
    serializer_class = TransmissionTypeSerializer


class TireSizeViewSet(_SimpleCatalogViewSet):
    model = TireSize
    serializer_class = TireSizeSerializer


class CardViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = Card.objects.all().order_by("number")
        return Response(CardSerializer(qs, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = CardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        card = Card.objects.create(**serializer.validated_data)
        return Response(CardSerializer(card).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, pk: int) -> Response:
        try:
            card = Card.objects.get(pk=pk)
        except Card.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = CardSerializer(card, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(card, field, value)
        card.save()
        return Response(CardSerializer(card).data)


class LossPayeeViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = LossPayee.objects.filter(is_active=True).order_by("name")
        return Response(LossPayeeSerializer(qs, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = LossPayeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = LossPayee.objects.create(**serializer.validated_data)
        return Response(LossPayeeSerializer(obj).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, pk: int) -> Response:
        try:
            obj = LossPayee.objects.get(pk=pk)
        except LossPayee.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = LossPayeeSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(obj, field, value)
        obj.save()
        return Response(LossPayeeSerializer(obj).data)


class TruckMilesResetViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        qs = TruckMilesReset.objects.select_related("truck").order_by("-date", "-id")
        truck_id = request.query_params.get("truck")
        if truck_id:
            qs = qs.filter(truck_id=truck_id)
        search_mode = request.query_params.get("search", "3")
        if search_mode == "1":
            date_from = request.query_params.get("date_from")
            date_to = request.query_params.get("date_to")
            if date_from:
                qs = qs.filter(date__date__gte=date_from)
            if date_to:
                qs = qs.filter(date__date__lte=date_to)
        latest_ids = _latest_miles_reset_ids(qs)
        return Response(
            TruckMilesResetSerializer(
                qs, many=True, context={"latest_reset_ids": latest_ids}
            ).data
        )

    def retrieve(self, request: Request, pk: int) -> Response:
        try:
            reset = TruckMilesReset.objects.select_related("truck").get(pk=pk)
        except TruckMilesReset.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        latest = (
            TruckMilesReset.objects.filter(truck=reset.truck)
            .order_by("-date", "-id")
            .first()
        )
        latest_ids = {latest.pk} if latest else set()
        return Response(
            TruckMilesResetSerializer(
                reset, context={"latest_reset_ids": latest_ids}
            ).data
        )

    def create(self, request: Request) -> Response:
        serializer = TruckMilesResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        fields = dict(serializer.validated_data)
        truck = fields.pop("truck")
        reset = services.add_truck_miles_reset(truck=truck, **fields)
        return Response(
            TruckMilesResetSerializer(
                TruckMilesReset.objects.select_related("truck").get(pk=reset.pk)
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request: Request, pk: int) -> Response:
        try:
            reset = TruckMilesReset.objects.select_related("truck").get(pk=pk)
        except TruckMilesReset.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = TruckMilesResetSerializer(reset, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        reset = services.update_truck_miles_reset(
            reset=reset, **dict(serializer.validated_data)
        )
        return Response(
            TruckMilesResetSerializer(
                TruckMilesReset.objects.select_related("truck").get(pk=reset.pk)
            ).data
        )

    def destroy(self, request: Request, pk: int) -> Response:
        try:
            reset = TruckMilesReset.objects.get(pk=pk)
        except TruckMilesReset.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        services.delete_truck_miles_reset(reset=reset)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request: Request) -> Response:
        pks = request.data.get("ids", [])
        if not pks:
            return Response(
                {"detail": "No ids provided."}, status=status.HTTP_400_BAD_REQUEST
            )
        TruckMilesReset.objects.filter(pk__in=pks).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _latest_miles_reset_ids(qs) -> set[int]:
    truck_ids = qs.values_list("truck_id", flat=True).distinct()
    truck_latest_dates = (
        TruckMilesReset.objects.filter(truck_id__in=truck_ids)
        .values("truck_id")
        .annotate(latest_date=Max("date"))
        .values_list("truck_id", "latest_date")
    )
    latest_ids: set[int] = set()
    for truck_id, latest_date in truck_latest_dates:
        latest = (
            TruckMilesReset.objects.filter(truck_id=truck_id, date=latest_date)
            .order_by("-id")
            .first()
        )
        if latest:
            latest_ids.add(latest.pk)
    return latest_ids
