from django.conf import settings
from django.db import models


class DispatcherWorkInvoiceByPercent(models.Model):
    class Status(models.IntegerChoices):
        CLOSED = 0, "Closed"
        OPEN = 1, "Open"

    number = models.PositiveIntegerField(unique=True)
    dispatcher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="percent_invoices",
    )
    date = models.DateField()
    start = models.DateTimeField()
    end = models.DateTimeField()
    percent = models.DecimalField(max_digits=5, decimal_places=2)
    status = models.IntegerField(choices=Status.choices, default=Status.OPEN)
    record = models.ForeignKey(
        "accounting.Record",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dispatch_percent_invoices",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_percent_invoices",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_percent_invoices",
    )

    class Meta:
        db_table = "dispatcher_work_invoice_by_percent"
        ordering = ["-number"]

    def __str__(self) -> str:
        return f"Percent Invoice #{self.number}"


class DispatcherWorkInvoiceByHour(models.Model):
    class Status(models.IntegerChoices):
        CLOSED = 0, "Closed"
        OPEN = 1, "Open"

    number = models.PositiveIntegerField(unique=True)
    dispatcher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hour_invoices",
    )
    date = models.DateField()
    start = models.DateTimeField()
    end = models.DateTimeField()
    pay_per_hour = models.DecimalField(max_digits=8, decimal_places=2)
    status = models.IntegerField(choices=Status.choices, default=Status.OPEN)
    record = models.ForeignKey(
        "accounting.Record",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dispatch_hour_invoices",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_hour_invoices",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_hour_invoices",
    )

    class Meta:
        db_table = "dispatcher_work_invoice_by_hour"
        ordering = ["-number"]

    def __str__(self) -> str:
        return f"Hour Invoice #{self.number}"


class DispatcherWork(models.Model):
    start = models.DateTimeField()
    end = models.DateTimeField()
    title = models.CharField(max_length=100)
    dispatcher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="work_sessions",
    )
    session = models.CharField(max_length=100, blank=True, default="")
    is_finished = models.BooleanField(default=False)
    is_paid = models.BooleanField(default=False)
    invoice_percent = models.ForeignKey(
        DispatcherWorkInvoiceByPercent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="work_sessions",
    )
    invoice_hour = models.ForeignKey(
        DispatcherWorkInvoiceByHour,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="work_sessions",
    )

    class Meta:
        db_table = "dispatcher_work"
        ordering = ["-start"]

    def __str__(self) -> str:
        return self.title

    @property
    def duration_hours(self) -> float:
        if not self.is_finished:
            return 0.0
        delta = self.end - self.start
        return delta.total_seconds() / 3600
