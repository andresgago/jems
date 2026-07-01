from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from .models import Broker, BrokerContact, Business
from .serializers import (
    BrokerContactSerializer,
    BrokerFileUploadSerializer,
    BrokerListSerializer,
    BrokerSerializer,
    BrokerStatusCreateSerializer,
    BrokerStatusSerializer,
    BusinessSerializer,
)
from .services import (
    BROKER_FILE_SLOTS,
    clear_broker_file,
    create_broker,
    create_broker_from_status_result,
    create_broker_contact,
    create_business,
    delete_business,
    delete_broker_contact,
    search_brokers_status,
    set_broker_file,
    toggle_business_status,
    toggle_broker_status,
    update_broker,
    update_broker_contact,
    update_business,
)


class LegacyGridPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200


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

    @action(detail=False, methods=["post"], url_path="status-search/create")
    def status_search_create(self, request):
        serializer = BrokerStatusCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            broker = create_broker_from_status_result(
                data=serializer.validated_data,
                user=request.user,
            )
        except DjangoValidationError as exc:
            return Response({"error": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        broker = (
            Broker.objects.select_related("carrier", "city", "state")
            .prefetch_related("contacts")
            .get(pk=broker.pk)
        )
        return Response(BrokerSerializer(broker).data, status=status.HTTP_201_CREATED)

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

    def _base_queryset(self):
        return Business.objects.select_related("city__state").annotate(
            shipper_load_count=Count("shipper_loads", distinct=True),
            receiver_load_count=Count("receiver_loads", distinct=True),
        )

    def _get_business(self, pk: int) -> Business | None:
        try:
            return self._base_queryset().get(pk=pk)
        except Business.DoesNotExist:
            return None

    def list(self, request):
        q = request.query_params.get("q", "").strip()
        name = request.query_params.get("name", "").strip()
        address = request.query_params.get("address", "").strip()
        city = request.query_params.get("city", "").strip()
        status_param = request.query_params.get("status", "").strip()

        businesses = self._base_queryset().order_by("name")
        if q:
            businesses = businesses.filter(
                Q(name__icontains=q) | Q(address__icontains=q)
            )
        if name:
            businesses = businesses.filter(name__icontains=name)
        if address:
            businesses = businesses.filter(address__icontains=address)
        if city:
            try:
                businesses = businesses.filter(city_id=int(city))
            except ValueError:
                businesses = businesses.none()
        if status_param != "":
            try:
                businesses = businesses.filter(status=int(status_param))
            except ValueError:
                businesses = businesses.none()

        paginator = LegacyGridPagination()
        page = paginator.paginate_queryset(businesses, request)
        return paginator.get_paginated_response(
            BusinessSerializer(page, many=True).data
        )

    def create(self, request):
        serializer = BusinessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            business = create_business(**serializer.validated_data)
        except DjangoValidationError as exc:
            return Response({"error": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            BusinessSerializer(business).data, status=status.HTTP_201_CREATED
        )

    def retrieve(self, request, pk=None):
        business = self._get_business(pk)
        if business is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(BusinessSerializer(business).data)

    def update(self, request, pk=None):
        business = self._get_business(pk)
        if business is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = BusinessSerializer(business, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            business = update_business(business=business, **serializer.validated_data)
        except DjangoValidationError as exc:
            return Response({"error": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(BusinessSerializer(business).data)

    def destroy(self, request, pk=None):
        business = self._get_business(pk)
        if business is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            delete_business(business=business)
        except DjangoValidationError as exc:
            return Response({"error": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

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

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request, pk=None):
        business = self._get_business(pk)
        if business is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        business = toggle_business_status(business=business)
        return Response(BusinessSerializer(business).data)


class BrokerContactGlobalViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def _get_contact(self, pk: int) -> BrokerContact | None:
        try:
            return BrokerContact.objects.select_related("broker").get(pk=pk)
        except BrokerContact.DoesNotExist:
            return None

    def list(self, request):
        q = request.query_params.get("q", "").strip()
        name = request.query_params.get("name", "").strip()
        email = request.query_params.get("email", "").strip()
        phone = request.query_params.get("phone", "").strip()
        broker = request.query_params.get("broker", "").strip()

        contacts = BrokerContact.objects.select_related("broker").order_by("name")
        if q:
            contacts = contacts.filter(
                Q(name__icontains=q)
                | Q(email__icontains=q)
                | Q(phone__icontains=q)
                | Q(broker__name__icontains=q)
            )
        if name:
            contacts = contacts.filter(name__icontains=name)
        if email:
            contacts = contacts.filter(email__icontains=email)
        if phone:
            contacts = contacts.filter(phone__icontains=phone)
        if broker:
            try:
                contacts = contacts.filter(broker_id=int(broker))
            except ValueError:
                contacts = contacts.none()

        paginator = LegacyGridPagination()
        page = paginator.paginate_queryset(contacts, request)
        return paginator.get_paginated_response(
            BrokerContactSerializer(page, many=True).data
        )

    def create(self, request):
        serializer = BrokerContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        broker = serializer.validated_data.get("broker")
        if broker is None:
            return Response(
                {"broker": ["This field is required."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = serializer.validated_data
        data.pop("broker", None)
        try:
            contact = create_broker_contact(broker=broker, **data)
        except DjangoValidationError as exc:
            return Response({"error": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            BrokerContactSerializer(contact).data, status=status.HTTP_201_CREATED
        )

    def retrieve(self, request, pk=None):
        contact = self._get_contact(pk)
        if contact is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(BrokerContactSerializer(contact).data)

    def update(self, request, pk=None):
        contact = self._get_contact(pk)
        if contact is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = BrokerContactSerializer(contact, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        broker = data.pop("broker", None)
        if broker is not None:
            contact.broker = broker
        try:
            contact = update_broker_contact(contact=contact, **data)
        except DjangoValidationError as exc:
            return Response({"error": exc.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response(BrokerContactSerializer(contact).data)

    def destroy(self, request, pk=None):
        contact = self._get_contact(pk)
        if contact is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        delete_broker_contact(contact=contact)
        return Response(status=status.HTTP_204_NO_CONTENT)


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
