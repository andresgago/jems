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
    TruckMilesReset,
)
from apps.fleet.tests.factories import TruckFactory, UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


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
        TruckMilesReset.objects.create(truck=truck, date=datetime.date(2024, 1, 15))
        response = client.get(reverse("truck-miles-reset-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_filter_by_truck(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        other = TruckFactory()
        TruckMilesReset.objects.create(truck=truck, date=datetime.date(2024, 1, 15))
        TruckMilesReset.objects.create(truck=other, date=datetime.date(2024, 2, 1))
        response = client.get(reverse("truck-miles-reset-list") + f"?truck={truck.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(r["truck"] == truck.pk for r in response.data)

    def test_create_reset(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        response = client.post(
            reverse("truck-miles-reset-list"),
            {"truck": truck.pk, "date": "2024-06-01"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["truck"] == truck.pk

    def test_delete_reset(self, auth_client):
        client, _ = auth_client
        truck = TruckFactory()
        reset = TruckMilesReset.objects.create(
            truck=truck, date=datetime.date(2024, 1, 15)
        )
        response = client.delete(
            reverse("truck-miles-reset-detail", kwargs={"pk": reset.pk})
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
