from __future__ import annotations

import datetime
from calendar import monthrange
import re
from typing import Any

from django.db.models import Count, Q, Sum
from django.db.models.functions import ExtractMonth

from apps.accounting.models import (
    Account,
    Category,
    DriverInvoice,
    Record,
)
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
    return [int(match) for match in re.findall(r"\d+", raw)]


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
    carrier_id: int | None = None,
) -> dict[str, Any]:
    if invoice_ids:
        invoices = DriverInvoice.objects.filter(pk__in=invoice_ids)
    else:
        invoices = DriverInvoice.objects.filter(date__range=[date_begin, date_end])
        if driver_ids:
            invoices = invoices.filter(driver_id__in=driver_ids)
    if carrier_id is not None:
        invoices = invoices.filter(driver__carrier_id=carrier_id)

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
# Report 2a: Balance Sheet
# ---------------------------------------------------------------------------


_BALANCE_SECTIONS = [
    ("current_assets", "Current Assets", "400"),
    ("fixed_assets", "Fixed Assets", "401"),
    ("current_liabilities", "Current Liabilities", "500"),
    ("long_term_liabilities", "Long-Term Liabilities", "501"),
    ("equity", "Equity", "600"),
]


def _parse_date(value: str) -> datetime.date:
    return datetime.date.fromisoformat(value)


def _month_add(value: datetime.date, months: int = 1) -> datetime.date:
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    return datetime.date(year, month, min(value.day, monthrange(year, month)[1]))


def _balance_period_kind(period: str | int | None) -> str:
    value = str(period or "1").lower()
    if value in {"2", "week", "weekly"}:
        return "week"
    return "month"


def _balance_period_key(value: datetime.date, kind: str) -> str:
    if kind == "week":
        start = value - datetime.timedelta(days=value.weekday())
        return start.isoformat()
    return f"{value.year:04d}-{value.month:02d}"


def _balance_period_label(key: str, kind: str, multi_year: bool) -> str:
    if kind == "week":
        start = _parse_date(key)
        end = start + datetime.timedelta(days=6)
        return f"{start.strftime('%b')} {start.day}-{end.strftime('%b')} {end.day}"
    value = _parse_date(f"{key}-01")
    return value.strftime("%b %Y" if multi_year else "%b")


def _balance_columns(date_begin: str, date_end: str, kind: str) -> list[dict[str, Any]]:
    start = _parse_date(date_begin)
    end = _parse_date(date_end)
    columns: list[dict[str, Any]] = []

    if kind == "week":
        current = start - datetime.timedelta(days=start.weekday())
        while current <= end:
            key = current.isoformat()
            columns.append({"key": key, "label": "", "priority": len(columns) + 1})
            current += datetime.timedelta(days=7)
    else:
        current = start.replace(day=1)
        while current <= end:
            key = f"{current.year:04d}-{current.month:02d}"
            columns.append({"key": key, "label": "", "priority": len(columns) + 1})
            current = _month_add(current)

    multi_year = len({col["key"][:4] for col in columns}) > 1
    for col in columns:
        col["label"] = _balance_period_label(col["key"], kind, multi_year)
    return columns


def _blank_amounts(columns: list[dict[str, Any]]) -> dict[str, float]:
    return {col["key"]: 0.0 for col in columns}


