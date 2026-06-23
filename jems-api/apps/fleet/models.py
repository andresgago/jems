from django.db import models

# --- Lookup tables ---


class TruckType(models.Model):
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "truck_types"

    def __str__(self) -> str:
        return self.name


class TrailerType(models.Model):
    name = models.CharField(max_length=200, unique=True)
    short_name = models.CharField(max_length=3, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "trailer_types"

    def __str__(self) -> str:
        return self.name


class EngineType(models.Model):
    name = models.CharField(max_length=100)

    class Meta:
        db_table = "engine_types"

    def __str__(self) -> str:
        return self.name


class CabinType(models.Model):
    name = models.CharField(max_length=100)

    class Meta:
        db_table = "cabin_types"

    def __str__(self) -> str:
        return self.name


class TransmissionType(models.Model):
    name = models.CharField(max_length=100)

    class Meta:
        db_table = "transmission_types"

    def __str__(self) -> str:
        return self.name


class Make(models.Model):
    name = models.CharField(max_length=100)

    class Meta:
        db_table = "makes"

    def __str__(self) -> str:
        return self.name


class TireSize(models.Model):
    name = models.CharField(max_length=50)

    class Meta:
        db_table = "tire_sizes"

    def __str__(self) -> str:
        return self.name


class Card(models.Model):
    number = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "cards"

    def __str__(self) -> str:
        return self.number


# --- TruckOwner ---


class TruckOwner(models.Model):
    class Status(models.IntegerChoices):
        INACTIVE = 0, "Inactive"
        ACTIVE = 1, "Active"

    class OwnerType(models.IntegerChoices):
        COMPANY = 1, "Company"
        OWNER_OPERATOR = 2, "Owner Operator"

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    status = models.IntegerField(choices=Status.choices, default=Status.ACTIVE)
    owner_type = models.IntegerField(
        choices=OwnerType.choices, default=OwnerType.OWNER_OPERATOR
    )
    worker_comp = models.FloatField(default=0)
    factor_dispatch = models.FloatField(default=0)
    factor_fee = models.FloatField(default=0)
    percent = models.FloatField(default=0)
    insurance = models.FloatField(default=0)
    truck_amount = models.FloatField(default=0)
    driver_amount = models.FloatField(default=0)
    truck_yard_rent = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "truck_owners"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def __str__(self) -> str:
        return self.full_name


# --- Truck ---


class Truck(models.Model):
    class Status(models.IntegerChoices):
        INACTIVE = 0, "Inactive"
        ACTIVE = 1, "Active"

    number = models.CharField(max_length=60, unique=True)
    vin = models.CharField(max_length=100, blank=True, default="")
    year = models.IntegerField(null=True, blank=True)
    truck_type = models.ForeignKey(
        TruckType,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trucks",
    )
    status = models.IntegerField(choices=Status.choices, default=Status.ACTIVE)
    plate = models.CharField(max_length=30, blank=True, default="")
    transponder = models.CharField(max_length=100, blank=True, default="")

    # Specs
    make = models.ForeignKey(
        Make, null=True, blank=True, on_delete=models.SET_NULL, related_name="trucks"
    )
    engine_type = models.ForeignKey(
        EngineType,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trucks",
    )
    cabin_type = models.ForeignKey(
        CabinType,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trucks",
    )
    transmission_type = models.ForeignKey(
        TransmissionType,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trucks",
    )
    tire_size = models.ForeignKey(
        TireSize,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trucks",
    )
    gross_weight = models.FloatField(default=0)
    odometer_current = models.FloatField(default=0)

    # Documents
    avi_file = models.FileField(upload_to="trucks/avi/", null=True, blank=True)
    avi_expiration = models.DateField(null=True, blank=True)
    registration_file = models.FileField(
        upload_to="trucks/registration/", null=True, blank=True
    )
    registration_expiration = models.DateField(null=True, blank=True)
    agreement_file = models.FileField(
        upload_to="trucks/agreements/", null=True, blank=True
    )
    photo = models.ImageField(upload_to="trucks/photos/", null=True, blank=True)

    # Purchase / Financing
    purchase_date = models.DateField(null=True, blank=True)
    purchase_cost = models.FloatField(default=0)
    is_leased = models.BooleanField(default=False)
    leased_name = models.CharField(max_length=200, blank=True, default="")
    loan_term = models.CharField(max_length=100, blank=True, default="")
    interest_rate = models.CharField(max_length=50, blank=True, default="")
    monthly_bill = models.CharField(max_length=50, blank=True, default="")
    remaining_balance = models.CharField(max_length=50, blank=True, default="")

    # Assignments
    dispatcher = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="dispatched_trucks",
    )
    owner = models.ForeignKey(
        TruckOwner,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trucks",
    )
    fuel_card = models.ForeignKey(
        Card, null=True, blank=True, on_delete=models.SET_NULL, related_name="trucks"
    )
    carrier = models.ForeignKey(
        "carriers.Carrier",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trucks",
    )
    carrier_start_date = models.DateField(null=True, blank=True)
    carrier_end_date = models.DateField(null=True, blank=True)
    carrier_end_reason = models.TextField(blank=True, default="")
    loss_payee = models.ForeignKey(
        "fleet.LossPayee",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trucks",
    )

    # ELD
    mac_address = models.CharField(max_length=50, blank=True, default="")
    serial_number = models.CharField(max_length=100, blank=True, default="")
    eld_company = models.CharField(max_length=100, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_trucks",
    )

    class Meta:
        db_table = "trucks"

    def __str__(self) -> str:
        return self.number


