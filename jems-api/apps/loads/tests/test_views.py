import datetime

from django.utils import timezone

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounting.models import Account
from apps.drivers.models import DriverType
from apps.loads.models import Load
from apps.loads.tests.factories import (
    CityFactory,
    DriverFactory,
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


@pytest.fixture
def load_accounting_accounts(db):
    codes = {
        "90010": "Income by Rate",
        "90011": "Income by Detention",
        "10040": "% Factor dispatch by load",
        "80011": "Expenses By Detention",
    }
    return {
        code: Account.objects.get_or_create(code=code, defaults={"name": name})[0]
        for code, name in codes.items()
    }


@pytest.fixture
def solo_driver_type(db):
    return DriverType.objects.get_or_create(
        id=4, defaults={"name": "Solo Driver", "is_active": True}
    )[0]


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
            "miles": 350,
            "payment": 2000.00,
            "broker": broker.pk,
            "carrier": carrier.pk,
            "shipper": shipper.pk,
            "receiver": receiver.pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["number"] == "LD-99999"
        assert response.data["details"] == "Must be on time."

    def test_details_blank_rejected(self, auth_client):
        from apps.loads.tests.factories import (
            BrokerFactory,
            BusinessFactory,
            CarrierFactory,
        )

        client, _ = auth_client
        city = CityFactory()
        payload = {
            "number": "LD-NO-DETAILS",
            "pickup_date": timezone.now().strftime("%Y-%m-%d %H:%M"),
            "dropoff_date": (timezone.now() + datetime.timedelta(days=2)).strftime(
                "%Y-%m-%d %H:%M"
            ),
            "pickup_city": city.pk,
            "dropoff_city": city.pk,
            "pickup_address": "123 Start Ave",
            "dropoff_address": "456 End Blvd",
            "miles": 350,
            "payment": 2000.00,
            "details": "",
            "broker": BrokerFactory().pk,
            "carrier": CarrierFactory().pk,
            "shipper": BusinessFactory().pk,
            "receiver": BusinessFactory().pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "details" in response.data

    def test_details_max_length_rejected(self, auth_client):
        from apps.loads.tests.factories import (
            BrokerFactory,
            BusinessFactory,
            CarrierFactory,
        )

        client, _ = auth_client
        city = CityFactory()
        payload = {
            "number": "LD-LONG-DETAILS",
            "pickup_date": timezone.now().strftime("%Y-%m-%d %H:%M"),
            "dropoff_date": (timezone.now() + datetime.timedelta(days=2)).strftime(
                "%Y-%m-%d %H:%M"
            ),
            "pickup_city": city.pk,
            "dropoff_city": city.pk,
            "pickup_address": "123 Start Ave",
            "dropoff_address": "456 End Blvd",
            "miles": 350,
            "payment": 2000.00,
            "details": "x" * 801,
            "broker": BrokerFactory().pk,
            "carrier": CarrierFactory().pk,
            "shipper": BusinessFactory().pk,
            "receiver": BusinessFactory().pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "details" in response.data

    def test_lumper_paid_by_required_when_lumper_is_positive(self, auth_client):
        from apps.loads.tests.factories import (
            BrokerFactory,
            BusinessFactory,
            CarrierFactory,
        )

        client, _ = auth_client
        city = CityFactory()
        payload = {
            "number": "LD-LUMPER-1",
            "pickup_date": timezone.now().strftime("%Y-%m-%d %H:%M"),
            "dropoff_date": (timezone.now() + datetime.timedelta(days=2)).strftime(
                "%Y-%m-%d %H:%M"
            ),
            "pickup_city": city.pk,
            "dropoff_city": city.pk,
            "pickup_address": "123 Start Ave",
            "dropoff_address": "456 End Blvd",
            "miles": 350,
            "payment": 2000.00,
            "lumper": 75.00,
            "broker": BrokerFactory().pk,
            "carrier": CarrierFactory().pk,
            "shipper": BusinessFactory().pk,
            "receiver": BusinessFactory().pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "lumper_paid_by" in response.data

    def test_lumper_paid_by_is_cleared_when_lumper_is_zero(self, auth_client):
        from apps.loads.tests.factories import (
            BrokerFactory,
            BusinessFactory,
            CarrierFactory,
        )

        client, _ = auth_client
        city = CityFactory()
        payload = {
            "number": "LD-LUMPER-0",
            "pickup_date": timezone.now().strftime("%Y-%m-%d %H:%M"),
            "dropoff_date": (timezone.now() + datetime.timedelta(days=2)).strftime(
                "%Y-%m-%d %H:%M"
            ),
            "pickup_city": city.pk,
            "dropoff_city": city.pk,
            "pickup_address": "123 Start Ave",
            "dropoff_address": "456 End Blvd",
            "miles": 350,
            "payment": 2000.00,
            "lumper": 0,
            "lumper_paid_by": Load.LumperPaidBy.DRIVER,
            "broker": BrokerFactory().pk,
            "carrier": CarrierFactory().pk,
            "shipper": BusinessFactory().pk,
            "receiver": BusinessFactory().pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["lumper_paid_by"] == ""

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

    def test_miles_required(self, auth_client):
        from apps.loads.tests.factories import (
            BrokerFactory,
            BusinessFactory,
            CarrierFactory,
        )

        client, _ = auth_client
        city = CityFactory()
        payload = {
            "number": "LD-NOMILES",
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
            "receiver": BusinessFactory().pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "miles" in response.data


@pytest.mark.django_db
class TestLoadUpdate:
    def test_patch_without_details_preserves_existing_value(self, auth_client):
        client, _ = auth_client
        load = LoadFactory(details="Keep this note")

        response = client.patch(
            reverse("load-detail", kwargs={"pk": load.pk}),
            {"payment": 1750.00},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["details"] == "Keep this note"
        load.refresh_from_db()
        assert load.details == "Keep this note"

    def test_patch_blank_details_rejected(self, auth_client):
        client, _ = auth_client
        load = LoadFactory(details="Keep this note")

        response = client.patch(
            reverse("load-detail", kwargs={"pk": load.pk}),
            {"details": ""},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "details" in response.data
        load.refresh_from_db()
        assert load.details == "Keep this note"

    def test_patch_details_max_length_rejected(self, auth_client):
        client, _ = auth_client
        load = LoadFactory(details="Keep this note")

        response = client.patch(
            reverse("load-detail", kwargs={"pk": load.pk}),
            {"details": "x" * 801},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "details" in response.data
        load.refresh_from_db()
        assert load.details == "Keep this note"

    def test_patch_details_accepts_valid_value(self, auth_client):
        client, _ = auth_client
        load = LoadFactory(details="Old note")

        response = client.patch(
            reverse("load-detail", kwargs={"pk": load.pk}),
            {"details": "Call before arrival."},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["details"] == "Call before arrival."
        load.refresh_from_db()
        assert load.details == "Call before arrival."


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
    def test_toggle_invoiced(
        self, auth_client, load_accounting_accounts, solo_driver_type
    ):
        client, _ = auth_client
        driver = DriverFactory(driver_type=solo_driver_type, factor=25.0)
        load = LoadFactory(invoiced=False, driver=driver)
        response = client.post(reverse("load-set-invoiced", kwargs={"pk": load.pk}))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["invoiced"] is True

    def test_toggle_invoiced_with_unsupported_driver_type_returns_400(
        self, auth_client, load_accounting_accounts
    ):
        client, _ = auth_client
        driver_type = DriverType.objects.create(
            id=99, name="Company Driver", is_active=True
        )
        driver = DriverFactory(driver_type=driver_type)
        load = LoadFactory(invoiced=False, driver=driver)

        response = client.post(reverse("load-set-invoiced", kwargs={"pk": load.pk}))

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Unsupported driver type" in response.data["error"]


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
            "miles": 350,
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
            "miles": 350,
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
            "miles": 350,
            "payment": 1500.00,
            "broker": broker.pk,
            "carrier": carrier.pk,
            "shipper": shipper.pk,
            "receiver": receiver.pk,
        }
        response = client.post(reverse("load-list"), payload)
        assert response.status_code == status.HTTP_201_CREATED
