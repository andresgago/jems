from __future__ import annotations

from typing import Any

from django.db.models import Sum

from apps.accounting.models import Account, DriverInvoice, Record
from apps.brokers.models import Broker
from apps.drivers.models import Driver
from apps.fleet.models import Card, Trailer, Truck
from apps.loads.models import Load
from apps.locations.models import State
from apps.users.models import Position, User

_DRIVER_TYPE_OWNER_OP = 3
_DRIVER_TYPE_SOLO = 4
_DRIVER_TYPE_TEAM = 5


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _date_range(date_begin: str, date_end: str) -> tuple[str, str]:
    return date_begin, date_end


def _sum_records(
    qs,
    *,
    date_begin: str,
    date_end: str,
    account: Account | None = None,
    driver_ids: list[int] | None = None,
    truck_ids: list[int] | None = None,
    trailer_ids: list[int] | None = None,
    dispatcher_ids: list[int] | None = None,
    load_ids: list[int] | None = None,
    carrier_id: int | None = None,
) -> float:
    if account is not None:
        qs = qs.filter(account=account)
    qs = qs.filter(progress=0, date__range=[date_begin, date_end])
    if driver_ids:
        qs = qs.filter(driver_id__in=driver_ids)
    if truck_ids:
        qs = qs.filter(truck_id__in=truck_ids)
    if trailer_ids:
        qs = qs.filter(trailer_id__in=trailer_ids)
    if dispatcher_ids:
        qs = qs.filter(dispatcher_id__in=dispatcher_ids)
    if load_ids is not None:
        qs = qs.filter(load_id__in=load_ids)
    if carrier_id is not None:
        qs = qs.filter(carrier_id=carrier_id)
    return float(qs.aggregate(total=Sum("amount"))["total"] or 0.0)


def _account_amount(
    date_begin: str,
    date_end: str,
    account: Account,
    driver_ids: list[int] | None = None,
    truck_ids: list[int] | None = None,
    trailer_ids: list[int] | None = None,
    dispatcher_ids: list[int] | None = None,
    carrier_id: int | None = None,
) -> float:
    base_qs = Record.objects.all()
    return _sum_records(
        base_qs,
        date_begin=date_begin,
        date_end=date_end,
        account=account,
        driver_ids=driver_ids,
        truck_ids=truck_ids,
        trailer_ids=trailer_ids,
        dispatcher_ids=dispatcher_ids,
        carrier_id=carrier_id,
    )


