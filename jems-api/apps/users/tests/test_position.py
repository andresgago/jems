import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import Position
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
class TestPosition:
    def test_list_positions(self, auth_client):
        client, _ = auth_client
        Position.objects.create(name="Dispatcher", is_active=True)
        Position.objects.create(name="Driver", is_active=True)
        response = client.get(reverse("position-list"))
        assert response.status_code == status.HTTP_200_OK
        names = [p["name"] for p in response.data]
        assert "Dispatcher" in names
        assert "Driver" in names

    def test_inactive_not_listed(self, auth_client):
        client, _ = auth_client
        Position.objects.create(name="Retired", is_active=False)
        response = client.get(reverse("position-list"))
        assert response.status_code == status.HTTP_200_OK
        assert all(p["is_active"] for p in response.data)

    def test_create_position(self, auth_client):
        client, _ = auth_client
        response = client.post(reverse("position-list"), {"name": "Safety Manager"})
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Safety Manager"

    def test_update_position(self, auth_client):
        client, _ = auth_client
        pos = Position.objects.create(name="Old", is_active=True)
        response = client.patch(
            reverse("position-detail", kwargs={"pk": pos.pk}),
            {"name": "Updated"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Updated"

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("position-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
