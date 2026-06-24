import factory
from factory.django import DjangoModelFactory

from apps.locations.models import City, State


class StateFactory(DjangoModelFactory):
    class Meta:
        model = State
        django_get_or_create = ("abbreviation",)

    name = factory.Sequence(lambda n: f"State {n}")
    abbreviation = factory.Sequence(lambda n: f"S{n:02d}")


class CityFactory(DjangoModelFactory):
    class Meta:
        model = City

    name = factory.Sequence(lambda n: f"City {n}")
    zip = factory.Sequence(lambda n: f"{n:05d}")
    state = factory.SubFactory(StateFactory)