def _build_account_entry(
    account: Account,
    amount: float,
    date_begin: str,
    date_end: str,
    driver_ids: list[int] | None,
    truck_ids: list[int] | None,
    trailer_ids: list[int] | None,
    dispatcher_ids: list[int] | None,
    carrier_id: int | None = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "account_code": account.code,
        "account_name": account.name,
        "amount": amount,
        "details": {},
    }
    if driver_ids:
        drivers_map = {
            d.pk: d.full_name for d in Driver.objects.filter(pk__in=driver_ids)
        }
        entry["details"]["drivers"] = [
            {
                "id": d,
                "name": drivers_map.get(d, ""),
                "amount": _account_amount(
                    date_begin,
                    date_end,
                    account,
                    driver_ids=[d],
                    truck_ids=truck_ids,
                    trailer_ids=trailer_ids,
                    dispatcher_ids=dispatcher_ids,
                    carrier_id=carrier_id,
                ),
            }
            for d in driver_ids
        ]
    if truck_ids:
        truck_numbers = {
            t.pk: t.number
            for t in Truck.objects.filter(pk__in=truck_ids).only("pk", "number")
        }
        entry["details"]["trucks"] = [
            {
                "id": t,
                "number": truck_numbers.get(t, ""),
                "amount": _account_amount(
                    date_begin,
                    date_end,
                    account,
                    driver_ids=driver_ids,
                    truck_ids=[t],
                    trailer_ids=trailer_ids,
                    dispatcher_ids=dispatcher_ids,
                    carrier_id=carrier_id,
                ),
            }
            for t in truck_ids
        ]
    if trailer_ids:
        trailer_numbers = {
            t.pk: t.number
            for t in Trailer.objects.filter(pk__in=trailer_ids).only("pk", "number")
        }
        entry["details"]["trailers"] = [
            {
                "id": t,
                "number": trailer_numbers.get(t, ""),
                "amount": _account_amount(
                    date_begin,
                    date_end,
                    account,
                    driver_ids=driver_ids,
                    truck_ids=truck_ids,
                    trailer_ids=[t],
                    dispatcher_ids=dispatcher_ids,
                    carrier_id=carrier_id,
                ),
            }
            for t in trailer_ids
        ]
    if dispatcher_ids:
        users_map = {
            u.pk: f"{u.first_name} {u.last_name}".strip()
            for u in User.objects.filter(pk__in=dispatcher_ids)
        }
        entry["details"]["dispatchers"] = [
            {
                "id": d,
                "name": users_map.get(d, ""),
                "amount": _account_amount(
                    date_begin,
                    date_end,
                    account,
                    driver_ids=driver_ids,
                    truck_ids=truck_ids,
                    trailer_ids=trailer_ids,
                    dispatcher_ids=[d],
                    carrier_id=carrier_id,
                ),
            }
            for d in dispatcher_ids
        ]
    return entry


# ---------------------------------------------------------------------------
# Report 1: Profit and Loss
# ---------------------------------------------------------------------------


def get_financial_report(
    date_begin: str,
    date_end: str,
    driver_ids: list[int] | None = None,
    truck_ids: list[int] | None = None,
    trailer_ids: list[int] | None = None,
    dispatcher_ids: list[int] | None = None,
    carrier_id: int | None = None,
) -> dict[str, Any]:
    from apps.carriers.models import Carrier

    carrier_name = ""
    if carrier_id is not None:
        try:
            carrier_name = Carrier.objects.get(pk=carrier_id).name
        except Carrier.DoesNotExist:
            pass

    ytd_begin = f"{date_end[:4]}-01-01"

    revenue_accounts = Account.objects.filter(
        is_main=False, code__startswith="900"
    ).order_by("code")
    expense_accounts = Account.objects.filter(
        is_main=False, code__startswith="800"
    ).order_by("code")

    total_revenues = 0.0
    ytd_total_revenues = 0.0
    revenues: list[dict] = []
    for account in revenue_accounts:
        amount = _account_amount(
            date_begin,
            date_end,
            account,
            driver_ids,
            truck_ids,
            trailer_ids,
            dispatcher_ids,
            carrier_id,
        )
        ytd_amount = _account_amount(
            ytd_begin,
            date_end,
            account,
            driver_ids,
            truck_ids,
            trailer_ids,
            dispatcher_ids,
            carrier_id,
        )
        total_revenues += amount
        ytd_total_revenues += ytd_amount
        entry = _build_account_entry(
            account,
            amount,
            date_begin,
            date_end,
            driver_ids,
            truck_ids,
            trailer_ids,
            dispatcher_ids,
            carrier_id,
        )
        entry["ytd_amount"] = ytd_amount
        revenues.append(entry)

    total_expenses = 0.0
    ytd_total_expenses = 0.0
    expenses: list[dict] = []
    for account in expense_accounts:
        amount = _account_amount(
            date_begin,
            date_end,
            account,
            driver_ids,
            truck_ids,
            trailer_ids,
            dispatcher_ids,
            carrier_id,
        )
        ytd_amount = _account_amount(
            ytd_begin,
            date_end,
            account,
            driver_ids,
            truck_ids,
            trailer_ids,
            dispatcher_ids,
            carrier_id,
        )
        total_expenses += amount
        ytd_total_expenses += ytd_amount
        entry = _build_account_entry(
            account,
            amount,
            date_begin,
            date_end,
            driver_ids,
            truck_ids,
            trailer_ids,
            dispatcher_ids,
            carrier_id,
        )
        entry["ytd_amount"] = ytd_amount
        expenses.append(entry)

    return {
        "carrier_name": carrier_name,
        "date_begin": date_begin,
        "date_end": date_end,
        "ytd_begin": ytd_begin,
        "revenues": revenues,
        "total_revenues": total_revenues,
        "ytd_total_revenues": ytd_total_revenues,
        "expenses": expenses,
        "total_expenses": total_expenses,
        "ytd_total_expenses": ytd_total_expenses,
        "net_profit": total_revenues + total_expenses,
        "ytd_net_profit": ytd_total_revenues + ytd_total_expenses,
    }


