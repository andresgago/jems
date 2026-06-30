from __future__ import annotations

import argparse
import datetime as dt
import math
import random
from dataclasses import dataclass
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounting.models import Account, Record
from apps.brokers.models import Broker
from apps.loads.models import Load

DEMO_PREFIX = "JEMS-BROKER-SUMMARY-DEMO"


@dataclass(frozen=True)
class BrokerTarget:
    name: str
    mc: str
    current_revenue: float
    current_deliveries: int
    prior_revenue: float
    prior_deliveries: int


TOP_BROKERS = [
    BrokerTarget(
        "ECHO GLOBAL LOGISTICS INC",
        "511639",
        1_861_586.00,
        1075,
        1_435_800.00,
        842,
    ),
    BrokerTarget(
        "NORTH STAR TRANSPORT GROUP INC",
        "211421",
        1_201_950.00,
        686,
        973_400.00,
        552,
    ),
    BrokerTarget(
        "REICH LOGISTIC SERVICES INC",
        "187921",
        942_631.00,
        554,
        786_200.00,
        465,
    ),
    BrokerTarget(
        "TOTAL QUALITY LOGISTICS LLC",
        "322572",
        754_388.21,
        427,
        691_300.00,
        395,
    ),
    BrokerTarget(
        "NOLAN TRANSPORTATION GROUP LLC",
        "567093",
        722_153.73,
        375,
        541_800.00,
        301,
    ),
    BrokerTarget(
        "OAK LODGE HOLDINGS INC",
        "391815",
        482_702.00,
        272,
        379_200.00,
        218,
    ),
    BrokerTarget(
        "Epes Logistics Services INC",
        "283016",
        421_970.00,
        244,
        318_775.00,
        191,
    ),
    BrokerTarget(
        "ARRIVE LOGISTICS",
        "725005",
        377_680.00,
        221,
        312_350.00,
        183,
    ),
    BrokerTarget(
        "COYOTE LOGISTICS LLC",
        "561135",
        344_210.00,
        203,
        291_500.00,
        172,
    ),
    BrokerTarget(
        "RXO CAPACITY SOLUTIONS LLC",
        "221292",
        302_840.00,
        177,
        264_150.00,
        154,
    ),
]


TAIL_NAMES = [
    "EVEREST FREIGHT PARTNERS",
    "BLUE RIDGE BROKERAGE",
    "CARRIERHAWK LLC",
    "FREEDOM FREIGHT SERVICES INC",
    "PIONEER LOGISTICS GROUP",
    "SUNSET TRANSPORT SOLUTIONS",
    "APEX LOAD NETWORK",
    "SUMMIT ROAD FREIGHT",
    "IRON BRIDGE LOGISTICS",
    "GREAT LAKES FREIGHT LLC",
    "HORIZON CARGO GROUP",
    "RIVERSTONE TRANSPORT",
    "SILVERLINE BROKERAGE",
    "MAPLE RIDGE FREIGHT",
    "CROSSROADS LOGISTICS",
    "REDWOOD CARRIER GROUP",
    "AMERICAN LANE PARTNERS",
    "PINNACLE LOAD SOLUTIONS",
    "CAPSTONE FREIGHT LLC",
    "WESTWARD LOGISTICS INC",
    "LANDMARK TRANSPORT GROUP",
    "MAVERICK BROKERAGE LLC",
    "FALCON FREIGHT NETWORK",
    "KEYSTONE CARGO SERVICES",
    "BRIGHTWAY LOGISTICS",
    "ORCHARD FREIGHT PARTNERS",
    "TRIANGLE TRANSPORT GROUP",
    "NATIONAL LOAD SERVICES",
    "BAYSHORE LOGISTICS LLC",
    "EASTGATE FREIGHT INC",
    "PRAIRIE ROAD BROKERAGE",
    "VALLEY CARGO SOLUTIONS",
    "STERLING FREIGHT GROUP",
    "MISSION LOGISTICS INC",
    "LIBERTY TRANSPORT SERVICES",
    "GATEWAY LOAD PARTNERS",
    "ARROWHEAD FREIGHT LLC",
    "HARBOR POINT LOGISTICS",
    "CONTINENTAL LANE GROUP",
    "UNITY FREIGHT SERVICES",
]


