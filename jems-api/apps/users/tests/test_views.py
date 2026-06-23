import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User
from apps.users.tests.factories import AdminUserFactory, DispatcherFactory, UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_client(api_client):
    user = AdminUserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


@pytest.mark.django_db
class TestUserList:
    def test_admin_can_list_users(self, admin_client):
        client, _ = admin_client
        UserFactory.create_batch(3)
        response = client.get(reverse("user-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3

    def test_regular_user_cannot_list_users(self, auth_client):
        client, _ = auth_client
        response = client.get(reverse("user-list"))
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_list_users(self, api_client):
        response = api_client.get(reverse("user-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestUserCreate:
    def test_admin_can_create_user(self, admin_client):
        client, _ = admin_client
        payload = {
            "username": "newuser",
            "first_name": "New",
            "last_name": "User",
            "email": "new@example.com",
            "password": "securepass123",
            "phone": "555-0000",
        }
        response = client.post(reverse("user-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["username"] == "newuser"

    def test_create_fails_without_required_fields(self, admin_client):
        client, _ = admin_client
        response = client.post(reverse("user-list"), {"username": "incomplete"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestToggleStatus:
    def test_admin_can_toggle_status(self, admin_client):
        client, _ = admin_client
        user = UserFactory(status=User.Status.ACTIVE)
        response = client.post(reverse("user-toggle-status", kwargs={"pk": user.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == User.Status.INACTIVE

    def test_regular_user_cannot_toggle_status(self, auth_client):
        client, _ = auth_client
        user = UserFactory()
        response = client.post(reverse("user-toggle-status", kwargs={"pk": user.pk}))
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestToggleDispatcher:
    def test_admin_can_toggle_dispatcher(self, admin_client):
        client, _ = admin_client
        user = UserFactory(is_dispatcher=False)
        response = client.post(reverse("user-toggle-dispatcher", kwargs={"pk": user.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_dispatcher"] is True


@pytest.mark.django_db
class TestChangePassword:
    def test_admin_can_change_password(self, admin_client):
        client, _ = admin_client
        user = UserFactory()
        payload = {"password": "newpass456!", "password_confirm": "newpass456!"}
        response = client.post(
            reverse("user-change-password", kwargs={"pk": user.pk}), payload
        )
        assert response.status_code == status.HTTP_200_OK

    def test_mismatched_passwords_rejected(self, admin_client):
        client, _ = admin_client
        user = UserFactory()
        payload = {"password": "newpass456!", "password_confirm": "different!"}
        response = client.post(
            reverse("user-change-password", kwargs={"pk": user.pk}), payload
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestMeEndpoint:
    def test_authenticated_user_gets_own_profile(self, auth_client):
        client, user = auth_client
        response = client.get(reverse("user-me"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["username"] == user.username

    def test_unauthenticated_cannot_access_me(self, api_client):
        response = api_client.get(reverse("user-me"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
