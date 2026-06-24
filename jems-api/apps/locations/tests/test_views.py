import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.locations.tests.factories import CityFactory, StateFactory
from apps.users.tests.factories import UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client


# ---------------------------------------------------------------------------
# States
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Cities — List
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCityList:
    def test_requires_authentication(self, api_client):
        response = api_client.get(reverse("city-list"))
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )

    def test_list_returns_paginated_results(self, auth_client):
        CityFactory(name="Austin", zip="78701", active=True)
        CityFactory(name="Dallas", zip="75201", active=True)
        response = auth_client.get(reverse("city-list"))
        assert response.status_code == status.HTTP_200_OK
        assert "count" in response.data
        assert "results" in response.data
        assert response.data["count"] == 2

    def test_list_response_fields(self, auth_client):
        state = StateFactory(abbreviation="TX")
        CityFactory(state=state, active=True)
        response = auth_client.get(reverse("city-list"))
        assert response.status_code == status.HTTP_200_OK
        item = response.data["results"][0]
        assert "id" in item
        assert "name" in item
        assert "zip" in item
        assert "state" in item
        assert "state_name" in item
        assert "state_abbreviation" in item
        assert "active" in item
        assert "timezone" in item

    def test_filter_by_name(self, auth_client):
        CityFactory(name="Charlotte", zip="28201", active=True)
        CityFactory(name="Raleigh", zip="27601", active=True)
        response = auth_client.get(reverse("city-list"), {"q": "charl"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["name"] == "Charlotte"

    def test_filter_by_zip(self, auth_client):
        CityFactory(name="Charlotte", zip="28201", active=True)
        CityFactory(name="Raleigh", zip="27601", active=True)
        response = auth_client.get(reverse("city-list"), {"q": "276"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["zip"] == "27601"

    def test_filter_by_state(self, auth_client):
        tx = StateFactory(abbreviation="TX")
        nc = StateFactory(abbreviation="NC")
        CityFactory(state=tx, active=True)
        CityFactory(state=nc, active=True)
        response = auth_client.get(reverse("city-list"), {"state": tx.id})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1
        assert response.data["results"][0]["state"] == tx.id

    def test_filter_active_only(self, auth_client):
        CityFactory(active=True)
        CityFactory(active=False)
        response = auth_client.get(reverse("city-list"), {"active": "1"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1

    def test_filter_inactive_only(self, auth_client):
        CityFactory(active=True)
        CityFactory(active=False)
        response = auth_client.get(reverse("city-list"), {"active": "0"})
        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 1


# ---------------------------------------------------------------------------
# Cities — Retrieve
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCityRetrieve:
    def test_retrieve_existing_city(self, auth_client):
        state = StateFactory(name="Texas", abbreviation="TX")
        city = CityFactory(
            name="Houston", zip="77001", state=state, timezone="America/Chicago"
        )
        url = reverse("city-detail", args=[city.pk])
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "Houston"
        assert response.data["zip"] == "77001"
        assert response.data["timezone"] == "America/Chicago"
        assert "state_data" in response.data
        assert response.data["state_data"]["abbreviation"] == "TX"

    def test_retrieve_nonexistent_returns_404(self, auth_client):
        url = reverse("city-detail", args=[99999])
        response = auth_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_authentication(self, api_client):
        city = CityFactory()
        url = reverse("city-detail", args=[city.pk])
        response = api_client.get(url)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


# ---------------------------------------------------------------------------
# Cities — Create
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCityCreate:
    def test_create_valid_city(self, auth_client):
        state = StateFactory()
        payload = {"name": "Raleigh", "zip": "27601", "state": state.pk}
        response = auth_client.post(reverse("city-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Raleigh"
        assert response.data["zip"] == "27601"

    def test_create_with_timezone(self, auth_client):
        state = StateFactory()
        payload = {
            "name": "Denver",
            "zip": "80201",
            "state": state.pk,
            "timezone": "America/Denver",
        }
        response = auth_client.post(reverse("city-list"), payload, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["timezone"] == "America/Denver"

    def test_create_invalid_zip_returns_400(self, auth_client):
        state = StateFactory()
        payload = {"name": "Raleigh", "zip": "ABCDE", "state": state.pk}
        response = auth_client.post(reverse("city-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "zip" in response.data

    def test_create_missing_name_returns_400(self, auth_client):
        state = StateFactory()
        payload = {"zip": "27601", "state": state.pk}
        response = auth_client.post(reverse("city-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_duplicate_city_returns_400(self, auth_client):
        state = StateFactory()
        CityFactory(name="Raleigh", zip="27601", state=state)
        payload = {"name": "Raleigh", "zip": "27601", "state": state.pk}
        response = auth_client.post(reverse("city-list"), payload, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_requires_authentication(self, api_client):
        state = StateFactory()
        payload = {"name": "Raleigh", "zip": "27601", "state": state.pk}
        response = api_client.post(reverse("city-list"), payload, format="json")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


# ---------------------------------------------------------------------------
# Cities — Partial Update
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCityPartialUpdate:
    def test_patch_name(self, auth_client):
        city = CityFactory(name="Old Name")
        url = reverse("city-detail", args=[city.pk])
        response = auth_client.patch(url, {"name": "New Name"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "New Name"

    def test_patch_timezone(self, auth_client):
        city = CityFactory(timezone="")
        url = reverse("city-detail", args=[city.pk])
        response = auth_client.patch(
            url, {"timezone": "America/Los_Angeles"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["timezone"] == "America/Los_Angeles"

    def test_patch_invalid_zip_returns_400(self, auth_client):
        city = CityFactory()
        url = reverse("city-detail", args=[city.pk])
        response = auth_client.patch(url, {"zip": "NOPE"}, format="json")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_patch_nonexistent_returns_404(self, auth_client):
        url = reverse("city-detail", args=[99999])
        response = auth_client.patch(url, {"name": "X"}, format="json")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_authentication(self, api_client):
        city = CityFactory()
        url = reverse("city-detail", args=[city.pk])
        response = api_client.patch(url, {"name": "X"}, format="json")
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )


# ---------------------------------------------------------------------------
# Cities — Toggle Status
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCityToggleStatus:
    def test_toggle_active_to_inactive(self, auth_client):
        city = CityFactory(active=True)
        url = reverse("city-toggle-status", args=[city.pk])
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["active"] is False
        city.refresh_from_db()
        assert city.active is False

    def test_toggle_inactive_to_active(self, auth_client):
        city = CityFactory(active=False)
        url = reverse("city-toggle-status", args=[city.pk])
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["active"] is True
        city.refresh_from_db()
        assert city.active is True

    def test_toggle_nonexistent_returns_404(self, auth_client):
        url = reverse("city-toggle-status", args=[99999])
        response = auth_client.post(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_requires_authentication(self, api_client):
        city = CityFactory(active=True)
        url = reverse("city-toggle-status", args=[city.pk])
        response = api_client.post(url)
        assert response.status_code in (
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        )
