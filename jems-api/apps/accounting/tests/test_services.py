import datetime

import pytest
from django.core.exceptions import ValidationError

from apps.accounting.models import (
    Account,
    DriverInvoice,
    OwnerInvoice,
    Record,
)
from apps.accounting.services import (
    bulk_delete_categories,
    close_driver_invoice,
    close_owner_invoice,
    create_account,
    create_category,
    create_driver_invoice,
    create_load_accounting_records,
    create_owner_invoice,
    create_record,
    delete_category,
    delete_load_accounting_records,
    delete_record,
    get_driver_invoice_analysis,
    open_driver_invoice,
    parse_load_list,
    toggle_category_status,
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
    UserFactory,
)
from apps.drivers.models import Driver, DriverType
from apps.loads.tests.factories import LoadFactory

# ── Fixtures for load accounting tests ────────────────────────────────────────


@pytest.fixture
def load_accounts(db):
    """Seed the account codes used by create_load_accounting_records."""
    codes = {
        "90010": "Income by Rate",
        "90011": "Income by Detention",
        "10040": "% Factor dispatch by load",
        "80011": "Expenses By Detention",
        "90014": "Income by Drop Trailer",
        "10041": "% Factor dispatch by Drop Trailer",
    }
    return {
        code: Account.objects.get_or_create(code=code, defaults={"name": name})[0]
        for code, name in codes.items()
    }


@pytest.fixture
def solo_driver_type(db):
    dt, _ = DriverType.objects.get_or_create(
        id=4, defaults={"name": "Solo Driver", "is_active": True}
    )
    return dt


@pytest.fixture
def owner_op_driver_type(db):
    dt, _ = DriverType.objects.get_or_create(
        id=3, defaults={"name": "Owner Operator", "is_active": True}
    )
    return dt


@pytest.fixture
def team_driver_type(db):
    dt, _ = DriverType.objects.get_or_create(
        id=5, defaults={"name": "Team Driver", "is_active": True}
    )
    return dt


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
class TestDeleteCategory:
    def test_deletes_category_without_records(self):
        cat = CategoryFactory()
        pk = cat.pk
        delete_category(category=cat)
        from apps.accounting.models import Category

        assert not Category.objects.filter(pk=pk).exists()

    def test_raises_if_records_exist(self):
        import datetime

        cat = CategoryFactory()
        from apps.accounting.tests.factories import RecordFactory

        RecordFactory(category=cat, date=datetime.date.today())
        with pytest.raises(ValueError, match="linked records"):
            delete_category(category=cat)


@pytest.mark.django_db
class TestToggleCategoryStatus:
    def test_toggles_active_to_inactive(self):
        cat = CategoryFactory(is_active=True)
        result = toggle_category_status(category=cat)
        assert result.is_active is False

    def test_toggles_inactive_to_active(self):
        cat = CategoryFactory(is_active=False)
        result = toggle_category_status(category=cat)
        assert result.is_active is True

    def test_toggle_twice_returns_original(self):
        cat = CategoryFactory(is_active=True)
        toggle_category_status(category=cat)
        cat.refresh_from_db()
        result = toggle_category_status(category=cat)
        assert result.is_active is True


@pytest.mark.django_db
class TestBulkDeleteCategories:
    def test_deletes_all_without_records(self):
        cats = CategoryFactory.create_batch(3)
        ids = [c.pk for c in cats]
        result = bulk_delete_categories(ids=ids)
        assert set(result["deleted"]) == set(ids)
        assert result["blocked"] == []

    def test_partial_success_when_some_have_records(self):
        import datetime

        from apps.accounting.tests.factories import RecordFactory

        cat_ok = CategoryFactory()
        cat_blocked = CategoryFactory()
        RecordFactory(category=cat_blocked, date=datetime.date.today())
        result = bulk_delete_categories(ids=[cat_ok.pk, cat_blocked.pk])
        assert cat_ok.pk in result["deleted"]
        assert cat_blocked.pk in result["blocked"]

    def test_ignores_nonexistent_ids(self):
        result = bulk_delete_categories(ids=[99998, 99999])
        assert result["deleted"] == []
        assert result["blocked"] == []

    def test_empty_list(self):
        result = bulk_delete_categories(ids=[])
        assert result["deleted"] == []
        assert result["blocked"] == []


