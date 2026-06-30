import datetime

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.fleet.models import (
    Card,
    EngineType,
    LossPayee,
    Make,
    TrailerType,
    TruckMilesReset,
)
from apps.fleet.tests.factories import (
    TrailerTypeFactory,
    TruckFactory,
    TruckMilesResetFactory,
    UserFactory,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


# ── TrailerType ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestTrailerType:
    def test_list_returns_only_active(self, auth_client):
        client, _ = auth_client
        TrailerTypeFactory(name="Van", short_name="V", is_active=True)
        TrailerTypeFactory(name="Retired", short_name="R", is_active=False)
        response = client.get(reverse("trailer-type-list"))
        assert response.status_code == status.HTTP_200_OK
        names = [t["name"] for t in response.data]
        assert "Van" in names
        assert "Retired" not in names

    def test_response_includes_short_name(self, auth_client):
        client, _ = auth_client
        TrailerTypeFactory(name="Reefer", short_name="R", is_active=True)
        response = client.get(reverse("trailer-type-list"))
        assert response.status_code == status.HTTP_200_OK
        reefer = next(t for t in response.data if t["name"] == "Reefer")
        assert reefer["short_name"] == "R"

    def test_create_with_short_name(self, auth_client):
        client, _ = auth_client
        payload = {"name": "Flatbed", "short_name": "F", "is_active": True}
        response = client.post(reverse("trailer-type-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["short_name"] == "F"
        assert TrailerType.objects.filter(name="Flatbed", short_name="F").exists()

    def test_short_name_max_3_chars(self, auth_client):
        client, _ = auth_client
        payload = {"name": "Too Long", "short_name": "ABCD", "is_active": True}
        response = client.post(reverse("trailer-type-list"), payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_list_ordered_by_name(self, auth_client):
        client, _ = auth_client
        TrailerTypeFactory(name="Reefer", short_name="R", is_active=True)
        TrailerTypeFactory(name="Flatbed", short_name="F", is_active=True)
        TrailerTypeFactory(name="Van", short_name="V", is_active=True)
        response = client.get(reverse("trailer-type-list"))
        assert response.status_code == status.HTTP_200_OK
        names = [t["name"] for t in response.data]
        assert names == sorted(names)

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("trailer-type-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ── Make ──────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestMake:
    def test_list_makes(self, auth_client):
        client, _ = auth_client
        Make.objects.create(name="Freightliner")
        Make.objects.create(name="Kenworth")
        response = client.get(reverse("make-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 2

    def test_create_make(self, auth_client):
        client, _ = auth_client
        response = client.post(reverse("make-list"), {"name": "Peterbilt"})
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Peterbilt"

    def test_update_make(self, auth_client):
        client, _ = auth_client
        make = Make.objects.create(name="Old Name")
        response = client.patch(
            reverse("make-detail", kwargs={"pk": make.pk}), {"name": "New Name"}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == "New Name"

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("make-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


# ── EngineType ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestEngineType:
    def test_list_engine_types(self, auth_client):
        client, _ = auth_client
        EngineType.objects.create(name="Cummins ISX")
        response = client.get(reverse("engine-type-list"))
        assert response.status_code == status.HTTP_200_OK
        assert any(e["name"] == "Cummins ISX" for e in response.data)

    def test_create_engine_type(self, auth_client):
        client, _ = auth_client
        response = client.post(reverse("engine-type-list"), {"name": "Detroit DD15"})
        assert response.status_code == status.HTTP_201_CREATED


# ── Card ──────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCard:
    def test_list_cards(self, auth_client):
        client, _ = auth_client
        Card.objects.create(number="CARD-001")
        response = client.get(reverse("card-list"))
        assert response.status_code == status.HTTP_200_OK
        assert any(c["number"] == "CARD-001" for c in response.data)

    def test_create_card(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("card-list"), {"number": "CARD-XYZ", "is_active": True}
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["number"] == "CARD-XYZ"

    def test_toggle_card_active(self, auth_client):
        client, _ = auth_client
        card = Card.objects.create(number="CARD-002", is_active=True)
        response = client.patch(
            reverse("card-detail", kwargs={"pk": card.pk}), {"is_active": False}
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_active"] is False


# ── LossPayee ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestLossPayee:
    def test_list_loss_payees(self, auth_client):
        client, _ = auth_client
        LossPayee.objects.create(name="Bank of America", is_active=True)
        response = client.get(reverse("loss-payee-list"))
        assert response.status_code == status.HTTP_200_OK
        assert any(lp["name"] == "Bank of America" for lp in response.data)

    def test_create_loss_payee(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("loss-payee-list"),
            {"name": "Wells Fargo", "address": "123 Main St", "is_active": True},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Wells Fargo"


# ── TruckMilesReset ───────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestTruckMilesReset:
    def test_list_resets(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        TruckMilesResetFactory(
            truck=truck,
            date=datetime.datetime(2024, 1, 15, tzinfo=datetime.timezone.utc),
        )
        response = client.get(reverse("truck-miles-reset-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1
        assert response.data[0]["truck_number"]
        assert "is_last_reset" in response.data[0]

    def test_filter_by_truck(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        other = TruckFactory()
        TruckMilesResetFactory(
            truck=truck,
            date=datetime.datetime(2024, 1, 15, tzinfo=datetime.timezone.utc),
        )
        TruckMilesResetFactory(
            truck=other,
            date=datetime.datetime(2024, 2, 1, tzinfo=datetime.timezone.utc),
        )
        response = client.get(reverse("truck-miles-reset-list") + f"?truck={truck.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(r["truck"] == truck.pk for r in response.data)

    def test_filter_by_date_only_when_search_mode_by_date(self, auth_client):
        client, _ = auth_client
        TruckMilesResetFactory(
            date=datetime.datetime(2024, 1, 15, tzinfo=datetime.timezone.utc)
        )
        TruckMilesResetFactory(
            date=datetime.datetime(2024, 2, 15, tzinfo=datetime.timezone.utc)
        )

        ignored = client.get(
            reverse("truck-miles-reset-list")
            + "?date_from=2024-02-01&date_to=2024-02-28"
        )
        filtered = client.get(
            reverse("truck-miles-reset-list")
            + "?search=1&date_from=2024-02-01&date_to=2024-02-28"
        )

        assert ignored.status_code == status.HTTP_200_OK
        assert len(ignored.data) >= 2
        assert filtered.status_code == status.HTTP_200_OK
        assert len(filtered.data) == 1

    def test_create_reset(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        response = client.post(
            reverse("truck-miles-reset-list"),
            {"truck": truck.pk, "date": "2024-06-01"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["truck"] == truck.pk
        assert response.data["date"].startswith("2024-06-01")

    def test_duplicate_reset_rejected(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        TruckMilesResetFactory(
            truck=truck,
            date=datetime.datetime(2024, 6, 1, tzinfo=datetime.timezone.utc),
        )
        response = client.post(
            reverse("truck-miles-reset-list"),
            {"truck": truck.pk, "date": "2024-06-01"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_retrieve_and_update_reset(self, auth_client):
        client, _ = auth_client
        reset = TruckMilesResetFactory()

        retrieve = client.get(
            reverse("truck-miles-reset-detail", kwargs={"pk": reset.pk})
        )
        update = client.patch(
            reverse("truck-miles-reset-detail", kwargs={"pk": reset.pk}),
            {"date": "2024-07-01T12:30:00Z"},
            format="json",
        )

        assert retrieve.status_code == status.HTTP_200_OK
        assert update.status_code == status.HTTP_200_OK
        assert update.data["date"].startswith("2024-07-01T12:30:00")

    def test_delete_reset(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        reset = TruckMilesResetFactory(truck=truck)
        response = client.delete(
            reverse("truck-miles-reset-detail", kwargs={"pk": reset.pk})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_bulk_delete_reset(self, auth_client):
        client, _ = auth_client
        first = TruckMilesResetFactory()
        second = TruckMilesResetFactory()

        response = client.post(
            reverse("truck-miles-reset-bulk-delete"),
            {"ids": [first.pk, second.pk]},
            format="json",
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not TruckMilesReset.objects.filter(pk__in=[first.pk, second.pk]).exists()