def _month_weights() -> list[float]:
    return [
        0.076,
        0.081,
        0.089,
        0.083,
        0.091,
        0.087,
        0.079,
        0.074,
        0.082,
        0.095,
        0.082,
        0.081,
    ]


def _split_count(total: int, rng: random.Random) -> list[int]:
    weights = _month_weights()
    raw = [total * weight for weight in weights]
    counts = [math.floor(value) for value in raw]
    remainder = total - sum(counts)
    order = list(range(12))
    rng.shuffle(order)
    for index in order[:remainder]:
        counts[index] += 1
    return counts


def _split_amount(
    total: float, counts: list[int], rng: random.Random
) -> list[list[float]]:
    all_amounts: list[list[float]] = []
    remaining_total = round(total, 2)
    remaining_count = sum(counts)
    for month_index, count in enumerate(counts):
        month_amounts: list[float] = []
        if count <= 0:
            all_amounts.append(month_amounts)
            continue

        month_ratio = _month_weights()[month_index]
        month_target = round(total * month_ratio, 2)
        if month_index == 11:
            month_target = remaining_total

        base = month_target / count
        month_remaining = month_target
        for item_index in range(count):
            remaining_count -= 1
            if item_index == count - 1:
                amount = round(month_remaining, 2)
            else:
                variance = rng.uniform(0.82, 1.18)
                amount = round(max(150.0, base * variance), 2)
                amount = min(
                    amount, round(month_remaining - 150.0 * (count - item_index - 1), 2)
                )
            month_amounts.append(amount)
            month_remaining = round(month_remaining - amount, 2)
            remaining_total = round(remaining_total - amount, 2)
        all_amounts.append(month_amounts)

    if all_amounts and all_amounts[-1]:
        correction = round(total - sum(sum(month) for month in all_amounts), 2)
        all_amounts[-1][-1] = round(all_amounts[-1][-1] + correction, 2)
    return all_amounts


def _tail_targets(count: int, rng: random.Random) -> list[BrokerTarget]:
    targets: list[BrokerTarget] = []
    for index in range(count):
        name = TAIL_NAMES[index % len(TAIL_NAMES)]
        suffix = index // len(TAIL_NAMES)
        display_name = name if suffix == 0 else f"{name} {suffix + 1}"
        deliveries = max(8, int(180 * (0.91**index)) + rng.randint(-4, 8))
        revenue = round(deliveries * rng.uniform(1180.0, 1850.0), 2)
        prior_deliveries = max(0, int(deliveries * rng.uniform(0.45, 1.05)))
        prior_revenue = round(prior_deliveries * rng.uniform(1050.0, 1750.0), 2)
        targets.append(
            BrokerTarget(
                display_name,
                f"BS{700000 + index:06d}",
                revenue,
                deliveries,
                prior_revenue,
                prior_deliveries,
            )
        )
    return targets


