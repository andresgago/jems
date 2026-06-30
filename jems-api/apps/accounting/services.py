import re
from typing import Any, Optional

from django.core.exceptions import ValidationError
from django.db.models import Sum

from .models import Account, Category, DriverInvoice, OwnerInvoice, Record

# ── Invoice Analysis ───────────────────────────────────────────────────────────

# Ordered list of (field_name, account_code) for the analysis grid columns.
# Order matches the legacy TMS driver_invoice table column order.
ANALYSIS_ACCOUNT_COLUMNS: list[tuple[str, str]] = [
    ("acc_90010", "90010"),  # I-Rate
    ("acc_90011", "90011"),  # I-Detention
    ("acc_80030", "80030"),  # E-Fuel
    ("acc_80084", "80084"),  # E-Fee
    ("acc_10040", "10040"),  # E-% FDisp
    ("acc_10043", "10043"),  # E-% FDispO
    ("acc_80081", "80081"),  # E-Insurance
    ("acc_80011", "80011"),  # E-Detention
    ("acc_80082", "80082"),  # E-Driver
    ("acc_80080", "80080"),  # E-Toll
    ("acc_80012", "80012"),  # E-Lumper
    ("acc_10042", "10042"),  # E-% FDet
    ("acc_80013", "80013"),  # E-Scale & Wash
    ("acc_80051", "80051"),  # E-Vacation
    ("acc_90030", "90030"),  # E-I-Driver (driver deductions)
    ("acc_80035", "80035"),  # E-Scale
    ("acc_80050", "80050"),  # Driver Payroll
    ("acc_90012", "90012"),  # I-Lumper
    ("acc_80036", "80036"),  # Misc
    ("acc_80056", "80056"),  # BoA Fee (Driver Payment BoA Fee x Transaction)
]

# Account codes that represent income (gross revenue to the company).
_INCOME_CODES = {"90010", "90011", "90012", "90014"}


def parse_load_list(load_list: str) -> list[int]:
    """Parse pipe- or comma-delimited load list into integer IDs."""
    if not load_list:
        return []
    text = load_list.strip("|").strip()
    parts = re.split(r"[|,\s]+", text)
    return [int(p) for p in parts if p.isdigit() and int(p) > 0]


def get_driver_invoice_analysis(
    *,
    date_begin: str,
    date_end: str,
    driver_ids: list[int] | None = None,
    dispatcher_ids: list[int] | None = None,
    carrier_id: int | None = None,
) -> list[dict]:
    """Return one analysis row per DriverInvoice in the date range.

    Each row contains per-account-code aggregated Record amounts so the
    frontend can render the Invoices Analysis grid exactly as the legacy TMS.
    """
    from apps.loads.models import Load  # avoid circular import

    qs = (
        DriverInvoice.objects.select_related("driver", "driver__carrier")
        .filter(date__range=[date_begin, date_end])
        .order_by("-date", "-number")
    )

    if driver_ids:
        qs = qs.filter(driver_id__in=driver_ids)
    if carrier_id:
        qs = qs.filter(driver__carrier_id=carrier_id)

    results = []
    for invoice in qs:
        load_ids = parse_load_list(invoice.load_list)

        loads_qs = (
            Load.objects.filter(id__in=load_ids).select_related("dispatcher")
            if load_ids
            else Load.objects.none()
        )

        # Dispatcher filter: skip invoice if none of its loads match.
        if (
            dispatcher_ids
            and not loads_qs.filter(dispatcher_id__in=dispatcher_ids).exists()
        ):
            continue

        dispatcher_names = ", ".join(
            sorted({ld.dispatcher.full_name for ld in loads_qs if ld.dispatcher})
        )

        # Aggregate record amounts by account code for this invoice's loads.
        account_totals: dict[str, float] = {}
        if load_ids:
            rows = (
                Record.objects.filter(load_id__in=load_ids)
                .values("account__code")
                .annotate(total=Sum("amount"))
            )
            account_totals = {r["account__code"]: float(r["total"]) for r in rows}

        row: dict[str, Any] = {
            "id": invoice.id,
            "number": invoice.number,
            "date": str(invoice.date),
            "driver_name": invoice.driver.full_name if invoice.driver else "",
            "dispatcher_names": dispatcher_names,
            "carrier_name": (
                invoice.driver.carrier.name
                if invoice.driver and invoice.driver.carrier
                else ""
            ),
            "load_count": len(load_ids),
            "status": invoice.status,
        }

        for field_name, code in ANALYSIS_ACCOUNT_COLUMNS:
            row[field_name] = account_totals.get(code, 0.0)

        income = sum(account_totals.get(c, 0.0) for c in _INCOME_CODES)
        expenses = sum(v for c, v in account_totals.items() if c not in _INCOME_CODES)
        row["gross"] = round(income, 2)
        row["net"] = round(income - expenses, 2)

        results.append(row)

    return results


