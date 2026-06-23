import datetime

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounting.models import CardGain
from apps.accounting.tests.factories import UserFactory
from apps.fleet.models import Card


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory()
    api_client.force_authenticate(user=user)
    return api_client, user


@pytest.fixture
def card():
    return Card.objects.create(number="FLEET-001", is_active=True)


@pytest.mark.django_db
class TestCardGain:
    def test_list_gains(self, auth_client, card):
        client, _ = auth_client
        CardGain.objects.create(card=card, date=datetime.date(2024, 1, 10), gain=150.0)
        response = client.get(reverse("card-gain-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 1

    def test_filter_by_card(self, auth_client, card):
        client, _ = auth_client
        other_card = Card.objects.create(number="FLEET-002")
        CardGain.objects.create(card=card, date=datetime.date(2024, 1, 10), gain=100.0)
        CardGain.objects.create(
            card=other_card, date=datetime.date(2024, 1, 11), gain=200.0
        )
        response = client.get(reverse("card-gain-list") + f"?card={card.pk}")
        assert response.status_code == status.HTTP_200_OK
        assert all(g["card"] == card.pk for g in response.data)

    def test_create_gain(self, auth_client, card):
        client, _ = auth_client
        response = client.post(
            reverse("card-gain-list"),
            {"card": card.pk, "date": "2024-03-01", "gain": 250.0},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["gain"] == 250.0

    def test_delete_gain(self, auth_client, card):
        client, _ = auth_client
        gain = CardGain.objects.create(
            card=card, date=datetime.date(2024, 1, 15), gain=75.0
        )
        response = client.delete(reverse("card-gain-detail", kwargs={"pk": gain.pk}))
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("card-gain-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
