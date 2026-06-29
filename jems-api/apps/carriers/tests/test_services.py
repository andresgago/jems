import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.carriers.services import (
    create_carrier,
    get_carrier_available_files,
    resolve_carrier_packet_recipients,
    send_carrier_packet,
    toggle_carrier_status,
    update_carrier,
)
from apps.carriers.tests.factories import CarrierFactory
from apps.brokers.tests.factories import BrokerContactFactory, BrokerFactory


@pytest.mark.django_db
class TestCreateCarrier:
    def test_creates_carrier_with_required_fields(self):
        carrier = create_carrier(
            mc="MC123456", dot_number="DOT123456", name="Test Carrier"
        )
        assert carrier.pk is not None
        assert carrier.mc == "MC123456"
        assert carrier.active is False

    def test_duplicate_mc_raises(self):
        CarrierFactory(mc="MC_DUP")
        with pytest.raises(ValidationError):
            create_carrier(mc="MC_DUP", dot_number="DOT999999", name="Another")

    def test_duplicate_dot_raises(self):
        CarrierFactory(dot_number="DOT_DUP")
        with pytest.raises(ValidationError):
            create_carrier(mc="MC999999", dot_number="DOT_DUP", name="Another")


@pytest.mark.django_db
class TestToggleCarrierStatus:
    def test_inactive_becomes_active(self):
        carrier = CarrierFactory(active=False)
        updated = toggle_carrier_status(carrier=carrier)
        assert updated.active is True

    def test_active_becomes_inactive(self):
        carrier = CarrierFactory(active=True)
        updated = toggle_carrier_status(carrier=carrier)
        assert updated.active is False


@pytest.mark.django_db
class TestUpdateCarrier:
    def test_updates_fields(self):
        carrier = CarrierFactory(phone="111-000-0000")
        updated = update_carrier(
            carrier=carrier, phone="999-888-7777", dba_name="New DBA"
        )
        assert updated.phone == "999-888-7777"
        assert updated.dba_name == "New DBA"


@pytest.mark.django_db
class TestGetCarrierAvailableFiles:
    def test_returns_empty_when_no_files(self):
        carrier = CarrierFactory()
        result = get_carrier_available_files(carrier=carrier)
        assert result == []

    def test_returns_slot_for_uploaded_file(self, tmp_path):
        fake = SimpleUploadedFile("w9.pdf", b"data", content_type="application/pdf")
        carrier = CarrierFactory(w9_file=fake)
        result = get_carrier_available_files(carrier=carrier)
        slots = [r["slot"] for r in result]
        assert "w9_file" in slots

    def test_returns_label(self, tmp_path):
        fake = SimpleUploadedFile("coi.pdf", b"data", content_type="application/pdf")
        carrier = CarrierFactory(coi_file=fake)
        result = get_carrier_available_files(carrier=carrier)
        labels = [r["label"] for r in result]
        assert "COI" in labels

    def test_returns_only_uploaded_slots(self, tmp_path):
        fake = SimpleUploadedFile("noa.pdf", b"data", content_type="application/pdf")
        carrier = CarrierFactory(noa_file=fake)
        result = get_carrier_available_files(carrier=carrier)
        assert len(result) == 1
        assert result[0]["slot"] == "noa_file"

    def test_ignores_database_value_when_file_is_missing_from_storage(self):
        fake = SimpleUploadedFile("w9.pdf", b"data", content_type="application/pdf")
        carrier = CarrierFactory(w9_file=fake)
        carrier.w9_file.storage.delete(carrier.w9_file.name)

        result = get_carrier_available_files(carrier=carrier)

        assert result == []
        assert not carrier.w9_file.storage.exists(carrier.w9_file.name)


@pytest.mark.django_db
class TestResolveCarrierPacketRecipients:
    def test_uses_manual_email_when_no_contacts_selected(self):
        result = resolve_carrier_packet_recipients(broker_email=" broker@test.com ")
        assert result == ["broker@test.com"]

    def test_resolves_selected_broker_contacts(self):
        broker = BrokerFactory()
        contact_1 = BrokerContactFactory(broker=broker, email="one@test.com")
        contact_2 = BrokerContactFactory(broker=broker, email="two@test.com")

        result = resolve_carrier_packet_recipients(
            broker_id=broker.id,
            contact_ids=[contact_1.id, contact_2.id],
            broker_email="",
        )

        assert result == ["one@test.com", "two@test.com"]

    def test_combines_manual_email_and_contacts_without_duplicates(self):
        broker = BrokerFactory()
        contact = BrokerContactFactory(broker=broker, email="broker@test.com")

        result = resolve_carrier_packet_recipients(
            broker_id=broker.id,
            contact_ids=[contact.id],
            broker_email="broker@test.com",
        )

        assert result == ["broker@test.com"]

    def test_rejects_contact_that_does_not_belong_to_selected_broker(self):
        broker = BrokerFactory()
        other_contact = BrokerContactFactory(email="other@test.com")

        with pytest.raises(ValidationError, match="not found for selected broker"):
            resolve_carrier_packet_recipients(
                broker_id=broker.id,
                contact_ids=[other_contact.id],
                broker_email="",
            )

    def test_rejects_empty_recipients(self):
        with pytest.raises(ValidationError, match="Select at least one"):
            resolve_carrier_packet_recipients()


