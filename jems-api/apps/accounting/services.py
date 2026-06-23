from typing import Any, Optional

from django.core.exceptions import ValidationError

from .models import Account, Category, CategoryType, DriverInvoice, OwnerInvoice, Record


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
    last = DriverInvoice.objects.order_by("-number").values_list("number", flat=True).first()
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


def close_driver_invoice(*, invoice: DriverInvoice, updated_by: Optional[Any] = None) -> DriverInvoice:
    if invoice.status == DriverInvoice.Status.CLOSED:
        raise ValueError("Invoice is already closed.")
    invoice.status = DriverInvoice.Status.CLOSED
    if updated_by:
        invoice.updated_by = updated_by
    invoice.save(update_fields=["status", "updated_by"])
    return invoice


def open_driver_invoice(*, invoice: DriverInvoice, updated_by: Optional[Any] = None) -> DriverInvoice:
    invoice.status = DriverInvoice.Status.OPEN
    if updated_by:
        invoice.updated_by = updated_by
    invoice.save(update_fields=["status", "updated_by"])
    return invoice


def delete_driver_invoice(*, invoice: DriverInvoice) -> None:
    invoice.delete()


# ── Owner Invoices ────────────────────────────────────────────────────────────


def create_owner_invoice(*, owner: Any, date: Any, **kwargs: Any) -> OwnerInvoice:
    last = OwnerInvoice.objects.order_by("-number").values_list("number", flat=True).first()
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


def close_owner_invoice(*, invoice: OwnerInvoice, updated_by: Optional[Any] = None) -> OwnerInvoice:
    invoice.status = OwnerInvoice.Status.CLOSED
    if updated_by:
        invoice.updated_by = updated_by
    invoice.save(update_fields=["status", "updated_by"])
    return invoice


def open_owner_invoice(*, invoice: OwnerInvoice, updated_by: Optional[Any] = None) -> OwnerInvoice:
    invoice.status = OwnerInvoice.Status.OPEN
    if updated_by:
        invoice.updated_by = updated_by
    invoice.save(update_fields=["status", "updated_by"])
    return invoice


def delete_owner_invoice(*, invoice: OwnerInvoice) -> None:
    invoice.delete()
