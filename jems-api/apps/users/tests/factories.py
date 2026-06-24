import factory
from factory.django import DjangoModelFactory

from apps.users.models import Position, User


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User

    username = factory.Sequence(lambda n: f"user{n}")
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    phone = factory.Faker("phone_number")
    status = User.Status.ACTIVE
    is_dispatcher = False
    is_staff = False

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        password = kwargs.pop("password", "testpass123")
        user = model_class(*args, **kwargs)
        user.set_password(password)
        user.save()
        return user


class AdminUserFactory(UserFactory):
    is_staff = True
    is_superuser = True


class DispatcherFactory(UserFactory):
    is_dispatcher = True
    dispatcher_type = User.DispatcherType.MAIN
    contract = User.Contract.BY_PERCENT
    percent = 5.0


class AssistantDispatcherFactory(DispatcherFactory):
    dispatcher_type = User.DispatcherType.ASSISTANT


class PositionFactory(DjangoModelFactory):
    class Meta:
        model = Position

    name = factory.Sequence(lambda n: f"Position {n}")
    is_active = True
