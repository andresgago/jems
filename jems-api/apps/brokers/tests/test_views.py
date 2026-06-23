import pytest
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
