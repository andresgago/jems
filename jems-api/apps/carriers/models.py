from django.db import models
from django.conf import settings


class Carrier(models.Model):
    mc = models.CharField(max_length=20, unique=True)
    dot_number = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    dba_name = models.CharField(max_length=200, blank=True, default="")
    email = models.EmailField(max_length=50, unique=True, blank=True, null=True)
    phone = models.CharField(max_length=15, blank=True, default="")
    no_reply_email = models.EmailField(max_length=50, blank=True, null=True)
    cc_email = models.EmailField(max_length=50, blank=True, null=True)
    accounting_email = models.EmailField(max_length=50, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.ForeignKey(
        "locations.State",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="state",
    )
    zip = models.CharField(max_length=10, blank=True, default="")
    active = models.BooleanField(default=False)
    factor_company = models.CharField(max_length=255, blank=True, default="")
    factor_account_id = models.CharField(max_length=255, blank=True, default="")
    debtor_buy_status = models.CharField(max_length=100, blank=True, default="")
    buy_status = models.CharField(max_length=100, blank=True, default="")
    sister_companies = models.TextField(blank=True, default="")
    power_units = models.CharField(max_length=50, blank=True, default="")
    operating_status = models.CharField(max_length=50, blank=True, default="")
    eld_user = models.CharField(max_length=100, blank=True, default="")
    eld_password = models.CharField(max_length=100, blank=True, default="")
    # Document files
    w9_file = models.FileField(upload_to="carriers/w9/", blank=True, null=True)
    noa_file = models.FileField(upload_to="carriers/noa/", blank=True, null=True)
    coi_file = models.FileField(upload_to="carriers/coi/", blank=True, null=True)
    mcc_file = models.FileField(upload_to="carriers/mcc/", blank=True, null=True)
    safety_letter_file = models.FileField(upload_to="carriers/safety/", blank=True, null=True)
    last_inspection_file = models.FileField(upload_to="carriers/inspection/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_carriers",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_carriers",
    )

    class Meta:
        db_table = "carriers"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.mc})"


class Factor(models.Model):
    value = models.DecimalField(max_digits=10, decimal_places=2, unique=True)
    percent = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        db_table = "factor"
        ordering = ["value"]

    def __str__(self) -> str:
        return f">{self.value} → {self.percent}%"
