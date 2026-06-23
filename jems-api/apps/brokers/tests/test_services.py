import pytest
from django.core.exceptions import ValidationError

from apps.brokers.models import Broker, BrokerContact
from apps.brokers.services import (
    create_broker,
    create_broker_contact,
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
        contact = create_broker_contact(broker=broker, name="Jane Doe", email="jane@example.com")
        assert contact.pk is not None
        assert contact.broker == broker

    def test_duplicate_email_raises(self):
        broker = BrokerFactory()
        BrokerContactFactory(email="dup@example.com")
        with pytest.raises(ValidationError):
            create_broker_contact(broker=broker, name="Someone", email="dup@example.com")


@pytest.mark.django_db
class TestUpdateBrokerContact:
    def test_updates_contact_phone(self):
        contact = BrokerContactFactory(phone="000-000-0000")
        updated = update_broker_contact(contact=contact, phone="777-888-9999")
        assert updated.phone == "777-888-9999"
