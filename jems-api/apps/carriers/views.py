from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from .models import Carrier, Factor
from .serializers import (
    CarrierSerializer,
    FactorSerializer,
    SendCarrierPacketSerializer,
)
from .services import (
    create_carrier,
    delete_carrier,
    get_carrier_available_files,
    resolve_carrier_packet_recipients,
    send_carrier_packet,
    toggle_carrier_status,
    update_carrier,
)


class CarrierViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        carriers = Carrier.objects.select_related("state").order_by("name")
        serializer = CarrierSerializer(carriers, many=True)
        return Response(serializer.data)

    def create(self, request):
        serializer = CarrierSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        carrier = create_carrier(
            created_by=request.user,
            **serializer.validated_data,
        )
        return Response(CarrierSerializer(carrier).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        try:
            carrier = Carrier.objects.select_related("state").get(pk=pk)
        except Carrier.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(CarrierSerializer(carrier).data)

    def update(self, request, pk=None):
        try:
            carrier = Carrier.objects.get(pk=pk)
        except Carrier.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = CarrierSerializer(carrier, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        carrier = update_carrier(
            carrier=carrier,
            updated_by=request.user,
            **serializer.validated_data,
        )
        return Response(CarrierSerializer(carrier).data)

    def destroy(self, request, pk=None):
        try:
            carrier = Carrier.objects.get(pk=pk)
        except Carrier.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        delete_carrier(carrier=carrier)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request, pk=None):
        try:
            carrier = Carrier.objects.get(pk=pk)
        except Carrier.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        carrier = toggle_carrier_status(carrier=carrier)
        return Response(CarrierSerializer(carrier).data)

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response([])
        carriers = (
            Carrier.objects.filter(active=True).filter(name__icontains=q)
            | Carrier.objects.filter(active=True).filter(mc__icontains=q)
            | Carrier.objects.filter(active=True).filter(dba_name__icontains=q)
        )
        carriers = carriers.order_by("name")[:20]
        serializer = CarrierSerializer(carriers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="available-files")
    def available_files(self, request, pk=None):
        """Return the packet file slots that have an uploaded file."""
        try:
            carrier = Carrier.objects.get(pk=pk)
        except Carrier.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(get_carrier_available_files(carrier=carrier))

    @action(detail=True, methods=["post"], url_path="send-packet")
    def send_packet(self, request, pk=None):
        try:
            carrier = Carrier.objects.get(pk=pk)
        except Carrier.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = SendCarrierPacketSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"error": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from django.core.exceptions import ValidationError

        try:
            recipient_emails = resolve_carrier_packet_recipients(
                broker_id=serializer.validated_data.get("broker_id"),
                contact_ids=serializer.validated_data.get("contact_ids"),
                broker_email=serializer.validated_data.get("broker_email", ""),
            )
            send_carrier_packet(
                carrier=carrier,
                recipient_emails=recipient_emails,
                file_slots=serializer.validated_data["file_slots"],
                bcc_email=request.user.email,
            )
        except ValidationError as exc:
            return Response(
                {"error": exc.message},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response({"detail": "Packet sent successfully."})

    @action(detail=False, methods=["get"], url_path="options")
    def options_list(self, request):
        carriers = (
            Carrier.objects.filter(active=True)
            .values("id", "name", "mc")
            .order_by("name")
        )
        data = [{"id": c["id"], "label": f"{c['name']} ({c['mc']})"} for c in carriers]
        return Response(data)


class FactorViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request: Request) -> Response:
        factors = Factor.objects.all()
        return Response(FactorSerializer(factors, many=True).data)

    def create(self, request: Request) -> Response:
        serializer = FactorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        factor = Factor.objects.create(**serializer.validated_data)
        return Response(FactorSerializer(factor).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, pk: int) -> Response:
        try:
            factor = Factor.objects.get(pk=pk)
        except Factor.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = FactorSerializer(factor, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        for field, value in serializer.validated_data.items():
            setattr(factor, field, value)
        factor.save()
        return Response(FactorSerializer(factor).data)

    def destroy(self, request: Request, pk: int) -> Response:
        try:
            factor = Factor.objects.get(pk=pk)
        except Factor.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        factor.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
