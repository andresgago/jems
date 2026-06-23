import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.carriers.models import Carrier
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
        payload = {"mc": "MC999001", "dot_number": "DOT999001", "name": "New Carrier LLC"}
        response = client.post(reverse("carrier-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["mc"] == "MC999001"

    def test_duplicate_mc_rejected(self, auth_client):
        client, _ = auth_client
        CarrierFactory(mc="MCDUP001")
        response = client.post(reverse("carrier-list"), {"mc": "MCDUP001", "dot_number": "DOT001", "name": "X"})
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
        response = client.post(reverse("carrier-toggle-status", kwargs={"pk": carrier.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["active"] is False

    def test_toggle_inactive_to_active(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory(active=False)
        response = client.post(reverse("carrier-toggle-status", kwargs={"pk": carrier.pk}))
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