# ---------------------------------------------------------------------------
# Report 2: Profit and Loss By Invoices
# ---------------------------------------------------------------------------


def _invoice_load_ids(invoice: DriverInvoice) -> list[int]:
    raw = invoice.load_list.strip()
    if not raw:
        return []
    try:
        return [int(x) for x in raw.split(",") if x.strip()]
    except ValueError:
        return []


def _amount_by_driver_invoice(
    account: Account,
    driver_ids: list[int] | None,
    invoice_ids: list[int],
) -> float:
    total = 0.0
    for inv in DriverInvoice.objects.filter(pk__in=invoice_ids):
        load_ids = _invoice_load_ids(inv)
        if not load_ids:
            continue
        qs = Record.objects.filter(
            account=account, progress=0, load_id__in=load_ids, is_automatic=False
        )
        if driver_ids:
            qs = qs.filter(driver_id__in=driver_ids)
        total += float(qs.aggregate(total=Sum("amount"))["total"] or 0.0)
    return total


def get_invoice_report(
    date_begin: str,
    date_end: str,
    driver_ids: list[int] | None = None,
    invoice_ids: list[int] | None = None,
) -> dict[str, Any]:
    if invoice_ids:
        invoices = DriverInvoice.objects.filter(pk__in=invoice_ids)
    else:
        invoices = DriverInvoice.objects.filter(date__range=[date_begin, date_end])
        if driver_ids:
            invoices = invoices.filter(driver_id__in=driver_ids)

    resolved_invoice_ids = list(invoices.values_list("pk", flat=True))

    invoice_labels = [
        {"id": inv.pk, "number": inv.number} for inv in invoices.order_by("number")
    ]

    revenue_accounts = Account.objects.filter(
        is_main=False, code__startswith="900"
    ).order_by("code")
    expense_accounts = Account.objects.filter(
        is_main=False, code__startswith="800"
    ).order_by("code")

    total_revenues = 0.0
    revenues: list[dict] = []
    for account in revenue_accounts:
        amount = _amount_by_driver_invoice(account, driver_ids, resolved_invoice_ids)
        if amount != 0:
            total_revenues += amount
            entry: dict[str, Any] = {
                "account_code": account.code,
                "account_name": account.name,
                "amount": amount,
                "details": {},
            }
            if driver_ids:
                drivers_map = {
                    d.pk: d.full_name for d in Driver.objects.filter(pk__in=driver_ids)
                }
                entry["details"]["drivers"] = [
                    {
                        "id": d,
                        "name": drivers_map.get(d, ""),
                        "amount": _amount_by_driver_invoice(
                            account, [d], resolved_invoice_ids
                        ),
                    }
                    for d in driver_ids
                ]
            revenues.append(entry)

    total_expenses = 0.0
    expenses: list[dict] = []
    for account in expense_accounts:
        amount = _amount_by_driver_invoice(account, driver_ids, resolved_invoice_ids)
        if amount != 0:
            total_expenses += amount
            entry = {
                "account_code": account.code,
                "account_name": account.name,
                "amount": amount,
                "details": {},
            }
            if driver_ids:
                drivers_map = {
                    d.pk: d.full_name for d in Driver.objects.filter(pk__in=driver_ids)
                }
                entry["details"]["drivers"] = [
                    {
                        "id": d,
                        "name": drivers_map.get(d, ""),
                        "amount": _amount_by_driver_invoice(
                            account, [d], resolved_invoice_ids
                        ),
                    }
                    for d in driver_ids
                ]
            expenses.append(entry)

    return {
        "date_begin": date_begin,
        "date_end": date_end,
        "invoices": invoice_labels,
        "revenues": revenues,
        "total_revenues": total_revenues,
        "expenses": expenses,
        "total_expenses": total_expenses,
        "net_profit": total_revenues + total_expenses,
    }


