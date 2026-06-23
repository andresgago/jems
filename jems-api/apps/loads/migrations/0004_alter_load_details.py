from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("loads", "0003_load_dates_to_datetime"),
    ]

    operations = [
        migrations.AlterField(
            model_name="load",
            name="details",
            field=models.CharField(default="Must be on time.", max_length=800),
        ),
    ]