class TruckMaintenance(models.Model):
    truck = models.ForeignKey(
        Truck, on_delete=models.CASCADE, related_name="maintenance_records"
    )
    date = models.DateField()
    miles_alert = models.IntegerField(default=0)
    time_alert = models.IntegerField(default=0)
    time_year = models.IntegerField(default=0)
    time_month = models.IntegerField(default=0)
    odometer_start = models.FloatField(default=0)
    odometer_current = models.FloatField(default=0)
    detail = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "truck_maintenance"
        ordering = ["-date"]

    def __str__(self) -> str:
        return f"{self.truck} - {self.date}"


# --- Trailer ---


class Trailer(models.Model):
    class Status(models.IntegerChoices):
        INACTIVE = 0, "Inactive"
        ACTIVE = 1, "Active"

    number = models.CharField(max_length=60, unique=True)
    vin = models.CharField(max_length=100, blank=True, default="")
    year = models.IntegerField(null=True, blank=True)
    width = models.FloatField(default=0)
    height = models.FloatField(default=0)
    trailer_type = models.ForeignKey(
        TrailerType,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trailers",
    )
    status = models.IntegerField(choices=Status.choices, default=Status.ACTIVE)
    plate_number = models.CharField(max_length=30, blank=True, default="")
    plate_state = models.ForeignKey(
        "locations.State",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trailers",
    )

    # Documents
    annual_inspection_file = models.FileField(
        upload_to="trailers/inspections/", null=True, blank=True
    )
    annual_inspection_expiration = models.DateField(null=True, blank=True)
    registration_file = models.FileField(
        upload_to="trailers/registration/", null=True, blank=True
    )
    agreement_file = models.FileField(
        upload_to="trailers/agreements/", null=True, blank=True
    )

    # Purchase
    purchase_date = models.DateField(null=True, blank=True)
    purchase_cost = models.FloatField(default=0)
    is_rented = models.BooleanField(default=False)
    loss_payee = models.CharField(max_length=200, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_trailers",
    )

    class Meta:
        db_table = "trailers"

    def __str__(self) -> str:
        return self.number


class TrailerMaintenance(models.Model):
    trailer = models.ForeignKey(
        Trailer, on_delete=models.CASCADE, related_name="maintenance_records"
    )
    date = models.DateField()
    miles = models.FloatField(default=0)
    miles_alert = models.IntegerField(default=0)
    time_alert = models.IntegerField(default=0)
    time_year = models.IntegerField(default=0)
    time_month = models.IntegerField(default=0)
    detail = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "trailer_maintenance"
        ordering = ["-date"]

    def __str__(self) -> str:
        return f"{self.trailer} - {self.date}"


class LossPayee(models.Model):
    name = models.CharField(max_length=200)
    address = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "loss_payees"

    def __str__(self) -> str:
        return self.name


# --- Accidents ---


class Accident(models.Model):
    date = models.DateTimeField()
    driver = models.ForeignKey(
        "drivers.Driver",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accidents",
    )
    truck = models.ForeignKey(
        Truck,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accidents",
    )
    trailer = models.ForeignKey(
        Trailer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accidents",
    )
    city = models.ForeignKey(
        "locations.City",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accidents",
    )
    address = models.CharField(max_length=300)
    state = models.ForeignKey(
        "locations.State",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accidents",
    )
    police_report_file = models.FileField(
        upload_to="accidents/police_reports/", null=True, blank=True
    )
    post_accident_file = models.FileField(
        upload_to="accidents/post_accident/", null=True, blank=True
    )
    crash_number = models.CharField(max_length=100)
    tow_aways = models.BooleanField(default=False)
    death_count = models.PositiveIntegerField(default=0)
    fatal_injuries = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_accidents",
    )

    class Meta:
        db_table = "accidents"
        ordering = ["-date"]

    def __str__(self) -> str:
        return f"Accident #{self.pk} – {self.date:%Y-%m-%d}"


class AccidentPicture(models.Model):
    accident = models.ForeignKey(
        Accident, on_delete=models.CASCADE, related_name="pictures"
    )
    file = models.ImageField(upload_to="accidents/pictures/")
    description = models.CharField(max_length=200, blank=True, default="")
    rank = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accident_pictures"
        ordering = ["rank", "created_at"]

    def __str__(self) -> str:
        return f"Picture {self.pk} – Accident #{self.accident_id}"


# --- TruckMilesReset ---


class TruckMilesReset(models.Model):
    truck = models.ForeignKey(
        Truck, on_delete=models.CASCADE, related_name="miles_resets"
    )
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "truck_miles_reset"
        ordering = ["-date"]

    def __str__(self) -> str:
        return f"{self.truck} reset on {self.date}"
