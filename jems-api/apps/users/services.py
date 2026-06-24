from django.contrib.auth.hashers import make_password
from django.db.models import Q

from .models import DisplayOptions, SystemConfig, User

PROTECTED_USER_IDS = {1, 8}

DEFAULT_TRUCK_OPTIONS = (
    "number,VIN,cabintype,make,year,owner,loss_payee_id,odometer_start"
)
DEFAULT_TRAILER_OPTIONS = "number,year,VIN,losspayee,owner"
DEFAULT_DRIVER_OPTIONS = "name,lastname,phone,licensenumber,licensestate,birth"


def list_users(
    *,
    q: str = "",
    status: int | None = None,
    is_dispatcher: bool | None = None,
):
    qs = User.objects.select_related("position", "main_dispatcher").order_by(
        "first_name", "last_name"
    )
    if q:
        qs = qs.filter(
            Q(username__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(email__icontains=q)
            | Q(phone__icontains=q)
        )
    if status is not None:
        qs = qs.filter(status=status)
    if is_dispatcher is not None:
        qs = qs.filter(is_dispatcher=is_dispatcher)
    return qs


def list_user_options(
    *,
    dispatchers: bool = False,
    contract: int | None = None,
    main: bool = False,
    exclude: int | None = None,
    active_only: bool = True,
):
    qs = User.objects.order_by("first_name", "last_name")
    if active_only:
        qs = qs.filter(status=User.Status.ACTIVE)
    if dispatchers or main or contract is not None:
        qs = qs.filter(is_dispatcher=True)
    if contract is not None:
        qs = qs.filter(contract=contract)
    elif dispatchers:
        qs = qs.exclude(contract=-1)
    if main:
        qs = qs.filter(dispatcher_type=User.DispatcherType.MAIN)
    if exclude is not None:
        qs = qs.exclude(pk=exclude)
    return qs


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
    extra_fields = _normalize_user_fields(extra_fields)
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
    fields = _normalize_user_fields(fields)
    for field, value in fields.items():
        setattr(user, field, value)
    user.full_clean()
    user.save()
    return user


def toggle_user_status(*, user: User) -> User:
    if user.pk in PROTECTED_USER_IDS:
        return user
    user.status = (
        User.Status.INACTIVE
        if user.status == User.Status.ACTIVE
        else User.Status.ACTIVE
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


def set_user_photo(*, user: User, photo) -> User:
    user.photo = photo
    user.full_clean(exclude=["password"])
    user.save(update_fields=["photo", "updated_at"])
    return user


def clear_user_photo(*, user: User) -> User:
    if user.photo:
        user.photo.delete(save=False)
    user.photo = None
    user.save(update_fields=["photo", "updated_at"])
    return user


def get_system_config() -> SystemConfig:
    config, _ = SystemConfig.objects.get_or_create(pk=1)
    return config


def update_system_config(**fields) -> SystemConfig:
    config = get_system_config()
    for field, value in fields.items():
        setattr(config, field, value)
    config.full_clean()
    config.save()
    return config


def get_next_invoice_number(*, invoice: str, next_and_save: bool = False) -> int:
    allowed = {
        "dispatcher_invoice_hour",
        "dispatcher_invoice_percent",
        "driver_invoice",
        "owner_invoice",
    }
    if invoice not in allowed:
        raise ValueError("Unknown invoice counter.")
    config = get_system_config()
    current = getattr(config, invoice) or 1000
    number = current + 1
    if next_and_save:
        setattr(config, invoice, number)
        config.save(update_fields=[invoice, "updated_at"])
    return number


def get_display_options() -> DisplayOptions:
    options, created = DisplayOptions.objects.get_or_create(
        pk=1,
        defaults={
            "truck": DEFAULT_TRUCK_OPTIONS,
            "trailer": DEFAULT_TRAILER_OPTIONS,
            "driver": DEFAULT_DRIVER_OPTIONS,
        },
    )
    if created:
        return options
    changed = False
    for field, default in (
        ("truck", DEFAULT_TRUCK_OPTIONS),
        ("trailer", DEFAULT_TRAILER_OPTIONS),
        ("driver", DEFAULT_DRIVER_OPTIONS),
    ):
        if getattr(options, field) == "":
            setattr(options, field, default)
            changed = True
    if changed:
        options.save()
    return options


def update_display_options(**fields) -> DisplayOptions:
    options = get_display_options()
    for field, value in fields.items():
        setattr(options, field, value)
    options.full_clean()
    options.save()
    return options


def _normalize_user_fields(fields: dict) -> dict:
    normalized = dict(fields)
    if "dispatcher_type" in normalized:
        if normalized["dispatcher_type"] == User.DispatcherType.MAIN:
            normalized["main_dispatcher"] = None
        normalized["is_main_dispatcher"] = (
            normalized["dispatcher_type"] == User.DispatcherType.MAIN
        )
    return normalized
