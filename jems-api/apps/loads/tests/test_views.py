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
    BrokerFactory,
    CarrierFactory,
    CityFactory,
    DriverFactory,
    LoadFactory,
    LoadStopFactory,
    StateFactory,
    TrailerFactory,
    TrailerTypeFactory,
    TruckFactory,
    UserFactory,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client):
    user = UserFactory(is_dispatcher=True)
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


def load_results(response):
    if isinstance(response.data, dict):
        return response.data["results"]
    return response.data


@pytest.mark.django_db
class TestLoadList:
    def test_lists_loads(self, auth_client):
        client, _ = auth_client
        LoadFactory.create_batch(3)
        response = client.get(reverse("load-list"))
        assert response.status_code == status.HTTP_200_OK
        assert len(load_results(response)) >= 3
        assert response.data["count"] >= 3

    def test_lists_loads_paginated_by_default(self, auth_client):
        client, _ = auth_client
        LoadFactory.create_batch(30)

        response = client.get(reverse("load-list"))

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] >= 30
        assert len(response.data["results"]) == 25

    def test_lists_all_filtered_loads_when_requested(self, auth_client):
        client, _ = auth_client
        LoadFactory.create_batch(30, status=Load.Status.STARTED)
        LoadFactory(status=Load.Status.REGISTERED)

        response = client.get(
            reverse("load-list"),
            {"status": Load.Status.STARTED, "all": "true"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["count"] == 30
        assert len(response.data["results"]) == 30
        assert response.data["next"] is None
        assert all(
            load["status"] == Load.Status.STARTED for load in response.data["results"]
        )

    def test_filter_by_status(self, auth_client):
        client, _ = auth_client
        LoadFactory(status=Load.Status.STARTED)
        LoadFactory(status=Load.Status.REGISTERED)
        response = client.get(reverse("load-list") + f"?status={Load.Status.STARTED}")
        assert response.status_code == status.HTTP_200_OK
        assert all(
            load["status"] == Load.Status.STARTED for load in load_results(response)
        )

    def test_filter_by_history_flag(self, auth_client):
        client, _ = auth_client
        active_load = LoadFactory(history=False)
        history_load = LoadFactory(history=True)

        response = client.get(reverse("load-list"), {"history": "true"})

        assert response.status_code == status.HTTP_200_OK
        numbers = {row["number"] for row in load_results(response)}
        assert history_load.number in numbers
        assert active_load.number not in numbers

    def test_filter_by_broker_text_matches_name_dba_mc_and_carrier(self, auth_client):
        client, _ = auth_client
        carrier = CarrierFactory(name="Blue Carrier")
        broker = BrokerFactory(
            name="Alpha Freight", dba_name="Road Runner", mc="MCROAD"
        )
        name_load = LoadFactory(broker=broker)
        carrier_load = LoadFactory(carrier=carrier)
        other_load = LoadFactory()

        for query, expected in [
            ("Alpha", name_load.number),
            ("Road", name_load.number),
            ("MCROAD", name_load.number),
            ("Blue Carrier", carrier_load.number),
        ]:
            response = client.get(reverse("load-list"), {"broker": query})
            assert response.status_code == status.HTTP_200_OK
            numbers = {row["number"] for row in load_results(response)}
            assert expected in numbers
            assert other_load.number not in numbers

    def test_filter_by_dispatcher_text(self, auth_client):
        client, _ = auth_client
        dispatcher = UserFactory(
            first_name="Pedro", last_name="Cancino", username="pcancino"
        )
        matching_load = LoadFactory(dispatcher=dispatcher)
        other_load = LoadFactory()

        response = client.get(reverse("load-list"), {"dispatcher": "Cancino"})

        assert response.status_code == status.HTTP_200_OK
        numbers = {row["number"] for row in load_results(response)}
        assert matching_load.number in numbers
        assert other_load.number not in numbers

    def test_filter_by_driver_text_matches_driver_team_truck_and_trailer(
        self, auth_client
    ):
        client, _ = auth_client
        driver = DriverFactory(first_name="Alain", last_name="Reynier")
        team_driver = DriverFactory(first_name="Team", last_name="Mate")
        truck = TruckFactory(number="TRK-4268")
        trailer = TrailerFactory(number="TRL-534242")
        load = LoadFactory(
            driver=driver,
            team_driver=team_driver,
            truck=truck,
            trailer=trailer,
        )
        other_load = LoadFactory()

        for query in ["Alain", "Mate", "4268", "534242"]:
            response = client.get(reverse("load-list"), {"driver": query})
            assert response.status_code == status.HTTP_200_OK
            numbers = {row["number"] for row in load_results(response)}
            assert load.number in numbers
            assert other_load.number not in numbers

    def test_filter_by_pickup_and_dropoff_city_text(self, auth_client):
        client, _ = auth_client
        state = StateFactory(name="North Carolina", abbreviation="NC")
        pickup_city = CityFactory(name="Pineville", zip="28134", state=state)
        dropoff_city = CityFactory(name="Charlotte", zip="28202", state=state)
        load = LoadFactory(pickup_city=pickup_city, dropoff_city=dropoff_city)
        other_load = LoadFactory()

        response = client.get(reverse("load-list"), {"pickup_city": "28134"})
        assert response.status_code == status.HTTP_200_OK
        numbers = {row["number"] for row in load_results(response)}
        assert load.number in numbers
        assert other_load.number not in numbers

        response = client.get(reverse("load-list"), {"dropoff_city": "Charlotte"})
        assert response.status_code == status.HTTP_200_OK
        numbers = {row["number"] for row in load_results(response)}
        assert load.number in numbers
        assert other_load.number not in numbers

    def test_filter_by_invoiced_and_paid_flags(self, auth_client):
        client, _ = auth_client
        matching_load = LoadFactory(invoiced=True, paid=True)
        LoadFactory(invoiced=True, paid=False)
        LoadFactory(invoiced=False, paid=True)

        response = client.get(
            reverse("load-list"), {"invoiced": "true", "paid": "true"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert {row["number"] for row in load_results(response)} == {
            matching_load.number
        }

    def test_date_type_all_ignores_date_bounds(self, auth_client):
        client, _ = auth_client
        old_load = LoadFactory(pickup_date=timezone.now() - datetime.timedelta(days=30))

        response = client.get(
            reverse("load-list"),
            {
                "date_type": "all",
                "date_from": (timezone.now() + datetime.timedelta(days=30))
                .date()
                .isoformat(),
            },
        )

        assert response.status_code == status.HTTP_200_OK
        assert old_load.number in {row["number"] for row in load_results(response)}

    def test_list_exposes_tms_grid_fields_and_broker_denial(self, auth_client):
        client, _ = auth_client
        broker = BrokerFactory(
            name="Fallback Broker",
            dba_name="Local Jobee",
            buy_status="0",
            debtor_buy_status="No Buy - Denied For Purchases",
        )
        trailer_type = TrailerTypeFactory(short_name="V")
        truck = TruckFactory(number="4268")
        trailer = TrailerFactory(number="J534242", trailer_type=trailer_type)
        driver = DriverFactory(first_name="Alain", last_name="Reynier")
        load = LoadFactory(
            broker=broker,
            driver=driver,
            truck=truck,
            trailer=trailer,
            trailer_type=trailer_type,
            rate_file="loads/rates/rate.pdf",
            bill_file="loads/bills/bill.pdf",
            shipper_rating=5,
            receiver_rating=5,
        )

        response = client.get(reverse("load-list"), {"number": load.number})

        assert response.status_code == status.HTTP_200_OK
        row = load_results(response)[0]
        assert row["broker_name"] == "Local Jobee"
        assert row["broker_denied"] is True
        assert row["broker_debtor_buy_status"] == "No Buy - Denied For Purchases"
        assert row["driver_name"] == "Alain Reynier"
        assert row["truck_number"] == "4268"
        assert row["trailer_number"] == "J534242"
        assert row["trailer_type_short_name"] == "V"
        assert row["assignment_complete"] is True
        assert row["ready_to_execute"] is True

    def test_list_grid_field_edges_without_optional_relations(self, auth_client):
        client, _ = auth_client
        city = CityFactory(name="Plain City", state=None, zip="99999")
        broker = BrokerFactory(name="Allowed Broker", dba_name="", buy_status="1")
        load = LoadFactory(
            broker=broker,
            pickup_city=city,
            dropoff_city=city,
            driver=None,
            truck=None,
            trailer=None,
            rate_file="",
            bill_file="",
        )

        response = client.get(reverse("load-list"), {"number": load.number})

        assert response.status_code == status.HTTP_200_OK
        row = load_results(response)[0]
        assert row["broker_name"] == "Allowed Broker"
        assert row["broker_denied"] is False
        assert row["pickup_city_display"] == "Plain City"
        assert row["dropoff_city_display"] == "Plain City"
        assert row["driver_photo"] == ""
        assert row["assignment_complete"] is False
        assert row["ready_to_execute"] is False

    def test_filter_by_dropoff_date_type(self, auth_client):
        client, _ = auth_client
        old_load = LoadFactory(
            dropoff_date=timezone.now() - datetime.timedelta(days=10)
        )
        new_load = LoadFactory(dropoff_date=timezone.now() + datetime.timedelta(days=2))

        response = client.get(
            reverse("load-list"),
            {
                "date_type": "dropoff",
                "date_from": (timezone.now() - datetime.timedelta(days=1))
                .date()
                .isoformat(),
            },
        )

        assert response.status_code == status.HTTP_200_OK
        numbers = {row["number"] for row in load_results(response)}
        assert new_load.number in numbers
        assert old_load.number not in numbers

    def test_unauthenticated_blocked(self, api_client):
        response = api_client.get(reverse("load-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_regular_authenticated_user_blocked(self, api_client):
        user = UserFactory(is_dispatcher=False, is_staff=False, is_superuser=False)
        api_client.force_authenticate(user=user)

        response = api_client.get(reverse("load-list"))

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_non_dispatcher_can_list(self, api_client):
        user = UserFactory(is_dispatcher=False, is_staff=True)
        api_client.force_authenticate(user=user)

        response = api_client.get(reverse("load-list"))

        assert response.status_code == status.HTTP_200_OK


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


@pytest.mark.django_db
class TestSendDriverInfoView:
    def test_unauthenticated_rejected(self, api_client):
        response = api_client.post(reverse("load-send-driver-info"), {})
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_missing_fields_returns_400(self, auth_client):
        client, _ = auth_client
        response = client.post(reverse("load-send-driver-info"), {})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Missing fields" in response.data["detail"]

    def test_partial_fields_returns_400(self, auth_client):
        client, _ = auth_client
        response = client.post(
            reverse("load-send-driver-info"),
            {"carrier_id": 1, "driver_id": 1},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_valid_payload_sends_email(self, auth_client):
        from unittest.mock import patch
        from apps.loads.tests.factories import (
            CarrierFactory,
            DriverFactory,
            TruckFactory,
            TrailerFactory,
        )
        from apps.fleet.models import Truck, Trailer

        client, _ = auth_client
        carrier = CarrierFactory(
            no_reply_email="nr@test.com", no_reply_password="pw", cc_email=None
        )
        driver = DriverFactory()
        truck = TruckFactory(status=Truck.Status.ACTIVE)
        trailer = TrailerFactory(status=Trailer.Status.ACTIVE)

        with patch("apps.loads.services.get_connection"), patch(
            "apps.loads.services.EmailMessage"
        ) as mock_msg_cls:
            from unittest.mock import MagicMock

            mock_msg_cls.return_value = MagicMock()
            response = client.post(
                reverse("load-send-driver-info"),
                {
                    "carrier_id": carrier.pk,
                    "driver_id": driver.pk,
                    "truck_id": truck.pk,
                    "trailer_id": trailer.pk,
                    "broker_email": "broker@example.com",
                },
            )

        assert response.status_code == status.HTTP_200_OK
        assert "sent successfully" in response.data["detail"]
        mock_msg_cls.return_value.send.assert_called_once()
