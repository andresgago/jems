from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounting", "0003_add_carrier_to_record"),
    ]

    operations = [
        migrations.AddField(
            model_name="account",
            name="balance_concept",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="balance_accounts",
                to="accounting.account",
            ),
        ),
        migrations.AddField(
            model_name="account",
            name="parent",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="child_accounts",
                to="accounting.account",
            ),
        ),
    ]
