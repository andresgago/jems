import pytest

from apps.users.models import User
from apps.users.services import (
    change_password,
    create_user,
    toggle_dispatcher,
    toggle_user_status,
    update_user,
)
from apps.users.tests.factories import UserFactory


@pytest.mark.django_db
class TestCreateUser:
    def test_creates_user_with_correct_fields(self):
        user = create_user(
            username="jdoe",
            email="jdoe@example.com",
            password="securepass123",
            first_name="John",
            last_name="Doe",
        )
        assert user.pk is not None
        assert user.username == "jdoe"
        assert user.full_name == "John Doe"
        assert user.status == User.Status.ACTIVE

    def test_password_is_hashed(self):
        user = create_user(
            username="jdoe2",
            email="jdoe2@example.com",
            password="securepass123",
            first_name="John",
            last_name="Doe",
        )
        assert user.password != "securepass123"
        assert user.check_password("securepass123")

    def test_raises_on_duplicate_username(self):
        UserFactory(username="taken")
        with pytest.raises(Exception):
            create_user(
                username="taken",
                email="other@example.com",
                password="pass123",
                first_name="X",
                last_name="Y",
            )


@pytest.mark.django_db
class TestToggleUserStatus:
    def test_active_user_becomes_inactive(self):
        user = UserFactory(status=User.Status.ACTIVE)
        updated = toggle_user_status(user=user)
        assert updated.status == User.Status.INACTIVE

    def test_inactive_user_becomes_active(self):
        user = UserFactory(status=User.Status.INACTIVE)
        updated = toggle_user_status(user=user)
        assert updated.status == User.Status.ACTIVE

    def test_protected_users_are_not_toggled(self):
        from apps.users.services import PROTECTED_USER_IDS

        user = UserFactory(status=User.Status.ACTIVE)
        # Simulate a protected ID without touching the DB
        original_pk = user.pk
        user.pk = next(iter(PROTECTED_USER_IDS))
        updated = toggle_user_status(user=user)
        user.pk = original_pk
        assert updated.status == User.Status.ACTIVE


@pytest.mark.django_db
class TestToggleDispatcher:
    def test_non_dispatcher_becomes_dispatcher(self):
        user = UserFactory(is_dispatcher=False)
        updated = toggle_dispatcher(user=user)
        assert updated.is_dispatcher is True

    def test_dispatcher_becomes_non_dispatcher(self):
        user = UserFactory(is_dispatcher=True)
        updated = toggle_dispatcher(user=user)
        assert updated.is_dispatcher is False


@pytest.mark.django_db
class TestChangePassword:
    def test_password_is_updated(self):
        user = UserFactory()
        change_password(user=user, new_password="newpass456")
        user.refresh_from_db()
        assert user.check_password("newpass456")

    def test_old_password_no_longer_works(self):
        user = UserFactory(password="oldpass123")
        change_password(user=user, new_password="newpass456")
        user.refresh_from_db()
        assert not user.check_password("oldpass123")


@pytest.mark.django_db
class TestUpdateUser:
    def test_updates_fields(self):
        user = UserFactory(first_name="Old", phone="000")
        updated = update_user(user=user, first_name="New", phone="555-1234")
        assert updated.first_name == "New"
        assert updated.phone == "555-1234"
