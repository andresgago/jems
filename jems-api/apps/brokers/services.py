import os
from typing import Any

from django.core.exceptions import ValidationError

from .models import Broker, BrokerContact, Business


def create_broker(*, mc: str, name: str, **kwargs: Any) -> Broker:
    if Broker.objects.filter(mc=mc).exists():
        raise ValidationError(f"Broker with MC '{mc}' already exists.")
    broker = Broker(mc=mc, name=name, **kwargs)
    broker.full_clean()
    broker.save()
    return broker


def update_broker(*, broker: Broker, **kwargs: Any) -> Broker:
    for field, value in kwargs.items():
        setattr(broker, field, value)
    broker.full_clean()
    broker.save()
    return broker


def toggle_broker_status(*, broker: Broker) -> Broker:
    if broker.status == Broker.Status.ACTIVE:
        broker.status = Broker.Status.INACTIVE
    else:
        broker.status = Broker.Status.ACTIVE
    broker.save(update_fields=["status"])
    return broker


def delete_broker(*, broker: Broker) -> None:
    if broker.setup_packet_file:
        try:
            if os.path.isfile(broker.setup_packet_file.path):
                os.remove(broker.setup_packet_file.path)
        except (ValueError, OSError):
            pass
    broker.delete()


BROKER_FILE_SLOTS = {
    "setup-packet": "setup_packet_file",
}


def set_broker_file(*, broker: Broker, slot: str, file: Any) -> Broker:
    field = BROKER_FILE_SLOTS[slot]
    old_file = getattr(broker, field)
    if old_file:
        try:
            if os.path.isfile(old_file.path):
                os.remove(old_file.path)
        except (ValueError, OSError):
            pass
    setattr(broker, field, file)
    broker.save(update_fields=[field])
    return broker


def clear_broker_file(*, broker: Broker, slot: str) -> Broker:
    field = BROKER_FILE_SLOTS[slot]
    current = getattr(broker, field)
    if not current:
        return broker
    try:
        if os.path.isfile(current.path):
            os.remove(current.path)
    except (ValueError, OSError):
        pass
    setattr(broker, field, None)
    broker.save(update_fields=[field])
    return broker


def create_broker_contact(
    *, broker: Broker, name: str, email: str, **kwargs: Any
) -> BrokerContact:
    if BrokerContact.objects.filter(email=email).exists():
        raise ValidationError(f"Contact with email '{email}' already exists.")
    contact = BrokerContact(broker=broker, name=name, email=email, **kwargs)
    contact.full_clean()
    contact.save()
    return contact


def update_broker_contact(*, contact: BrokerContact, **kwargs: Any) -> BrokerContact:
    for field, value in kwargs.items():
        setattr(contact, field, value)
    contact.full_clean()
    contact.save()
    return contact


def delete_broker_contact(*, contact: BrokerContact) -> None:
    contact.delete()


def create_business(*, name: str, **kwargs: Any) -> Business:
    business = Business(name=name, **kwargs)
    business.full_clean()
    business.save()
    return business


def update_business(*, business: Business, **kwargs: Any) -> Business:
    for field, value in kwargs.items():
        setattr(business, field, value)
    business.full_clean()
    business.save()
    return business
