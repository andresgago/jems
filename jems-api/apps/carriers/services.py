from typing import Any

from django.core.exceptions import ValidationError
from django.core.mail import EmailMessage, get_connection
from django.template.loader import render_to_string
from django.utils import timezone

from .models import Carrier

# Maps slot name → (model field, human label) — order matches the legacy form
PACKET_FILE_SLOTS: dict[str, tuple[str, str]] = {
    "w9_file": ("w9_file", "W9"),
    "noa_file": ("noa_file", "NOA"),
    "coi_file": ("coi_file", "COI"),
    "mcc_file": ("mcc_file", "MCC"),
    "safety_letter_file": ("safety_letter_file", "Safety Letter"),
    "last_inspection_file": ("last_inspection_file", "Last Inspection"),
}


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


def get_carrier_available_files(*, carrier: Carrier) -> list[dict[str, str]]:
    """Return the packet file slots that have an uploaded file for this carrier."""
    result = []
    for slot, (field, label) in PACKET_FILE_SLOTS.items():
        file_field = getattr(carrier, field)
        if file_field:
            result.append({"slot": slot, "label": label})
    return result


def send_carrier_packet(
    *,
    carrier: Carrier,
    broker_email: str,
    file_slots: list[str],
) -> None:
    """Email selected carrier files to the broker email address.

    Raises ValidationError if the carrier has no no_reply_email configured
    or if any requested slot is unknown / has no file.
    """
    if not carrier.no_reply_email:
        raise ValidationError(
            f"Carrier '{carrier.name}' has no outgoing email address configured."
        )
    if not file_slots:
        raise ValidationError("At least one file must be selected.")

    invalid = [s for s in file_slots if s not in PACKET_FILE_SLOTS]
    if invalid:
        raise ValidationError(f"Unknown file slot(s): {invalid}")

    # Collect file paths for the selected slots
    attachments: list[tuple[str, str]] = []  # (label, path)
    for slot in file_slots:
        field, label = PACKET_FILE_SLOTS[slot]
        file_field = getattr(carrier, field)
        if not file_field:
            raise ValidationError(f"No file uploaded for slot '{slot}'.")
        attachments.append((label, file_field.path))

    hour = timezone.localtime(timezone.now()).hour
    if hour < 12:
        greeting = "Good morning,"
    elif hour < 17:
        greeting = "Good afternoon,"
    else:
        greeting = "Good evening,"

    body = render_to_string(
        "carriers/packet_email.html",
        {
            "greeting": greeting,
            "carrier_name": carrier.name,
            "carrier_mc": carrier.mc,
            "carrier_dot": carrier.dot_number,
        },
    )

    connection = get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend",
        host="smtp.gmail.com",
        port=587,
        username=carrier.no_reply_email,
        password=carrier.no_reply_password,
        use_tls=True,
        fail_silently=False,
    )

    cc = [carrier.cc_email] if carrier.cc_email else []

    msg = EmailMessage(
        subject=f"{carrier.name} Files Packet",
        body=body,
        from_email=f"{carrier.name} <{carrier.no_reply_email}>",
        to=[broker_email],
        cc=cc,
        connection=connection,
    )
    msg.content_subtype = "html"

    for label, path in attachments:
        msg.attach_file(path)

    msg.send()