class Command(BaseCommand):
    help = (
        "Seed realistic high-volume Broker Summary demo data for local visual review."
    )

    def add_arguments(self, parser: argparse.ArgumentParser) -> None:
        parser.add_argument("--year", type=int, default=timezone.localdate().year)
        parser.add_argument("--tail-brokers", type=int, default=40)
        parser.add_argument(
            "--clear-only",
            action="store_true",
            help="Delete previously generated demo records/loads/brokers and exit.",
        )

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        year = int(options["year"])
        tail_count = int(options["tail_brokers"])
        rng = random.Random(20260630)

        self._clear_demo_data()
        if options["clear_only"]:
            self.stdout.write(self.style.SUCCESS("Broker Summary demo data cleared."))
            return

        account, _ = Account.objects.get_or_create(
            code="90010",
            defaults={
                "name": "Freight Income",
                "is_active": True,
                "is_main": False,
                "is_assistant": False,
            },
        )

        targets = TOP_BROKERS + _tail_targets(tail_count, rng)
        broker_by_mc: dict[str, Broker] = {}
        for target in targets:
            broker, _ = Broker.objects.update_or_create(
                mc=target.mc,
                defaults={
                    "name": target.name,
                    "dba_name": target.name,
                    "email": f"{target.mc.lower()}@broker-summary-demo.local",
                    "status": Broker.Status.ACTIVE,
                    "details": DEMO_PREFIX,
                },
            )
            broker_by_mc[target.mc] = broker

        loads: list[Load] = []
        pending_records: list[tuple[Record, str]] = []
        for target_index, target in enumerate(targets, start=1):
            broker = broker_by_mc[target.mc]
            for data_year, revenue, deliveries in [
                (year - 1, target.prior_revenue, target.prior_deliveries),
                (year, target.current_revenue, target.current_deliveries),
            ]:
                counts = _split_count(deliveries, rng)
                amounts_by_month = _split_amount(revenue, counts, rng)
                sequence = 1
                for month, amounts in enumerate(amounts_by_month, start=1):
                    for amount in amounts:
                        day = 1 + ((sequence * 7 + month * 3) % 26)
                        pickup = timezone.make_aware(
                            dt.datetime(data_year, month, day, 8, 0)
                        )
                        dropoff = pickup + dt.timedelta(days=2)
                        load_number = f"{DEMO_PREFIX}-{data_year}-{target_index:03d}-{sequence:04d}"
                        loads.append(
                            Load(
                                number=load_number,
                                pickup_date=pickup,
                                dropoff_date=dropoff,
                                pickup_address="Demo pickup",
                                dropoff_address="Demo delivery",
                                payment=amount,
                                broker=broker,
                                status=Load.Status.FINISHED,
                                execute=True,
                                accounting_day=day,
                                details=DEMO_PREFIX,
                            )
                        )
                        pending_records.append(
                            (
                                Record(
                                    date=pickup.date(),
                                    account=account,
                                    quantity=1.0,
                                    amount=amount,
                                    detail=f"{DEMO_PREFIX} revenue",
                                    record_type=Record.RecordType.INCOME,
                                    progress=0,
                                    transaction_number=load_number,
                                    is_automatic=True,
                                ),
                                load_number,
                            )
                        )
                        sequence += 1

        Load.objects.bulk_create(loads, batch_size=1000)
        load_by_number = {
            load.number: load
            for load in Load.objects.filter(number__startswith=DEMO_PREFIX).only(
                "id", "number"
            )
        }
        records = []
        for record, load_number in pending_records:
            record.load = load_by_number[load_number]
            records.append(record)
        Record.objects.bulk_create(records, batch_size=1000)

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded Broker Summary demo data: "
                f"{len(targets)} brokers, {len(loads)} loads, {len(records)} revenue records "
                f"for {year - 1}-{year}."
            )
        )
        self.stdout.write(f"Open /reports/broker-summary and choose year {year}.")

    def _clear_demo_data(self) -> None:
        record_qs = Record.objects.filter(transaction_number__startswith=DEMO_PREFIX)
        record_count = record_qs.count()
        record_qs.delete()

        load_qs = Load.objects.filter(number__startswith=DEMO_PREFIX)
        load_count = load_qs.count()
        load_qs.delete()

        broker_qs = Broker.objects.filter(details=DEMO_PREFIX)
        broker_count = broker_qs.count()
        broker_qs.delete()

        self.stdout.write(
            f"Cleared previous Broker Summary demo data: "
            f"{broker_count} brokers, {load_count} loads, {record_count} records."
        )