# Seeded driver type IDs — must match apps/locations/management/commands/seed.py DRIVER_TYPES
_DRIVER_TYPE_OWNER_OP = 3  # Owner Operator
_DRIVER_TYPE_SOLO = 4  # Solo Driver
_DRIVER_TYPE_TEAM = 5  # Team Driver

# ── Accounts ──────────────────────────────────────────────────────────────────


def create_account(*, code: str, name: str, **kwargs: Any) -> Account:
    if Account.objects.filter(code=code).exists():
        raise ValidationError(f"Account with code '{code}' already exists.")
    account = Account(code=code, name=name, **kwargs)
    account.full_clean()
    account.save()
    return account


def update_account(*, account: Account, **kwargs: Any) -> Account:
    for field, value in kwargs.items():
        setattr(account, field, value)
    account.full_clean()
    account.save()
    return account


# ── Categories ────────────────────────────────────────────────────────────────


def create_category(*, code: str, name: str, **kwargs: Any) -> Category:
    if Category.objects.filter(code=code).exists():
        raise ValidationError(f"Category with code '{code}' already exists.")
    category = Category(code=code, name=name, **kwargs)
    category.full_clean()
    category.save()
    return category


def update_category(*, category: Category, **kwargs: Any) -> Category:
    for field, value in kwargs.items():
        setattr(category, field, value)
    category.full_clean()
    category.save()
    return category


# ── Records ───────────────────────────────────────────────────────────────────


def create_record(*, date: Any, amount: float, **kwargs: Any) -> Record:
    record = Record(date=date, amount=amount, **kwargs)
    record.full_clean()
    record.save()
    return record


def update_record(*, record: Record, **kwargs: Any) -> Record:
    for field, value in kwargs.items():
        setattr(record, field, value)
    record.full_clean()
    record.save()
    return record


def delete_record(*, record: Record) -> None:
    record.delete()


# ── Driver Invoices ───────────────────────────────────────────────────────────


def create_driver_invoice(*, driver: Any, date: Any, **kwargs: Any) -> DriverInvoice:
    last = (
        DriverInvoice.objects.order_by("-number")
        .values_list("number", flat=True)
        .first()
    )
    number = (last or 0) + 1
    invoice = DriverInvoice(driver=driver, date=date, number=number, **kwargs)
    invoice.full_clean()
    invoice.save()
    return invoice


def update_driver_invoice(*, invoice: DriverInvoice, **kwargs: Any) -> DriverInvoice:
    for field, value in kwargs.items():
        setattr(invoice, field, value)
    invoice.full_clean()
    invoice.save()
    return invoice


def close_driver_invoice(
    *, invoice: DriverInvoice, updated_by: Optional[Any] = None
) -> DriverInvoice:
    if invoice.status == DriverInvoice.Status.CLOSED:
        raise ValueError("Invoice is already closed.")
    invoice.status = DriverInvoice.Status.CLOSED
    if updated_by:
        invoice.updated_by = updated_by
    invoice.save(update_fields=["status", "updated_by"])
    return invoice


def open_driver_invoice(
    *, invoice: DriverInvoice, updated_by: Optional[Any] = None
) -> DriverInvoice:
    invoice.status = DriverInvoice.Status.OPEN
    if updated_by:
        invoice.updated_by = updated_by
    invoice.save(update_fields=["status", "updated_by"])
    return invoice


