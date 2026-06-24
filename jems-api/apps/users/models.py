from typing import cast

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.db import models
from django.core.exceptions import ValidationError


class UserManager(BaseUserManager):
    def create_user(self, username: str, email: str, password: str, **extra_fields):
        if not username:
            raise ValueError("Username is required")
        email = self.normalize_email(email)
        user = cast("User", self.model(username=username, email=email, **extra_fields))
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(
        self, username: str, email: str, password: str, **extra_fields
    ):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Status(models.IntegerChoices):
        INACTIVE = 0, "Inactive"
        ACTIVE = 10, "Active"

    class DispatcherType(models.IntegerChoices):
        MAIN = 0, "Main"
        ASSISTANT = 1, "Assistant"

    class Contract(models.IntegerChoices):
        BY_PERCENT = 0, "By Percent"
        BY_HOUR = 1, "By Hour"

    username = models.CharField(max_length=150, unique=True)
    first_name = models.CharField(max_length=200)
    last_name = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=200, blank=True, default="")
    status = models.IntegerField(choices=Status.choices, default=Status.ACTIVE)
    is_dispatcher = models.BooleanField(default=False)
    dispatcher_type = models.IntegerField(
        choices=DispatcherType.choices, default=DispatcherType.MAIN
    )
    is_main_dispatcher = models.BooleanField(default=False)
    contract = models.IntegerField(
        choices=Contract.choices, default=Contract.BY_PERCENT
    )
    percent = models.FloatField(default=0)
    hours = models.FloatField(default=0)
    start_hour = models.TimeField(null=True, blank=True)
    end_hour = models.TimeField(null=True, blank=True)
    color = models.CharField(max_length=20, blank=True, default="")
    photo = models.ImageField(upload_to="users/photos/", null=True, blank=True)
    address = models.CharField(max_length=300, blank=True, default="")
    social_security_number = models.CharField(max_length=12, blank=True, default="")
    carriers_access = models.JSONField(default=list, blank=True)
    dispatcher_access = models.JSONField(default=list, blank=True)
    carrier = models.IntegerField(default=0)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    position = models.ForeignKey(
        "Position",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users",
    )
    main_dispatcher = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assistant_users",
    )
    created_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_users",
    )
    updated_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_users",
    )

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = ["email", "first_name", "last_name"]

    class Meta:
        db_table = "users"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def is_active(self) -> bool:  # type: ignore[override]  # AbstractBaseUser defines this as a field; we derive it from status
        return self.status == self.Status.ACTIVE

    def clean(self):
        super().clean()
        if self.percent < 0 or self.percent > 100:
            raise ValidationError({"percent": "Percent must be between 0 and 100."})
        if self.hours < 0:
            raise ValidationError(
                {"hours": "Hours must be greater than or equal to 0."}
            )
        if self.dispatcher_type == self.DispatcherType.MAIN:
            self.main_dispatcher = None
        if self.main_dispatcher_id == self.pk and self.pk:
            raise ValidationError(
                {"main_dispatcher": "A user cannot be their own main dispatcher."}
            )

    def save(self, *args, **kwargs):
        self.is_main_dispatcher = self.dispatcher_type == self.DispatcherType.MAIN
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.full_name


class Position(models.Model):
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "positions"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class SystemConfig(models.Model):
    start_hours_work_dispatcher = models.TimeField(default="08:00")
    end_hours_work_dispatcher = models.TimeField(default="17:00")
    dispatcher_invoice_hour = models.IntegerField(default=1000)
    dispatcher_invoice_percent = models.IntegerField(default=1000)
    driver_invoice = models.IntegerField(default=1000)
    owner_invoice = models.IntegerField(default=1000)
    carrier = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "system_config"

    def __str__(self) -> str:
        return f"SystemConfig #{self.pk}"


class DisplayOptions(models.Model):
    truck = models.CharField(max_length=800, default="")
    trailer = models.CharField(max_length=800, default="")
    driver = models.CharField(max_length=800, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "display_options"
        verbose_name_plural = "display options"

    def __str__(self) -> str:
        return f"DisplayOptions #{self.pk}"