def _balance_section_rows(
    date_begin: str,
    date_end: str,
    concept_code: str,
    carrier_id: int | None,
    period_kind: str,
    columns: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    qs = Record.objects.select_related("account", "account__balance_concept").filter(
        progress=0,
        date__range=[date_begin, date_end],
        account__isnull=False,
    )
    if carrier_id is not None:
        qs = qs.filter(carrier_id=carrier_id)

    explicit_records = qs.filter(account__balance_concept__code__contains=concept_code)
    direct_records = qs.filter(
        account__balance_concept__isnull=True,
        account__code__contains=concept_code,
    )

    rows_by_code: dict[str, dict[str, Any]] = {}
    for record in list(explicit_records) + list(direct_records):
        record_account = record.account
        if record_account is None:
            continue
        account = record_account.balance_concept or record_account
        row = rows_by_code.setdefault(
            account.code,
            {
                "code": account.code,
                "name": account.name,
                "amounts": _blank_amounts(columns),
                "total": 0.0,
            },
        )
        key = _balance_period_key(record.date, period_kind)
        if key not in row["amounts"]:
            continue
        amount = float(record.amount or 0.0)
        row["amounts"][key] += amount
        row["total"] += amount

    return sorted(rows_by_code.values(), key=lambda row: row["code"])


def _balance_section(
    key: str,
    title: str,
    concept_code: str,
    date_begin: str,
    date_end: str,
    carrier_id: int | None,
    period_kind: str,
    columns: list[dict[str, Any]],
) -> dict[str, Any]:
    rows = _balance_section_rows(
        date_begin,
        date_end,
        concept_code,
        carrier_id,
        period_kind,
        columns,
    )
    totals = _blank_amounts(columns)
    total = 0.0
    for row in rows:
        total += row["total"]
        for col in columns:
            totals[col["key"]] += row["amounts"].get(col["key"], 0.0)
    return {
        "key": key,
        "title": title,
        "concept_code": concept_code,
        "rows": rows,
        "totals": totals,
        "total": total,
    }


def _combine_balance_totals(
    columns: list[dict[str, Any]], *sections: dict[str, Any]
) -> dict[str, Any]:
    amounts = _blank_amounts(columns)
    total = 0.0
    for section in sections:
        total += section["total"]
        for col in columns:
            amounts[col["key"]] += section["totals"].get(col["key"], 0.0)
    return {"amounts": amounts, "total": total}


def get_balance_sheet_report(
    date_begin: str,
    date_end: str,
    period: str | int | None = "1",
    carrier_id: int | None = None,
) -> dict[str, Any]:
    from apps.carriers.models import Carrier

    carrier_name = ""
    if carrier_id is not None:
        try:
            carrier_name = Carrier.objects.get(pk=carrier_id).name
        except Carrier.DoesNotExist:
            pass

    period_kind = _balance_period_kind(period)
    columns = _balance_columns(date_begin, date_end, period_kind)
    sections = {
        key: _balance_section(
            key,
            title,
            concept_code,
            date_begin,
            date_end,
            carrier_id,
            period_kind,
            columns,
        )
        for key, title, concept_code in _BALANCE_SECTIONS
    }

    total_assets = _combine_balance_totals(
        columns, sections["current_assets"], sections["fixed_assets"]
    )
    total_liabilities = _combine_balance_totals(
        columns,
        sections["current_liabilities"],
        sections["long_term_liabilities"],
    )
    total_liabilities_and_equity = _combine_balance_totals(
        columns,
        sections["current_liabilities"],
        sections["long_term_liabilities"],
        sections["equity"],
    )
    balance = {
        "amounts": {
            col["key"]: total_assets["amounts"][col["key"]]
            - total_liabilities_and_equity["amounts"][col["key"]]
            for col in columns
        },
        "total": total_assets["total"] - total_liabilities_and_equity["total"],
    }

    return {
        "carrier_name": carrier_name,
        "date_begin": date_begin,
        "date_end": date_end,
        "period": period_kind,
        "columns": columns,
        **sections,
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "total_liabilities_and_equity": total_liabilities_and_equity,
        "balance": balance,
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


def get_tax_report(
    date_begin: str,
    date_end: str,
    option: int = 0,
    carrier_id: int | None = None,
) -> dict[str, Any]:
    # Drivers (type 4 — Solo and type 5 — Team)
    driver_qs = Driver.objects.filter(
        driver_type_id__in=[_DRIVER_TYPE_SOLO, _DRIVER_TYPE_TEAM]
    )
    if carrier_id is not None:
        driver_qs = driver_qs.filter(carrier_id=carrier_id)

    driver_rows: list[dict] = []
    driver_total_tax = 0.0
    driver_total_revenue = 0.0
    for driver in driver_qs.order_by("last_name", "first_name"):
        raw_payroll = _driver_tax_amount(driver, date_begin, date_end, "80050")
        notax = _driver_notax_amount(driver, date_begin, date_end)
        combined = raw_payroll + notax
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
            # Revenue = absolute value of what was paid to driver via payroll account
            rev = -raw_payroll
            entry["revenue"] = rev
            driver_total_revenue += rev
        driver_total_tax += combined
        driver_rows.append(entry)

    # Owner Operators (type 3)
    owner_qs = Driver.objects.filter(driver_type_id=_DRIVER_TYPE_OWNER_OP)
    if carrier_id is not None:
        owner_qs = owner_qs.filter(carrier_id=carrier_id)

    owner_rows: list[dict] = []
    owner_total_tax = 0.0
    owner_total_revenue = 0.0
    for driver in owner_qs.order_by("last_name", "first_name"):
        raw_payroll = _driver_tax_amount(driver, date_begin, date_end, "80085")
        notax = _driver_notax_amount(driver, date_begin, date_end)
        combined = raw_payroll + notax
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
            # Revenue = absolute value of what was paid via owner operator payment account
            rev = -raw_payroll
            entry["revenue"] = rev
            owner_total_revenue += rev
        owner_total_tax += combined
        owner_rows.append(entry)

    # Dispatchers (carrier filter does not apply — dispatchers are users, not drivers)
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
            raw_payroll = 0.0
        else:
            raw_payroll = float(
                Record.objects.filter(
                    dispatcher=user,
                    account=disp_account,
                    progress=0,
                    date__range=[date_begin, date_end],
                ).aggregate(total=Sum("amount"))["total"]
                or 0.0
            )
        if raw_payroll == 0.0 and not user.is_active:
            continue
        entry = {
            "id": user.pk,
            "name": f"{user.first_name} {user.last_name}".strip(),
            "email": user.email,
            "address": user.address,
            "ssn": user.social_security_number,
            "is_active": user.is_active,
            "tax": raw_payroll,
        }
        if option == 1:
            # Revenue = absolute value of what was paid via dispatcher payroll account
            rev = -raw_payroll
            entry["revenue"] = rev
            dispatcher_total_revenue += rev
        dispatcher_total_tax += raw_payroll
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
            "category__category_type",
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
            unit = (
                record.category.category_type.unit_of_measure
                if record.category.category_type
                else ""
            )
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


def _broker_records_qs(
    *,
    date_begin: str,
    date_end: str,
    broker: Broker | None = None,
    broker_ids: list[int] | None = None,
    require_broker: bool = True,
):
    qs = Record.objects.filter(
        account__code="90010",
        date__range=[date_begin, date_end],
    )
    if require_broker:
        qs = qs.filter(load__broker__isnull=False)
    if broker is not None:
        qs = qs.filter(load__broker=broker)
    if broker_ids is not None:
        qs = qs.filter(load__broker_id__in=broker_ids)
    return qs


def _broker_revenue(
    *,
    date_begin: str,
    date_end: str,
    broker: Broker | None = None,
    require_broker: bool = True,
) -> float:
    return float(
        _broker_records_qs(
            date_begin=date_begin,
            date_end=date_end,
            broker=broker,
            require_broker=require_broker,
        ).aggregate(total=Sum("amount"))["total"]
        or 0.0
    )


def _broker_deliveries(
    *,
    date_begin: str,
    date_end: str,
    broker: Broker | None = None,
    require_broker: bool = True,
) -> int:
    return _broker_records_qs(
        date_begin=date_begin,
        date_end=date_end,
        broker=broker,
        require_broker=require_broker,
    ).count()


def _broker_monthly_summary_by_broker(
    *,
    year: int,
    broker_ids: list[int],
) -> dict[int, dict[int, dict[str, float | int]]]:
    if not broker_ids:
        return {}

    start = f"{year}-01-01"
    end = f"{year}-12-31"
    rows = (
        _broker_records_qs(
            date_begin=start,
            date_end=end,
            broker_ids=broker_ids,
            require_broker=True,
        )
        .annotate(month=ExtractMonth("date"))
        .values("load__broker_id", "month")
        .annotate(revenue=Sum("amount"), deliveries=Count("id"))
    )

    summary: dict[int, dict[int, dict[str, float | int]]] = {}
    for row in rows:
        broker_id = int(row["load__broker_id"])
        month = int(row["month"])
        summary.setdefault(broker_id, {})[month] = {
            "revenue": float(row["revenue"] or 0.0),
            "deliveries": int(row["deliveries"] or 0),
        }
    return summary


def _broker_total_monthly_summary(
    *,
    year: int,
    require_broker_for_revenue: bool,
    require_broker_for_deliveries: bool,
) -> dict[int, dict[str, float | int]]:
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    revenue_rows = (
        _broker_records_qs(
            date_begin=start,
            date_end=end,
            require_broker=require_broker_for_revenue,
        )
        .annotate(month=ExtractMonth("date"))
        .values("month")
        .annotate(revenue=Sum("amount"))
    )
    delivery_rows = (
        _broker_records_qs(
            date_begin=start,
            date_end=end,
            require_broker=require_broker_for_deliveries,
        )
        .annotate(month=ExtractMonth("date"))
        .values("month")
        .annotate(deliveries=Count("id"))
    )
    summary: dict[int, dict[str, float | int]] = {}
    for row in revenue_rows:
        month = int(row["month"])
        summary.setdefault(month, {})["revenue"] = float(row["revenue"] or 0.0)
    for row in delivery_rows:
        month = int(row["month"])
        summary.setdefault(month, {})["deliveries"] = int(row["deliveries"] or 0)
    return summary


def _monthly_list(
    source: dict[int, dict[str, float | int]],
) -> list[dict[str, float | int]]:
    return [
        {
            "month": month,
            "revenue": float(source.get(month, {}).get("revenue", 0.0)),
            "deliveries": int(source.get(month, {}).get("deliveries", 0)),
        }
        for month in range(1, 13)
    ]


def _report_row_from_months(
    *,
    row_id: int | None,
    name: str,
    mc: str,
    current_months: list[dict[str, float | int]],
    prior_months: list[dict[str, float | int]],
    revenue: float | None = None,
    prior_revenue: float | None = None,
    deliveries: int | None = None,
    prior_deliveries: int | None = None,
) -> dict[str, Any]:
    current_revenue = (
        float(revenue)
        if revenue is not None
        else sum(float(item["revenue"]) for item in current_months)
    )
    prior_revenue_value = (
        float(prior_revenue)
        if prior_revenue is not None
        else sum(float(item["revenue"]) for item in prior_months)
    )
    current_deliveries = (
        int(deliveries)
        if deliveries is not None
        else sum(int(item["deliveries"]) for item in current_months)
    )
    prior_deliveries_value = (
        int(prior_deliveries)
        if prior_deliveries is not None
        else sum(int(item["deliveries"]) for item in prior_months)
    )
    return {
        "id": row_id,
        "name": name,
        "mc": mc,
        "revenue": current_revenue,
        "prior_revenue": prior_revenue_value,
        "deliveries": current_deliveries,
        "prior_deliveries": prior_deliveries_value,
        "monthly": current_months,
        "prior_monthly": prior_months,
        "monthly_loads": [
            {"month": item["month"], "deliveries": item["deliveries"]}
            for item in current_months
        ],
        "prior_monthly_loads": [
            {"month": item["month"], "deliveries": item["deliveries"]}
            for item in prior_months
        ],
    }


def get_broker_summary_report(year: int, option: int = 0) -> dict[str, Any]:
    year_start = f"{year}-01-01"
    year_end = f"{year}-12-31"
    prior_year = year - 1
    prior_start = f"{prior_year}-01-01"
    prior_end = f"{prior_year}-12-31"

    if option == 0:
        rows: list[dict] = []
        brokers = list(Broker.objects.filter(status=1).order_by("name"))
        broker_ids = [broker.pk for broker in brokers]
        current_summary = _broker_monthly_summary_by_broker(
            year=year,
            broker_ids=broker_ids,
        )
        prior_summary = _broker_monthly_summary_by_broker(
            year=prior_year,
            broker_ids=broker_ids,
        )
        for broker in brokers:
            row = _report_row_from_months(
                row_id=broker.pk,
                name=broker.name,
                mc=broker.mc,
                current_months=_monthly_list(current_summary.get(broker.pk, {})),
                prior_months=_monthly_list(prior_summary.get(broker.pk, {})),
            )
            if row["revenue"] == 0.0:
                continue
            rows.append(row)
        rows.sort(key=lambda r: r["revenue"], reverse=True)
        return {
            "year": year,
            "option": option,
            "prior_year": prior_year,
            "brokers": rows,
            "total_revenue": sum(row["revenue"] for row in rows),
            "total_prior_revenue": sum(row["prior_revenue"] for row in rows),
            "total_deliveries": sum(row["deliveries"] for row in rows),
            "total_prior_deliveries": sum(row["prior_deliveries"] for row in rows),
        }

    current_chart_summary = _broker_total_monthly_summary(
        year=year,
        require_broker_for_revenue=True,
        require_broker_for_deliveries=False,
    )
    prior_chart_summary = _broker_total_monthly_summary(
        year=prior_year,
        require_broker_for_revenue=True,
        require_broker_for_deliveries=False,
    )
    total_revenue = _broker_revenue(
        date_begin=year_start,
        date_end=year_end,
        require_broker=False,
    )
    total_prior_revenue = _broker_revenue(
        date_begin=prior_start,
        date_end=prior_end,
        require_broker=False,
    )
    total_deliveries = _broker_deliveries(
        date_begin=year_start,
        date_end=year_end,
        require_broker=False,
    )
    total_prior_deliveries = _broker_deliveries(
        date_begin=prior_start,
        date_end=prior_end,
        require_broker=False,
    )
    total_row = _report_row_from_months(
        row_id=None,
        name="ALL BROKERS",
        mc="",
        current_months=_monthly_list(current_chart_summary),
        prior_months=_monthly_list(prior_chart_summary),
        revenue=total_revenue,
        prior_revenue=total_prior_revenue,
        deliveries=total_deliveries,
        prior_deliveries=total_prior_deliveries,
    )
    return {
        "year": year,
        "option": option,
        "prior_year": prior_year,
        "brokers": [],
        "total": total_row,
        "total_revenue": total_revenue,
        "total_prior_revenue": total_prior_revenue,
        "total_deliveries": total_deliveries,
        "total_prior_deliveries": total_prior_deliveries,
    }


# ---------------------------------------------------------------------------
# Report 7: Shipper-Receiver
# ---------------------------------------------------------------------------


def get_shipper_receiver_report(year: int, option: int = 0) -> dict[str, Any]:
    year_start = f"{year}-01-01"
    year_end = f"{year}-12-31"

    from apps.brokers.models import Business

    base_qs = (
        Load.objects.filter(
            execute=True, pickup_date__date__range=[year_start, year_end]
        )
        .exclude(shipper__isnull=True)
        .exclude(receiver__isnull=True)
    )
    shipper_ids = list(
        base_qs.values_list("shipper_id", flat=True).distinct().order_by("shipper_id")
    )
    receiver_ids = list(
        base_qs.values_list("receiver_id", flat=True).distinct().order_by("receiver_id")
    )
    pair_counts = {
        (row["shipper_id"], row["receiver_id"]): row["total"]
        for row in base_qs.values("shipper_id", "receiver_id").annotate(
            total=Count("id")
        )
    }

    # Legacy parity: PHP builds every distinct shipper x distinct receiver
    # combination for the year, excludes same-business pairs, then sorts by count.
    deliveries = []
    for shipper_id in shipper_ids:
        for receiver_id in receiver_ids:
            if shipper_id == receiver_id:
                continue
            deliveries.append(
                {
                    "shipper_id": shipper_id,
                    "receiver_id": receiver_id,
                    "total": pair_counts.get((shipper_id, receiver_id), 0),
                }
            )
    deliveries.sort(key=lambda row: row["total"], reverse=True)

    limit = 30 if option == 0 else 10
    top = deliveries[:limit]

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
                "monthly": None,
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
                last_day = monthrange(year, month)[1]
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


# ---------------------------------------------------------------------------
# Report 8: Truck Parts and Pieces
# ---------------------------------------------------------------------------

#: Truck part group IDs → which category FK must be non-null
_PART_GROUP_CONDITIONS: dict[int, Q] = {
    1: Q(category__engine_type__isnull=False),
    2: Q(category__cabin_type__isnull=False),
    3: Q(category__transmission_type__isnull=False),
}

TRUCK_PART_GROUPS = {
    1: "Engine Type",
    2: "Cabin Type",
    3: "Transmission Type",
}


def _truck_parts_base_qs(
    date_begin: str,
    date_end: str,
    date_option: int,
    truck_ids: list[int] | None,
    category_type_ids: list[int] | None,
    part_group_ids: list[int] | None,
    category_ids: list[int] | None,
):
    """Return a filtered Record queryset for the truck parts report."""
    qs = Record.objects.select_related(
        "category",
        "category__engine_type",
        "category__cabin_type",
        "category__transmission_type",
        "truck",
    ).filter(truck__isnull=False)

    if date_option != 3:
        qs = qs.filter(date__range=[date_begin, date_end])

    if truck_ids:
        qs = qs.filter(truck_id__in=truck_ids)

    if category_ids:
        qs = qs.filter(category_id__in=category_ids)

    if category_type_ids:
        qs = qs.filter(category__category_type_id__in=category_type_ids)
    else:
        # Mirror legacy: requires category.type > 0
        qs = qs.filter(category__category_type__isnull=False)

    if part_group_ids:
        group_q = Q()
        for gid in part_group_ids:
            if gid in _PART_GROUP_CONDITIONS:
                group_q |= _PART_GROUP_CONDITIONS[gid]
        qs = qs.filter(group_q)

    return qs


def _build_details_label(category: Category | None) -> str:
    if category is None:
        return ""
    parts: list[str] = []
    if category.engine_type_id and category.engine_type:
        parts.append(f"{category.engine_type.name} [Engine]")
    if category.cabin_type_id and category.cabin_type:
        parts.append(f"{category.cabin_type.name} [Cabin]")
    if category.transmission_type_id and category.transmission_type:
        parts.append(f"{category.transmission_type.name} [Transmission]")
    return " | ".join(parts)


def _summary_section(
    qs,
    truck: Truck | None,
) -> dict[str, Any]:
    """Build one summary section (per-truck or all-trucks) for report=1."""
    # Aggregate quantity and spent per distinct category
    agg_rows = (
        qs.values("category_id")
        .annotate(
            total_quantity=Sum("quantity"),
            total_spent=Sum("amount"),
        )
        .order_by("category__name")
    )

    # Load category objects for details
    cat_ids = [r["category_id"] for r in agg_rows if r["category_id"]]
    cat_map: dict[int, Category] = {
        c.pk: c
        for c in Category.objects.select_related(
            "engine_type", "cabin_type", "transmission_type"
        ).filter(pk__in=cat_ids)
    }

    rows: list[dict] = []
    section_qty = 0.0
    section_spent = 0.0

    for no, agg in enumerate(agg_rows, start=1):
        cat = cat_map.get(agg["category_id"])
        qty = float(agg["total_quantity"] or 0)
        spent = -float(agg["total_spent"] or 0)  # amounts are stored as negative
        avg = spent / qty if qty else 0.0
        section_qty += qty
        section_spent += spent
        rows.append(
            {
                "no": no,
                "category_id": agg["category_id"],
                "code": cat.code if cat else "",
                "name": cat.name if cat else "",
                "quantity": qty,
                "spent": spent,
                "average_price": avg,
                "details": _build_details_label(cat),
            }
        )

    return {
        "truck_id": truck.pk if truck else None,
        "truck_label": f"{truck.number} - {truck.vin}" if truck else "All",
        "rows": rows,
        "total_quantity": section_qty,
        "total_spent": section_spent,
        "total_average_price": (section_spent / section_qty) if section_qty else 0.0,
    }


def _listing_section(
    qs,
    truck: Truck | None,
) -> dict[str, Any]:
    """Build one listing section (per-truck or all-trucks) for report=2."""
    records = list(qs.order_by("date", "pk"))

    rows: list[dict] = []
    section_qty = 0.0
    section_spent = 0.0

    for no, record in enumerate(records, start=1):
        cat = record.category
        qty = float(record.quantity)
        spent = -float(record.amount)  # amounts are stored as negative
        section_qty += qty
        section_spent += spent
        rows.append(
            {
                "no": no,
                "date": str(record.date),
                "category_id": cat.pk if cat else None,
                "code": cat.code if cat else "",
                "name": cat.name if cat else "",
                "quantity": qty,
                "amount": spent,
                "detail": record.detail,
                "details": _build_details_label(cat),
            }
        )

    return {
        "truck_id": truck.pk if truck else None,
        "truck_label": f"{truck.number} - {truck.vin}" if truck else "All",
        "rows": rows,
        "total_quantity": section_qty,
        "total_spent": section_spent,
    }


def get_truck_parts_report(
    date_begin: str,
    date_end: str,
    date_option: int = 1,
    truck_ids: list[int] | None = None,
    category_type_ids: list[int] | None = None,
    part_group_ids: list[int] | None = None,
    category_ids: list[int] | None = None,
    report: int = 1,
) -> dict[str, Any]:
    """
    Parts and Pieces Used By Trucks report.

    report=1 → Summary (distinct categories, aggregated qty/spent/avg)
    report=2 → Listing (individual records)

    When truck_ids given → one section per truck.
    When no truck_ids → one combined section for all trucks.
    """
    base_qs = _truck_parts_base_qs(
        date_begin,
        date_end,
        date_option,
        truck_ids,
        category_type_ids,
        part_group_ids,
        category_ids,
    )

    sections: list[dict] = []
    grand_qty = 0.0
    grand_spent = 0.0

    if truck_ids:
        trucks = list(Truck.objects.filter(pk__in=truck_ids).order_by("number"))
        for truck in trucks:
            truck_qs = base_qs.filter(truck_id=truck.pk)
            if report == 2:
                section = _listing_section(truck_qs, truck)
            else:
                section = _summary_section(truck_qs, truck)
            if section["rows"]:
                sections.append(section)
                grand_qty += section["total_quantity"]
                grand_spent += section["total_spent"]
    else:
        if report == 2:
            section = _listing_section(base_qs, None)
        else:
            section = _summary_section(base_qs, None)
        if section["rows"]:
            sections.append(section)
            grand_qty = section["total_quantity"]
            grand_spent = section["total_spent"]

    return {
        "date_begin": date_begin,
        "date_end": date_end,
        "date_option": date_option,
        "report": report,
        "sections": sections,
        "grand_total_quantity": grand_qty,
        "grand_total_spent": grand_spent,
    }
