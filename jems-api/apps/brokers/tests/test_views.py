import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.brokers.models import Broker
from apps.brokers.tests.factories import BrokerContactFactory, BrokerFactory
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
class TestBrokerList:
    def test_lists_brokers(self, auth_client):
        client, _ = auth_client
        BrokerFactory.create_batch(3)
        response = client.get(reverse("broker-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("broker-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestBrokerCreate:
    def test_create_broker(self, auth_client):
        client, _ = auth_client
        payload = {"mc": "NEWBRK001", "name": "New Broker LLC"}
        response = client.post(reverse("broker-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["mc"] == "NEWBRK001"

    def test_duplicate_mc_rejected(self, auth_client):
        client, _ = auth_client
        BrokerFactory(mc="DUPBRK001")
        response = client.post(
            reverse("broker-list"), {"mc": "DUPBRK001", "name": "Dup"}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestBrokerRetrieve:
    def test_retrieve_includes_contacts(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory()
        BrokerContactFactory(broker=broker)
        response = client.get(reverse("broker-detail", kwargs={"pk": broker.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert "contacts" in response.data
        assert len(response.data["contacts"]) == 1

    def test_nonexistent_returns_404(self, auth_client):
        client, _ = auth_client
        response = client.get(reverse("broker-detail", kwargs={"pk": 99999}))
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestBrokerToggleStatus:
    def test_toggle_active_to_inactive(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory(status=Broker.Status.ACTIVE)
        response = client.post(
            reverse("broker-toggle-status", kwargs={"pk": broker.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == Broker.Status.INACTIVE

    def test_toggle_inactive_to_active(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory(status=Broker.Status.INACTIVE)
        response = client.post(
            reverse("broker-toggle-status", kwargs={"pk": broker.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == Broker.Status.ACTIVE


@pytest.mark.django_db
class TestBrokerSearch:
    def test_search_by_name(self, auth_client):
        client, _ = auth_client
        BrokerFactory(name="Sunrise Freight", status=Broker.Status.ACTIVE)
        response = client.get(reverse("broker-search") + "?q=Sunrise")
        assert response.status_code == status.HTTP_200_OK
        assert any("Sunrise" in b["name"] for b in response.data)

    def test_empty_query_returns_empty(self, auth_client):
        client, _ = auth_client
        response = client.get(reverse("broker-search"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []


@pytest.mark.django_db
class TestBrokerContacts:
    def test_list_contacts_for_broker(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory()
        BrokerContactFactory.create_batch(2, broker=broker)
        response = client.get(
            reverse("broker-contact-list", kwargs={"broker_pk": broker.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_add_contact(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory()
        payload = {"name": "Alice Smith", "email": "alice@broker.com"}
        response = client.post(
            reverse("broker-contact-list", kwargs={"broker_pk": broker.pk}), payload
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["email"] == "alice@broker.com"

    def test_delete_contact(self, auth_client):
        client, _ = auth_client
        contact = BrokerContactFactory()
        url = reverse(
            "broker-contact-detail",
            kwargs={"broker_pk": contact.broker.pk, "pk": contact.pk},
        )
        response = client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_contact_has_confirmed_and_is_scam_fields(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory()
        BrokerContactFactory(broker=broker, confirmed=True, is_scam=False)
        response = client.get(
            reverse("broker-contact-list", kwargs={"broker_pk": broker.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data[0]["confirmed"] is True
        assert response.data[0]["is_scam"] is False

    def test_patch_contact_sets_is_scam(self, auth_client):
        client, _ = auth_client
        contact = BrokerContactFactory(is_scam=False)
        url = reverse(
            "broker-contact-detail",
            kwargs={"broker_pk": contact.broker.pk, "pk": contact.pk},
        )
        response = client.patch(url, {"is_scam": True})
        assert response.status_code == status.HTTP_200_OK
        contact.refresh_from_db()
        assert contact.is_scam is True


@pytest.mark.django_db
class TestBrokerRetrieveNewFields:
    def test_retrieve_includes_address_fields(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory(
            physical_address="123 Main St",
            usdot_number="1234567",
            safer_operating_status="AUTHORIZED",
        )
        response = client.get(reverse("broker-detail", kwargs={"pk": broker.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["physical_address"] == "123 Main St"
        assert response.data["usdot_number"] == "1234567"
        assert response.data["safer_operating_status"] == "AUTHORIZED"

    def test_retrieve_includes_carrier_name(self, auth_client):
        from apps.carriers.tests.factories import CarrierFactory

        client, _ = auth_client
        carrier = CarrierFactory()
        broker = BrokerFactory(carrier=carrier)
        response = client.get(reverse("broker-detail", kwargs={"pk": broker.pk}))
        assert response.data["carrier_name"] == carrier.name


@pytest.mark.django_db
class TestBrokerDestroy:
    def test_destroy_soft_deletes_broker(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory(status=Broker.Status.ACTIVE)
        response = client.delete(reverse("broker-detail", kwargs={"pk": broker.pk}))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        broker.refresh_from_db()
        assert broker.status == Broker.Status.INACTIVE


@pytest.mark.django_db
class TestBrokerFileUpload:
    def _pdf(self, name: str = "packet.pdf") -> SimpleUploadedFile:
        return SimpleUploadedFile(
            name, b"%PDF-1.4 fake", content_type="application/pdf"
        )

    def test_upload_setup_packet(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory()
        url = reverse("broker-file", kwargs={"pk": broker.pk, "slot": "setup-packet"})
        response = client.post(url, {"file": self._pdf()}, format="multipart")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["setup_packet_file"]

    def test_unknown_slot_returns_400(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory()
        url = reverse("broker-file", kwargs={"pk": broker.pk, "slot": "does-not-exist"})
        response = client.post(url, {"file": self._pdf()}, format="multipart")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_clear_setup_packet(self, auth_client):
        from apps.brokers.services import set_broker_file

        client, _ = auth_client
        broker = BrokerFactory()
        broker = set_broker_file(broker=broker, slot="setup-packet", file=self._pdf())
        url = reverse("broker-file", kwargs={"pk": broker.pk, "slot": "setup-packet"})
        response = client.delete(url)
        assert response.status_code == status.HTTP_200_OK
        assert not response.data["setup_packet_file"]