# ---------------------------------------------------------------------------
# Report 3: IFTA
# ---------------------------------------------------------------------------


def get_ifta_report(date_begin: str, date_end: str) -> dict[str, Any]:
    states = State.objects.all().order_by("name")
    cards = Card.objects.all().order_by("number")

    rows: list[dict] = []
    grand_total = 0.0

    for state in states:
        gallons = float(
            Record.objects.filter(
                city__state=state,
                date__range=[date_begin, date_end],
            ).aggregate(total=Sum("quantity"))["total"]
            or 0.0
        )
        if gallons == 0:
            continue

        grand_total += gallons
        card_details: list[dict] = []
        for card in cards:
            card_gallons = float(
                Record.objects.filter(
                    city__state=state,
                    card=card,
                    date__range=[date_begin, date_end],
                ).aggregate(total=Sum("quantity"))["total"]
                or 0.0
            )
            if card_gallons != 0:
                card_details.append(
                    {"card_number": card.number, "gallons": card_gallons}
                )

        rows.append(
            {
                "state_name": state.name,
                "state_abbreviation": state.abbreviation,
                "gallons": gallons,
                "cards": card_details,
            }
        )

    return {
        "date_begin": date_begin,
        "date_end": date_end,
        "rows": rows,
        "total_gallons": grand_total,
    }


# ---------------------------------------------------------------------------
# Report 4: Tax
# ---------------------------------------------------------------------------


def _driver_tax_amount(
    driver: Driver, date_begin: str, date_end: str, account_code: str
) -> float:
    try:
        account = Account.objects.get(code=account_code)
    except Account.DoesNotExist:
        return 0.0
    return float(
        Record.objects.filter(
            driver=driver,
            account=account,
            progress=0,
            date__range=[date_begin, date_end],
        ).aggregate(total=Sum("amount"))["total"]
        or 0.0
    )


def _driver_notax_amount(driver: Driver, date_begin: str, date_end: str) -> float:
    return float(
        Record.objects.filter(
            driver=driver,
            account__no_tax=True,
            progress=0,
            date__range=[date_begin, date_end],
        ).aggregate(total=Sum("amount"))["total"]
        or 0.0
    )


