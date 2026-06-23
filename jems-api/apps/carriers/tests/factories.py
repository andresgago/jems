import factory
from factory.django import DjangoModelFactory

from apps.carriers.models import Carrier
from apps.locations.models import State


class StateFactory(DjangoModelFactory):
    class Meta:
        model = State
        django_get_or_create = ("abbreviation",)

    name = factory.Sequence(lambda n: f"State {n}")
    abbreviation = factory.Sequence(lambda n: f"S{n:02d}")


class CarrierFactory(DjangoModelFactory):
    class Meta:
        model = Carrier

    mc = factory.Sequence(lambda n: f"MC{n:06d}")
    dot_number = factory.Sequence(lambda n: f"DOT{n:06d}")
    name = factory.Sequence(lambda n: f"Carrier {n}")
    dba_name = factory.Sequence(lambda n: f"DBA {n}")
    email = factory.Sequence(lambda n: f"carrier{n}@example.com")
    active = True
    state = factory.SubFactory(StateFactory)
