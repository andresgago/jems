from django.conf import settings
from django.db import models


class Broker(models.Model):
    class Status(models.IntegerChoices):
        INACTIVE = 0, "Inactive"
        ACTIVE = 1, "Active"

    mc = models.CharField(max_length=60, unique=True)
    name = models.CharField(max_length=255)
    dba_name = models.CharField(max_length=255, blank=True, default="")
    email = models.EmailField(max_length=255, unique=True, blank=True, null=True)
    phone = models.CharField(max_length=255, blank=True, default="")
    accounting_email = models.EmailField(max_length=255, blank=True, null=True)
    status = models.IntegerField(choices=Status.choices, default=Status.INACTIVE)
    setup_packet_file = models.FileField(upload_to="brokers/packets/", blank=True, null=True)
    factor_company = models.CharField(max_length=255, blank=True, default="")
    factor_account_id = models.CharField(max_length=255, blank=True, default="")
    buy_status = models.CharField(max_length=100, blank=True, default="")
    debtor_buy_status = models.CharField(max_length=100, blank=True, default="")
    details = models.TextField(blank=True, default="")
    checked_at = models.DateTimeField(null=True, blank=True)
    carrier = models.ForeignKey(
        "carriers.Carrier",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="brokers",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_brokers",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_brokers",
    )

    class Meta:
        db_table = "brokers"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.mc})"


class Business(models.Model):
    """Shipper or receiver business — used as load origin/destination."""

    class Status(models.IntegerChoices):
        INACTIVE = 0, "Inactive"
        ACTIVE = 1, "Active"

    name = models.CharField(max_length=255)
    status = models.IntegerField(choices=Status.choices, default=Status.ACTIVE)
    rating = models.FloatField(default=0.0)
    address = models.CharField(max_length=500, blank=True, default="")
    city = models.ForeignKey(
        "locations.City",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="businesses",
    )
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)

    class Meta:
        db_table = "business"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class BrokerContact(models.Model):
    broker = models.ForeignKey(Broker, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=255)
    email = models.EmailField(max_length=255, unique=True)
    phone = models.CharField(max_length=255, blank=True, default="")
    team = models.BooleanField(default=False)
    details = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "broker_contacts"
        ordering = ["email"]

    def __str__(self) -> str:
        return f"{self.name} <{self.email}>"
