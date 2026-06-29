import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.brokers.models import Broker
from apps.brokers.services import (
    BROKER_FILE_SLOTS,
    clear_broker_file,
    create_broker,
    create_broker_from_status_result,
    create_broker_contact,
    search_brokers_status,
    set_broker_file,
    toggle_broker_status,
    update_broker,
    update_broker_contact,
)
from apps.brokers.tests.factories import BrokerContactFactory, BrokerFactory


@pytest.mark.django_db
class TestCreateBroker:
    def test_creates_broker_with_required_fields(self):
        broker = create_broker(mc="BRK001", name="Test Broker Inc")
        assert broker.pk is not None
        assert broker.status == Broker.Status.INACTIVE

    def test_duplicate_mc_raises(self):
        BrokerFactory(mc="BRKDUP")
        with pytest.raises(ValidationError):
            create_broker(mc="BRKDUP", name="Another Broker")


@pytest.mark.django_db
class TestToggleBrokerStatus:
    def test_active_becomes_inactive(self):
        broker = BrokerFactory(status=Broker.Status.ACTIVE)
        updated = toggle_broker_status(broker=broker)
        assert updated.status == Broker.Status.INACTIVE

    def test_inactive_becomes_active(self):
        broker = BrokerFactory(status=Broker.Status.INACTIVE)
        updated = toggle_broker_status(broker=broker)
        assert updated.status == Broker.Status.ACTIVE


@pytest.mark.django_db
class TestUpdateBroker:
    def test_updates_fields(self):
        broker = BrokerFactory(phone="000-000-0000")
        updated = update_broker(broker=broker, phone="555-444-3333", dba_name="New DBA")
        assert updated.phone == "555-444-3333"
        assert updated.dba_name == "New DBA"


@pytest.mark.django_db
class TestCreateBrokerContact:
    def test_creates_contact_under_broker(self):
        broker = BrokerFactory()
        contact = create_broker_contact(
            broker=broker, name="Jane Doe", email="jane@example.com"
        )
        assert contact.pk is not None
        assert contact.broker == broker

    def test_duplicate_email_raises(self):
        broker = BrokerFactory()
        BrokerContactFactory(email="dup@example.com")
        with pytest.raises(ValidationError):
            create_broker_contact(
                broker=broker, name="Someone", email="dup@example.com"
            )


@pytest.mark.django_db
class TestUpdateBrokerContact:
    def test_updates_contact_phone(self):
        contact = BrokerContactFactory(phone="000-000-0000")
        updated = update_broker_contact(contact=contact, phone="777-888-9999")
        assert updated.phone == "777-888-9999"

    def test_confirmed_and_is_scam_default_false(self):
        contact = BrokerContactFactory()
        assert contact.confirmed is False
        assert contact.is_scam is False

    def test_sets_confirmed_flag(self):
        contact = BrokerContactFactory()
        updated = update_broker_contact(contact=contact, confirmed=True)
        assert updated.confirmed is True


@pytest.mark.django_db
class TestBrokerFileServices:
    def _pdf(self, name: str = "test.pdf") -> SimpleUploadedFile:
        return SimpleUploadedFile(
            name, b"%PDF-1.4 fake", content_type="application/pdf"
        )

    def test_set_file_populates_field(self):
        broker = BrokerFactory()
        broker = set_broker_file(broker=broker, slot="setup-packet", file=self._pdf())
        assert broker.setup_packet_file

    def test_clear_file_removes_field(self):
        broker = BrokerFactory()
        broker = set_broker_file(broker=broker, slot="setup-packet", file=self._pdf())
        broker = clear_broker_file(broker=broker, slot="setup-packet")
        assert not broker.setup_packet_file

    def test_clear_noop_on_empty(self):
        broker = BrokerFactory()
        result = clear_broker_file(broker=broker, slot="setup-packet")
        assert result.pk == broker.pk

    def test_broker_file_slots_constant(self):
        assert "setup-packet" in BROKER_FILE_SLOTS