@pytest.mark.django_db
class TestCreateRecord:
    def test_creates_record(self):
        account = AccountFactory()
        record = create_record(
            date=datetime.date.today(), amount=250.0, account=account
        )
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
        invoice = create_driver_invoice(
            driver=driver, date=datetime.date.today(), percent=25.0
        )
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
        invoice = create_owner_invoice(
            owner=owner, date=datetime.date.today(), percent=80.0
        )
        assert invoice.pk is not None
        assert invoice.number >= 1
        assert invoice.status == OwnerInvoice.Status.OPEN

    def test_close_invoice(self):
        invoice = TruckOwnerInvoiceFactory(status=OwnerInvoice.Status.OPEN)
        updated = close_owner_invoice(invoice=invoice)
        assert updated.status == OwnerInvoice.Status.CLOSED


# ── Load Accounting Records ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCreateLoadAccountingRecords:
    def _make_driver(self, driver_type, factor=25.0):
        return Driver.objects.create(
            first_name="Test",
            last_name="Driver",
            driver_type=driver_type,
            factor=factor,
            status=Driver.Status.ACTIVE,
        )

    # ── Solo Driver ───────────────────────────────────────────────────────────

    def test_solo_no_detention_creates_rate_and_dispatch(
        self, load_accounts, solo_driver_type
    ):
        driver = self._make_driver(solo_driver_type, factor=25.0)
        load = LoadFactory(driver=driver, payment=2000.0, detention=0.0)

        create_load_accounting_records(load=load)

        records = Record.objects.filter(load=load, is_automatic=True)
        assert records.count() == 2
        codes = set(records.values_list("account__code", flat=True))
        assert codes == {"90010", "10040"}

    def test_solo_with_detention_creates_four_records(
        self, load_accounts, solo_driver_type
    ):
        driver = self._make_driver(solo_driver_type, factor=25.0)
        load = LoadFactory(driver=driver, payment=2000.0, detention=200.0)

        create_load_accounting_records(load=load)

        records = Record.objects.filter(load=load, is_automatic=True)
        assert records.count() == 4

    def test_solo_detention_amounts(self, load_accounts, solo_driver_type):
        driver = self._make_driver(solo_driver_type, factor=25.0)
        load = LoadFactory(driver=driver, payment=2000.0, detention=200.0)

        create_load_accounting_records(load=load)

        by_code = {
            r.account.code: r.amount
            for r in Record.objects.filter(load=load, is_automatic=True)
        }
        assert by_code["90010"] == 2000.0  # full rate
        assert by_code["90011"] == 200.0  # full detention income
        # Two 10040 records: detention cut (50) + rate cut (500)
        cuts = sorted(
            Record.objects.filter(
                load=load, is_automatic=True, account__code="10040"
            ).values_list("amount", flat=True)
        )
        assert cuts == [50.0, 500.0]

    def test_solo_with_drop_trailer_creates_income_and_dispatch(
        self, load_accounts, solo_driver_type
    ):
        driver = self._make_driver(solo_driver_type, factor=25.0)
        load = LoadFactory(
            driver=driver, payment=2000.0, detention=0.0, drop_trailer=300.0
        )

        create_load_accounting_records(load=load)

        assert sorted(
            Record.objects.filter(load=load, is_automatic=True).values_list(
                "account__code", "amount"
            )
        ) == [
            ("10040", 500.0),
            ("10041", 75.0),
            ("90010", 2000.0),
            ("90014", 300.0),
        ]

    def test_recreating_records_does_not_duplicate_existing_automatic_records(
        self, load_accounts, solo_driver_type
    ):
        driver = self._make_driver(solo_driver_type, factor=25.0)
        load = LoadFactory(driver=driver, payment=2000.0, detention=200.0)

        create_load_accounting_records(load=load)
        create_load_accounting_records(load=load)

        records = Record.objects.filter(load=load, is_automatic=True)
        assert records.count() == 4
        assert sorted(records.values_list("account__code", "amount")) == [
            ("10040", 50.0),
            ("10040", 500.0),
            ("90010", 2000.0),
            ("90011", 200.0),
        ]

    def test_solo_all_records_linked_to_driver(self, load_accounts, solo_driver_type):
        driver = self._make_driver(solo_driver_type, factor=30.0)
        load = LoadFactory(driver=driver, payment=1000.0, detention=0.0)

        create_load_accounting_records(load=load)

        for r in Record.objects.filter(load=load, is_automatic=True):
            assert r.driver_id == driver.pk

    # ── Owner Operator ────────────────────────────────────────────────────────

    def test_owner_op_no_detention(self, load_accounts, owner_op_driver_type):
        driver = self._make_driver(owner_op_driver_type, factor=70.0)
        load = LoadFactory(driver=driver, payment=3000.0, detention=0.0)

        create_load_accounting_records(load=load)

        records = Record.objects.filter(load=load, is_automatic=True)
        assert records.count() == 2
        codes = set(records.values_list("account__code", flat=True))
        assert codes == {"90010", "10040"}

    def test_owner_op_detention_negative_amounts(
        self, load_accounts, owner_op_driver_type
    ):
        # Mirrors TMS legacy: $_detention=-140, expenses=-(200 - -140).
        driver = self._make_driver(owner_op_driver_type, factor=70.0)
        load = LoadFactory(driver=driver, payment=3000.0, detention=200.0)

        create_load_accounting_records(load=load)

        records = Record.objects.filter(load=load, is_automatic=True)
        assert records.count() == 4

        det_income = Record.objects.get(
            load=load, is_automatic=True, account__code="90011"
        )
        det_expense = Record.objects.get(
            load=load, is_automatic=True, account__code="80011"
        )
        assert det_income.amount == -140.0  # negative: passes through to owner
        assert det_expense.amount == -340.0

    def test_owner_op_with_drop_trailer_creates_income_and_dispatch(
        self, load_accounts, owner_op_driver_type
    ):
        driver = self._make_driver(owner_op_driver_type, factor=70.0)
        load = LoadFactory(
            driver=driver, payment=3000.0, detention=0.0, drop_trailer=400.0
        )

        create_load_accounting_records(load=load)

        assert sorted(
            Record.objects.filter(load=load, is_automatic=True).values_list(
                "account__code", "amount"
            )
        ) == [
            ("10040", 2100.0),
            ("10041", 280.0),
            ("90010", 3000.0),
            ("90014", 400.0),
        ]

    # ── Team Driver ───────────────────────────────────────────────────────────

    def test_team_driver_no_detention(self, load_accounts, team_driver_type):
        driver = self._make_driver(team_driver_type, factor=20.0)
        team = self._make_driver(team_driver_type, factor=20.0)
        load = LoadFactory(
            driver=driver, team_driver=team, payment=2000.0, detention=0.0
        )

        create_load_accounting_records(load=load)

        records = Record.objects.filter(load=load, is_automatic=True)
        # 90010 (main) + 10040 (main rate) + 10040 (team rate) = 3
        assert records.count() == 3

    def test_team_driver_drop_trailer_does_not_create_drop_records(
        self, load_accounts, team_driver_type
    ):
        driver = self._make_driver(team_driver_type, factor=20.0)
        team = self._make_driver(team_driver_type, factor=20.0)
        load = LoadFactory(
            driver=driver,
            team_driver=team,
            payment=2000.0,
            detention=0.0,
            drop_trailer=300.0,
        )

        create_load_accounting_records(load=load)

        records = Record.objects.filter(load=load, is_automatic=True)
        assert records.count() == 3
        assert not records.filter(account__code__in=["90014", "10041"]).exists()

    def test_team_driver_with_detention(self, load_accounts, team_driver_type):
        # detention $100, factor 20% each
        driver = self._make_driver(team_driver_type, factor=20.0)
        team = self._make_driver(team_driver_type, factor=20.0)
        load = LoadFactory(
            driver=driver, team_driver=team, payment=2000.0, detention=100.0
        )

        create_load_accounting_records(load=load)

        records = Record.objects.filter(load=load, is_automatic=True)
        # 90010 + 90011 (main) + 10040 (main det) + 90011 (team) + 10040 (team det) + 10040 (main rate) + 10040 (team rate) = 7
        assert records.count() == 7

        det_records = records.filter(account__code="90011")
        assert det_records.count() == 2
        for r in det_records:
            assert r.amount == 100.0

    def test_no_driver_creates_no_records(self, load_accounts):
        load = LoadFactory(driver=None, payment=1000.0, detention=50.0)

        create_load_accounting_records(load=load)

        assert not Record.objects.filter(load=load, is_automatic=True).exists()

    def test_unknown_driver_type_raises(self, load_accounts):
        driver_type = DriverType.objects.create(name="Unknown", is_active=True)
        driver = self._make_driver(driver_type, factor=25.0)
        load = LoadFactory(driver=driver, payment=1000.0, detention=50.0)

        with pytest.raises(ValueError, match="Unsupported driver type"):
            create_load_accounting_records(load=load)

        assert not Record.objects.filter(load=load, is_automatic=True).exists()

    # ── Delete ────────────────────────────────────────────────────────────────

    def test_delete_removes_only_automatic_records(
        self, load_accounts, solo_driver_type
    ):
        driver = self._make_driver(solo_driver_type, factor=25.0)
        load = LoadFactory(driver=driver, payment=1500.0, detention=100.0)

        create_load_accounting_records(load=load)
        manual = AccountFactory(code="99999", name="Manual")
        Record.objects.create(
            date=datetime.date.today(),
            account=manual,
            amount=999.0,
            load=load,
            is_automatic=False,
        )

        delete_load_accounting_records(load=load)

        remaining = Record.objects.filter(load=load)
        assert remaining.count() == 1
        assert remaining.first().is_automatic is False


