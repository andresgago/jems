from pathlib import Path

import pytest
from django.core.management import call_command

from apps.brokers.models import Broker, BrokerContact, Business
from apps.carriers.models import Carrier
from apps.locations.management.commands.seed_from_tms_dump import _parse_mysql_values
from apps.locations.models import City, State


def test_parse_mysql_values_handles_escapes_and_nulls():
    rows = _parse_mysql_values(
        "(1,'SHEARER\\'S FOODS',NULL,42),(2,'Line\\nTwo','',3.5)"
    )

    assert rows == [
        [1, "SHEARER'S FOODS", None, 42],
        [2, "Line\nTwo", "", 3.5],
    ]


@pytest.mark.django_db
def test_seed_from_tms_dump_imports_selected_tables(tmp_path: Path):
    state = State.objects.create(id=34, name="North Carolina", abbreviation="NC")
    Carrier.objects.create(
        id=1,
        mc="041672",
        dot_number="3035327",
        name="JOBEE EXPRESS LLC",
        state=state,
        active=True,
    )
    dump = tmp_path / "legacy.sql"
    dump.write_text(
        "\n".join(
            [
                "INSERT INTO `city` VALUES (239,'Charlotte','28273',34,1,NULL,NULL);",
                (
                    "INSERT INTO `broker` VALUES "
                    "(1,'765587','AXLE LOGISTICS LLC','','ops@axle.test','555',1,"
                    "'packet.pdf','ap@axle.test','tafs','acct','Approved For Purchases',"
                    "'2026-06-23','',1,'2026-06-01 10:00:00',"
                    "'2026-06-02 10:00:00',0,0,1,'addr','mail',239,34,'28273',"
                    "'AUTHORIZED','2253967',1),"
                    "(2,'765587','DUPLICATE MC','','dup@axle.test','555',1,"
                    "'','','','','Approved For Purchases',"
                    "'2026-06-23','',1,'2026-06-01 10:00:00',"
                    "'2026-06-02 10:00:00',0,0,1,'addr','mail',239,34,'28273',"
                    "'AUTHORIZED','2253967',1);"
                ),
                (
                    "INSERT INTO `broker_contacts` VALUES "
                    "(10,'Dispatcher','dispatcher@axle.test','555-1000',1);"
                ),
                (
                    "INSERT INTO `business` VALUES "
                    "(20,'Domtar EG',1,8,'300 NorthPark Drive',239,34.1,-80.9);"
                ),
            ]
        ),
        encoding="utf-8",
    )

    call_command("seed_from_tms_dump", "--dump", str(dump))

    city = City.objects.get(id=239)
    assert city.name == "Charlotte"
    assert city.state == state

    broker = Broker.objects.get(id=1)
    assert broker.mc == "765587"
    assert broker.email == "ops@axle.test"
    assert broker.carrier_id == 1
    assert not Broker.objects.filter(id=2).exists()

    contact = BrokerContact.objects.get(id=10)
    assert contact.broker == broker
    assert contact.email == "dispatcher@axle.test"

    business = Business.objects.get(id=20)
    assert business.city == city
    assert business.lat == 34.1
    assert business.lon == -80.9