@pytest.mark.django_db
class TestSearchBrokersStatus:
    def test_returns_matching_brokers_by_name(self):
        BrokerFactory(name="Acme Freight LLC", mc="MC111")
        BrokerFactory(name="Other Corp", mc="MC999")
        results = search_brokers_status(query="Acme")
        assert len(results) == 1
        assert results[0]["name"] == "Acme Freight LLC"

    def test_returns_matching_brokers_by_mc(self):
        BrokerFactory(name="Broker Alpha", mc="MC55500")
        BrokerFactory(name="Broker Beta", mc="MC99900")
        results = search_brokers_status(query="555")
        assert len(results) == 1
        assert results[0]["mc"] == "MC55500"

    def test_returns_both_active_and_inactive(self):
        BrokerFactory(name="Active Broker", mc="MC001", status=Broker.Status.ACTIVE)
        BrokerFactory(
            name="Active Broker Inc", mc="MC002", status=Broker.Status.INACTIVE
        )
        results = search_brokers_status(query="Active Broker")
        assert len(results) == 2

    def test_result_contains_status_fields(self):
        BrokerFactory(
            name="Status Broker",
            mc="MC300",
            buy_status="1",
            debtor_buy_status="Approved For Purchases",
            safer_operating_status="AUTHORIZED",
            factor_company="tafs",
        )
        results = search_brokers_status(query="Status Broker")
        assert len(results) == 1
        r = results[0]
        assert r["debtor_buy_status"] == "Approved For Purchases"
        assert r["safer_operating_status"] == "AUTHORIZED"
        assert r["factor_company"] == "tafs"
        assert r["exists"] is True
        assert r["source"] == "local"

    def test_last_load_is_none_when_broker_has_no_loads(self):
        BrokerFactory(name="No Loads Broker", mc="MC400")
        results = search_brokers_status(query="No Loads Broker")
        assert results[0]["last_load"] is None

    def test_last_load_populated_when_broker_has_loads(self):
        from apps.loads.tests.factories import LoadFactory

        broker = BrokerFactory(name="With Loads Broker", mc="MC500")
        load = LoadFactory(broker=broker, number="LD-99999")
        results = search_brokers_status(query="With Loads Broker")
        assert results[0]["last_load"] is not None
        assert results[0]["last_load"]["number"] == "LD-99999"
        assert results[0]["last_load"]["id"] == load.id
        assert "driver" in results[0]["last_load"]

    def test_empty_query_returns_empty_list(self):
        BrokerFactory(name="Some Broker", mc="MC600")
        results = search_brokers_status(query="ZZZNONEXISTENT")
        assert results == []

    def test_capped_at_20_results(self):
        for i in range(25):
            BrokerFactory(name=f"Cap Broker {i:02d}", mc=f"MCCAP{i:04d}")
        results = search_brokers_status(query="Cap Broker")
        assert len(results) == 20

    def test_external_results_update_existing_broker(self, monkeypatch):
        broker = BrokerFactory(
            name="Existing Broker",
            mc="MC777",
            buy_status="1",
            debtor_buy_status="Old Status",
            factor_account_id="old",
        )
        monkeypatch.setattr(
            "apps.brokers.services.fetch_tafs_broker_statuses",
            lambda *, query: [
                {
                    "mc_number": "MC777",
                    "legal_name": "Existing Broker",
                    "dba_name": "Existing",
                    "account_id": "acct-777",
                    "debtor_buy_status": "No Buy - Denied For Purchases",
                    "debtor_rating": "C",
                    "debtor_credit_limit": "5000",
                    "operating_status": "AUTHORIZED FOR BROKER Property",
                    "phone": "555-0100",
                }
            ],
        )

        results = search_brokers_status(query="Existing")

        broker.refresh_from_db()
        assert len(results) == 1
        assert results[0]["exists"] is True
        assert results[0]["source"] == "tafs"
        assert results[0]["debtor_rating"] == "C"
        assert results[0]["debtor_credit_limit"] == "5000"
        assert broker.factor_account_id == "acct-777"
        assert broker.debtor_buy_status == "No Buy - Denied For Purchases"
        assert broker.buy_status == "0"
        assert broker.checked_at is not None

    def test_external_results_include_missing_broker_without_creating_it(
        self, monkeypatch
    ):
        monkeypatch.setattr(
            "apps.brokers.services.fetch_tafs_broker_statuses",
            lambda *, query: [
                {
                    "mc_number": "MC404",
                    "legal_name": "Missing Broker LLC",
                    "debtor_name": "Missing Broker LLC",
                    "debtor_buy_status": "Approved For Purchases",
                    "operating_status": "ACTIVE",
                }
            ],
        )

        results = search_brokers_status(query="Missing")

        assert len(results) == 1
        assert results[0]["exists"] is False
        assert results[0]["id"] is None
        assert results[0]["mc"] == "MC404"
        assert Broker.objects.filter(mc="MC404").exists() is False


@pytest.mark.django_db
class TestCreateBrokerFromStatusResult:
    def test_creates_inactive_broker_from_external_result(self):
        broker = create_broker_from_status_result(
            data={
                "mc_number": "MCNEW",
                "legal_name": "New Broker LLC",
                "dba_name": "New",
                "phone": "555-0111",
                "account_id": "acct-new",
                "debtor_buy_status": "Approved For Purchases",
                "operating_status": "AUTHORIZED",
            }
        )

        assert broker.mc == "MCNEW"
        assert broker.name == "New Broker LLC"
        assert broker.status == Broker.Status.INACTIVE
        assert broker.factor_company == "tafs"
        assert broker.factor_account_id == "acct-new"
        assert broker.buy_status == "1"
        assert broker.safer_operating_status == "AUTHORIZED"

    def test_denied_status_sets_buy_status_zero(self):
        broker = create_broker_from_status_result(
            data={
                "mc": "MCDENIED",
                "name": "Denied Broker LLC",
                "debtor_buy_status": "No Buy - Denied For Purchases",
            }
        )
        assert broker.buy_status == "0"

    def test_missing_mc_raises_validation_error(self):
        with pytest.raises(ValidationError):
            create_broker_from_status_result(data={"name": "No MC LLC"})

    def test_missing_name_raises_validation_error(self):
        with pytest.raises(ValidationError):
            create_broker_from_status_result(data={"mc": "MCNONAME"})
