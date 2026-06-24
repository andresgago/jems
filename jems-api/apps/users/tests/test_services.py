import pytest

from apps.users.models import User
from apps.users.services import (
    change_password,
    create_user,
    get_display_options,
    get_next_invoice_number,
    get_system_config,
    list_user_options,
    toggle_dispatcher,
    toggle_user_status,
    update_display_options,
    update_system_config,
    update_user,
)
from apps.users.tests.factories import DispatcherFactory, UserFactory


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
        user = UserFactory(id=99, status=User.Status.ACTIVE)
        updated = toggle_user_status(user=user)
        assert updated.status == User.Status.INACTIVE

    def test_inactive_user_becomes_active(self):
        user = UserFactory(id=100, status=User.Status.INACTIVE)
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

    def test_rejects_invalid_percent(self):
        user = UserFactory()
        with pytest.raises(Exception):
            update_user(user=user, percent=101)


@pytest.mark.django_db
class TestUserOptions:
    def test_returns_active_dispatchers_only(self):
        DispatcherFactory(first_name="Active", status=User.Status.ACTIVE)
        DispatcherFactory(first_name="Inactive", status=User.Status.INACTIVE)
        UserFactory(first_name="Regular", is_dispatcher=False)

        options = list(list_user_options(dispatchers=True))

        assert [u.first_name for u in options] == ["Active"]

    def test_filters_by_contract(self):
        DispatcherFactory(first_name="Percent", contract=User.Contract.BY_PERCENT)
        DispatcherFactory(first_name="Hour", contract=User.Contract.BY_HOUR)

        options = list(
            list_user_options(dispatchers=True, contract=User.Contract.BY_HOUR)
        )

        assert len(options) == 1
        assert options[0].first_name == "Hour"

    def test_main_dispatchers_exclude_current_user(self):
        current = DispatcherFactory(first_name="Current")
        other = DispatcherFactory(first_name="Other")

        options = list(list_user_options(main=True, exclude=current.pk))

        assert options == [other]


@pytest.mark.django_db
class TestSystemConfig:
    def test_get_system_config_creates_singleton_defaults(self):
        config = get_system_config()

        assert config.pk == 1
        assert config.dispatcher_invoice_hour == 1000

    def test_update_system_config(self):
        config = update_system_config(driver_invoice=1500)

        assert config.driver_invoice == 1500

    def test_next_invoice_number_can_persist(self):
        number = get_next_invoice_number(invoice="driver_invoice", next_and_save=True)

        assert number == 1001
        assert get_system_config().driver_invoice == 1001


@pytest.mark.django_db
class TestDisplayOptions:
    def test_get_display_options_creates_legacy_defaults(self):
        options = get_display_options()

        assert "number" in options.truck
        assert "licensenumber" in options.driver

    def test_update_display_options(self):
        options = update_display_options(driver="name,phone")

        assert options.driver == "name,phone"