def delete_driver_invoice(*, invoice: DriverInvoice) -> None:
    invoice.delete()


# ── Owner Invoices ────────────────────────────────────────────────────────────


def create_owner_invoice(*, owner: Any, date: Any, **kwargs: Any) -> OwnerInvoice:
    last = (
        OwnerInvoice.objects.order_by("-number")
        .values_list("number", flat=True)
        .first()
    )
    number = (last or 0) + 1
    invoice = OwnerInvoice(owner=owner, date=date, number=number, **kwargs)
    invoice.full_clean()
    invoice.save()
    return invoice


def update_owner_invoice(*, invoice: OwnerInvoice, **kwargs: Any) -> OwnerInvoice:
    for field, value in kwargs.items():
        setattr(invoice, field, value)
    invoice.full_clean()
    invoice.save()
    return invoice


def close_owner_invoice(
    *, invoice: OwnerInvoice, updated_by: Optional[Any] = None
) -> OwnerInvoice:
    invoice.status = OwnerInvoice.Status.CLOSED
    if updated_by:
        invoice.updated_by = updated_by
    invoice.save(update_fields=["status", "updated_by"])
    return invoice


def open_owner_invoice(
    *, invoice: OwnerInvoice, updated_by: Optional[Any] = None
) -> OwnerInvoice:
    invoice.status = OwnerInvoice.Status.OPEN
    if updated_by:
        invoice.updated_by = updated_by
    invoice.save(update_fields=["status", "updated_by"])
    return invoice


def delete_owner_invoice(*, invoice: OwnerInvoice) -> None:
    invoice.delete()


# ── Load Accounting Records ────────────────────────────────────────────────────


def _account(code: str) -> Account:
    """Fetch account by code; raises ValueError if seed was not run."""
    try:
        return Account.objects.get(code=code)
    except Account.DoesNotExist:
        raise ValueError(f"Account '{code}' not found. Run manage.py seed.")


def _auto_record(
    *,
    load: Any,
    account: Account,
    amount: float,
    driver: Any = None,
    team_driver: Any = None,
) -> Record:
    """Persist one automatic accounting record linked to a load."""
    date = (
        load.dropoff_date.date()
        if hasattr(load.dropoff_date, "date")
        else load.dropoff_date
    )
    record_type = (
        Record.RecordType.INCOME
        if account.code.startswith("9")
        else Record.RecordType.EXPENSE
    )
    record = Record(
        date=date,
        account=account,
        amount=amount,
        load=load,
        truck=load.truck,
        trailer=load.trailer,
        driver=driver,
        team_driver=team_driver,
        is_automatic=True,
        record_type=record_type,
    )
    record.save()
    return record


