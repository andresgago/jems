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
        if _has_existing_packet_file(file_field):
            result.append({"slot": slot, "label": label})
    return result


def _has_existing_packet_file(file_field: Any) -> bool:
    if not file_field:
        return False
    try:
        return bool(file_field.name) and file_field.storage.exists(file_field.name)
    except (OSError, ValueError):
        return False


def resolve_carrier_packet_recipients(
    *,
    broker_id: int | None = None,
    contact_ids: list[int] | None = None,
    broker_email: str = "",
) -> list[str]:
    """Resolve Send Packet recipients from selected broker contacts plus fallback email."""
    recipients: list[str] = []

    cleaned_email = broker_email.strip()
    if cleaned_email:
        recipients.append(cleaned_email)

    selected_contact_ids = contact_ids or []
    if selected_contact_ids:
        from apps.brokers.models import BrokerContact

        if broker_id is None:
            raise ValidationError("Select a broker before choosing broker contacts.")

        contacts = list(
            BrokerContact.objects.filter(
                broker_id=broker_id,
                id__in=selected_contact_ids,
            ).order_by("email")
        )
        found_ids = {contact.id for contact in contacts}
        missing_ids = [
            contact_id
            for contact_id in selected_contact_ids
            if contact_id not in found_ids
        ]
        if missing_ids:
            raise ValidationError(
                "Broker contact(s) not found for selected broker: "
                f"{', '.join(str(contact_id) for contact_id in missing_ids)}."
            )
        recipients.extend(contact.email for contact in contacts)

    unique_recipients = list(dict.fromkeys(recipients))
    if not unique_recipients:
        raise ValidationError("Select at least one broker contact or enter an email.")
    return unique_recipients


def send_carrier_packet(
    *,
    carrier: Carrier,
    file_slots: list[str],
    recipient_emails: list[str] | None = None,
    broker_email: str = "",
    bcc_email: str | None = None,
) -> None:
    """Email selected carrier files to the broker email address.

    Raises ValidationError if the carrier has no no_reply_email configured
    or if any requested slot is unknown / has no file.
    """
    if not carrier.no_reply_email:
        raise ValidationError(
            f"Carrier '{carrier.name}' has no outgoing email address configured."
        )
    recipients = recipient_emails or ([broker_email.strip()] if broker_email else [])
    recipients = list(dict.fromkeys(email for email in recipients if email))
    if not recipients:
        raise ValidationError("Select at least one broker contact or enter an email.")
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
        if not _has_existing_packet_file(file_field):
            raise ValidationError(f"File for slot '{slot}' is missing from storage.")
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

    msg = EmailMessage(
        subject=f"{carrier.name} Files Packet",
        body=body,
        from_email=f"{carrier.name} <{carrier.no_reply_email}>",
        to=recipients,
        bcc=[bcc_email] if bcc_email else [],
        connection=connection,
    )
    msg.content_subtype = "html"

    for label, path in attachments:
        msg.attach_file(path)

    msg.send()
