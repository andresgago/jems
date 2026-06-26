import datetime

from django.contrib.auth import get_user_model
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
    calendar_events,
    close_invoice_by_hour,
    close_invoice_by_percent,
    create_dispatcher_work,
    create_invoice_by_hour,
    create_invoice_by_percent,
    delete_dispatcher_work,
    finish_dispatcher_work,
    mark_dispatcher_work_paid,
    move_work_event,
    open_invoice_by_hour,
    open_invoice_by_percent,
    update_dispatcher_work,
    update_invoice_by_hour,
    update_invoice_by_percent,
)

User = get_user_model()

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


class DispatcherWorkCalendarView(APIView):
    """Return FullCalendar-compatible events for the given date window.

    Query params:
      start (required) — ISO date or datetime, start of visible range
      end   (required) — ISO date or datetime, end of visible range
      self_only         — "true" (default) shows only current user; "false" shows all
    """

    def get(self, request: Request) -> Response:
        start_str = request.query_params.get("start")
        end_str = request.query_params.get("end")
        if not start_str or not end_str:
            return Response(
                {"detail": "start and end query params are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            start = datetime.date.fromisoformat(start_str[:10])
            end = datetime.date.fromisoformat(end_str[:10])
        except ValueError:
            return Response(
                {"detail": "Invalid date format. Use ISO 8601 (YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        self_only = request.query_params.get("self_only", "true").lower() != "false"
        events = calendar_events(
            user=request.user, start=start, end=end, self_only=self_only
        )
        return Response(events)


class DispatcherWorkMoveView(APIView):
    """Shift a work session's start (and end by the same delta) via drag-and-drop."""

    def post(self, request: Request, pk: int) -> Response:
        work = get_object_or_404(DispatcherWork, pk=pk)
        new_start_str = request.data.get("start")
        if not new_start_str:
            return Response(
                {"detail": "start is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            new_start = datetime.datetime.fromisoformat(
                str(new_start_str).replace("Z", "+00:00")
            )
        except ValueError:
            return Response(
                {"detail": "Invalid datetime format. Use ISO 8601."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_start.tzinfo is None:
            new_start = new_start.replace(tzinfo=datetime.timezone.utc)

        work = move_work_event(work=work, new_start=new_start)
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


# ── Dispatchers Options ───────────────────────────────────────────────────────


class DispatchersOptionsView(APIView):
    """Return all users flagged as dispatchers for dropdown use."""

    def get(self, request: Request) -> Response:
        dispatchers = (
            User.objects.filter(is_dispatcher=True)
            .order_by("first_name", "last_name")
            .values("id", "first_name", "last_name", "dispatcher_type", "color")
        )
        data = [
            {
                "id": d["id"],
                "full_name": f"{d['first_name']} {d['last_name']}".strip(),
                "dispatcher_type": d["dispatcher_type"],
                "color": d["color"],
            }
            for d in dispatchers
        ]
        return Response(data)
