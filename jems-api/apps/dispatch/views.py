from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    DispatcherWork,
    DispatcherWorkInvoiceByHour,
    DispatcherWorkInvoiceByPercent,
)
from .serializers import (
    DispatcherWorkInvoiceByHourSerializer,
    DispatcherWorkInvoiceByPercentSerializer,
    DispatcherWorkSerializer,
)
from .services import (
    calculate_amount_by_hour,
    calculate_amount_by_percent,
    close_invoice_by_hour,
    close_invoice_by_percent,
    create_dispatcher_work,
    create_invoice_by_hour,
    create_invoice_by_percent,
    delete_dispatcher_work,
    finish_dispatcher_work,
    mark_dispatcher_work_paid,
    open_invoice_by_hour,
    open_invoice_by_percent,
    update_dispatcher_work,
    update_invoice_by_hour,
    update_invoice_by_percent,
)

# ── Dispatcher Work ───────────────────────────────────────────────────────────


class DispatcherWorkListView(APIView):
    def get(self, request: Request) -> Response:
        qs = DispatcherWork.objects.all()
        dispatcher_id = request.query_params.get("dispatcher")
        if dispatcher_id:
            qs = qs.filter(dispatcher_id=dispatcher_id)
        is_finished = request.query_params.get("is_finished")
        if is_finished is not None:
            qs = qs.filter(is_finished=is_finished.lower() == "true")
        serializer = DispatcherWorkSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request: Request) -> Response:
        serializer = DispatcherWorkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        work = create_dispatcher_work(**serializer.validated_data)
        return Response(
            DispatcherWorkSerializer(work).data, status=status.HTTP_201_CREATED
        )


class DispatcherWorkDetailView(APIView):
    def get(self, request: Request, pk: int) -> Response:
        work = get_object_or_404(DispatcherWork, pk=pk)
        return Response(DispatcherWorkSerializer(work).data)

    def patch(self, request: Request, pk: int) -> Response:
        work = get_object_or_404(DispatcherWork, pk=pk)
        serializer = DispatcherWorkSerializer(work, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        work = update_dispatcher_work(work=work, **serializer.validated_data)
        return Response(DispatcherWorkSerializer(work).data)

    def delete(self, request: Request, pk: int) -> Response:
        work = get_object_or_404(DispatcherWork, pk=pk)
        delete_dispatcher_work(work=work)
        return Response(status=status.HTTP_204_NO_CONTENT)


class DispatcherWorkFinishView(APIView):
    def post(self, request: Request, pk: int) -> Response:
        work = get_object_or_404(DispatcherWork, pk=pk)
        try:
            work = finish_dispatcher_work(work=work)
        except ValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DispatcherWorkSerializer(work).data)


class DispatcherWorkMarkPaidView(APIView):
    def post(self, request: Request, pk: int) -> Response:
        work = get_object_or_404(DispatcherWork, pk=pk)
        work = mark_dispatcher_work_paid(work=work)
        return Response(DispatcherWorkSerializer(work).data)


# ── Invoice By Percent ────────────────────────────────────────────────────────


class InvoiceByPercentListView(APIView):
    def get(self, request: Request) -> Response:
        qs = DispatcherWorkInvoiceByPercent.objects.all()
        dispatcher_id = request.query_params.get("dispatcher")
        if dispatcher_id:
            qs = qs.filter(dispatcher_id=dispatcher_id)
        status_filter = request.query_params.get("status")
        if status_filter is not None:
            qs = qs.filter(status=status_filter)
        serializer = DispatcherWorkInvoiceByPercentSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request: Request) -> Response:
        serializer = DispatcherWorkInvoiceByPercentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = create_invoice_by_percent(**serializer.validated_data)
        return Response(
            DispatcherWorkInvoiceByPercentSerializer(invoice).data,
            status=status.HTTP_201_CREATED,
        )


