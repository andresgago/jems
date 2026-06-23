from typing import Any, Optional

from django.core.exceptions import ValidationError

from .models import Account, Category, DriverInvoice, OwnerInvoice, Record

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

      Owner Operator (id=3):
        90010  Income by Rate        = payment
        10040  % Factor dispatch     = payment  * factor%
        90011  Income by Detention   = -(detention * factor%)  (if detention > 0)
        80011  Expenses by Detention = -(detention - driver portion)  (if detention > 0)

      Team Driver (id=5):
        90010  Income by Rate                      = payment           (main driver)
        90011  Income by Detention × 2             = detention each    (if detention > 0)
        10040  % Factor dispatch det × 2           = det * factor%     (if detention > 0)
        10040  % Factor dispatch rate × 2          = payment * factor% (each driver)
    """
    driver = load.driver
    if driver is None:
        return

    driver_type_id = driver.driver_type_id
    factor = driver.factor or 0.0
    payment = float(load.payment)
    detention = float(load.detention)

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
