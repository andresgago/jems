from __future__ import annotations

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from .models import (
    Account,
    CardGain,
    Category,
    CategoryType,
    DriverInvoice,
    OwnerInvoice,
    Record,
)
from .serializers import (
    AccountSerializer,
    CardGainSerializer,
    CategorySerializer,
    CategoryTypeSerializer,
    DriverInvoiceSerializer,
    OwnerInvoiceSerializer,
    RecordListSerializer,
    RecordSerializer,
)
from .services import (
    close_driver_invoice,
    close_owner_invoice,
    create_account,
    create_category,
    create_driver_invoice,
    create_owner_invoice,
    create_record,
    delete_driver_invoice,
    delete_owner_invoice,
    delete_record,
    open_driver_invoice,
    open_owner_invoice,
    update_account,
    update_category,
    update_driver_invoice,
    update_owner_invoice,
    update_record,
)


class AccountViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        qs = Account.objects.all()
        if request.query_params.get("active_only"):
            qs = qs.filter(is_active=True)
        return Response(AccountSerializer(qs, many=True).data)

    def create(self, request):
        serializer = AccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = create_account(**serializer.validated_data)
        return Response(AccountSerializer(account).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        try:
            account = Account.objects.get(pk=pk)
        except Account.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(AccountSerializer(account).data)

    def update(self, request, pk=None):
        try:
            account = Account.objects.get(pk=pk)
        except Account.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = AccountSerializer(account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        account = update_account(account=account, **serializer.validated_data)
        return Response(AccountSerializer(account).data)


class CategoryTypeViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        qs = CategoryType.objects.filter(is_active=True)
        return Response(CategoryTypeSerializer(qs, many=True).data)

    def create(self, request):
        serializer = CategoryTypeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ct = CategoryType.objects.create(**serializer.validated_data)
        return Response(CategoryTypeSerializer(ct).data, status=status.HTTP_201_CREATED)


class CategoryViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        qs = Category.objects.select_related("category_type").filter(is_active=True)
        return Response(CategorySerializer(qs, many=True).data)

    def create(self, request):
        serializer = CategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = create_category(**serializer.validated_data)
        return Response(
            CategorySerializer(category).data, status=status.HTTP_201_CREATED
        )

    def retrieve(self, request, pk=None):
        try:
            category = Category.objects.get(pk=pk)
        except Category.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(CategorySerializer(category).data)

    def update(self, request, pk=None):
        try:
            category = Category.objects.get(pk=pk)
        except Category.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = CategorySerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        category = update_category(category=category, **serializer.validated_data)
        return Response(CategorySerializer(category).data)

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request: "Request") -> Response:
        q = request.query_params.get("q", "").strip()
        if len(q) < 3:
            return Response([])
        qs = (
            (
                Category.objects.select_related("category_type")
                .filter(is_active=True)
                .filter(name__icontains=q)
                | Category.objects.select_related("category_type")
                .filter(is_active=True)
                .filter(code__icontains=q)
            )
            .distinct()
            .order_by("name")
        )
        data = [
            {
                "id": cat.pk,
                "label": (
                    f"{cat.name} - {cat.code}"
                    + (
                        f" ({cat.category_type.unit_of_measure})"
                        if cat.category_type and cat.category_type.unit_of_measure
                        else ""
                    )
                ),
                "name": cat.name,
                "code": cat.code,
            }
            for cat in qs
        ]
        return Response(data)


class RecordViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def _base_qs(self):
        return Record.objects.select_related(
            "account",
            "load",
            "truck",
            "trailer",
            "driver",
            "owner",
            "category",
            "dispatcher",
            "city",
            "card",
            "created_by",
        )

    def list(self, request):
        qs = self._base_qs()
        # Filters
        driver = request.query_params.get("driver")
        if driver:
            qs = qs.filter(driver_id=driver)
        load = request.query_params.get("load")
        if load:
            qs = qs.filter(load_id=load)
        truck = request.query_params.get("truck")
        if truck:
            qs = qs.filter(truck_id=truck)
        account = request.query_params.get("account")
        if account:
            qs = qs.filter(account_id=account)
        date_from = request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        date_to = request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(date__lte=date_to)
        return Response(RecordListSerializer(qs, many=True).data)

    def create(self, request):
        serializer = RecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record = create_record(created_by=request.user, **serializer.validated_data)
        return Response(RecordSerializer(record).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        try:
            record = self._base_qs().get(pk=pk)
        except Record.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(RecordSerializer(record).data)

    def update(self, request, pk=None):
        try:
            record = Record.objects.get(pk=pk)
        except Record.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = RecordSerializer(record, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        record = update_record(
            record=record, updated_by=request.user, **serializer.validated_data
        )
        return Response(RecordSerializer(record).data)

    def destroy(self, request, pk=None):
        try:
            record = Record.objects.get(pk=pk)
        except Record.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        delete_record(record=record)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DriverInvoiceViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        qs = DriverInvoice.objects.select_related("driver", "created_by")
        s = request.query_params.get("status")
        if s is not None:
            qs = qs.filter(status=s)
        driver = request.query_params.get("driver")
        if driver:
            qs = qs.filter(driver_id=driver)
        return Response(DriverInvoiceSerializer(qs, many=True).data)

    def create(self, request):
        serializer = DriverInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {
            k: v for k, v in serializer.validated_data.items() if k not in ("number",)
        }
        invoice = create_driver_invoice(created_by=request.user, **data)
        return Response(
            DriverInvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED
        )

    def retrieve(self, request, pk=None):
        try:
            invoice = DriverInvoice.objects.select_related("driver").get(pk=pk)
        except DriverInvoice.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(DriverInvoiceSerializer(invoice).data)

    def update(self, request, pk=None):
        try:
            invoice = DriverInvoice.objects.get(pk=pk)
        except DriverInvoice.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = DriverInvoiceSerializer(invoice, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = {
            k: v for k, v in serializer.validated_data.items() if k not in ("number",)
        }
        invoice = update_driver_invoice(
            invoice=invoice, updated_by=request.user, **data
        )
        return Response(DriverInvoiceSerializer(invoice).data)

    def destroy(self, request, pk=None):
        try:
            invoice = DriverInvoice.objects.get(pk=pk)
        except DriverInvoice.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        delete_driver_invoice(invoice=invoice)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        try:
            invoice = DriverInvoice.objects.get(pk=pk)
        except DriverInvoice.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            invoice = close_driver_invoice(invoice=invoice, updated_by=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DriverInvoiceSerializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="open")
    def open(self, request, pk=None):
        try:
            invoice = DriverInvoice.objects.get(pk=pk)
        except DriverInvoice.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        invoice = open_driver_invoice(invoice=invoice, updated_by=request.user)
        return Response(DriverInvoiceSerializer(invoice).data)

    @action(detail=False, methods=["get"], url_path="options")
    def options(self, request: "Request") -> Response:
        date_begin = request.query_params.get("date_begin", "")
        date_end = request.query_params.get("date_end", "")
        qs = DriverInvoice.objects.select_related("driver").filter(
            status=DriverInvoice.Status.OPEN
        )
        if date_begin and date_end:
            qs = qs.filter(date__range=[date_begin, date_end])
        carrier = request.query_params.get("carrier")
        if carrier and carrier.isdigit():
            qs = qs.filter(driver__carrier_id=int(carrier))
        raw_drivers = request.query_params.getlist("driver")
        if raw_drivers:
            driver_ids: list[int] = []
            for item in raw_drivers:
                driver_ids.extend(
                    int(part) for part in item.split(",") if part.strip().isdigit()
                )
            if driver_ids:
                qs = qs.filter(driver_id__in=driver_ids)
        data = [
            {
                "id": inv.pk,
                "number": inv.number,
                "driver_name": inv.driver.full_name if inv.driver else "",
            }
            for inv in qs.order_by("number")
        ]
        return Response(data)


class OwnerInvoiceViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        qs = OwnerInvoice.objects.select_related("owner", "created_by")
        s = request.query_params.get("status")
        if s is not None:
            qs = qs.filter(status=s)
        owner = request.query_params.get("owner")
        if owner:
            qs = qs.filter(owner_id=owner)
        return Response(OwnerInvoiceSerializer(qs, many=True).data)

    def create(self, request):
        serializer = OwnerInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = {
            k: v for k, v in serializer.validated_data.items() if k not in ("number",)
        }
        invoice = create_owner_invoice(created_by=request.user, **data)
        return Response(
            OwnerInvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED
        )

    def retrieve(self, request, pk=None):
        try:
            invoice = OwnerInvoice.objects.get(pk=pk)
        except OwnerInvoice.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(OwnerInvoiceSerializer(invoice).data)

    def update(self, request, pk=None):
        try:
            invoice = OwnerInvoice.objects.get(pk=pk)
        except OwnerInvoice.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = OwnerInvoiceSerializer(invoice, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = {
            k: v for k, v in serializer.validated_data.items() if k not in ("number",)
        }
        invoice = update_owner_invoice(invoice=invoice, updated_by=request.user, **data)
        return Response(OwnerInvoiceSerializer(invoice).data)

    def destroy(self, request, pk=None):
        try:
            invoice = OwnerInvoice.objects.get(pk=pk)
        except OwnerInvoice.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        delete_owner_invoice(invoice=invoice)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request, pk=None):
        try:
            invoice = OwnerInvoice.objects.get(pk=pk)
        except OwnerInvoice.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        invoice = close_owner_invoice(invoice=invoice, updated_by=request.user)
        return Response(OwnerInvoiceSerializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="open")
    def open(self, request, pk=None):
        try:
            invoice = OwnerInvoice.objects.get(pk=pk)
        except OwnerInvoice.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        invoice = open_owner_invoice(invoice=invoice, updated_by=request.user)
        return Response(OwnerInvoiceSerializer(invoice).data)


class CardGainViewSet(ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        qs = CardGain.objects.select_related("card").all()
        card_id = request.query_params.get("card")
        if card_id:
            qs = qs.filter(card_id=card_id)
        return Response(CardGainSerializer(qs, many=True).data)

    def create(self, request):
        serializer = CardGainSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        gain = CardGain.objects.create(**serializer.validated_data)
        return Response(CardGainSerializer(gain).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        try:
            gain = CardGain.objects.get(pk=pk)
        except CardGain.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(CardGainSerializer(gain).data)

    def destroy(self, request, pk=None):
        try:
            gain = CardGain.objects.get(pk=pk)
        except CardGain.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        gain.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
