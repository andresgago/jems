import datetime

import pytest
from django.core.exceptions import ValidationError

from apps.accounting.models import Account, Category, DriverInvoice, OwnerInvoice, Record
from apps.accounting.services import (
    close_driver_invoice,
    close_owner_invoice,
    create_account,
    create_category,
    create_driver_invoice,
    create_owner_invoice,
    create_record,
    delete_record,
    open_driver_invoice,
    update_account,
    update_record,
)
from apps.accounting.tests.factories import (
    AccountFactory,
    CategoryFactory,
    DriverFactory,
    DriverInvoiceFactory,
    TruckOwnerFactory,
    TruckOwnerInvoiceFactory,
)


@pytest.mark.django_db
class TestCreateAccount:
    def test_creates_with_code_and_name(self):
        account = create_account(code="90010", name="Freight Income")
        assert account.pk is not None
        assert account.is_active is True

    def test_duplicate_code_raises(self):
        AccountFactory(code="80030")
        with pytest.raises(ValidationError):
            create_account(code="80030", name="Another")


@pytest.mark.django_db
class TestUpdateAccount:
    def test_updates_name(self):
        account = AccountFactory(name="Old Name")
        updated = update_account(account=account, name="New Name")
        assert updated.name == "New Name"


@pytest.mark.django_db
class TestCreateCategory:
    def test_creates_category(self):
        category = create_category(code="FUEL001", name="Fuel")
        assert category.pk is not None

    def test_duplicate_code_raises(self):
        CategoryFactory(code="OIL001")
        with pytest.raises(ValidationError):
            create_category(code="OIL001", name="Oil Change")


@pytest.mark.django_db
class TestCreateRecord:
    def test_creates_record(self):
        account = AccountFactory()
        record = create_record(date=datetime.date.today(), amount=250.0, account=account)
        assert record.pk is not None
        assert record.amount == 250.0

    def test_updates_record_amount(self):
        record = create_record(date=datetime.date.today(), amount=100.0)
        updated = update_record(record=record, amount=999.0)
        assert updated.amount == 999.0

    def test_deletes_record(self):
        record = create_record(date=datetime.date.today(), amount=50.0)
        pk = record.pk
        delete_record(record=record)
        assert not Record.objects.filter(pk=pk).exists()


@pytest.mark.django_db
class TestDriverInvoice:
    def test_creates_with_auto_number(self):
        driver = DriverFactory()
        invoice = create_driver_invoice(driver=driver, date=datetime.date.today(), percent=25.0)
        assert invoice.pk is not None
        assert invoice.number >= 1
        assert invoice.status == DriverInvoice.Status.OPEN

    def test_sequential_numbers(self):
        driver = DriverFactory()
        inv1 = create_driver_invoice(driver=driver, date=datetime.date.today())
        inv2 = create_driver_invoice(driver=driver, date=datetime.date.today())
        assert inv2.number == inv1.number + 1

    def test_close_invoice(self):
        invoice = DriverInvoiceFactory(status=DriverInvoice.Status.OPEN)
        updated = close_driver_invoice(invoice=invoice)
        assert updated.status == DriverInvoice.Status.CLOSED

    def test_open_invoice(self):
        invoice = DriverInvoiceFactory(status=DriverInvoice.Status.CLOSED)
        updated = open_driver_invoice(invoice=invoice)
        assert updated.status == DriverInvoice.Status.OPEN


@pytest.mark.django_db
class TestOwnerInvoice:
    def test_creates_with_auto_number(self):
        owner = TruckOwnerFactory()
        invoice = create_owner_invoice(owner=owner, date=datetime.date.today(), percent=80.0)
        assert invoice.pk is not None
        assert invoice.number >= 1
        assert invoice.status == OwnerInvoice.Status.OPEN

    def test_close_invoice(self):
        invoice = TruckOwnerInvoiceFactory(status=OwnerInvoice.Status.OPEN)
        updated = close_owner_invoice(invoice=invoice)
        assert updated.status == OwnerInvoice.Status.CLOSED