# ── parse_load_list ───────────────────────────────────────────────────────────


class TestParseLoadList:
    def test_empty_string(self):
        assert parse_load_list("") == []

    def test_pipe_delimited(self):
        assert parse_load_list("|123|456|789|") == [123, 456, 789]

    def test_comma_delimited(self):
        assert parse_load_list("123,456,789") == [123, 456, 789]

    def test_single_id(self):
        assert parse_load_list("42") == [42]

    def test_mixed_separators(self):
        assert parse_load_list("|100|200,300|") == [100, 200, 300]

    def test_ignores_zeros(self):
        assert parse_load_list("|0|5|0|") == [5]

    def test_strips_whitespace(self):
        assert parse_load_list(" 10 , 20 ") == [10, 20]


# ── get_driver_invoice_analysis ───────────────────────────────────────────────


@pytest.mark.django_db
class TestGetDriverInvoiceAnalysis:
    TODAY = datetime.date.today()
    DATE_BEGIN = str(TODAY)
    DATE_END = str(TODAY)

    def _make_account(self, code: str, name: str) -> Account:
        acct, _ = Account.objects.get_or_create(code=code, defaults={"name": name})
        return acct

    def test_returns_invoice_in_date_range(self):
        inv = DriverInvoiceFactory(date=self.TODAY)
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN, date_end=self.DATE_END
        )
        assert any(r["id"] == inv.id for r in rows)

    def test_excludes_invoice_outside_date_range(self):
        yesterday = self.TODAY - datetime.timedelta(days=5)
        inv = DriverInvoiceFactory(date=yesterday)
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN, date_end=self.DATE_END
        )
        assert not any(r["id"] == inv.id for r in rows)

    def test_row_has_required_fields(self):
        DriverInvoiceFactory(date=self.TODAY)
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN, date_end=self.DATE_END
        )
        assert len(rows) >= 1
        row = rows[0]
        for key in (
            "id",
            "number",
            "date",
            "driver_name",
            "carrier_name",
            "dispatcher_names",
            "load_count",
            "gross",
            "net",
            "acc_90010",
            "acc_90011",
            "acc_80030",
        ):
            assert key in row, f"Missing field: {key}"

    def test_aggregates_record_amounts_by_account(self, db):
        acct = self._make_account("90010", "Income by Rate")
        inv = DriverInvoiceFactory(date=self.TODAY, load_list="")
        load = LoadFactory(payment=1000.0)
        inv.load_list = str(load.id)
        inv.save()
        Record.objects.create(
            date=self.TODAY,
            account=acct,
            amount=1000.0,
            load=load,
            is_automatic=True,
        )
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN, date_end=self.DATE_END
        )
        row = next(r for r in rows if r["id"] == inv.id)
        assert row["acc_90010"] == 1000.0

    def test_gross_sums_income_accounts(self, db):
        acct_rate = self._make_account("90010", "Income by Rate")
        acct_det = self._make_account("90011", "Income by Detention")
        inv = DriverInvoiceFactory(date=self.TODAY, load_list="")
        load = LoadFactory(payment=500.0)
        inv.load_list = str(load.id)
        inv.save()
        Record.objects.create(
            date=self.TODAY,
            account=acct_rate,
            amount=500.0,
            load=load,
            is_automatic=True,
        )
        Record.objects.create(
            date=self.TODAY,
            account=acct_det,
            amount=100.0,
            load=load,
            is_automatic=True,
        )
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN, date_end=self.DATE_END
        )
        row = next(r for r in rows if r["id"] == inv.id)
        assert row["gross"] == 600.0

    def test_net_subtracts_expenses(self, db):
        acct_rate = self._make_account("90010", "Income by Rate")
        acct_fuel = self._make_account("80030", "Fuel")
        inv = DriverInvoiceFactory(date=self.TODAY, load_list="")
        load = LoadFactory(payment=1000.0)
        inv.load_list = str(load.id)
        inv.save()
        Record.objects.create(
            date=self.TODAY,
            account=acct_rate,
            amount=1000.0,
            load=load,
            is_automatic=True,
        )
        Record.objects.create(
            date=self.TODAY,
            account=acct_fuel,
            amount=200.0,
            load=load,
            is_automatic=True,
        )
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN, date_end=self.DATE_END
        )
        row = next(r for r in rows if r["id"] == inv.id)
        assert row["net"] == 800.0

    def test_load_count_from_load_list(self):
        load1 = LoadFactory()
        load2 = LoadFactory()
        inv = DriverInvoiceFactory(
            date=self.TODAY, load_list=f"|{load1.id}|{load2.id}|"
        )
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN, date_end=self.DATE_END
        )
        row = next(r for r in rows if r["id"] == inv.id)
        assert row["load_count"] == 2

    def test_filters_by_driver(self):
        driver_a = DriverFactory()
        driver_b = DriverFactory()
        inv_a = DriverInvoiceFactory(date=self.TODAY, driver=driver_a)
        inv_b = DriverInvoiceFactory(date=self.TODAY, driver=driver_b)
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN,
            date_end=self.DATE_END,
            driver_ids=[driver_a.id],
        )
        ids = [r["id"] for r in rows]
        assert inv_a.id in ids
        assert inv_b.id not in ids

    def test_filters_by_carrier(self):
        from apps.loads.tests.factories import CarrierFactory

        carrier_a = CarrierFactory()
        carrier_b = CarrierFactory()
        driver_a = DriverFactory(carrier=carrier_a)
        driver_b = DriverFactory(carrier=carrier_b)
        inv_a = DriverInvoiceFactory(date=self.TODAY, driver=driver_a)
        inv_b = DriverInvoiceFactory(date=self.TODAY, driver=driver_b)
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN,
            date_end=self.DATE_END,
            carrier_id=carrier_a.id,
        )
        ids = [r["id"] for r in rows]
        assert inv_a.id in ids
        assert inv_b.id not in ids

    def test_filters_by_dispatcher(self):
        disp_a = UserFactory()
        disp_b = UserFactory()
        inv = DriverInvoiceFactory(date=self.TODAY, load_list="")
        load_a = LoadFactory(dispatcher=disp_a)
        load_b = LoadFactory(dispatcher=disp_b)
        inv.load_list = f"|{load_a.id}|"
        inv.save()
        inv_no_match = DriverInvoiceFactory(date=self.TODAY, load_list=f"|{load_b.id}|")
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN,
            date_end=self.DATE_END,
            dispatcher_ids=[disp_a.id],
        )
        ids = [r["id"] for r in rows]
        assert inv.id in ids
        assert inv_no_match.id not in ids

    def test_empty_load_list_returns_zero_amounts(self):
        inv = DriverInvoiceFactory(date=self.TODAY, load_list="")
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN, date_end=self.DATE_END
        )
        row = next(r for r in rows if r["id"] == inv.id)
        assert row["acc_90010"] == 0.0
        assert row["gross"] == 0.0
        assert row["net"] == 0.0
        assert row["load_count"] == 0

    def test_carrier_name_from_driver(self):
        from apps.loads.tests.factories import CarrierFactory

        carrier = CarrierFactory(name="ACME Transport LLC")
        driver = DriverFactory(carrier=carrier)
        inv = DriverInvoiceFactory(date=self.TODAY, driver=driver)
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN, date_end=self.DATE_END
        )
        row = next(r for r in rows if r["id"] == inv.id)
        assert row["carrier_name"] == "ACME Transport LLC"

    def test_dispatcher_names_from_loads(self):
        disp = UserFactory(first_name="Jorge", last_name="Silveira")
        inv = DriverInvoiceFactory(date=self.TODAY, load_list="")
        load = LoadFactory(dispatcher=disp)
        inv.load_list = str(load.id)
        inv.save()
        rows = get_driver_invoice_analysis(
            date_begin=self.DATE_BEGIN, date_end=self.DATE_END
        )
        row = next(r for r in rows if r["id"] == inv.id)
        assert "Jorge Silveira" in row["dispatcher_names"]
