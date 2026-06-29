from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import (
    get_broker_summary_report,
    get_category_tracking_report,
    get_financial_report,
    get_ifta_report,
    get_invoice_report,
    get_shipper_receiver_report,
    get_tax_report,
)


def _list_param(request: Request, key: str) -> list[int] | None:
    """Parse a comma-separated or repeated query param into a list of ints, or None if absent."""
    raw = request.query_params.getlist(key)
    if not raw:
        return None
    ids: list[int] = []
    for item in raw:
        for part in item.split(","):
            part = part.strip()
            if part:
                try:
                    ids.append(int(part))
                except ValueError:
                    pass
    return ids if ids else None


class FinancialReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        date_begin = request.query_params.get("date_begin", "")
        date_end = request.query_params.get("date_end", "")
        if not date_begin or not date_end:
            return Response(
                {"detail": "date_begin and date_end are required."}, status=400
            )
        data = get_financial_report(
            date_begin,
            date_end,
            driver_ids=_list_param(request, "driver"),
            truck_ids=_list_param(request, "truck"),
            trailer_ids=_list_param(request, "trailer"),
            dispatcher_ids=_list_param(request, "dispatcher"),
        )
        return Response(data)


class InvoiceReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        date_begin = request.query_params.get("date_begin", "")
        date_end = request.query_params.get("date_end", "")
        if not date_begin or not date_end:
            return Response(
                {"detail": "date_begin and date_end are required."}, status=400
            )
        data = get_invoice_report(
            date_begin,
            date_end,
            driver_ids=_list_param(request, "driver"),
            invoice_ids=_list_param(request, "invoice"),
        )
        return Response(data)


class IftaReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        date_begin = request.query_params.get("date_begin", "")
        date_end = request.query_params.get("date_end", "")
        if not date_begin or not date_end:
            return Response(
                {"detail": "date_begin and date_end are required."}, status=400
            )
        data = get_ifta_report(date_begin, date_end)
        return Response(data)


class TaxReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        date_begin = request.query_params.get("date_begin", "")
        date_end = request.query_params.get("date_end", "")
        if not date_begin or not date_end:
            return Response(
                {"detail": "date_begin and date_end are required."}, status=400
            )
        try:
            option = int(request.query_params.get("option", 0))
        except ValueError:
            option = 0
        data = get_tax_report(date_begin, date_end, option=option)
        return Response(data)


class CategoryTrackingReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        date_begin = request.query_params.get("date_begin", "")
        date_end = request.query_params.get("date_end", "")
        if not date_begin or not date_end:
            return Response(
                {"detail": "date_begin and date_end are required."}, status=400
            )
        data = get_category_tracking_report(
            date_begin,
            date_end,
            truck_ids=_list_param(request, "truck"),
            trailer_ids=_list_param(request, "trailer"),
            category_ids=_list_param(request, "category"),
            position_ids=_list_param(request, "position"),
        )
        return Response(data)


class BrokerSummaryReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        year_raw = request.query_params.get("year", "")
        if not year_raw:
            return Response({"detail": "year is required."}, status=400)
        try:
            year = int(year_raw)
        except ValueError:
            return Response({"detail": "year must be an integer."}, status=400)
        try:
            option = int(request.query_params.get("option", 0))
        except ValueError:
            option = 0
        data = get_broker_summary_report(year, option=option)
        return Response(data)


class ShipperReceiverReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        year_raw = request.query_params.get("year", "")
        if not year_raw:
            return Response({"detail": "year is required."}, status=400)
        try:
            year = int(year_raw)
        except ValueError:
            return Response({"detail": "year must be an integer."}, status=400)
        try:
            option = int(request.query_params.get("option", 0))
        except ValueError:
            option = 0
        data = get_shipper_receiver_report(year, option=option)
        return Response(data)
