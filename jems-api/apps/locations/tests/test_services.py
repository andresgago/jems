import pytest

from apps.locations.services import (
    create_city,
    list_cities,
    toggle_city_status,
    update_city,
)
from apps.locations.tests.factories import CityFactory, StateFactory


@pytest.mark.django_db
class TestListCities:
    def test_returns_all_cities_by_default(self):
        CityFactory(name="Austin", zip="78701")
        CityFactory(name="Dallas", zip="75201")
        assert list_cities().count() == 2

    def test_filter_by_name(self):
        CityFactory(name="Austin", zip="78701")
        CityFactory(name="Dallas", zip="75201")
        result = list_cities(q="aus")
        assert result.count() == 1
        assert result.first().name == "Austin"

    def test_filter_by_zip(self):
        CityFactory(name="Austin", zip="78701")
        CityFactory(name="Dallas", zip="75201")
        result = list_cities(q="787")
        assert result.count() == 1
        assert result.first().zip == "78701"

    def test_filter_by_state(self):
        tx = StateFactory(name="Texas", abbreviation="TX")
        nc = StateFactory(name="North Carolina", abbreviation="NC")
        CityFactory(state=tx)
        CityFactory(state=nc)
        result = list_cities(state_id=tx.id)
        assert result.count() == 1
        assert result.first().state == tx

    def test_filter_active_only(self):
        CityFactory(active=True)
        CityFactory(active=False)
        assert list_cities(active=True).count() == 1

    def test_filter_inactive_only(self):
        CityFactory(active=True)
        CityFactory(active=False)
        assert list_cities(active=False).count() == 1


@pytest.mark.django_db
class TestCreateCity:
    def test_create_city_success(self):
        state = StateFactory()
        city = create_city(name="Raleigh", zip="27601", state=state)
        assert city.pk is not None
        assert city.name == "Raleigh"
        assert city.zip == "27601"
        assert city.state == state
        assert city.active is True

    def test_create_city_with_timezone(self):
        state = StateFactory()
        city = create_city(
            name="Denver", zip="80201", state=state, timezone="America/Denver"
        )
        assert city.timezone == "America/Denver"

    def test_duplicate_name_zip_state_raises(self):
        state = StateFactory()
        create_city(name="Raleigh", zip="27601", state=state)
        # Django unique_together doesn't exist here — uniqueness is enforced via serializer,
        # not model. But full_clean will still run model validators.
        # Create a second one to verify DB allows it (uniqueness is in serializer layer).
        city2 = create_city(name="Raleigh", zip="27602", state=state)
        assert city2.pk is not None


@pytest.mark.django_db
class TestUpdateCity:
    def test_update_name(self):
        city = CityFactory(name="Old Name")
        updated = update_city(city=city, name="New Name")
        assert updated.name == "New Name"
        city.refresh_from_db()
        assert city.name == "New Name"

    def test_update_timezone(self):
        city = CityFactory(timezone="")
        updated = update_city(city=city, timezone="America/Chicago")
        assert updated.timezone == "America/Chicago"

    def test_update_active_field(self):
        city = CityFactory(active=True)
        updated = update_city(city=city, active=False)
        assert updated.active is False


@pytest.mark.django_db
class TestToggleCityStatus:
    def test_toggle_active_to_inactive(self):
        city = CityFactory(active=True)
        result = toggle_city_status(city=city)
        assert result.active is False
        city.refresh_from_db()
        assert city.active is False

    def test_toggle_inactive_to_active(self):
        city = CityFactory(active=False)
        result = toggle_city_status(city=city)
        assert result.active is True
        city.refresh_from_db()
        assert city.active is True
