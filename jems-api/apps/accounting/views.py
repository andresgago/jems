from __future__ import annotations

from typing import Optional

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
    DriverInvoiceDetailSerializer,
    DriverInvoiceSerializer,
    OwnerInvoiceSerializer,
    RecordListSerializer,
    RecordSerializer,
)
from .services import (
    bulk_delete_categories,
    close_driver_invoice,
    close_owner_invoice,
    create_account,
    create_category,
    create_driver_invoice,
    create_owner_invoice,
    create_record,
    delete_category,
    delete_driver_invoice,
    delete_owner_invoice,
    delete_record,
    get_driver_invoice_analysis,
    open_driver_invoice,
    open_owner_invoice,
    toggle_category_status,
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

    def _base_qs(self):
        return Category.objects.select_related(
            "category_type", "engine_type", "cabin_type", "transmission_type"
        )

    def list(self, request: "Request") -> Response:
        qs = self._base_qs()
        # Status filter: default returns all (active + inactive) — mirrors legacy
        status_param = request.query_params.get("status")
        if status_param is not None:
            qs = qs.filter(is_active=status_param in ("1", "true", "True"))
        # Type filter
        category_type = request.query_params.get("category_type")
        if category_type:
            qs = qs.filter(category_type_id=category_type)
        # Truck part filter
        is_truck_part = request.query_params.get("is_truck_part")
        if is_truck_part is not None:
            qs = qs.filter(is_truck_part=is_truck_part in ("1", "true", "True"))
        # Name / code LIKE filters
        name_q = request.query_params.get("name", "").strip()
        if name_q:
            qs = qs.filter(name__icontains=name_q)
        code_q = request.query_params.get("code", "").strip()
        if code_q:
            qs = qs.filter(code__icontains=code_q)
        qs = qs.order_by("code")
        return Response(CategorySerializer(qs, many=True).data)

    def create(self, request: "Request") -> Response:
        serializer = CategorySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            category = create_category(**serializer.validated_data)
        except DjangoValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            CategorySerializer(self._base_qs().get(pk=category.pk)).data,
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request: "Request", pk: Optional[str] = None) -> Response:
        try:
            category = self._base_qs().get(pk=pk)
        except Category.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(CategorySerializer(category).data)

    def update(self, request: "Request", pk: Optional[str] = None) -> Response:
        try:
            category = self._base_qs().get(pk=pk)
        except Category.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        serializer = CategorySerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        category = update_category(category=category, **serializer.validated_data)
        return Response(CategorySerializer(self._base_qs().get(pk=category.pk)).data)

    def destroy(self, request: "Request", pk: Optional[str] = None) -> Response:
        assert pk is not None
        try:
            category = Category.objects.get(pk=pk)
        except Category.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            delete_category(category=category)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="options")
    def options(self, request: "Request") -> Response:
        qs = (
            Category.objects.select_related("category_type")
            .filter(is_active=True)
            .order_by("name")
        )
        data = [
            {
                "id": cat.pk,
                "name": cat.name,
                "code": cat.code,
                "label": f"{cat.name} - {cat.code}",
                "category_type_name": (
                    cat.category_type.name if cat.category_type else ""
                ),
                "unit_of_measure": (
                    cat.category_type.unit_of_measure if cat.category_type else ""
                ),
            }
            for cat in qs
        ]
        return Response(data)

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request: "Request", pk: Optional[str] = None) -> Response:
        assert pk is not None
        try:
            category = Category.objects.get(pk=pk)
        except Category.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        category = toggle_category_status(category=category)
        return Response(CategorySerializer(self._base_qs().get(pk=category.pk)).data)

    @action(detail=False, methods=["post"], url_path="bulk-delete")
    def bulk_delete(self, request: "Request") -> Response:
        ids = request.data.get("ids", [])
        if not ids:
            return Response(
                {"detail": "ids list is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = bulk_delete_categories(ids=ids)
        if result["blocked"]:
            return Response(
                {
                    "detail": (
                        "Some categories could not be deleted because they have linked records."
                    ),
                    "deleted": result["deleted"],
                    "blocked": result["blocked"],
                },
                status=status.HTTP_207_MULTI_STATUS,
            )
        return Response(
            {"deleted": result["deleted"], "blocked": []},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="send-category")
    def send_category(self, request: "Request") -> Response:
        """Quick-create endpoint — mirrors legacy actionSendCategory."""
        from django.core.exceptions import ValidationError as DjangoValidationError

        code = str(request.data.get("code", "")).strip()
        name = str(request.data.get("name", "")).strip()
        category_type_id = request.data.get("category_type")

        if not code or not name or not category_type_id:
            errors: dict = {}
            if not code:
                errors["code"] = ["This field is required."]
            if not name:
                errors["name"] = ["This field is required."]
            if not category_type_id:
                errors["category_type"] = ["This field is required."]
            return Response(
                {"success": False, **errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            from .models import CategoryType

            category_type = CategoryType.objects.get(pk=category_type_id)
        except CategoryType.DoesNotExist:
            return Response(
                {"success": False, "category_type": ["Category type not found."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        kwargs: dict = {
            "is_active": True,
            "is_truck_part": bool(request.data.get("is_truck_part", False)),
            "category_type": category_type,
        }
        engine_type_id = request.data.get("engine_type")
        if engine_type_id:
            kwargs["engine_type_id"] = int(engine_type_id)
        cabin_type_id = request.data.get("cabin_type")
        if cabin_type_id:
            kwargs["cabin_type_id"] = int(cabin_type_id)
        transmission_type_id = request.data.get("transmission_type")
        if transmission_type_id:
            kwargs["transmission_type_id"] = int(transmission_type_id)

        try:
            category = create_category(code=code, name=name, **kwargs)
        except DjangoValidationError as exc:
            return Response(
                {"success": False, "detail": exc.message},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "success": True,
                "id": category.pk,
                "code": category.code,
                "name": category.name,
                "category_type_id": category_type.pk,
                "category_type_name": category_type.name,
                "category_type_um": category_type.unit_of_measure,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request: "Request") -> Response:
        q = request.query_params.get("q", "").strip()
        if len(q) < 3:
            return Response(
                {"detail": "Search query must be at least 3 characters."},
                status=status.HTTP_400_BAD_REQUEST,
            )
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
            invoice = DriverInvoice.objects.select_related("driver__carrier").get(pk=pk)
        except DriverInvoice.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(DriverInvoiceDetailSerializer(invoice).data)

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

    @action(detail=False, methods=["get"], url_path="analysis")
    def analysis(self, request: "Request") -> Response:
        date_begin = request.query_params.get("date_begin", "")
        date_end = request.query_params.get("date_end", "")
        if not date_begin or not date_end:
            return Response(
                {"detail": "date_begin and date_end are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_drivers = request.query_params.getlist("driver")
        driver_ids: list[int] | None = None
        if raw_drivers:
            driver_ids = []
            for item in raw_drivers:
                driver_ids.extend(
                    int(p) for p in item.split(",") if p.strip().isdigit()
                )

        raw_dispatchers = request.query_params.getlist("dispatcher")
        dispatcher_ids: list[int] | None = None
        if raw_dispatchers:
            dispatcher_ids = []
            for item in raw_dispatchers:
                dispatcher_ids.extend(
                    int(p) for p in item.split(",") if p.strip().isdigit()
                )

        carrier_param = request.query_params.get("carrier")
        carrier_id: int | None = (
            int(carrier_param) if carrier_param and carrier_param.isdigit() else None
        )

        rows = get_driver_invoice_analysis(
            date_begin=date_begin,
            date_end=date_end,
            driver_ids=driver_ids or None,
            dispatcher_ids=dispatcher_ids or None,
            carrier_id=carrier_id,
        )
        return Response(rows)


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
