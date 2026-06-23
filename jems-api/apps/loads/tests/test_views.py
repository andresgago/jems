import datetime

from django.utils import timezone

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.loads.models import Load
from apps.loads.tests.factories import (
    CityFactory,
    LoadFactory,
    LoadStopFactory,
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


@pytest.mark.django_db
class TestLoadList:
    def test_lists_loads(self, auth_client):
        client, _ = auth_client
        LoadFactory.create_batch(3)
        response = client.get(reverse("load-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) >= 3

    def test_filter_by_status(self, auth_client):
        client, _ = auth_client
        LoadFactory(status=Load.Status.STARTED)
        LoadFactory(status=Load.Status.REGISTERED)
        response = client.get(reverse("load-list") + f"?status={Load.Status.STARTED}")
        assert response.status_code == status.HTTP_200_OK
        assert all(load["status"] == Load.Status.STARTED for load in response.data)

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("load-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestLoadCreate:
    def test_create_load(self, auth_client):
        from apps.loads.tests.factories import (
            BrokerFactory,
            BusinessFactory,
            CarrierFactory,
        )

        client, _ = auth_client
        city = CityFactory()
        broker = BrokerFactory()
        carrier = CarrierFactory()
        shipper = BusinessFactory()
        receiver = BusinessFactory()
        payload = {
            "number": "LD-99999",
            "pickup_date": timezone.now().strftime("%Y-%m-%d %H:%M"),
            "dropoff_date": (timezone.now() + datetime.timedelta(days=2)).strftime(
                "%Y-%m-%d %H:%M"
            ),
            "pickup_city": city.pk,
            "dropoff_city": city.pk,
            "pickup_address": "123 Start Ave",
            "dropoff_address": "456 End Blvd",
            "payment": 2000.00,
            "broker": broker.pk,
            "carrier": carrier.pk,
            "shipper": shipper.pk,
            "receiver": receiver.pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["number"] == "LD-99999"

    def test_duplicate_number_rejected(self, auth_client):
        client, _ = auth_client
        LoadFactory(number="LD-DUP99")
        response = client.post(reverse("load-list"), {"number": "LD-DUP99"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_shipper_required(self, auth_client):
        from apps.loads.tests.factories import (
            BrokerFactory,
            BusinessFactory,
            CarrierFactory,
        )

        client, _ = auth_client
        city = CityFactory()
        payload = {
            "number": "LD-NOSHP",
            "pickup_date": timezone.now().strftime("%Y-%m-%d %H:%M"),
            "dropoff_date": (timezone.now() + datetime.timedelta(days=2)).strftime(
                "%Y-%m-%d %H:%M"
            ),
            "pickup_city": city.pk,
            "dropoff_city": city.pk,
            "pickup_address": "123 Start Ave",
            "dropoff_address": "456 End Blvd",
            "payment": 1500.00,
            "broker": BrokerFactory().pk,
            "carrier": CarrierFactory().pk,
            "receiver": BusinessFactory().pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "shipper" in response.data

    def test_receiver_required(self, auth_client):
        from apps.loads.tests.factories import (
            BrokerFactory,
            BusinessFactory,
            CarrierFactory,
        )

        client, _ = auth_client
        city = CityFactory()
        payload = {
            "number": "LD-NORCV",
            "pickup_date": timezone.now().strftime("%Y-%m-%d %H:%M"),
            "dropoff_date": (timezone.now() + datetime.timedelta(days=2)).strftime(
                "%Y-%m-%d %H:%M"
            ),
            "pickup_city": city.pk,
            "dropoff_city": city.pk,
            "pickup_address": "123 Start Ave",
            "dropoff_address": "456 End Blvd",
            "payment": 1500.00,
            "broker": BrokerFactory().pk,
            "carrier": CarrierFactory().pk,
            "shipper": BusinessFactory().pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "receiver" in response.data


@pytest.mark.django_db
class TestLoadRetrieve:
    def test_retrieve_includes_stops(self, auth_client):
        client, _ = auth_client
        load = LoadFactory()
        LoadStopFactory(load=load)
        response = client.get(reverse("load-detail", kwargs={"pk": load.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert "stops" in response.data
        assert len(response.data["stops"]) == 1

    def test_nonexistent_returns_404(self, auth_client):
        client, _ = auth_client
        response = client.get(reverse("load-detail", kwargs={"pk": 99999}))
        assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestLoadSetStatus:
    def test_valid_transition(self, auth_client):
        client, _ = auth_client
        load = LoadFactory(status=Load.Status.REGISTERED)
        response = client.post(
            reverse("load-set-status", kwargs={"pk": load.pk}),
            {"status": Load.Status.STARTED},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["status"] == Load.Status.STARTED

    def test_invalid_transition_returns_400(self, auth_client):
        client, _ = auth_client
        load = LoadFactory(status=Load.Status.FINISHED)
        response = client.post(
            reverse("load-set-status", kwargs={"pk": load.pk}),
            {"status": Load.Status.STARTED},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestLoadInvoiced:
    def test_toggle_invoiced(self, auth_client):
        client, _ = auth_client
        load = LoadFactory(invoiced=False)
        response = client.post(reverse("load-set-invoiced", kwargs={"pk": load.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["invoiced"] is True


@pytest.mark.django_db
class TestLoadPaid:
    def test_toggle_paid(self, auth_client):
        client, _ = auth_client
        load = LoadFactory(paid=False)
        response = client.post(reverse("load-set-paid", kwargs={"pk": load.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["paid"] is True


@pytest.mark.django_db
class TestLoadAssign:
    def test_assign_truck_and_driver(self, auth_client):
        from apps.loads.tests.factories import DriverFactory, TruckFactory

        client, _ = auth_client
        load = LoadFactory()
        truck = TruckFactory()
        driver = DriverFactory()
        response = client.post(
            reverse("load-assign", kwargs={"pk": load.pk}),
            {"truck": truck.pk, "driver": driver.pk},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["truck"] == truck.pk
        assert response.data["driver"] == driver.pk
        assert response.data["execute"] is True


@pytest.mark.django_db
class TestLoadStops:
    def test_list_stops(self, auth_client):
        client, _ = auth_client
        load = LoadFactory()
        LoadStopFactory.create_batch(2, load=load)
        response = client.get(reverse("load-stops", kwargs={"pk": load.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 2

    def test_add_stop(self, auth_client):
        from apps.loads.tests.factories import BusinessFactory

        client, _ = auth_client
        load = LoadFactory()
        city = CityFactory()
        business = BusinessFactory()
        payload = {
            "stop_type": 1,
            "from_date": str(datetime.date.today()),
            "to_date": str(datetime.date.today() + datetime.timedelta(days=1)),
            "address": "999 New Stop Ln",
            "city": city.pk,
            "business": business.pk,
        }
        response = client.post(reverse("load-stops", kwargs={"pk": load.pk}), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["address"] == "999 New Stop Ln"

    def test_delete_stop(self, auth_client):
        client, _ = auth_client
        stop = LoadStopFactory()
        url = reverse(
            "load-stop-detail", kwargs={"load_pk": stop.load.pk, "pk": stop.pk}
        )
        response = client.delete(url)
        assert response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
class TestCitySearch:
    def test_search_by_name(self, auth_client):
        client, _ = auth_client
        CityFactory(name="Nashville")
        response = client.get(reverse("city-search") + "?q=Nash")
        assert response.status_code == status.HTTP_200_OK
        assert any("Nashville" in c["name"] for c in response.data)

    def test_search_by_zip(self, auth_client):
        client, _ = auth_client
        CityFactory(name="Denver", zip="80201")
        response = client.get(reverse("city-search") + "?q=80201")
        assert response.status_code == status.HTTP_200_OK
        assert any(c["zip"] == "80201" for c in response.data)

    def test_search_by_partial_zip(self, auth_client):
        client, _ = auth_client
        CityFactory(name="Los Angeles", zip="90001")
        response = client.get(reverse("city-search") + "?q=9000")
        assert response.status_code == status.HTTP_200_OK
        assert any(c["name"] == "Los Angeles" for c in response.data)

    def test_empty_query_returns_empty(self, auth_client):
        client, _ = auth_client
        response = client.get(reverse("city-search"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data == []

    def test_response_includes_state_and_zip(self, auth_client):
        client, _ = auth_client
        CityFactory(name="Austin", zip="78701")
        response = client.get(reverse("city-search") + "?q=Austin")
        assert response.status_code == status.HTTP_200_OK
        city = next(c for c in response.data if c["name"] == "Austin")
        assert "state" in city
        assert city["zip"] == "78701"


@pytest.mark.django_db
class TestLoadDateValidation:
    def test_dropoff_before_pickup_rejected(self, auth_client):
        from apps.loads.tests.factories import (
            BrokerFactory,
            BusinessFactory,
            CarrierFactory,
        )

        client, _ = auth_client
        city = CityFactory()
        broker = BrokerFactory()
        carrier = CarrierFactory()
        shipper = BusinessFactory()
        receiver = BusinessFactory()
        now = timezone.now()
        payload = {
            "number": "LD-DATE-01",
            "pickup_date": (now + datetime.timedelta(days=2)).strftime(
                "%Y-%m-%d %H:%M"
            ),
            "dropoff_date": now.strftime("%Y-%m-%d %H:%M"),
            "pickup_city": city.pk,
            "dropoff_city": city.pk,
            "pickup_address": "123 Start Ave",
            "dropoff_address": "456 End Blvd",
            "payment": 1500.00,
            "broker": broker.pk,
            "carrier": carrier.pk,
            "shipper": shipper.pk,
            "receiver": receiver.pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "dropoff_date" in response.data

    def test_dropoff_same_as_pickup_allowed(self, auth_client):
        from apps.loads.tests.factories import (
            BrokerFactory,
            BusinessFactory,
            CarrierFactory,
        )

        client, _ = auth_client
        city = CityFactory()
        broker = BrokerFactory()
        carrier = CarrierFactory()
        shipper = BusinessFactory()
        receiver = BusinessFactory()
        now = timezone.now().strftime("%Y-%m-%d %H:%M")
        payload = {
            "number": "LD-DATE-02",
            "pickup_date": now,
            "dropoff_date": now,
            "pickup_city": city.pk,
            "dropoff_city": city.pk,
            "pickup_address": "123 Start Ave",
            "dropoff_address": "456 End Blvd",
            "payment": 1500.00,
            "broker": broker.pk,
            "carrier": carrier.pk,
            "shipper": shipper.pk,
            "receiver": receiver.pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED

    def test_dropoff_after_pickup_allowed(self, auth_client):
        from apps.loads.tests.factories import (
            BrokerFactory,
            BusinessFactory,
            CarrierFactory,
        )

        client, _ = auth_client
        city = CityFactory()
        broker = BrokerFactory()
        carrier = CarrierFactory()
        shipper = BusinessFactory()
        receiver = BusinessFactory()
        now = timezone.now()
        payload = {
            "number": "LD-DATE-03",
            "pickup_date": now.strftime("%Y-%m-%d %H:%M"),
            "dropoff_date": (now + datetime.timedelta(days=3)).strftime(
                "%Y-%m-%d %H:%M"
            ),
            "pickup_city": city.pk,
            "dropoff_city": city.pk,
            "pickup_address": "123 Start Ave",
            "dropoff_address": "456 End Blvd",
            "payment": 1500.00,
            "broker": broker.pk,
            "carrier": carrier.pk,
            "shipper": shipper.pk,
            "receiver": receiver.pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
