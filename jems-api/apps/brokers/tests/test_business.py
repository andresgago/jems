import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.brokers.models import Business
from apps.users.tests.factories import UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


def make_business(name, status_val=Business.Status.ACTIVE):
    return Business.objects.create(name=name, status=status_val)


@pytest.mark.django_db
class TestBusinessSearch:
    def test_returns_matching_businesses(self, auth_client):
        client, _ = auth_client
        make_business("Acme Warehouse")
        make_business("Beta Logistics")
        response = client.get(reverse("business-search") + "?q=Acme")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["name"] == "Acme Warehouse"

    def test_empty_query_returns_empty(self, auth_client):
        client, _ = auth_client
        make_business("Acme Warehouse")
        response = client.get(reverse("business-search"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_inactive_excluded(self, auth_client):
        client, _ = auth_client
        make_business("Active Co", Business.Status.ACTIVE)
        make_business("Inactive Co", Business.Status.INACTIVE)
        response = client.get(reverse("business-search") + "?q=Co")
        assert response.status_code == status.HTTP_200_OK
        names = [b["name"] for b in response.data]
        assert "Active Co" in names
        assert "Inactive Co" not in names

    def test_response_includes_city_display(self, auth_client):
        client, _ = auth_client
        make_business("Test Biz")
        response = client.get(reverse("business-search") + "?q=Test")
        assert response.status_code == status.HTTP_200_OK
        assert "city_display" in response.data[0]

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("business-search") + "?q=test")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestBusinessCreate:
    def test_creates_business(self, auth_client):
        client, _ = auth_client
        response = client.post(reverse("business-list"), {"name": "New Shipper LLC"})
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "New Shipper LLC"
        assert Business.objects.filter(name="New Shipper LLC").exists()

    def test_name_required(self, auth_client):
        client, _ = auth_client
        response = client.post(reverse("business-list"), {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "name" in response.data

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.post(reverse("business-list"), {"name": "X"})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestBusinessRetrieve:
    def test_retrieve_existing(self, auth_client):
        client, _ = auth_client
        biz = make_business("Acme Warehouse")
        response = client.get(reverse("business-detail", kwargs={"pk": biz.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Acme Warehouse"

    def test_retrieve_nonexistent_returns_404(self, auth_client):
        client, _ = auth_client
        response = client.get(reverse("business-detail", kwargs={"pk": 99999}))
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestBusinessUpdate:
    def test_updates_name(self, auth_client):
        client, _ = auth_client
        biz = make_business("Old Name")
        response = client.put(
            reverse("business-detail", kwargs={"pk": biz.pk}),
            {"name": "New Name"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "New Name"
        biz.refresh_from_db()
        assert biz.name == "New Name"

    def test_nonexistent_returns_404(self, auth_client):
        client, _ = auth_client
        response = client.put(
            reverse("business-detail", kwargs={"pk": 99999}), {"name": "X"}
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND
