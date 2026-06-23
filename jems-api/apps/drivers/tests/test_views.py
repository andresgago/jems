import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.drivers.models import Driver
from apps.drivers.tests.factories import DriverFactory, DriverTypeFactory
from apps.users.tests.factories import AdminUserFactory, UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


@pytest.fixture
def admin_client(api_client):
    user = AdminUserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


@pytest.mark.django_db
class TestDriverList:
    def test_authenticated_user_can_list_drivers(self, auth_client):
        client, _ = auth_client
        DriverFactory.create_batch(3)
        response = client.get(reverse("driver-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3

    def test_terminated_drivers_excluded(self, auth_client):
        client, _ = auth_client
        DriverFactory(status=Driver.Status.ACTIVE)
        DriverFactory(status=Driver.Status.TERMINATED)
        response = client.get(reverse("driver-list"))
        for driver in response.data:
            assert driver["status"] != Driver.Status.TERMINATED

    def test_unauthenticated_cannot_list(self, api_client):
        response = api_client.get(reverse("driver-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestDriverCreate:
    def test_create_driver(self, auth_client):
        client, _ = auth_client
        driver_type = DriverTypeFactory()
        payload = {
            "first_name": "Carlos",
            "last_name": "Lopez",
            "driver_type": driver_type.pk,
            "phone": "555-1234",
            "email": "carlos@example.com",
        }
        response = client.post(reverse("driver-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["full_name"] == "Carlos Lopez"

    def test_create_fails_without_name(self, auth_client):
        client, _ = auth_client
        response = client.post(reverse("driver-list"), {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestDriverRetrieve:
    def test_retrieve_returns_full_detail(self, auth_client):
        client, _ = auth_client
        driver = DriverFactory()
        response = client.get(reverse("driver-detail", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["id"] == driver.pk
        assert "documents" in response.data


@pytest.mark.django_db
class TestDriverToggleStatus:
    def test_toggle_active_to_inactive(self, auth_client):
        client, _ = auth_client
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        response = client.post(
            reverse("driver-toggle-status", kwargs={"pk": driver.pk})
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == Driver.Status.INACTIVE


@pytest.mark.django_db
class TestDriverDelete:
    def test_delete_marks_as_terminated(self, auth_client):
        client, _ = auth_client
        driver = DriverFactory(status=Driver.Status.ACTIVE)
        response = client.delete(reverse("driver-detail", kwargs={"pk": driver.pk}))
        assert response.status_code == status.HTTP_204_NO_CONTENT
        driver.refresh_from_db()
        assert driver.status == Driver.Status.TERMINATED


@pytest.mark.django_db
class TestDriverTypes:
    def test_list_driver_types(self, auth_client):
        client, _ = auth_client
        DriverTypeFactory.create_batch(3)
        response = client.get(reverse("driver-type-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3
