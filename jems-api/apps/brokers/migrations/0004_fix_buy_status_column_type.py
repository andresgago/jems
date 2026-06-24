from django.db import migrations


class Migration(migrations.Migration):
    """
    The brokers table was created when buy_status was a BooleanField.
    The model was later changed to CharField but no AlterField migration was
    generated because Django trusts its own migration history.  This migration
    corrects the column type in the actual database.
    """

    dependencies = [
        ("brokers", "0003_broker_missing_fields"),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE brokers ALTER COLUMN buy_status TYPE varchar(100) USING buy_status::varchar;",
            reverse_sql="ALTER TABLE brokers ALTER COLUMN buy_status TYPE boolean USING (buy_status <> '');",
        ),
    ]
