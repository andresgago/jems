import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.carriers.services import (
    create_carrier,
    get_carrier_available_files,
    send_carrier_packet,
    toggle_carrier_status,
    update_carrier,
)
from apps.carriers.tests.factories import CarrierFactory


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

    def test_sends_email_with_attachments(self, tmp_path, mailoutbox):
        fake = SimpleUploadedFile("w9.pdf", b"content", content_type="application/pdf")
        carrier = CarrierFactory(
            no_reply_email="noreply@carrier.com",
            no_reply_password="pass",
            w9_file=fake,
        )
        from unittest.mock import patch

        with patch("apps.carriers.services.get_connection") as mock_conn, patch(
            "django.core.mail.EmailMessage.attach_file"
        ):
            mock_conn.return_value.__enter__ = lambda s: s
            mock_conn.return_value.__exit__ = lambda s, *a: False

            class FakeMsg:
                content_subtype = "html"

                def send(self):
                    pass

                def attach_file(self, path):
                    pass

            with patch("apps.carriers.services.EmailMessage", return_value=FakeMsg()):
                send_carrier_packet(
                    carrier=carrier,
                    broker_email="broker@test.com",
                    file_slots=["w9_file"],
                )
