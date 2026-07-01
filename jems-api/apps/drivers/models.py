from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models


class DriverType(models.Model):
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "driver_types"

    def __str__(self) -> str:
        return self.name


class Driver(models.Model):
    class Status(models.IntegerChoices):
        INACTIVE = 0, "Inactive"
        ACTIVE = 1, "Active"
        TERMINATED = -1, "Terminated"

    class Contract(models.IntegerChoices):
        BY_PERCENT = 0, "By percent"
        BY_MILES = 1, "By miles"
        BY_PERCENT_NO_EXPENSES = 2, "By percent no expenses"

    class PayVacation(models.IntegerChoices):
        YES = 0, "Yes"
        NO = 1, "Not"

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    driver_type = models.ForeignKey(
        DriverType,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="drivers",
    )
    status = models.IntegerField(choices=Status.choices, default=Status.ACTIVE)
    phone = models.CharField(max_length=30, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.CharField(max_length=300, blank=True, default="")
    birth_date = models.DateField(null=True, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    termination_date = models.DateField(null=True, blank=True)
    social_security_number = models.CharField(max_length=100, blank=True, default="")

    # License
    license_number = models.CharField(max_length=200, blank=True, default="")
    license_state = models.ForeignKey(
        "locations.State",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="drivers",
    )
    license_file = models.FileField(
        upload_to="drivers/licenses/", null=True, blank=True
    )
    license_expiration = models.DateField(null=True, blank=True)

    # Medical card
    medical_card_file = models.FileField(
        upload_to="drivers/medical_cards/", null=True, blank=True
    )
    medical_card_expiration = models.DateField(null=True, blank=True)

    # Documents
    residence_card_file = models.FileField(
        upload_to="drivers/residence_cards/", null=True, blank=True
    )
    application_file = models.FileField(
        upload_to="drivers/applications/", null=True, blank=True
    )
    lease_agreement_file = models.FileField(
        upload_to="drivers/lease_agreements/", null=True, blank=True
    )
    mvr_file = models.FileField(upload_to="drivers/mvr/", null=True, blank=True)
    mvr_expiration = models.DateField(null=True, blank=True)
    social_security_file = models.FileField(
        upload_to="drivers/social_security/", null=True, blank=True
    )
    photo = models.ImageField(upload_to="drivers/photos/", null=True, blank=True)

    # Compensation
    contract = models.IntegerField(
        choices=Contract.choices, default=Contract.BY_PERCENT
    )
    miles_empty = models.FloatField(default=0)
    miles_full = models.FloatField(default=0)
    percent = models.FloatField(default=0)
    weekly_rate = models.DecimalField(
        max_digits=7, decimal_places=3, default=Decimal("0.000")
    )

    # Deductions
    insurance = models.FloatField(default=0)
    eld = models.FloatField(default=0)
    worker_comp = models.FloatField(default=0)
    factor = models.FloatField(default=0)
    factor_fee = models.FloatField(default=0)
    pay_vacation = models.IntegerField(
        choices=PayVacation.choices, default=PayVacation.YES
    )

    # Assignments
    fuel_card = models.ForeignKey(
        "fleet.Card",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="drivers",
    )
    team_driver = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="team_partners",
    )
    owner = models.ForeignKey(
        "fleet.TruckOwner",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="drivers",
    )
    carrier = models.ForeignKey(
        "carriers.Carrier",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="drivers",
    )
    carrier_start_date = models.DateField(null=True, blank=True)
    carrier_end_date = models.DateField(null=True, blank=True)
    carrier_end_reason = models.TextField(blank=True, default="")
    eld_id = models.CharField(max_length=100, blank=True, default="")
    factoring_account_id = models.CharField(max_length=100, blank=True, default="")

    # CDL endorsements and restrictions (bitmask in legacy)
    endorsements = models.IntegerField(default=0)
    restrictions = models.IntegerField(default=0)

    on_vacation = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_drivers",
    )

    class Meta:
        db_table = "drivers"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    @property
    def is_team_driver_type(self) -> bool:
        if self.driver_type_id == 5:
            return True
        name = (
            self.driver_type.name if self.driver_type_id and self.driver_type else ""
        ).lower()
        return "team" in name

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}

        if (
            self.termination_date
            and self.hire_date
            and self.termination_date <= self.hire_date
        ):
            errors["termination_date"] = "Termination must be greater than hire date."

        non_negative_fields = [
            "factor",
            "miles_empty",
            "miles_full",
            "factor_fee",
            "insurance",
            "eld",
            "worker_comp",
        ]
        for field in non_negative_fields:
            if getattr(self, field) < 0:
                errors[field] = "Value must be greater than or equal to 0."

        if self.percent < 0 or self.percent > 100:
            errors["percent"] = "Percent must be between 0 and 100."

        if self.team_driver_id and self.pk and self.team_driver_id == self.pk:
            errors["team_driver"] = "A driver cannot be their own team driver."

        if self.is_team_driver_type and self.team_driver_id is None:
            errors["team_driver"] = "Team driver cannot be blank."

        if self.status == self.Status.ACTIVE and not self.is_team_driver_type:
            if self.fuel_card_id is None:
                errors["fuel_card"] = "Card fuel cannot be blank."
            else:
                duplicate = Driver.objects.filter(
                    status=self.Status.ACTIVE,
                    fuel_card_id=self.fuel_card_id,
                )
                if self.pk:
                    duplicate = duplicate.exclude(pk=self.pk)
                if duplicate.exists():
                    errors["fuel_card"] = "Card fuel has already been taken."

        if errors:
            raise ValidationError(errors)

    def __str__(self) -> str:
        return self.full_name


class DriverVacation(models.Model):
    driver = models.ForeignKey(
        Driver, on_delete=models.CASCADE, related_name="vacations"
    )
    start = models.DateField()
    end = models.DateField()
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "driver_vacations"
        ordering = ["-start"]

    def __str__(self) -> str:
        return f"{self.driver.full_name} {self.start} – {self.end}"


class DriverDocument(models.Model):
    class DocumentType(models.IntegerChoices):
        LICENSE = 1, "License"
        MEDICAL_CARD = 2, "Medical Card"
        MVR = 3, "MVR / Record"
        # Legacy parity: residence card, application, lease agreement and social
        # security card were dedicated file slots on the legacy Driver record.
        RESIDENCE_CARD = 4, "Residence Card"
        APPLICATION = 5, "Application"
        LEASE_AGREEMENT = 6, "Lease Agreement"
        SOCIAL_SECURITY = 7, "Social Security Card"

    driver = models.ForeignKey(
        Driver, on_delete=models.CASCADE, related_name="documents"
    )
    document_type = models.IntegerField(choices=DocumentType.choices)
    file = models.FileField(upload_to="drivers/documents/")
    expiration_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "driver_documents"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.driver.full_name} - {self.get_document_type_display()}"
