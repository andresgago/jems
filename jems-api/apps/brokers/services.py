import os
import json
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone

from .models import Broker, BrokerContact, Business


def create_broker(*, mc: str, name: str, **kwargs: Any) -> Broker:
    if Broker.objects.filter(mc=mc).exists():
        raise ValidationError(f"Broker with MC '{mc}' already exists.")
    broker = Broker(mc=mc, name=name, **kwargs)
    broker.full_clean()
    broker.save()
    return broker


def _bool_buy_status(debtor_buy_status: str) -> str:
    return "0" if debtor_buy_status == "No Buy - Denied For Purchases" else "1"


def _clean_status_value(value: Any) -> str:
    return str(value or "").strip()


def fetch_tafs_broker_statuses(*, query: str) -> list[dict[str, Any]]:
    """
    Call the same local TAFS search endpoint used by legacy PHP when configured.

    The legacy controller expected a JSON payload with a top-level ``brokers`` list.
    Failures are treated as no external results so the page can still use local data.
    """
    base_url = getattr(settings, "TAFS_SEARCH_BROKER_URL", "")
    if not base_url:
        return []

    url = base_url.rstrip("/") + "/" + quote(query.strip())
    request = Request(url, headers={"Content-Type": "application/json"})
    timeout = getattr(settings, "TAFS_SEARCH_TIMEOUT_SECONDS", 5.0)
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return []

    brokers = payload.get("brokers", [])
    return brokers if isinstance(brokers, list) else []


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


def _last_load_data(broker: Broker) -> dict[str, Any] | None:
    from apps.loads.models import Load

    last_load = (
        Load.objects.filter(broker=broker)
        .select_related(
            "pickup_city__state",
            "dropoff_city__state",
            "driver",
            "truck",
            "trailer",
        )
        .order_by("-pickup_date")
        .first()
    )

    if last_load is None:
        return None

    return {
        "id": last_load.id,
        "number": last_load.number,
        "pickup_city": str(last_load.pickup_city) if last_load.pickup_city else "",
        "dropoff_city": str(last_load.dropoff_city) if last_load.dropoff_city else "",
        "payment": str(last_load.payment),
        "pickup_date": (
            last_load.pickup_date.isoformat() if last_load.pickup_date else None
        ),
        "dropoff_date": (
            last_load.dropoff_date.isoformat() if last_load.dropoff_date else None
        ),
        "driver": last_load.driver.full_name if last_load.driver else "",
        "truck": last_load.truck.number if last_load.truck else "",
        "trailer": last_load.trailer.number if last_load.trailer else "",
    }


def _local_broker_status_result(broker: Broker) -> dict[str, Any]:
    return {
        "id": broker.id,
        "broker_id": broker.id,
        "mc": broker.mc,
        "mc_number": broker.mc,
        "name": broker.name,
        "legal_name": broker.name,
        "debtor_name": broker.name,
        "dba_name": broker.dba_name,
        "phone": broker.phone,
        "status": broker.status,
        "exists": True,
        "source": "local",
        "buy_status": broker.buy_status,
        "debtor_buy_status": broker.debtor_buy_status,
        "debtor_rating": "",
        "debtor_credit_limit": "",
        "safer_operating_status": broker.safer_operating_status,
        "operating_status": broker.safer_operating_status,
        "factor_company": broker.factor_company,
        "factor_account_id": broker.factor_account_id,
        "checked_at": broker.checked_at.isoformat() if broker.checked_at else None,
        "last_load": _last_load_data(broker),
    }


def _sync_broker_from_tafs(
    *, broker: Broker, external: dict[str, Any], today: Any
) -> Broker:
    debtor_buy_status = _clean_status_value(external.get("debtor_buy_status"))
    broker.factor_company = "tafs"
    broker.factor_account_id = _clean_status_value(external.get("account_id"))[:255]
    broker.debtor_buy_status = debtor_buy_status[:100]
    broker.buy_status = _bool_buy_status(debtor_buy_status)
    broker.checked_at = today

    operating_status = _clean_status_value(
        external.get("operating_status") or external.get("safer_operating_status")
    )
    if operating_status:
        broker.safer_operating_status = operating_status[:100]
    broker.save(
        update_fields=[
            "factor_company",
            "factor_account_id",
            "debtor_buy_status",
            "buy_status",
            "checked_at",
            "safer_operating_status",
        ]
    )
    return broker


