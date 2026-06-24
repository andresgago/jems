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
    contract = models.BooleanField(default=False)
    miles_empty = models.FloatField(default=0)
    miles_full = models.FloatField(default=0)
    percent = models.FloatField(default=0)

    # Deductions
    insurance = models.FloatField(default=0)
    eld = models.FloatField(default=0)
    worker_comp = models.FloatField(default=0)
    factor = models.FloatField(default=0)
    factor_fee = models.FloatField(default=0)

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
