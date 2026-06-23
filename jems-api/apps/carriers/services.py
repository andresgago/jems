from typing import Any

from django.core.exceptions import ValidationError

from .models import Carrier


def create_carrier(*, mc: str, dot_number: str, name: str, **kwargs: Any) -> Carrier:
    if Carrier.objects.filter(mc=mc).exists():
        raise ValidationError(f"Carrier with MC '{mc}' already exists.")
    if Carrier.objects.filter(dot_number=dot_number).exists():
        raise ValidationError(f"Carrier with DOT number '{dot_number}' already exists.")
    carrier = Carrier(mc=mc, dot_number=dot_number, name=name, **kwargs)
    carrier.full_clean()
    carrier.save()
    return carrier


def update_carrier(*, carrier: Carrier, **kwargs: Any) -> Carrier:
    for field, value in kwargs.items():
        setattr(carrier, field, value)
    carrier.full_clean()
    carrier.save()
    return carrier


def toggle_carrier_status(*, carrier: Carrier) -> Carrier:
    carrier.active = not carrier.active
    carrier.save(update_fields=["active"])
    return carrier


def delete_carrier(*, carrier: Carrier) -> None:
    carrier.delete()
