import factory
from factory.django import DjangoModelFactory

from apps.ai.models import Conversation, Message
from apps.users.tests.factories import UserFactory


class ConversationFactory(DjangoModelFactory):
    class Meta:
        model = Conversation

    user = factory.SubFactory(UserFactory)
    topic = factory.Sequence(lambda n: f"Topic {n}")


class MessageFactory(DjangoModelFactory):
    class Meta:
        model = Message

    conversation = factory.SubFactory(ConversationFactory)
    role = Message.Role.USER
    content = factory.Sequence(lambda n: f"Message content {n}")
