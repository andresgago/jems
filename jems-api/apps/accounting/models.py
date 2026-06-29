from django.conf import settings
from django.db import models


class Account(models.Model):
    """Chart of accounts entry."""

    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="child_accounts",
    )
    balance_concept = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="balance_accounts",
    )
    is_active = models.BooleanField(default=True)
    is_main = models.BooleanField(default=False)
    is_assistant = models.BooleanField(default=False)
    no_tax = models.BooleanField(default=False)

    class Meta:
        db_table = "accounts"
        ordering = ["code"]

    def __str__(self) -> str:
        return f"{self.code} – {self.name}"


class CategoryType(models.Model):
    """Unit of measure / category type (e.g. 'Parts', 'Service')."""

    name = models.CharField(max_length=100)
    unit_of_measure = models.CharField(max_length=20, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "category_types"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Category(models.Model):
    """Expense/maintenance category used on Records."""

    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=200)
    category_type = models.ForeignKey(
        CategoryType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="categories",
    )
    is_active = models.BooleanField(default=True)
    is_truck_part = models.BooleanField(default=False)
    # Optional truck-part specifics (FK into fleet lookup tables)
    engine_type = models.ForeignKey(
        "fleet.EngineType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="categories",
    )
    cabin_type = models.ForeignKey(
        "fleet.CabinType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="categories",
    )
    transmission_type = models.ForeignKey(
        "fleet.TransmissionType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="categories",
    )
    photo = models.ImageField(upload_to="categories/", blank=True, null=True)

    class Meta:
        db_table = "categories"
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


class Record(models.Model):
    """Financial transaction record — the central accounting entry."""

    class RecordType(models.IntegerChoices):
        INCOME = 1, "Income"
        EXPENSE = 2, "Expense"
        TRANSFER = 3, "Transfer"

    date = models.DateField()
    account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    quantity = models.FloatField(default=1.0)
    amount = models.FloatField(default=0.0)
    detail = models.TextField(blank=True, default="")
    record_type = models.IntegerField(
        choices=RecordType.choices, default=RecordType.EXPENSE
    )
    # Linked entities
    load = models.ForeignKey(
        "loads.Load",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    truck = models.ForeignKey(
        "fleet.Truck",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    trailer = models.ForeignKey(
        "fleet.Trailer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    driver = models.ForeignKey(
        "drivers.Driver",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    team_driver = models.ForeignKey(
        "drivers.Driver",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="team_records",
    )
    owner = models.ForeignKey(
        "fleet.TruckOwner",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    category_expire = models.BooleanField(default=False)
    category_expire_date = models.DateField(null=True, blank=True)
    dispatcher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dispatched_records",
    )
    city = models.ForeignKey(
        "locations.City",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    card = models.ForeignKey(
        "fleet.Card",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    carrier = models.ForeignKey(
        "carriers.Carrier",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="records",
    )
    is_automatic = models.BooleanField(default=False)
    progress = models.IntegerField(default=0)
    follow = models.IntegerField(default=0)
    position = models.IntegerField(default=0)
    product = models.CharField(max_length=255, blank=True, default="")
    transaction_number = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_records",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_records",
    )

    class Meta:
        db_table = "records"
        ordering = ["-date", "-id"]

    def __str__(self) -> str:
        return f"Record #{self.pk} – {self.amount}"


class DriverInvoice(models.Model):
    """Driver pay invoice grouping loads for settlement."""

    class Status(models.IntegerChoices):
        CLOSED = 0, "Closed"
        OPEN = 1, "Open"

    number = models.PositiveIntegerField()
    driver = models.ForeignKey(
        "drivers.Driver",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )
    date = models.DateField()
    invoice_type = models.IntegerField(default=0)
    contract = models.IntegerField(default=0)
    miles_empty = models.FloatField(default=0.0)
    miles_full = models.FloatField(default=0.0)
    percent = models.FloatField(default=0.0)
    vacation_now = models.CharField(max_length=50, blank=True, default="")
    vacation_pay = models.BooleanField(default=False)
    status = models.IntegerField(choices=Status.choices, default=Status.OPEN)
    load_list = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_driver_invoices",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_driver_invoices",
    )

    class Meta:
        db_table = "driver_invoices"
        ordering = ["-date", "-number"]

    def __str__(self) -> str:
        return f"Driver Invoice #{self.number}"


class OwnerInvoice(models.Model):
    """Owner-operator settlement invoice."""

    class Status(models.IntegerChoices):
        CLOSED = 0, "Closed"
        OPEN = 1, "Open"

    class OwnerType(models.TextChoices):
        COMPANY = "company", "Company"
        OWNER_OPERATOR = "owner_operator", "Owner Operator"

    number = models.PositiveIntegerField()
    owner = models.ForeignKey(
        "fleet.TruckOwner",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )
    date = models.DateField()
    owner_type = models.CharField(
        max_length=20, choices=OwnerType.choices, blank=True, default=""
    )
    contract = models.IntegerField(default=0)
    percent = models.FloatField(default=0.0)
    status = models.IntegerField(choices=Status.choices, default=Status.OPEN)
    worker_comp = models.FloatField(default=0.0)
    factor_dispatch = models.FloatField(default=0.0)
    factor_fee = models.FloatField(default=0.0)
    check_amount = models.FloatField(default=0.0)
    # Income breakdown
    income_by_rate = models.FloatField(default=0.0)
    income_by_detention = models.FloatField(default=0.0)
    income_by_lumper = models.FloatField(default=0.0)
    income_by_driver = models.FloatField(default=0.0)
    # Expense breakdown
    fuel_expenses = models.FloatField(default=0.0)
    scale_expenses = models.FloatField(default=0.0)
    insurance_expenses = models.FloatField(default=0.0)
    yard_expenses = models.FloatField(default=0.0)
    factor_expenses = models.FloatField(default=0.0)
    toll_expenses = models.FloatField(default=0.0)
    eld_expenses = models.FloatField(default=0.0)
    load_list = models.TextField(blank=True, default="")
    record = models.ForeignKey(
        Record,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="owner_invoices",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_owner_invoices",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_owner_invoices",
    )

    class Meta:
        db_table = "owner_invoices"
        ordering = ["-date", "-number"]

    def __str__(self) -> str:
        return f"Owner Invoice #{self.number}"


class CardGain(models.Model):
    card = models.ForeignKey(
        "fleet.Card",
        on_delete=models.CASCADE,
        related_name="gains",
    )
    date = models.DateField()
    gain = models.FloatField()

    class Meta:
        db_table = "cardsgain"
        ordering = ["-date"]

    def __str__(self) -> str:
        return f"Card {self.card_id} gain {self.gain} on {self.date}"