def create_load_accounting_records(*, load: Any) -> None:
    """Auto-create accounting records when a load is marked as invoiced.

    Mirrors TMS Load::invoiceDriver() logic exactly, preserving the same account
    codes, amounts, and sign conventions per driver type:

      Solo Driver (id=4):
        90010  Income by Rate        = payment
        90011  Income by Detention   = detention            (if detention > 0)
        10040  % Factor dispatch     = detention * factor%  (if detention > 0)
        10040  % Factor dispatch     = payment  * factor%
        90014  Income by Drop Trailer = drop_trailer         (if drop_trailer > 0)
        10041  % Factor dispatch Drop = drop_trailer * factor% (if drop_trailer > 0)

      Owner Operator (id=3):
        90010  Income by Rate        = payment
        10040  % Factor dispatch     = payment  * factor%
        90011  Income by Detention   = -(detention * factor%)  (if detention > 0)
        80011  Expenses by Detention = -(detention - driver portion)  (if detention > 0)
        90014  Income by Drop Trailer = drop_trailer           (if drop_trailer > 0)
        10041  % Factor dispatch Drop = drop_trailer * factor% (if drop_trailer > 0)

      Team Driver (id=5):
        90010  Income by Rate                      = payment           (main driver)
        90011  Income by Detention × 2             = detention each    (if detention > 0)
        10040  % Factor dispatch det × 2           = det * factor%     (if detention > 0)
        10040  % Factor dispatch rate × 2          = payment * factor% (each driver)
        Drop Trailer auto-records are not created; the legacy TMS block is commented out.
    """
    driver = load.driver
    if driver is None:
        return

    driver_type_id = driver.driver_type_id
    factor = driver.factor or 0.0
    payment = float(load.payment)
    detention = float(load.detention)
    drop_trailer = float(load.drop_trailer)

    acct_90010 = _account("90010")
    acct_10040 = _account("10040")

    if driver_type_id == _DRIVER_TYPE_SOLO:
        delete_load_accounting_records(load=load)
        _auto_record(load=load, account=acct_90010, amount=payment, driver=driver)
        if detention > 0:
            acct_90011 = _account("90011")
            _auto_record(load=load, account=acct_90011, amount=detention, driver=driver)
            _auto_record(
                load=load,
                account=acct_10040,
                amount=round(detention * factor / 100, 2),
                driver=driver,
            )
        _auto_record(
            load=load,
            account=acct_10040,
            amount=round(payment * factor / 100, 2),
            driver=driver,
        )
        if drop_trailer > 0:
            acct_90014 = _account("90014")
            acct_10041 = _account("10041")
            _auto_record(
                load=load, account=acct_90014, amount=drop_trailer, driver=driver
            )
            _auto_record(
                load=load,
                account=acct_10041,
                amount=round(drop_trailer * factor / 100, 2),
                driver=driver,
            )

    elif driver_type_id == _DRIVER_TYPE_OWNER_OP:
        if detention > 0:
            acct_90011 = _account("90011")
            acct_80011 = _account("80011")
        delete_load_accounting_records(load=load)
        _auto_record(load=load, account=acct_90010, amount=payment, driver=driver)
        _auto_record(
            load=load,
            account=acct_10040,
            amount=round(payment * factor / 100, 2),
            driver=driver,
        )
        if detention > 0:
            owner_cut = round(detention * factor / 100, 2)
            _auto_record(
                load=load, account=acct_90011, amount=-owner_cut, driver=driver
            )
            _auto_record(
                load=load,
                account=acct_80011,
                amount=-(detention - (-owner_cut)),
                driver=driver,
            )
        if drop_trailer > 0:
            acct_90014 = _account("90014")
            acct_10041 = _account("10041")
            _auto_record(
                load=load, account=acct_90014, amount=drop_trailer, driver=driver
            )
            _auto_record(
                load=load,
                account=acct_10041,
                amount=round(drop_trailer * factor / 100, 2),
                driver=driver,
            )

    elif driver_type_id == _DRIVER_TYPE_TEAM:
        team_driver = load.team_driver
        delete_load_accounting_records(load=load)
        _auto_record(load=load, account=acct_90010, amount=payment, driver=driver)
        if detention > 0:
            acct_90011 = _account("90011")
            _auto_record(load=load, account=acct_90011, amount=detention, driver=driver)
            _auto_record(
                load=load,
                account=acct_10040,
                amount=round(detention * factor / 100, 2),
                driver=driver,
            )
            if team_driver is not None:
                team_factor = team_driver.factor or 0.0
                _auto_record(
                    load=load,
                    account=acct_90011,
                    amount=detention,
                    team_driver=team_driver,
                )
                _auto_record(
                    load=load,
                    account=acct_10040,
                    amount=round(detention * team_factor / 100, 2),
                    team_driver=team_driver,
                )
        _auto_record(
            load=load,
            account=acct_10040,
            amount=round(payment * factor / 100, 2),
            driver=driver,
        )
        if team_driver is not None:
            team_factor = team_driver.factor or 0.0
            _auto_record(
                load=load,
                account=acct_10040,
                amount=round(payment * team_factor / 100, 2),
                team_driver=team_driver,
            )

    else:
        raise ValueError(
            f"Unsupported driver type for load accounting: {driver_type_id}"
        )


def delete_load_accounting_records(*, load: Any) -> None:
    """Delete all auto-created accounting records for a load (called on un-invoice)."""
    Record.objects.filter(load=load, is_automatic=True).delete()