def get_tax_report(date_begin: str, date_end: str, option: int = 0) -> dict[str, Any]:
    # Drivers (type 4 and 5)
    driver_rows: list[dict] = []
    driver_total_tax = 0.0
    driver_total_revenue = 0.0
    for driver in Driver.objects.filter(
        driver_type_id__in=[_DRIVER_TYPE_SOLO, _DRIVER_TYPE_TEAM]
    ).order_by("last_name", "first_name"):
        tax = _driver_tax_amount(driver, date_begin, date_end, "80050")
        notax = _driver_notax_amount(driver, date_begin, date_end)
        combined = tax + notax
        if combined == 0.0 and driver.status != 1:
            continue
        entry: dict[str, Any] = {
            "id": driver.pk,
            "name": driver.full_name,
            "email": driver.email,
            "address": driver.address,
            "ssn": driver.social_security_number,
            "status": driver.status,
            "tax": combined,
        }
        if option == 1:
            rev = _driver_tax_amount(driver, date_begin, date_end, "90010")
            entry["revenue"] = rev
            driver_total_revenue += rev
        driver_total_tax += combined
        driver_rows.append(entry)

    # Owner Operators (type 3)
    owner_rows: list[dict] = []
    owner_total_tax = 0.0
    owner_total_revenue = 0.0
    for driver in Driver.objects.filter(driver_type_id=_DRIVER_TYPE_OWNER_OP).order_by(
        "last_name", "first_name"
    ):
        tax = _driver_tax_amount(driver, date_begin, date_end, "80085")
        notax = _driver_notax_amount(driver, date_begin, date_end)
        combined = tax + notax
        if combined == 0.0 and driver.status != 1:
            continue
        entry = {
            "id": driver.pk,
            "name": driver.full_name,
            "email": driver.email,
            "address": driver.address,
            "ssn": driver.social_security_number,
            "status": driver.status,
            "tax": combined,
        }
        if option == 1:
            rev = _driver_tax_amount(driver, date_begin, date_end, "90010")
            entry["revenue"] = rev
            owner_total_revenue += rev
        owner_total_tax += combined
        owner_rows.append(entry)

    # Dispatchers
    dispatcher_rows: list[dict] = []
    dispatcher_total_tax = 0.0
    dispatcher_total_revenue = 0.0
    try:
        disp_account = Account.objects.get(code="80052")
    except Account.DoesNotExist:
        disp_account = None

    for user in User.objects.filter(is_dispatcher=True).order_by(
        "last_name", "first_name"
    ):
        if disp_account is None:
            tax = 0.0
        else:
            tax = float(
                Record.objects.filter(
                    dispatcher=user,
                    account=disp_account,
                    progress=0,
                    date__range=[date_begin, date_end],
                ).aggregate(total=Sum("amount"))["total"]
                or 0.0
            )
        if tax == 0.0 and not user.is_active:
            continue
        entry = {
            "id": user.pk,
            "name": f"{user.first_name} {user.last_name}".strip(),
            "email": user.email,
            "address": user.address,
            "ssn": user.social_security_number,
            "is_active": user.is_active,
            "tax": tax,
        }
        if option == 1:
            rev = float(
                Record.objects.filter(
                    dispatcher=user,
                    account__code="90010",
                    progress=0,
                    date__range=[date_begin, date_end],
                ).aggregate(total=Sum("amount"))["total"]
                or 0.0
            )
            entry["revenue"] = rev
            dispatcher_total_revenue += rev
        dispatcher_total_tax += tax
        dispatcher_rows.append(entry)

    result: dict[str, Any] = {
        "date_begin": date_begin,
        "date_end": date_end,
        "option": option,
        "drivers": {
            "rows": driver_rows,
            "total_tax": driver_total_tax,
        },
        "owners": {
            "rows": owner_rows,
            "total_tax": owner_total_tax,
        },
        "dispatchers": {
            "rows": dispatcher_rows,
            "total_tax": dispatcher_total_tax,
        },
    }
    if option == 1:
        result["drivers"]["total_revenue"] = driver_total_revenue
        result["owners"]["total_revenue"] = owner_total_revenue
        result["dispatchers"]["total_revenue"] = dispatcher_total_revenue

    return result


# ---------------------------------------------------------------------------
# Report 5: Category Tracking
# ---------------------------------------------------------------------------


