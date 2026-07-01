from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import (
    get_balance_sheet_report,
    get_broker_summary_report,
    get_category_tracking_report,
    get_financial_report,
    get_ifta_report,
    get_invoice_report,
    get_shipper_receiver_report,
    get_tax_report,
    get_truck_parts_report,
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
        carrier_raw = request.query_params.get("carrier", "")
        carrier_id = int(carrier_raw) if carrier_raw.isdigit() else None
        data = get_financial_report(
            date_begin,
            date_end,
            driver_ids=_list_param(request, "driver"),
            truck_ids=_list_param(request, "truck"),
            trailer_ids=_list_param(request, "trailer"),
            dispatcher_ids=_list_param(request, "dispatcher"),
            carrier_id=carrier_id,
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
        carrier_raw = request.query_params.get("carrier", "")
        carrier_id = int(carrier_raw) if carrier_raw.isdigit() else None
        data = get_invoice_report(
            date_begin,
            date_end,
            driver_ids=_list_param(request, "driver"),
            invoice_ids=_list_param(request, "invoice"),
            carrier_id=carrier_id,
        )
        return Response(data)


class BalanceSheetReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        date_begin = request.query_params.get("date_begin", "")
        date_end = request.query_params.get("date_end", "")
        if not date_begin or not date_end:
            return Response(
                {"detail": "date_begin and date_end are required."}, status=400
            )
        carrier_raw = request.query_params.get("carrier", "")
        carrier_id = int(carrier_raw) if carrier_raw.isdigit() else None
        data = get_balance_sheet_report(
            date_begin,
            date_end,
            period=request.query_params.get("period", "1"),
            carrier_id=carrier_id,
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
        carrier_raw = request.query_params.get("carrier", "")
        carrier_id = int(carrier_raw) if carrier_raw.isdigit() else None
        data = get_tax_report(
            date_begin, date_end, option=option, carrier_id=carrier_id
        )
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


class TruckPartsReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        date_begin = request.query_params.get("date_begin", "")
        date_end = request.query_params.get("date_end", "")

        try:
            date_option = int(request.query_params.get("date_option", 1))
        except ValueError:
            date_option = 1

        # date_option 3 = Show All (ignore dates); otherwise dates are required
        if date_option != 3 and (not date_begin or not date_end):
            return Response(
                {
                    "detail": "date_begin and date_end are required when date_option is not 3."
                },
                status=400,
            )

        try:
            report = int(request.query_params.get("report", 1))
        except ValueError:
            report = 1
        if report not in (1, 2):
            return Response(
                {"detail": "report must be 1 (Summary) or 2 (Listing)."}, status=400
            )

        data = get_truck_parts_report(
            date_begin=date_begin,
            date_end=date_end,
            date_option=date_option,
            truck_ids=_list_param(request, "truck"),
            category_type_ids=_list_param(request, "category_type"),
            part_group_ids=_list_param(request, "part_group"),
            category_ids=_list_param(request, "category"),
            report=report,
        )
        return Response(data)
