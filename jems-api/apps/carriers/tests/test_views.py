import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from unittest.mock import patch

from apps.brokers.tests.factories import BrokerContactFactory, BrokerFactory
from apps.carriers.tests.factories import CarrierFactory
from apps.users.tests.factories import UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


@pytest.mark.django_db
class TestCarrierList:
    def test_lists_all_carriers(self, auth_client):
        client, _ = auth_client
        CarrierFactory.create_batch(3)
        response = client.get(reverse("carrier-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("carrier-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestCarrierCreate:
    def test_create_carrier(self, auth_client):
        client, _ = auth_client
        payload = {
            "mc": "MC999001",
            "dot_number": "DOT999001",
            "name": "New Carrier LLC",
        }
        response = client.post(reverse("carrier-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["mc"] == "MC999001"

    def test_duplicate_mc_rejected(self, auth_client):
        client, _ = auth_client
        CarrierFactory(mc="MCDUP001")
        response = client.post(
            reverse("carrier-list"),
            {"mc": "MCDUP001", "dot_number": "DOT001", "name": "X"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestCarrierRetrieve:
    def test_retrieve_carrier(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory(name="Exact Carrier")
        response = client.get(reverse("carrier-detail", kwargs={"pk": carrier.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Exact Carrier"

    def test_retrieve_nonexistent_returns_404(self, auth_client):
        client, _ = auth_client
        response = client.get(reverse("carrier-detail", kwargs={"pk": 99999}))
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestCarrierToggleStatus:
    def test_toggle_active_to_inactive(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory(active=True)
        response = client.post(
            reverse("carrier-toggle-status", kwargs={"pk": carrier.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["active"] is False

    def test_toggle_inactive_to_active(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory(active=False)
        response = client.post(
            reverse("carrier-toggle-status", kwargs={"pk": carrier.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["active"] is True


@pytest.mark.django_db
class TestCarrierSearch:
    def test_search_by_name(self, auth_client):
        client, _ = auth_client
        CarrierFactory(name="Acme Transport", active=True)
        response = client.get(reverse("carrier-search") + "?q=Acme")
        assert response.status_code == status.HTTP_200_OK
        assert any("Acme" in c["name"] for c in response.data)

    def test_empty_query_returns_empty(self, auth_client):
        client, _ = auth_client
        response = client.get(reverse("carrier-search"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []


@pytest.mark.django_db
class TestCarrierOptions:
    def test_options_returns_id_and_label(self, auth_client):
        client, _ = auth_client
        CarrierFactory(name="Zebra Logistics", mc="MCZEB001", active=True)
        response = client.get(reverse("carrier-options"))
        assert response.status_code == status.HTTP_200_OK
        assert all("id" in c and "label" in c for c in response.data)


@pytest.mark.django_db
class TestCarrierAvailableFiles:
    def test_returns_empty_list_when_no_files(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory()
        response = client.get(
            reverse("carrier-available-files", kwargs={"pk": carrier.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_returns_slots_for_uploaded_files(self, auth_client):
        client, _ = auth_client
        fake = SimpleUploadedFile("w9.pdf", b"data", content_type="application/pdf")
        carrier = CarrierFactory(w9_file=fake)
        response = client.get(
            reverse("carrier-available-files", kwargs={"pk": carrier.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        slots = [r["slot"] for r in response.data]
        assert "w9_file" in slots

    def test_returns_404_for_unknown_carrier(self, auth_client):
        client, _ = auth_client
        response = client.get(reverse("carrier-available-files", kwargs={"pk": 99999}))
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated_blocked(self, api_client):
        carrier = CarrierFactory()
        response = api_client.get(
            reverse("carrier-available-files", kwargs={"pk": carrier.pk})
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestCarrierSendPacket:
    def test_missing_recipients_returns_400(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory()
        response = client.post(
            reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
            {"file_slots": ["w9_file"]},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "recipients" in response.data["error"]

    def test_missing_file_slots_returns_400(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory()
        response = client.post(
            reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
            {"broker_email": "broker@test.com"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "file_slots" in response.data["error"]

    def test_invalid_broker_email_returns_400(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory()
        response = client.post(
            reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
            {"broker_email": "not-an-email", "file_slots": ["w9_file"]},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "broker_email" in response.data["error"]

    def test_broker_email_over_50_chars_returns_400(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory()
        response = client.post(
            reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
            {
                "broker_email": "broker.address.longer.than.legacy.limit@example.com",
                "file_slots": ["w9_file"],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "broker_email" in response.data["error"]

    def test_duplicate_file_slot_returns_400(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory()
        response = client.post(
            reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
            {
                "broker_email": "broker@test.com",
                "file_slots": ["w9_file", "w9_file"],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "file_slots" in response.data["error"]

    def test_duplicate_contact_id_returns_400(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory()
        contact = BrokerContactFactory(broker=broker)
        carrier = CarrierFactory()
        response = client.post(
            reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
            {
                "broker_id": broker.id,
                "contact_ids": [contact.id, contact.id],
                "file_slots": ["w9_file"],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "contact_ids" in response.data["error"]

    def test_contact_without_broker_returns_400(self, auth_client):
        client, _ = auth_client
        contact = BrokerContactFactory()
        carrier = CarrierFactory()
        response = client.post(
            reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
            {
                "contact_ids": [contact.id],
                "file_slots": ["w9_file"],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "broker_id" in response.data["error"]

    def test_contact_from_another_broker_returns_400(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory()
        other_contact = BrokerContactFactory()
        carrier = CarrierFactory(no_reply_email="noreply@carrier.com")
        response = client.post(
            reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
            {
                "broker_id": broker.id,
                "contact_ids": [other_contact.id],
                "file_slots": ["w9_file"],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "not found for selected broker" in response.data["error"]

    def test_no_no_reply_email_returns_400(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory(no_reply_email=None)
        response = client.post(
            reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
            {"broker_email": "broker@test.com", "file_slots": ["w9_file"]},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_unknown_slot_returns_400(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory(no_reply_email="noreply@carrier.com")
        response = client.post(
            reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
            {
                "broker_email": "broker@test.com",
                "file_slots": ["bad_slot"],
            },
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_successful_send_returns_200(self, auth_client):
        client, user = auth_client
        user.email = "current-user@test.com"
        user.save(update_fields=["email"])
        fake = SimpleUploadedFile("w9.pdf", b"data", content_type="application/pdf")
        carrier = CarrierFactory(
            no_reply_email="noreply@carrier.com",
            no_reply_password="pass",
            cc_email="carrier-cc@test.com",
            w9_file=fake,
        )
        with patch("apps.carriers.services.get_connection"), patch(
            "apps.carriers.services.EmailMessage"
        ) as MockMsg:
            mock_msg = MockMsg.return_value
            response = client.post(
                reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
                {
                    "broker_email": "broker@test.com",
                    "file_slots": ["w9_file"],
                },
                format="json",
            )
        assert response.status_code == status.HTTP_200_OK
        assert "sent" in response.data["detail"].lower()
        kwargs = MockMsg.call_args.kwargs
        assert kwargs["bcc"] == ["current-user@test.com"]
        assert "cc" not in kwargs
        mock_msg.attach_file.assert_called_once_with(carrier.w9_file.path)

    def test_successful_send_to_selected_contacts_returns_200(self, auth_client):
        client, user = auth_client
        user.email = "current-user@test.com"
        user.save(update_fields=["email"])
        broker = BrokerFactory()
        contact_1 = BrokerContactFactory(broker=broker, email="one@test.com")
        contact_2 = BrokerContactFactory(broker=broker, email="two@test.com")
        fake = SimpleUploadedFile("w9.pdf", b"data", content_type="application/pdf")
        carrier = CarrierFactory(
            no_reply_email="noreply@carrier.com",
            no_reply_password="pass",
            w9_file=fake,
        )
        with patch("apps.carriers.services.get_connection"), patch(
            "apps.carriers.services.EmailMessage"
        ) as MockMsg:
            response = client.post(
                reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
                {
                    "broker_id": broker.id,
                    "contact_ids": [contact_1.id, contact_2.id],
                    "file_slots": ["w9_file"],
                },
                format="json",
            )
        assert response.status_code == status.HTTP_200_OK
        assert MockMsg.call_args.kwargs["to"] == ["one@test.com", "two@test.com"]
        assert MockMsg.call_args.kwargs["bcc"] == ["current-user@test.com"]

    def test_returns_404_for_unknown_carrier(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("carrier-send-packet", kwargs={"pk": 99999}),
            {"broker_email": "x@x.com", "file_slots": ["w9_file"]},
            format="json",
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unauthenticated_blocked(self, api_client):
        carrier = CarrierFactory()
        response = api_client.post(
            reverse("carrier-send-packet", kwargs={"pk": carrier.pk}),
            {"broker_email": "x@x.com", "file_slots": ["w9_file"]},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