def get_category_tracking_report(
    date_begin: str,
    date_end: str,
    truck_ids: list[int] | None = None,
    trailer_ids: list[int] | None = None,
    category_ids: list[int] | None = None,
    position_ids: list[int] | None = None,
) -> dict[str, Any]:

    qs = (
        Record.objects.select_related(
            "truck",
            "trailer",
            "category",
            "account",
        )
        .filter(follow=1, progress=0, date__range=[date_begin, date_end])
        .order_by("date", "pk")
    )

    if truck_ids:
        qs = qs.filter(truck_id__in=truck_ids)
    if trailer_ids:
        qs = qs.filter(trailer_id__in=trailer_ids)
    if category_ids:
        qs = qs.filter(category_id__in=category_ids)
    if position_ids:
        qs = qs.filter(position__in=position_ids)

    position_map: dict[int, str] = {}
    if qs.exists():
        pos_ids_in_result = set(qs.values_list("position", flat=True))
        pos_ids_in_result.discard(0)
        if pos_ids_in_result:
            for pos in Position.objects.filter(pk__in=pos_ids_in_result):
                position_map[pos.pk] = pos.name

    rows: list[dict] = []
    total_quantity = 0.0
    total_amount = 0.0

    for record in qs:
        quantity = float(record.quantity)
        amount = float(record.amount)
        total_quantity += quantity
        total_amount += amount

        truck_label = (
            f"{record.truck.number} - {record.truck.vin}" if record.truck else "-"
        )
        trailer_label = (
            f"{record.trailer.number} - {record.trailer.vin}" if record.trailer else "-"
        )
        if record.category:
            unit = ""
            if record.category.category_type and hasattr(
                record.category.category_type, "unit_of_measure"
            ):
                unit = record.category.category_type.unit_of_measure
            category_label = f"{record.category.name} - {record.category.code} ({unit})"
        else:
            category_label = "-"
        position_label = (
            position_map.get(record.position, "Not assigned")
            if record.position
            else "Not assigned"
        )
        account_label = (
            f"{record.account.code} {record.account.name}" if record.account else "-"
        )

        rows.append(
            {
                "id": record.pk,
                "date": str(record.date),
                "truck": truck_label,
                "trailer": trailer_label,
                "category": category_label,
                "position": position_label,
                "account": account_label,
                "quantity": quantity,
                "amount": amount,
            }
        )

    return {
        "date_begin": date_begin,
        "date_end": date_end,
        "rows": rows,
        "total_quantity": total_quantity,
        "total_amount": total_amount,
    }


# ---------------------------------------------------------------------------
# Report 6: Broker Summary
# ---------------------------------------------------------------------------


def _broker_revenue(broker: Broker, year_start: str, year_end: str) -> float:
    return float(
        Record.objects.filter(
            load__broker=broker,
            account__code="90010",
            date__range=[year_start, year_end],
        ).aggregate(total=Sum("amount"))["total"]
        or 0.0
    )


def _broker_monthly(broker: Broker, year: int) -> list[dict]:
    months = []
    for month in range(1, 13):
        import calendar

        last_day = calendar.monthrange(year, month)[1]
        m_start = f"{year}-{month:02d}-01"
        m_end = f"{year}-{month:02d}-{last_day:02d}"
        rev = float(
            Record.objects.filter(
                load__broker=broker,
                account__code="90010",
                date__range=[m_start, m_end],
            ).aggregate(total=Sum("amount"))["total"]
            or 0.0
        )
        months.append({"month": month, "revenue": rev})
    return months


def _broker_monthly_loads(broker: Broker, year: int) -> list[dict]:
    import calendar

    months = []
    for month in range(1, 13):
        last_day = calendar.monthrange(year, month)[1]
        m_start = f"{year}-{month:02d}-01"
        m_end = f"{year}-{month:02d}-{last_day:02d}"
        count = Load.objects.filter(
            broker=broker,
            execute=True,
            pickup_date__date__range=[m_start, m_end],
        ).count()
        months.append({"month": month, "deliveries": count})
    return months


