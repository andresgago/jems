import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("locations", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Carrier",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("mc", models.CharField(max_length=20, unique=True)),
                ("dot_number", models.CharField(max_length=20, unique=True)),
                ("name", models.CharField(max_length=200)),
                ("dba_name", models.CharField(blank=True, default="", max_length=200)),
                (
                    "email",
                    models.EmailField(
                        blank=True, max_length=50, null=True, unique=True
                    ),
                ),
                ("phone", models.CharField(blank=True, default="", max_length=15)),
                (
                    "no_reply_email",
                    models.EmailField(blank=True, max_length=50, null=True),
                ),
                ("cc_email", models.EmailField(blank=True, max_length=50, null=True)),
                (
                    "accounting_email",
                    models.EmailField(blank=True, max_length=50, null=True),
                ),
                ("address", models.CharField(blank=True, default="", max_length=255)),
                ("city", models.CharField(blank=True, default="", max_length=100)),
                ("zip", models.CharField(blank=True, default="", max_length=10)),
                ("active", models.BooleanField(default=False)),
                (
                    "factor_company",
                    models.CharField(blank=True, default="", max_length=255),
                ),
                (
                    "factor_account_id",
                    models.CharField(blank=True, default="", max_length=255),
                ),
                (
                    "debtor_buy_status",
                    models.CharField(blank=True, default="", max_length=100),
                ),
                (
                    "buy_status",
                    models.CharField(blank=True, default="", max_length=100),
                ),
                ("sister_companies", models.TextField(blank=True, default="")),
                (
                    "power_units",
                    models.CharField(blank=True, default="", max_length=50),
                ),
                (
                    "operating_status",
                    models.CharField(blank=True, default="", max_length=50),
                ),
                ("eld_user", models.CharField(blank=True, default="", max_length=100)),
                (
                    "eld_password",
                    models.CharField(blank=True, default="", max_length=100),
                ),
                (
                    "w9_file",
                    models.FileField(blank=True, null=True, upload_to="carriers/w9/"),
                ),
                (
                    "noa_file",
                    models.FileField(blank=True, null=True, upload_to="carriers/noa/"),
                ),
                (
                    "coi_file",
                    models.FileField(blank=True, null=True, upload_to="carriers/coi/"),
                ),
                (
                    "mcc_file",
                    models.FileField(blank=True, null=True, upload_to="carriers/mcc/"),
                ),
                (
                    "safety_letter_file",
                    models.FileField(
                        blank=True, null=True, upload_to="carriers/safety/"
                    ),
                ),
                (
                    "last_inspection_file",
                    models.FileField(
                        blank=True, null=True, upload_to="carriers/inspection/"
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "state",
                    models.ForeignKey(
                        blank=True,
                        db_column="state",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="locations.state",
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_carriers",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="updated_carriers",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "carriers",
                "ordering": ["name"],
            },
        ),
    ]