@pytest.mark.django_db
class TestSendCarrierPacket:
    def test_raises_if_no_no_reply_email(self):
        carrier = CarrierFactory(no_reply_email=None)
        with pytest.raises(ValidationError, match="no outgoing email"):
            send_carrier_packet(
                carrier=carrier,
                broker_email="broker@test.com",
                file_slots=["w9_file"],
            )

    def test_raises_if_no_file_slots(self):
        carrier = CarrierFactory(no_reply_email="noreply@carrier.com")
        with pytest.raises(ValidationError, match="At least one file"):
            send_carrier_packet(
                carrier=carrier,
                broker_email="broker@test.com",
                file_slots=[],
            )

    def test_raises_if_invalid_slot(self):
        carrier = CarrierFactory(no_reply_email="noreply@carrier.com")
        with pytest.raises(ValidationError, match="Unknown file slot"):
            send_carrier_packet(
                carrier=carrier,
                broker_email="broker@test.com",
                file_slots=["invalid_slot"],
            )

    def test_raises_if_slot_has_no_file(self):
        carrier = CarrierFactory(no_reply_email="noreply@carrier.com")
        with pytest.raises(ValidationError, match="No file uploaded for slot"):
            send_carrier_packet(
                carrier=carrier,
                broker_email="broker@test.com",
                file_slots=["w9_file"],
            )

    def test_raises_if_selected_file_is_missing_from_storage(self):
        fake = SimpleUploadedFile("w9.pdf", b"content", content_type="application/pdf")
        carrier = CarrierFactory(
            no_reply_email="noreply@carrier.com",
            no_reply_password="pass",
            w9_file=fake,
        )
        carrier.w9_file.storage.delete(carrier.w9_file.name)

        with pytest.raises(ValidationError, match="missing from storage"):
            send_carrier_packet(
                carrier=carrier,
                broker_email="broker@test.com",
                file_slots=["w9_file"],
            )

    def test_sends_email_with_legacy_headers_and_attachments(self, tmp_path):
        fake = SimpleUploadedFile("w9.pdf", b"content", content_type="application/pdf")
        carrier = CarrierFactory(
            no_reply_email="noreply@carrier.com",
            no_reply_password="pass",
            cc_email="carrier-cc@test.com",
            w9_file=fake,
        )
        from unittest.mock import patch

        with patch("apps.carriers.services.get_connection") as mock_conn, patch(
            "apps.carriers.services.EmailMessage"
        ) as mock_message:
            mock_msg = mock_message.return_value

            send_carrier_packet(
                carrier=carrier,
                broker_email="broker@test.com",
                file_slots=["w9_file"],
                bcc_email="current-user@test.com",
            )

        mock_conn.assert_called_once()
        mock_message.assert_called_once()
        kwargs = mock_message.call_args.kwargs
        assert kwargs["subject"] == f"{carrier.name} Files Packet"
        assert kwargs["from_email"] == f"{carrier.name} <{carrier.no_reply_email}>"
        assert kwargs["to"] == ["broker@test.com"]
        assert kwargs["bcc"] == ["current-user@test.com"]
        assert "cc" not in kwargs
        mock_msg.attach_file.assert_called_once_with(carrier.w9_file.path)
        mock_msg.send.assert_called_once()

    def test_sends_email_to_multiple_resolved_recipients(self):
        fake = SimpleUploadedFile("w9.pdf", b"content", content_type="application/pdf")
        carrier = CarrierFactory(
            no_reply_email="noreply@carrier.com",
            no_reply_password="pass",
            w9_file=fake,
        )
        from unittest.mock import patch

        with patch("apps.carriers.services.get_connection"), patch(
            "apps.carriers.services.EmailMessage"
        ) as mock_message:
            send_carrier_packet(
                carrier=carrier,
                recipient_emails=["one@test.com", "two@test.com"],
                file_slots=["w9_file"],
            )

        assert mock_message.call_args.kwargs["to"] == ["one@test.com", "two@test.com"]
