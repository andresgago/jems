from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from .models import Broker, BrokerContact, Business
from .serializers import (
    BrokerContactSerializer,
    BrokerFileUploadSerializer,
    BrokerListSerializer,
    BrokerSerializer,
    BrokerStatusSerializer,
    BusinessSerializer,
)
from .services import (
    BROKER_FILE_SLOTS,
    clear_broker_file,
    create_broker,
    create_broker_contact,
    create_business,
    delete_broker_contact,
    search_brokers_status,
    set_broker_file,
    toggle_broker_status,
    update_broker,
    update_broker_contact,
    update_business,
)


class BrokerViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_broker(self, pk: int) -> Broker | None:
        try:
            return Broker.objects.select_related("carrier", "city", "state").get(pk=pk)
        except Broker.DoesNotExist:
            return None

    def list(self, request):
        brokers = Broker.objects.select_related("carrier").order_by("name")
        serializer = BrokerListSerializer(brokers, many=True)
        return Response(serializer.data)

    def create(self, request):
        serializer = BrokerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {
            k: v for k, v in serializer.validated_data.items() if k not in ("contacts",)
        }
        broker = create_broker(
            created_by=request.user,
            **data,
        )
        broker = (
            Broker.objects.select_related("carrier", "city", "state")
            .prefetch_related("contacts")
            .get(pk=broker.pk)
        )
        return Response(BrokerSerializer(broker).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        broker = (
            Broker.objects.prefetch_related("contacts")
            .select_related("carrier", "city", "state")
            .filter(pk=pk)
            .first()
        )
        if broker is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(BrokerSerializer(broker).data)

    def update(self, request, pk=None):
        broker = self._get_broker(pk)
        if broker is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = BrokerSerializer(broker, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = {
            k: v for k, v in serializer.validated_data.items() if k not in ("contacts",)
        }
        broker = update_broker(
            broker=broker,
            updated_by=request.user,
            **data,
        )
        broker = (
            Broker.objects.select_related("carrier", "city", "state")
            .prefetch_related("contacts")
            .get(pk=broker.pk)
        )
        return Response(BrokerSerializer(broker).data)

    def destroy(self, request, pk=None):
        broker = self._get_broker(pk)
        if broker is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        toggle_broker_status(broker=broker)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request, pk=None):
        broker = self._get_broker(pk)
        if broker is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        broker = toggle_broker_status(broker=broker)
        return Response(BrokerListSerializer(broker).data)

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response([])
        brokers = (
            Broker.objects.filter(status=Broker.Status.ACTIVE).filter(name__icontains=q)
            | Broker.objects.filter(status=Broker.Status.ACTIVE).filter(mc__icontains=q)
            | Broker.objects.filter(status=Broker.Status.ACTIVE).filter(
                dba_name__icontains=q
            )
        ).order_by("name")[:20]
        serializer = BrokerListSerializer(brokers, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="status-search")
    def status_search(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response(
                {"error": "Query parameter 'q' is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        results = search_brokers_status(query=q)
        return Response(BrokerStatusSerializer(results, many=True).data)

    @action(detail=False, methods=["get"], url_path="options")
    def options_list(self, request):
        brokers = (
            Broker.objects.filter(status=Broker.Status.ACTIVE)
            .values("id", "name", "mc", "dba_name")
            .order_by("name")
        )
        data = [
            {"id": b["id"], "label": f"{b['name']}, {b['mc']} ({b['dba_name']})"}
            for b in brokers
        ]
        return Response(data)

    @action(detail=True, methods=["get"], url_path="contacts")
    def contacts(self, request, pk=None):
        broker = self._get_broker(pk)
        if broker is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        contacts = broker.contacts.order_by("email")
        return Response(BrokerContactSerializer(contacts, many=True).data)

    @action(
        detail=True,
        methods=["post", "delete"],
        url_path=r"files/(?P<slot>[^/.]+)",
    )
    def file(self, request, pk=None, slot=None):
        if slot not in BROKER_FILE_SLOTS:
            return Response(
                {"error": f"Unknown slot '{slot}'. Valid: {list(BROKER_FILE_SLOTS)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        broker = self._get_broker(pk)
        if broker is None:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            broker = clear_broker_file(broker=broker, slot=slot)
            return Response(BrokerSerializer(broker).data)

        serializer = BrokerFileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        broker = set_broker_file(
            broker=broker,
            slot=slot,
            file=serializer.validated_data["file"],
        )
        return Response(BrokerSerializer(broker).data)


class BusinessViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def create(self, request):
        serializer = BusinessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        business = create_business(**serializer.validated_data)
        return Response(
            BusinessSerializer(business).data, status=status.HTTP_201_CREATED
        )

    def retrieve(self, request, pk=None):
        try:
            business = Business.objects.select_related("city__state").get(pk=pk)
        except Business.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(BusinessSerializer(business).data)

    def update(self, request, pk=None):
        try:
            business = Business.objects.get(pk=pk)
        except Business.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = BusinessSerializer(business, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        business = update_business(business=business, **serializer.validated_data)
        return Response(BusinessSerializer(business).data)

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response([])
        businesses = (
            Business.objects.select_related("city__state")
            .filter(status=Business.Status.ACTIVE, name__icontains=q)
            .order_by("name")[:20]
        )
        return Response(BusinessSerializer(businesses, many=True).data)


class BrokerContactViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_broker(self, broker_pk: int) -> Broker | None:
        try:
            return Broker.objects.get(pk=broker_pk)
        except Broker.DoesNotExist:
            return None

    def list(self, request, broker_pk=None):
        broker = self._get_broker(broker_pk)
        if broker is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        contacts = BrokerContact.objects.filter(broker=broker).order_by("email")
        return Response(BrokerContactSerializer(contacts, many=True).data)

    def create(self, request, broker_pk=None):
        broker = self._get_broker(broker_pk)
        if broker is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = BrokerContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        data.pop("broker", None)
        contact = create_broker_contact(broker=broker, **data)
        return Response(
            BrokerContactSerializer(contact).data, status=status.HTTP_201_CREATED
        )

    def retrieve(self, request, pk=None, broker_pk=None):
        try:
            contact = BrokerContact.objects.get(pk=pk, broker_id=broker_pk)
        except BrokerContact.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(BrokerContactSerializer(contact).data)

    def update(self, request, pk=None, broker_pk=None):
        try:
            contact = BrokerContact.objects.get(pk=pk, broker_id=broker_pk)
        except BrokerContact.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = BrokerContactSerializer(contact, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        data.pop("broker", None)
        contact = update_broker_contact(contact=contact, **data)
        return Response(BrokerContactSerializer(contact).data)

    def destroy(self, request, pk=None, broker_pk=None):
        try:
            contact = BrokerContact.objects.get(pk=pk, broker_id=broker_pk)
        except BrokerContact.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        delete_broker_contact(contact=contact)
        return Response(status=status.HTTP_204_NO_CONTENT)
