import factory
from factory.django import DjangoModelFactory

from apps.brokers.models import Broker, BrokerContact


class BrokerFactory(DjangoModelFactory):
    class Meta:
        model = Broker

    mc = factory.Sequence(lambda n: f"BRK{n:06d}")
    name = factory.Sequence(lambda n: f"Broker {n}")
    dba_name = factory.Sequence(lambda n: f"DBA Broker {n}")
    email = factory.Sequence(lambda n: f"broker{n}@example.com")
    status = Broker.Status.ACTIVE


class BrokerContactFactory(DjangoModelFactory):
    class Meta:
        model = BrokerContact

    broker = factory.SubFactory(BrokerFactory)
    name = factory.Faker("name")
    email = factory.Sequence(lambda n: f"contact{n}@example.com")
    phone = factory.Faker("phone_number")
    team = False
