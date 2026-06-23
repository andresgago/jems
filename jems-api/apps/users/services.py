from django.contrib.auth.hashers import make_password

from .models import User

PROTECTED_USER_IDS = {1, 8}


def create_user(
    *,
    username: str,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    created_by: User | None = None,
    **extra_fields,
) -> User:
    user = User(
        username=username,
        email=email,
        first_name=first_name,
        last_name=last_name,
        created_by=created_by,
        **extra_fields,
    )
    user.set_password(password)
    user.full_clean()
    user.save()
    return user


def update_user(*, user: User, **fields) -> User:
    for field, value in fields.items():
        setattr(user, field, value)
    user.full_clean()
    user.save()
    return user


def toggle_user_status(*, user: User) -> User:
    if user.pk in PROTECTED_USER_IDS:
        return user
    user.status = (
        User.Status.INACTIVE if user.status == User.Status.ACTIVE else User.Status.ACTIVE
    )
    user.save(update_fields=["status", "updated_at"])
    return user


def toggle_dispatcher(*, user: User) -> User:
    user.is_dispatcher = not user.is_dispatcher
    user.save(update_fields=["is_dispatcher", "updated_at"])
    return user


def change_password(*, user: User, new_password: str) -> User:
    user.password = make_password(new_password)
    user.save(update_fields=["password", "updated_at"])
    return user
