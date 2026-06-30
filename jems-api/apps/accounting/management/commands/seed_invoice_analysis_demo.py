from __future__ import annotations

import datetime as dt
import random
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.accounting.models import Account, DriverInvoice, Record
from apps.brokers.models import Broker
from apps.carriers.models import Carrier
from apps.drivers.models import Driver
from apps.loads.models import Load
from apps.users.models import User

DEMO_TAG = "JEMS-INV-ANALYSIS-DEMO"

DRIVER_DATA = [
    ("Carlos", "Mendoza"),
    ("Lupe", "Ramirez"),
    ("Tony", "Herrera"),
]

# (account_code, ratio_of_rate) — generates expense records per load
EXPENSE_PLAN = [
    ("80030", 0.23),  # Fuel
    ("80084", 0.025),  # Factor Fee
    ("10040", 0.065),  # % FDisp
    ("80081", 0.010),  # Insurance
    ("80050", 0.280),  # Driver Pay
    ("80080", 0.005),  # Toll
]


class Command(BaseCommand):
    help = "Seed demo DriverInvoice + Record data for the Invoice Analysis report."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--clear-only",
            action="store_true",
            help="Delete previously generated demo data and exit.",
        )
        parser.add_argument(
            "--weeks-back",
            type=int,
            default=0,
            help="How many weeks back to place invoice dates (0 = current week).",
        )

    @transaction.atomic
    def handle(self, *args: Any, **options: Any) -> None:
        self._clear_demo_data()
        if options["clear_only"]:
            self.stdout.write(self.style.SUCCESS("Invoice Analysis demo data cleared."))
            return

        weeks_back: int = options["weeks_back"]
        today = timezone.localdate()
        week_start = today - dt.timedelta(days=today.weekday(), weeks=weeks_back)

        carrier = (
            Carrier.objects.filter(name__icontains="JOBEE").first()
            or Carrier.objects.first()
        )
        if not carrier:
            self.stderr.write("No carriers found — run seed first.")
            return

        dispatcher = (
            User.objects.filter(is_dispatcher=True).exclude(username="admin").first()
            or User.objects.first()
        )

        broker = Broker.objects.filter(status=Broker.Status.ACTIVE).first()

        income_acct = Account.objects.get(code="90010")
        expense_accts = {
            code: Account.objects.get(code=code) for code, _ in EXPENSE_PLAN
        }

        rng = random.Random(20260630)
        next_number = (
            DriverInvoice.objects.order_by("-number")
            .values_list("number", flat=True)
            .first()
            or 1000
        ) + 1

        # Create demo drivers (idempotent by name)
        drivers: list[Driver] = []
        for first, last in DRIVER_DATA:
            driver, _ = Driver.objects.get_or_create(
                first_name=first,
                last_name=last,
                defaults={
                    "carrier": carrier,
                    "status": Driver.Status.ACTIVE,
                },
            )
            drivers.append(driver)

        loads_to_create: list[Load] = []
        records_to_create: list[Record] = []

        for offset, driver in enumerate(drivers):
            invoice_date = week_start + dt.timedelta(days=offset * 2)
            num_loads = rng.randint(2, 4)

            for seq in range(num_loads):
                load_date = invoice_date - dt.timedelta(days=seq + 1)
                rate = round(rng.uniform(1_400.0, 3_200.0), 2)
                load_number = f"{DEMO_TAG}-D{driver.id}-{seq + 1:02d}-{invoice_date}"

                loads_to_create.append(
                    Load(
                        number=load_number,
                        pickup_date=timezone.make_aware(
                            dt.datetime(
                                load_date.year, load_date.month, load_date.day, 7, 0
                            )
                        ),
                        dropoff_date=timezone.make_aware(
                            dt.datetime(
                                load_date.year, load_date.month, load_date.day, 20, 0
                            )
                            + dt.timedelta(days=1)
                        ),
                        pickup_address="Chicago, IL",
                        dropoff_address="Dallas, TX",
                        payment=rate,
                        broker=broker,
                        dispatcher=dispatcher,
                        status=Load.Status.FINISHED,
                        execute=True,
                        accounting_day=load_date.day,
                        details=DEMO_TAG,
                    )
                )

                # Income record (rate)
                records_to_create.append(
                    Record(
                        date=load_date,
                        account=income_acct,
                        quantity=1.0,
                        amount=rate,
                        detail=DEMO_TAG,
                        record_type=Record.RecordType.INCOME,
                        progress=0,
                        transaction_number=load_number,
                        is_automatic=True,
                    )
                )

                # Expense records
                for code, ratio in EXPENSE_PLAN:
                    amt = round(rate * ratio * rng.uniform(0.9, 1.1), 2)
                    records_to_create.append(
                        Record(
                            date=load_date,
                            account=expense_accts[code],
                            quantity=1.0,
                            amount=amt,
                            detail=DEMO_TAG,
                            record_type=Record.RecordType.EXPENSE,
                            progress=0,
                            transaction_number=load_number,
                            is_automatic=True,
                        )
                    )

        Load.objects.bulk_create(loads_to_create, batch_size=500)
        load_by_number = {
            load.number: load
            for load in Load.objects.filter(number__startswith=DEMO_TAG).only(
                "id", "number"
            )
        }

        for rec in records_to_create:
            rec.load = load_by_number[rec.transaction_number]
        Record.objects.bulk_create(records_to_create, batch_size=500)

        # Create one DriverInvoice per driver with all their load IDs
        for offset, driver in enumerate(drivers):
            invoice_date = week_start + dt.timedelta(days=offset * 2)
            tag = f"{DEMO_TAG}-D{driver.id}-"
            driver_load_ids = [
                str(load.id)
                for num, load in load_by_number.items()
                if num.startswith(tag)
            ]
            DriverInvoice.objects.create(
                number=next_number,
                driver=driver,
                date=invoice_date,
                status=DriverInvoice.Status.OPEN,
                load_list="|".join(driver_load_ids),
            )
            next_number += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded: {len(drivers)} drivers, {len(loads_to_create)} loads, "
                f"{len(records_to_create)} records, {len(drivers)} invoices "
                f"(week of {week_start})."
            )
        )
        self.stdout.write(
            f"Search /reports/company-invoices with "
            f"{week_start} → {week_start + dt.timedelta(days=6)}."
        )

    def _clear_demo_data(self) -> None:
        r = Record.objects.filter(detail=DEMO_TAG).count()
        Record.objects.filter(detail=DEMO_TAG).delete()

        load_count = Load.objects.filter(details=DEMO_TAG).count()
        Load.objects.filter(details=DEMO_TAG).delete()

        demo_driver_names = [(f, la) for f, la in DRIVER_DATA]
        demo_drivers = Driver.objects.filter(
            first_name__in=[f for f, _ in demo_driver_names],
            last_name__in=[la for _, la in demo_driver_names],
        )
        inv = DriverInvoice.objects.filter(driver__in=demo_drivers).count()
        DriverInvoice.objects.filter(driver__in=demo_drivers).delete()

        d = demo_drivers.count()
        demo_drivers.delete()

        self.stdout.write(
            f"Cleared: {inv} invoices, {load_count} loads, {r} records, {d} drivers."
        )