def get_broker_summary_report(year: int, option: int = 0) -> dict[str, Any]:
    year_start = f"{year}-01-01"
    year_end = f"{year}-12-31"
    prior_start = f"{year - 1}-01-01"
    prior_end = f"{year - 1}-12-31"

    if option == 0:
        rows: list[dict] = []
        for broker in Broker.objects.filter(status=1).order_by("name"):
            revenue = _broker_revenue(broker, year_start, year_end)
            if revenue == 0.0:
                continue
            prior_revenue = _broker_revenue(broker, prior_start, prior_end)
            rows.append(
                {
                    "id": broker.pk,
                    "name": broker.name,
                    "mc": broker.mc,
                    "revenue": revenue,
                    "prior_revenue": prior_revenue,
                    "monthly": _broker_monthly(broker, year),
                    "monthly_loads": _broker_monthly_loads(broker, year),
                }
            )
        rows.sort(key=lambda r: r["revenue"], reverse=True)
        return {"year": year, "option": option, "brokers": rows}
    else:
        total_revenue = float(
            Record.objects.filter(
                account__code="90010",
                date__range=[year_start, year_end],
            ).aggregate(total=Sum("amount"))["total"]
            or 0.0
        )
        total_prior = float(
            Record.objects.filter(
                account__code="90010",
                date__range=[prior_start, prior_end],
            ).aggregate(total=Sum("amount"))["total"]
            or 0.0
        )
        return {
            "year": year,
            "option": option,
            "total_revenue": total_revenue,
            "total_prior_revenue": total_prior,
        }


# ---------------------------------------------------------------------------
# Report 7: Shipper-Receiver
# ---------------------------------------------------------------------------


def get_shipper_receiver_report(year: int, option: int = 0) -> dict[str, Any]:
    import calendar

    year_start = f"{year}-01-01"
    year_end = f"{year}-12-31"

    from django.db.models import Count as DjCount

    from apps.brokers.models import Business

    pairs_qs = list(
        Load.objects.filter(
            execute=True, pickup_date__date__range=[year_start, year_end]
        )
        .exclude(shipper__isnull=True)
        .exclude(receiver__isnull=True)
        .values("shipper_id", "receiver_id")
        .annotate(total=DjCount("id"))
        .order_by("-total")
    )
    # Exclude pairs where shipper == receiver
    deliveries = [p for p in pairs_qs if p["shipper_id"] != p["receiver_id"]]

    limit = 30 if option == 0 else 10
    top = deliveries[:limit]

    # Resolve names
    all_biz_ids = set()
    for d in top:
        all_biz_ids.add(d["shipper_id"])
        all_biz_ids.add(d["receiver_id"])
    biz_names = {b.pk: b.name for b in Business.objects.filter(pk__in=all_biz_ids)}

    total_deliveries = sum(d["total"] for d in top)

    if option == 0:
        pairs = [
            {
                "shipper": biz_names.get(d["shipper_id"], "Unknown"),
                "receiver": biz_names.get(d["receiver_id"], "Unknown"),
                "total": d["total"],
            }
            for d in top
        ]
        return {
            "year": year,
            "option": option,
            "pairs": pairs,
            "total_deliveries": total_deliveries,
        }
    else:
        # Monthly breakdown for top 10
        pairs_monthly = []
        for d in top:
            monthly = []
            for month in range(1, 13):
                last_day = calendar.monthrange(year, month)[1]
                m_start = f"{year}-{month:02d}-01"
                m_end = f"{year}-{month:02d}-{last_day:02d}"
                cnt = Load.objects.filter(
                    shipper_id=d["shipper_id"],
                    receiver_id=d["receiver_id"],
                    execute=True,
                    pickup_date__date__range=[m_start, m_end],
                ).count()
                monthly.append({"month": month, "count": cnt})
            pairs_monthly.append(
                {
                    "shipper": biz_names.get(d["shipper_id"], "Unknown"),
                    "receiver": biz_names.get(d["receiver_id"], "Unknown"),
                    "total": d["total"],
                    "monthly": monthly,
                }
            )
        return {
            "year": year,
            "option": option,
            "pairs": pairs_monthly,
            "total_deliveries": total_deliveries,
        }
