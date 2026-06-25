from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Load(models.Model):
    class Status(models.IntegerChoices):
        REGISTERED = 1, "Registered"
        STARTED = 2, "Started"
        FINISHED = 3, "Finished"
        DETENTION_PENDING = 4, "Detention Pending"
        CANCELLED = 5, "Cancelled"

    class LumperPaidBy(models.TextChoices):
        COMPANY = "company", "Company"
        BROKER = "broker", "Broker"
        DRIVER = "driver", "Driver"

    number = models.CharField(max_length=60, unique=True)
    miles = models.FloatField(default=0.0)
    miles_empty = models.FloatField(default=0.0)
    weight = models.FloatField(default=0.0)
    trailer_type = models.ForeignKey(
        "fleet.TrailerType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loads",
    )
    # Pickup
    pickup_date = models.DateTimeField()
    pickup_city = models.ForeignKey(
        "locations.City",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pickup_loads",
    )
    pickup_address = models.CharField(max_length=500)
    # Dropoff
    dropoff_date = models.DateTimeField()
    dropoff_city = models.ForeignKey(
        "locations.City",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dropoff_loads",
    )
    dropoff_address = models.CharField(max_length=500)
    # Financials
    payment = models.FloatField(default=0.0)
    detention = models.FloatField(default=0.0)
    lumper = models.FloatField(default=0.0)
    lumper_paid_by = models.CharField(
        max_length=10, choices=LumperPaidBy.choices, blank=True, default=""
    )
    drop_trailer = models.FloatField(default=0.0)
    # Relations
    broker = models.ForeignKey(
        "brokers.Broker",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loads",
    )
    broker_contacts = models.CharField(max_length=500, blank=True, default="")
    dispatcher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dispatched_loads",
    )
    carrier = models.ForeignKey(
        "carriers.Carrier",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loads",
    )
    truck = models.ForeignKey(
        "fleet.Truck",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loads",
    )
    trailer = models.ForeignKey(
        "fleet.Trailer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loads",
    )
    driver = models.ForeignKey(
        "drivers.Driver",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loads",
    )
    team_driver = models.ForeignKey(
        "drivers.Driver",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="team_loads",
    )
    shipper = models.ForeignKey(
        "brokers.Business",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipper_loads",
    )
    receiver = models.ForeignKey(
        "brokers.Business",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receiver_loads",
    )
    shipper_rating = models.IntegerField(default=0)
    receiver_rating = models.IntegerField(default=0)
    # Documents
    rate_file = models.FileField(upload_to="loads/rates/", blank=True, null=True)
    bill_file = models.FileField(upload_to="loads/bills/", blank=True, null=True)
    lumper_file = models.FileField(upload_to="loads/lumpers/", blank=True, null=True)
    detention_file = models.FileField(
        upload_to="loads/detentions/", blank=True, null=True
    )
    # Status and flags
    status = models.IntegerField(choices=Status.choices, default=Status.REGISTERED)
    execute = models.BooleanField(default=False)
    invoiced = models.BooleanField(default=False)
    paid = models.BooleanField(default=False)
    owner_invoiced = models.BooleanField(default=False)
    owner_invoice_number = models.IntegerField(default=0)
    owner_paid = models.BooleanField(default=False)
    history = models.BooleanField(default=False)
    move = models.BooleanField(default=False)
    dispatch_invoice_percent = models.ForeignKey(
        "dispatch.DispatcherWorkInvoiceByPercent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loads",
    )
    drivers_paid = models.BooleanField(default=False)

    class DropPlace(models.IntegerChoices):
        DROPOFF = 0, "In drop off"
        PICKUP = 1, "In pick up"

    # Drop related
    is_drop = models.BooleanField(default=False)
    drop_place = models.IntegerField(
        choices=DropPlace.choices,
        null=True,
        blank=True,
    )
    days_in_drop = models.IntegerField(default=0)
    # Notification flags
    rc_notified = models.BooleanField(default=False)
    bol_notified = models.BooleanField(default=False)
    lumper_notified = models.BooleanField(default=False)
    detention_notified = models.BooleanField(default=False)
    # Tracking
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    eta = models.IntegerField(null=True, blank=True)
    accounting_day = models.IntegerField(null=True, blank=True)
    details = models.CharField(max_length=800, default="Must be on time.")
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_loads",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_loads",
    )
    executed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="executed_loads",
    )

    class Meta:
        db_table = "loads"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.number

    def clean(self) -> None:
        super().clean()
        if self.lumper <= 0:
            self.lumper_paid_by = ""
        elif not self.lumper_paid_by:
            raise ValidationError(
                {
                    "lumper_paid_by": "Lumper Paid By is required when lumper is greater than 0."
                }
            )


class LoadStop(models.Model):
    class StopType(models.IntegerChoices):
        PICKUP = 1, "Pickup"
        DROPOFF = 2, "Dropoff"

    load = models.ForeignKey(Load, on_delete=models.CASCADE, related_name="stops")
    stop_type = models.IntegerField(choices=StopType.choices, default=StopType.PICKUP)
    from_date = models.DateField()
    to_date = models.DateField()
    bol_file = models.FileField(upload_to="loads/stops/bol/", blank=True, null=True)
    truck = models.ForeignKey(
        "fleet.Truck",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stop_trucks",
    )
    trailer = models.ForeignKey(
        "fleet.Trailer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stop_trailers",
    )
    driver = models.ForeignKey(
        "drivers.Driver",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stop_drivers",
    )
    business = models.ForeignKey(
        "brokers.Business",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stops",
    )
    business_rating = models.IntegerField(null=True, blank=True)
    is_drop = models.BooleanField(default=False)
    address = models.CharField(max_length=500)
    city = models.ForeignKey(
        "locations.City",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stops",
    )
    details = models.TextField(blank=True, default="")
    is_fcfs = models.BooleanField(default=False)
    po_number = models.CharField(max_length=100, blank=True, default="")
    commodity = models.CharField(max_length=100, blank=True, default="")
    temperature = models.CharField(max_length=10, blank=True, default="")
    driver_notes = models.CharField(max_length=255, blank=True, default="")
    arrived_at = models.DateTimeField(null=True, blank=True)
    departed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_stops",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_stops",
    )

    class Meta:
        db_table = "load_stops"
        ordering = ["from_date", "stop_type"]

    def __str__(self) -> str:
        return f"Stop {self.stop_type} – {self.load.number}"