class InvoiceByPercentDetailView(APIView):
    def get(self, request: Request, pk: int) -> Response:
        invoice = get_object_or_404(DispatcherWorkInvoiceByPercent, pk=pk)
        return Response(DispatcherWorkInvoiceByPercentSerializer(invoice).data)

    def patch(self, request: Request, pk: int) -> Response:
        invoice = get_object_or_404(DispatcherWorkInvoiceByPercent, pk=pk)
        serializer = DispatcherWorkInvoiceByPercentSerializer(
            invoice, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        invoice = update_invoice_by_percent(
            invoice=invoice, **serializer.validated_data
        )
        return Response(DispatcherWorkInvoiceByPercentSerializer(invoice).data)


class InvoiceByPercentCloseView(APIView):
    def post(self, request: Request, pk: int) -> Response:
        invoice = get_object_or_404(DispatcherWorkInvoiceByPercent, pk=pk)
        try:
            invoice = close_invoice_by_percent(invoice=invoice)
        except ValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DispatcherWorkInvoiceByPercentSerializer(invoice).data)


class InvoiceByPercentOpenView(APIView):
    def post(self, request: Request, pk: int) -> Response:
        invoice = get_object_or_404(DispatcherWorkInvoiceByPercent, pk=pk)
        try:
            invoice = open_invoice_by_percent(invoice=invoice)
        except ValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DispatcherWorkInvoiceByPercentSerializer(invoice).data)


class InvoiceByPercentAmountView(APIView):
    def get(self, request: Request, pk: int) -> Response:
        invoice = get_object_or_404(DispatcherWorkInvoiceByPercent, pk=pk)
        amount = calculate_amount_by_percent(invoice=invoice)
        return Response({"amount": amount})


# ── Invoice By Hour ───────────────────────────────────────────────────────────


class InvoiceByHourListView(APIView):
    def get(self, request: Request) -> Response:
        qs = DispatcherWorkInvoiceByHour.objects.all()
        dispatcher_id = request.query_params.get("dispatcher")
        if dispatcher_id:
            qs = qs.filter(dispatcher_id=dispatcher_id)
        status_filter = request.query_params.get("status")
        if status_filter is not None:
            qs = qs.filter(status=status_filter)
        serializer = DispatcherWorkInvoiceByHourSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request: Request) -> Response:
        serializer = DispatcherWorkInvoiceByHourSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice = create_invoice_by_hour(**serializer.validated_data)
        return Response(
            DispatcherWorkInvoiceByHourSerializer(invoice).data,
            status=status.HTTP_201_CREATED,
        )


class InvoiceByHourDetailView(APIView):
    def get(self, request: Request, pk: int) -> Response:
        invoice = get_object_or_404(DispatcherWorkInvoiceByHour, pk=pk)
        return Response(DispatcherWorkInvoiceByHourSerializer(invoice).data)

    def patch(self, request: Request, pk: int) -> Response:
        invoice = get_object_or_404(DispatcherWorkInvoiceByHour, pk=pk)
        serializer = DispatcherWorkInvoiceByHourSerializer(
            invoice, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        invoice = update_invoice_by_hour(invoice=invoice, **serializer.validated_data)
        return Response(DispatcherWorkInvoiceByHourSerializer(invoice).data)


class InvoiceByHourCloseView(APIView):
    def post(self, request: Request, pk: int) -> Response:
        invoice = get_object_or_404(DispatcherWorkInvoiceByHour, pk=pk)
        try:
            invoice = close_invoice_by_hour(invoice=invoice)
        except ValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DispatcherWorkInvoiceByHourSerializer(invoice).data)


class InvoiceByHourOpenView(APIView):
    def post(self, request: Request, pk: int) -> Response:
        invoice = get_object_or_404(DispatcherWorkInvoiceByHour, pk=pk)
        try:
            invoice = open_invoice_by_hour(invoice=invoice)
        except ValidationError as exc:
            return Response({"detail": exc.message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(DispatcherWorkInvoiceByHourSerializer(invoice).data)


class InvoiceByHourAmountView(APIView):
    def get(self, request: Request, pk: int) -> Response:
        invoice = get_object_or_404(DispatcherWorkInvoiceByHour, pk=pk)
        amount = calculate_amount_by_hour(invoice=invoice)
        return Response({"amount": amount})
