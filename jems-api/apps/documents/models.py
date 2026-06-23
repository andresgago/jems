from django.db import models


class DriverFile(models.Model):
    class Type(models.IntegerChoices):
        LICENSE = 1, "License"
        MEDICAL_CARD = 2, "Medical Card"

    driver = models.ForeignKey(
        "drivers.Driver",
        on_delete=models.CASCADE,
        related_name="files",
    )
    type = models.IntegerField(choices=Type.choices)
    file = models.FileField(upload_to="documents/drivers/")
    expiry_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "driver_file"
        ordering = ["-expiry_date"]

    def __str__(self) -> str:
        return f"{self.get_type_display()} — driver {self.driver_id}"


class TruckFile(models.Model):
    class Type(models.IntegerChoices):
        AVI = 1, "AVI"
        REGISTRATION = 2, "Registration"

    truck = models.ForeignKey(
        "fleet.Truck",
        on_delete=models.CASCADE,
        related_name="files",
    )
    type = models.IntegerField(choices=Type.choices)
    file = models.FileField(upload_to="documents/trucks/")
    expiry_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "truck_file"
        ordering = ["-expiry_date"]

    def __str__(self) -> str:
        return f"{self.get_type_display()} — truck {self.truck_id}"


class TrailerFile(models.Model):
    class Type(models.IntegerChoices):
        AVI = 1, "AVI"
        REGISTRATION = 2, "Registration"

    trailer = models.ForeignKey(
        "fleet.Trailer",
        on_delete=models.CASCADE,
        related_name="files",
    )
    type = models.IntegerField(choices=Type.choices)
    file = models.FileField(upload_to="documents/trailers/")
    expiry_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "trailer_file"
        ordering = ["-expiry_date"]

    def __str__(self) -> str:
        return f"{self.get_type_display()} — trailer {self.trailer_id}"


class ImportRecordFile(models.Model):
    class Type(models.IntegerChoices):
        PILOT = 1, "Pilot"
        STATEMENT = 2, "Statement"

    type = models.IntegerField(choices=Type.choices, default=Type.PILOT)
    filename = models.CharField(max_length=255)
    sha1_file = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "imported_file"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.filename
