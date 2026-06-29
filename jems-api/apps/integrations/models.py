from django.db import models


class RtlDriver(models.Model):
    """ELD driver record synced from RTL API."""

    rtl_id = models.CharField(max_length=100, unique=True)
    company_id = models.CharField(max_length=100, blank=True, default="")
    email = models.CharField(max_length=255, blank=True, default="")
    first_name = models.CharField(max_length=100, blank=True, default="")
    last_name = models.CharField(max_length=100, blank=True, default="")
    active = models.BooleanField(default=True)
    phone_num = models.CharField(max_length=50, blank=True, default="")
    license_number = models.CharField(max_length=100, blank=True, default="")
    license_state = models.CharField(max_length=10, blank=True, default="")
    rtl_created_at = models.CharField(max_length=50, blank=True, default="")
    rtl_updated_at = models.CharField(max_length=50, blank=True, default="")
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rtl_driver"
        ordering = ["last_name", "first_name"]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"


class RtlTruck(models.Model):
    """ELD truck record synced from RTL API."""

    rtl_id = models.CharField(max_length=100, unique=True)
    company_id = models.CharField(max_length=100, blank=True, default="")
    name = models.CharField(max_length=100, blank=True, default="")
    make = models.CharField(max_length=100, blank=True, default="")
    model = models.CharField(max_length=100, blank=True, default="")
    year = models.CharField(max_length=10, blank=True, default="")
    vin = models.CharField(max_length=50, blank=True, default="")
    plate_number = models.CharField(max_length=50, blank=True, default="")
    active = models.BooleanField(default=True)
    eld_serial_number = models.CharField(max_length=100, blank=True, default="")
    rtl_updated_at = models.CharField(max_length=50, blank=True, default="")
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rtl_truck"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name or self.vin


class RtlDriverStatus(models.Model):
    """Latest HOS status for an RTL driver (one record per driver)."""

    rtl_id = models.CharField(max_length=100, unique=True)
    rtl_driver = models.OneToOneField(
        RtlDriver,
        on_delete=models.CASCADE,
        related_name="latest_status",
        null=True,
        blank=True,
        to_field="rtl_id",
    )
    location_lat = models.FloatField(null=True, blank=True)
    location_lon = models.FloatField(null=True, blank=True)
    location_state = models.CharField(max_length=10, blank=True, default="")
    location_calculated = models.CharField(max_length=200, blank=True, default="")
    location_timestamp = models.CharField(max_length=50, blank=True, default="")
    vehicle_id = models.CharField(max_length=100, blank=True, default="")
    vehicle_vin = models.CharField(max_length=50, blank=True, default="")
    hos_event_code = models.CharField(max_length=20, blank=True, default="")
    hos_event_time = models.CharField(max_length=50, blank=True, default="")
    daily_hours_driven = models.FloatField(null=True, blank=True)
    daily_hours_on_duty = models.FloatField(null=True, blank=True)
    eta = models.CharField(max_length=50, blank=True, default="")
    violations = models.CharField(max_length=500, blank=True, default="")
    rtl_updated_at = models.CharField(max_length=50, blank=True, default="")
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rtl_driver_latest_status"

    def __str__(self) -> str:
        return f"Status for driver {self.rtl_driver_id}"


class RtlTruckStatus(models.Model):
    """Latest GPS/telematics status for an RTL truck (one record per truck)."""

    rtl_id = models.CharField(max_length=100, unique=True)
    rtl_truck = models.OneToOneField(
        RtlTruck,
        on_delete=models.CASCADE,
        related_name="latest_status",
        null=True,
        blank=True,
        to_field="rtl_id",
    )
    vin = models.CharField(max_length=50, blank=True, default="")
    odometer = models.FloatField(null=True, blank=True)
    speed = models.FloatField(null=True, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    timestamp = models.CharField(max_length=50, blank=True, default="")
    calculated_location = models.CharField(max_length=200, blank=True, default="")
    rtl_updated_at = models.CharField(max_length=50, blank=True, default="")
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rtl_truck_latest_status"

    def __str__(self) -> str:
        return f"Status for truck {self.rtl_truck_id}"


class RtlIfta(models.Model):
    """IFTA report metadata synced from RTL API."""

    rtl_id = models.CharField(max_length=100, unique=True)
    company_id = models.CharField(max_length=100, blank=True, default="")
    type_id = models.CharField(max_length=50, blank=True, default="")
    status_id = models.CharField(max_length=50, blank=True, default="")
    time_submitted = models.CharField(max_length=50, blank=True, default="")
    time_generated = models.CharField(max_length=50, blank=True, default="")
    url = models.CharField(max_length=500, blank=True, default="")
    csv_url = models.CharField(max_length=500, blank=True, default="")
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    vehicle_vin = models.CharField(max_length=50, blank=True, default="")
    vehicle_id = models.CharField(max_length=100, blank=True, default="")
    vehicle_name = models.CharField(max_length=100, blank=True, default="")
    synced_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rtl_ifta"
        ordering = ["-from_date"]

    def __str__(self) -> str:
        return f"IFTA {self.vehicle_name} {self.from_date}–{self.to_date}"


class ReportIFTA(models.Model):
    """Locally generated IFTA mileage report."""

    status = models.CharField(max_length=50, blank=True, default="")
    from_date = models.DateField(null=True, blank=True)
    to_date = models.DateField(null=True, blank=True)
    vehicles = models.TextField(blank=True, default="")
    report = models.CharField(max_length=100, blank=True, default="")
    processed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "report_ifta"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"IFTA Report {self.from_date}–{self.to_date}"
