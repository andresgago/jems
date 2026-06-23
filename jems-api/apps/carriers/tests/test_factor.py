import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.carriers.models import Factor
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
class TestFactor:
    def test_list_factors(self, auth_client):
        client, _ = auth_client
        Factor.objects.create(value="1000.00", percent="2.50")
        Factor.objects.create(value="5000.00", percent="2.00")
        response = client.get(reverse("factor-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 2

    def test_create_factor(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("factor-list"), {"value": "2000.00", "percent": "2.25"}
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert float(response.data["value"]) == 2000.0

    def test_duplicate_value_rejected(self, auth_client):
        client, _ = auth_client
        Factor.objects.create(value="3000.00", percent="2.00")
        response = client.post(
            reverse("factor-list"), {"value": "3000.00", "percent": "1.50"}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_update_factor(self, auth_client):
        client, _ = auth_client
        factor = Factor.objects.create(value="4000.00", percent="2.00")
        response = client.patch(
            reverse("factor-detail", kwargs={"pk": factor.pk}),
            {"percent": "1.75"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert float(response.data["percent"]) == 1.75

    def test_delete_factor(self, auth_client):
        client, _ = auth_client
        factor = Factor.objects.create(value="9999.00", percent="1.00")
        response = client.delete(reverse("factor-detail", kwargs={"pk": factor.pk}))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("factor-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
