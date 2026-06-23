from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, username: str, email: str, password: str, **extra_fields):
        if not username:
            raise ValueError("Username is required")
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username: str, email: str, password: str, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Status(models.IntegerChoices):
        INACTIVE = 0, "Inactive"
        ACTIVE = 10, "Active"

    class DispatcherType(models.IntegerChoices):
        NONE = 0, "None"
        BY_PERCENT = 1, "By Percent"
        BY_HOUR = 2, "By Hour"

    username = models.CharField(max_length=150, unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=30, blank=True, default="")
    status = models.IntegerField(choices=Status.choices, default=Status.ACTIVE)
    is_dispatcher = models.BooleanField(default=False)
    dispatcher_type = models.IntegerField(choices=DispatcherType.choices, default=DispatcherType.NONE)
    is_main_dispatcher = models.BooleanField(default=False)
    percent = models.FloatField(default=0)
    hours = models.FloatField(default=0)
    start_hour = models.TimeField(null=True, blank=True)
    end_hour = models.TimeField(null=True, blank=True)
    color = models.CharField(max_length=20, blank=True, default="")
    photo = models.ImageField(upload_to="users/photos/", null=True, blank=True)
    carriers_access = models.JSONField(default=list, blank=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="created_users"
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
    def is_active(self) -> bool:
        return self.status == self.Status.ACTIVE

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
