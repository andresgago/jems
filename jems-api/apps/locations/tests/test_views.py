import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.locations.tests.factories import StateFactory
from apps.users.tests.factories import UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client


@pytest.mark.django_db
class TestStateList:
    def test_authenticated_user_can_list_states(self, auth_client):
        StateFactory(name="Texas", abbreviation="TX")
        StateFactory(name="Alabama", abbreviation="AL")
        response = auth_client.get(reverse("state-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2
        # ordered by name
        assert response.data[0]["name"] == "Alabama"
        assert set(response.data[0].keys()) == {"id", "name", "abbreviation"}

    def test_returns_empty_list_when_no_states(self, auth_client):
        response = auth_client.get(reverse("state-list"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_requires_authentication(self, api_client):
        response = api_client.get(reverse("state-list"))
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