def _external_broker_status_result(
    *, external: dict[str, Any], broker: Broker | None, today: Any
) -> dict[str, Any]:
    if broker is not None:
        broker = _sync_broker_from_tafs(broker=broker, external=external, today=today)

    mc = _clean_status_value(external.get("mc_number") or external.get("mc"))
    legal_name = _clean_status_value(
        external.get("legal_name")
        or external.get("debtor_name")
        or external.get("name")
    )
    debtor_name = _clean_status_value(external.get("debtor_name") or legal_name)
    dba_name = _clean_status_value(external.get("dba_name"))
    debtor_buy_status = _clean_status_value(external.get("debtor_buy_status"))
    operating_status = _clean_status_value(
        external.get("operating_status") or external.get("safer_operating_status")
    )

    return {
        "id": broker.id if broker else None,
        "broker_id": broker.id if broker else None,
        "mc": mc,
        "mc_number": mc,
        "name": legal_name or debtor_name,
        "legal_name": legal_name,
        "debtor_name": debtor_name or legal_name,
        "dba_name": dba_name,
        "phone": _clean_status_value(external.get("phone")),
        "status": broker.status if broker else Broker.Status.INACTIVE,
        "exists": broker is not None,
        "source": "tafs",
        "buy_status": (
            broker.buy_status if broker else _bool_buy_status(debtor_buy_status)
        ),
        "debtor_buy_status": debtor_buy_status,
        "debtor_rating": _clean_status_value(external.get("debtor_rating")),
        "debtor_credit_limit": _clean_status_value(external.get("debtor_credit_limit")),
        "safer_operating_status": operating_status,
        "operating_status": operating_status,
        "factor_company": "tafs",
        "factor_account_id": _clean_status_value(external.get("account_id")),
        "checked_at": today.isoformat() if broker else None,
        "last_load": _last_load_data(broker) if broker else None,
    }


def search_brokers_status(*, query: str) -> list[dict[str, Any]]:
    """
    Match the legacy Brokers status behavior.

    Prefer the configured TAFS search endpoint, update matching local brokers by
    MC, and fall back to stored local broker status data when external search is
    unavailable.
    """
    query = query.strip()
    external_brokers = fetch_tafs_broker_statuses(query=query)
    today = timezone.localdate()

    if external_brokers:
        mcs = [
            _clean_status_value(item.get("mc_number") or item.get("mc"))
            for item in external_brokers
        ]
        brokers_by_mc = {
            broker.mc: broker
            for broker in Broker.objects.filter(mc__in=[mc for mc in mcs if mc])
        }
        return [
            _external_broker_status_result(
                external=item,
                broker=brokers_by_mc.get(
                    _clean_status_value(item.get("mc_number") or item.get("mc"))
                ),
                today=today,
            )
            for item in external_brokers
        ]

    brokers = Broker.objects.filter(
        Q(name__icontains=query) | Q(mc__icontains=query) | Q(dba_name__icontains=query)
    ).order_by("name")[:20]

    return [_local_broker_status_result(broker) for broker in brokers]


def create_broker_from_status_result(
    *, data: dict[str, Any], user: Any = None
) -> Broker:
    mc = _clean_status_value(data.get("mc") or data.get("mc_number"))
    name = _clean_status_value(
        data.get("legal_name") or data.get("name") or data.get("debtor_name")
    )
    if not mc:
        raise ValidationError("MC number is required.")
    if not name:
        raise ValidationError("Broker legal name is required.")

    debtor_buy_status = _clean_status_value(data.get("debtor_buy_status"))[:100]
    kwargs = {
        "dba_name": _clean_status_value(data.get("dba_name"))[:255],
        "phone": _clean_status_value(data.get("phone"))[:255],
        "status": Broker.Status.INACTIVE,
        "factor_company": _clean_status_value(data.get("factor_company") or "tafs")[
            :255
        ],
        "factor_account_id": _clean_status_value(
            data.get("factor_account_id") or data.get("account_id")
        )[:255],
        "debtor_buy_status": debtor_buy_status,
        "buy_status": _bool_buy_status(debtor_buy_status),
        "safer_operating_status": _clean_status_value(
            data.get("safer_operating_status") or data.get("operating_status")
        )[:100],
        "checked_at": timezone.localdate() if debtor_buy_status else None,
    }
    if user is not None and getattr(user, "is_authenticated", False):
        kwargs["created_by"] = user
    return create_broker(mc=mc[:60], name=name[:255], **kwargs)


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
