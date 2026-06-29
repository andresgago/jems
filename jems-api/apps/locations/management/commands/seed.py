"""
Seed the database with base catalog data from the production TMS.
Safe to run multiple times — uses get_or_create with the original IDs.

Usage:
    python manage.py seed
"""

from django.core.management.base import BaseCommand
from django.db import transaction

STATES = [
    (1, "Alabama", "AL"),
    (2, "Alaska", "AK"),
    (3, "Arizona", "AZ"),
    (4, "Arkansas", "AR"),
    (5, "California", "CA"),
    (6, "Colorado", "CO"),
    (7, "Connecticut", "CT"),
    (8, "Delaware", "DE"),
    (9, "District of Columbia", "DC"),
    (10, "Florida", "FL"),
    (11, "Georgia", "GA"),
    (12, "Hawaii", "HI"),
    (13, "Idaho", "ID"),
    (14, "Illinois", "IL"),
    (15, "Indiana", "IN"),
    (16, "Iowa", "IA"),
    (17, "Kansas", "KS"),
    (18, "Kentucky", "KY"),
    (19, "Louisiana", "LA"),
    (20, "Maine", "ME"),
    (21, "Maryland", "MD"),
    (22, "Massachusetts", "MA"),
    (23, "Michigan", "MI"),
    (24, "Minnesota", "MN"),
    (25, "Mississippi", "MS"),
    (26, "Missouri", "MO"),
    (27, "Montana", "MT"),
    (28, "Nebraska", "NE"),
    (29, "Nevada", "NV"),
    (30, "New Hampshire", "NH"),
    (31, "New Jersey", "NJ"),
    (32, "New Mexico", "NM"),
    (33, "New York", "NY"),
    (34, "North Carolina", "NC"),
    (35, "North Dakota", "ND"),
    (36, "Ohio", "OH"),
    (37, "Oklahoma", "OK"),
    (38, "Oregon", "OR"),
    (39, "Pennsylvania", "PA"),
    (40, "Rhode Island", "RI"),
    (41, "South Carolina", "SC"),
    (42, "South Dakota", "SD"),
    (43, "Tennessee", "TN"),
    (44, "Texas", "TX"),
    (45, "Utah", "UT"),
    (46, "Vermont", "VT"),
    (47, "Virginia", "VA"),
    (48, "Washington", "WA"),
    (49, "West Virginia", "WV"),
    (50, "Wisconsin", "WI"),
    (51, "Wyoming", "WY"),
]

TRAILER_TYPES = [
    (1, "Van", "V"),
    (2, "Reefer", "R"),
    (3, "Flatbed", "F"),
    (4, "Van or Reefer", "VR"),
    (5, "Van Vented", "VV"),
]

TRUCK_TYPES = [
    (1, "Tractor"),
    (2, "Tractor Lease"),
]

ENGINE_TYPES = [
    (1, "DD15"),
    (2, "D13"),
    (3, "14L(S60)"),
    (4, "Paccar"),
]

CABIN_TYPES = [
    (1, "Cascadia"),
    (2, "Volvo 670"),
    (3, "Volvo 780"),
    (4, "Volvo 860"),
    (5, "Volvo 730"),
    (6, "Volvo 630"),
    (7, "Century"),
    (8, "Kenworth T680"),
]

TRANSMISSION_TYPES = [
    (1, "Eaton Fuller (10 Speed Manual)"),
    (2, "E Shift (Volvo 12 Speed)"),
    (3, "Eaton Fuller (Automatic 12 Speed)"),
]

MAKES = [
    (1, "Freightliner"),
    (2, "Volvo"),
    (3, "Kenworth"),
]

TIRE_SIZES = [
    (1, "75R22.5"),
]

LOSS_PAYEES = [
    (0, "No loss payee"),
    (1, "Pinnacle Bank"),
    (2, "Tandem Finance INC"),
    (3, "ENGS Commercial Finance Co."),
    (4, "Ascentium Capital Financing"),
    (5, "Volvo Financial Services"),
    (6, "Crossroads Equipment Finance"),
    (7, "BMO Harris Bank N.A."),
    (8, "Amur Equipment Finance, INC."),
    (9, "Continental Bank"),
    (12, "Banterra Bank Finance"),
    (13, "Fountain Equipment Finance, LLC"),
]

DRIVER_TYPES = [
    (3, "Owner Operator"),
    (4, "Solo Driver"),
    (5, "Team Driver"),
]

CARRIERS = [
    {
        "id": 1,
        "mc": "041672",
        "dot_number": "3035327",
        "name": "JOBEE EXPRESS LLC",
        "dba_name": "Jobee Express",
        "email": "dispatch@jobeeexpress.com",
        "phone": "(980) 298-1291",
        "address": "4401 E Independence Blvd",
        "city": "Charlotte",
        "state_id": 34,
        "zip": "28205",
        "accounting_email": "accounting@jobeeexpress.com",
        "no_reply_email": "noreply@jobeeexpress.com",
        "cc_email": None,
        "smtp_pass_env": "CARRIER_JE_SMTP_PASS",
    },
    {
        "id": 2,
        "mc": "1447438",
        "dot_number": "3916656",
        "name": "BEST WHEELS TRANSPORT LLC",
        "dba_name": "BEST WHEELS",
        "email": "dispatch@bwheelstransport.com",
        "phone": "(980) 298-4209",
        "address": "4401 E Independence Blvd Suite 206",
        "city": "Charlotte",
        "state_id": 34,
        "zip": "28205",
        "accounting_email": "accounting@bwheelstransport.com",
        "no_reply_email": "noreply@bwheelstransport.com",
        "cc_email": "dispatch@bwheelstransport.com",
        "smtp_pass_env": "CARRIER_BWT_SMTP_PASS",
    },
]

# (id, code, name, is_active, is_main, no_tax, is_assistant)
ACCOUNTS = [
    (1, "900", "Income", True, True, False, False),
    (2, "90010", "Rate", True, False, False, False),
    (3, "800", "Expenses", True, True, False, False),
    (4, "80030", "Fuel", True, False, False, False),
    (5, "80050", "Driver Payroll", True, False, False, False),
    (6, "80081", "Insurance", True, False, False, False),
    (7, "80080", "Toll Charge", True, False, False, False),
    (8, "90030", "Driver deductions", True, False, False, False),
    (9, "80082", "Expenses by Driver", True, False, False, False),
    (10, "90011", "Detention", True, False, False, False),
    (11, "80011", "Expenses By Detention", True, False, False, False),
    (12, "90012", "Lumper", True, False, False, False),
    (13, "80012", "Expenses By Lumper", True, False, False, False),
    (14, "80013", "Expenses Scale & Wash", True, False, False, False),
    (15, "10040", "% Factor dispatch by load", True, False, False, False),
    (16, "80084", "Factor Fee", True, False, False, False),
    (17, "80051", "Vacation", True, False, False, False),
    (18, "80085", "Owner Operator Payment", True, False, False, False),
    (19, "80052", "Dispatcher Payroll", True, False, False, False),
    (20, "80070", "Expenses by Factor", True, False, False, False),
    (21, "80090", "Maintenance", True, False, True, False),
    (22, "80071", "Expenses by Minimum", True, False, False, False),
    (23, "90014", "Drop Trailer", True, False, False, False),
    (24, "80091", "Office", True, False, False, False),
    (25, "80092", "Inventory", True, False, True, False),
    (26, "80060", "Investment", True, False, False, False),
    (27, "80075", "Taxes and Licenses", True, False, False, False),
    (28, "80076", "Depreciation", True, False, False, False),
    (29, "80083", "Worker Compensation", True, False, False, False),
    (30, "80093", "Transam Lease", True, False, False, False),
    (31, "80094", "Yard Lease Payment", True, False, False, False),
    (32, "80095", "Spectrum Internet", True, False, False, False),
    (33, "80096", "Verizon Connect ELD", True, False, False, False),
    (34, "80097", "DAT Load Board", True, False, False, False),
    (35, "80098", "Prepass", True, False, False, False),
    (36, "80099", "TAF Fee", True, False, False, False),
    (37, "80014", "License Plate", True, False, True, False),
    (38, "80015", "2290 Fee", True, False, False, False),
    (39, "80020", "Safety Director", True, False, False, False),
    (40, "10041", "% Factor dispatch by Drop Trailer", True, False, False, False),
    (41, "80089", "Foley", True, False, False, False),
    (42, "80061", "Salvage Reseller", True, False, False, False),
    (43, "80062", "AT&T", True, False, False, False),
    (44, "80063", "Unifirst", True, False, False, False),
    (45, "80064", "Lawyer", True, False, True, False),
    (46, "80065", "Waste Connection", True, False, False, False),
    (47, "80053", "Taxes Accounting", True, False, False, False),
    (48, "80054", "Viewpost Subscription", True, False, False, False),
    (49, "80055", "Accidents", True, False, False, False),
    (50, "80056", "Driver Payment BoA Fee x Transaction", True, False, False, False),
    (51, "80057", "Hiring", True, False, False, False),
    (52, "80058", "Drug and Alcohol Program", True, False, False, False),
    (53, "80059", "Business Travel", True, False, False, False),
    (54, "80066", "KY Tax", True, False, False, False),
    (55, "80016", "IFTA", True, False, False, False),
    (56, "80018", "FMSCA CVL Penalty", True, False, False, False),
    (57, "90031", "UCR", True, False, False, False),
    (58, "80035", "Expenses by Scale", True, False, False, False),
    (59, "80036", "Misc", True, False, False, False),
    (60, "10042", "% Factor dispatch by Detention", True, False, False, False),
    (61, "10043", "% Factor dispatch by Owner", True, False, False, False),
    (62, "80086", "Loan", True, False, False, False),
    (63, "80040", "General", True, False, False, False),
    (64, "80001", "Accessorials", True, True, False, False),
    (65, "80002", "Payroll", True, True, False, False),
    (66, "80003", "Rent", True, True, False, False),
    (67, "80004", "Services", True, True, False, False),
]

CARDS = [
    (1, "304116000031"),
    (2, "005"),
    (3, "003"),
    (4, "070"),
    (5, "064"),
    (6, "004"),
    (8, "001"),
    (9, "073"),
    (10, "006"),
    (11, "007"),
    (12, "008"),
    (13, "0056"),
    (14, "009"),
    (15, "00064"),
    (16, "016"),
    (17, "013"),
    (18, "018"),
    (19, "012"),
    (20, "019"),
    (21, "022"),
    (22, "020"),
    (23, "023"),
    (24, "021"),
    (25, "028"),
    (26, "027"),
    (27, "026"),
    (28, "024"),
    (29, "014"),
    (30, "033"),
    (31, "029"),
    (32, "032"),
    (33, "025"),
    (34, "031"),
    (35, "030"),
    (36, "035"),
    (37, "037"),
    (38, "038"),
    (39, "036"),
    (40, "039"),
    (41, "040"),
    (42, "34"),
    (43, "034"),
    (44, "041"),
    (45, "042"),
    (46, "043"),
    (47, "053"),
    (48, "044"),
    (49, "047"),
    (50, "045"),
    (51, "050"),
    (52, "051"),
    (53, "049"),
    (54, "046"),
    (55, "052"),
    (56, "048"),
    (57, "017"),
    (58, "100"),
    (59, "101"),
    (60, "054"),
    (61, "055"),
    (62, "057"),
    (65, "060"),
    (68, "99"),
    (69, "059"),
    (70, "061"),
    (71, "063"),
    (75, "062"),
    (76, "068"),
    (78, "066"),
    (79, "069"),
    (80, "071"),
    (81, "067"),
    (82, "074"),
    (84, "065"),
    (86, "072"),
    (88, "507"),
]


class Command(BaseCommand):
    help = "Load base catalog data (states, trailer types, truck types, etc.)."

    def handle(self, *args, **options):
        with transaction.atomic():
            self._seed_states()
            self._seed_trailer_types()
            self._seed_truck_types()
            self._seed_engine_types()
            self._seed_cabin_types()
            self._seed_transmission_types()
            self._seed_makes()
            self._seed_tire_sizes()
            self._seed_loss_payees()
            self._seed_driver_types()
            self._seed_cards()
            self._seed_carriers()
            self._seed_accounts()
        self.stdout.write(self.style.SUCCESS("Seed complete."))

    def _seed_states(self):
        from apps.locations.models import State

        created = sum(
            1
            for pk, name, abbr in STATES
            if State.objects.update_or_create(
                id=pk, defaults={"name": name, "abbreviation": abbr}
            )[1]
        )
        self.stdout.write(f"  States: {len(STATES)} total, {created} new")

    def _seed_trailer_types(self):
        from apps.fleet.models import TrailerType

        created = sum(
            1
            for pk, name, short_name in TRAILER_TYPES
            if TrailerType.objects.update_or_create(
                id=pk,
                defaults={"name": name, "short_name": short_name, "is_active": True},
            )[1]
        )
        self.stdout.write(f"  TrailerTypes: {len(TRAILER_TYPES)} total, {created} new")

    def _seed_truck_types(self):
        from apps.fleet.models import TruckType

        created = sum(
            1
            for pk, name in TRUCK_TYPES
            if TruckType.objects.update_or_create(
                id=pk, defaults={"name": name, "is_active": True}
            )[1]
        )
        self.stdout.write(f"  TruckTypes: {len(TRUCK_TYPES)} total, {created} new")

    def _seed_engine_types(self):
        from apps.fleet.models import EngineType

        created = sum(
            1
            for pk, name in ENGINE_TYPES
            if EngineType.objects.update_or_create(id=pk, defaults={"name": name})[1]
        )
        self.stdout.write(f"  EngineTypes: {len(ENGINE_TYPES)} total, {created} new")

    def _seed_cabin_types(self):
        from apps.fleet.models import CabinType

        created = sum(
            1
            for pk, name in CABIN_TYPES
            if CabinType.objects.update_or_create(id=pk, defaults={"name": name})[1]
        )
        self.stdout.write(f"  CabinTypes: {len(CABIN_TYPES)} total, {created} new")

    def _seed_transmission_types(self):
        from apps.fleet.models import TransmissionType

        created = sum(
            1
            for pk, name in TRANSMISSION_TYPES
            if TransmissionType.objects.update_or_create(
                id=pk, defaults={"name": name}
            )[1]
        )
        self.stdout.write(
            f"  TransmissionTypes: {len(TRANSMISSION_TYPES)} total, {created} new"
        )

    def _seed_makes(self):
        from apps.fleet.models import Make

        created = sum(
            1
            for pk, name in MAKES
            if Make.objects.update_or_create(id=pk, defaults={"name": name})[1]
        )
        self.stdout.write(f"  Makes: {len(MAKES)} total, {created} new")

    def _seed_tire_sizes(self):
        from apps.fleet.models import TireSize

        created = sum(
            1
            for pk, name in TIRE_SIZES
            if TireSize.objects.update_or_create(id=pk, defaults={"name": name})[1]
        )
        self.stdout.write(f"  TireSizes: {len(TIRE_SIZES)} total, {created} new")

    def _seed_loss_payees(self):
        from apps.fleet.models import LossPayee

        created = sum(
            1
            for pk, name in LOSS_PAYEES
            if LossPayee.objects.update_or_create(
                id=pk, defaults={"name": name, "is_active": True}
            )[1]
        )
        self.stdout.write(f"  LossPayees: {len(LOSS_PAYEES)} total, {created} new")

    def _seed_driver_types(self):
        from apps.drivers.models import DriverType

        created = sum(
            1
            for pk, name in DRIVER_TYPES
            if DriverType.objects.update_or_create(
                id=pk, defaults={"name": name, "is_active": True}
            )[1]
        )
        self.stdout.write(f"  DriverTypes: {len(DRIVER_TYPES)} total, {created} new")

    def _seed_carriers(self):
        import environ
        from apps.carriers.models import Carrier
        from apps.locations.models import State

        env = environ.Env()
        created = 0
        for c in CARRIERS:
            state = State.objects.filter(pk=c["state_id"]).first()
            smtp_pass = env(c["smtp_pass_env"], default="")
            _, is_new = Carrier.objects.update_or_create(
                id=c["id"],
                defaults={
                    "mc": c["mc"],
                    "dot_number": c["dot_number"],
                    "name": c["name"],
                    "dba_name": c["dba_name"],
                    "email": c["email"],
                    "phone": c["phone"],
                    "address": c["address"],
                    "city": c["city"],
                    "state": state,
                    "zip": c["zip"],
                    "active": True,
                    "accounting_email": c["accounting_email"],
                    "no_reply_email": c["no_reply_email"],
                    "no_reply_password": smtp_pass,
                    "cc_email": c["cc_email"],
                },
            )
            if is_new:
                created += 1
        self.stdout.write(f"  Carriers: {len(CARRIERS)} total, {created} new")

    def _seed_accounts(self):
        from apps.accounting.models import Account

        created = sum(
            1
            for pk, code, name, is_active, is_main, no_tax, is_assistant in ACCOUNTS
            if Account.objects.update_or_create(
                id=pk,
                defaults={
                    "code": code,
                    "name": name,
                    "is_active": is_active,
                    "is_main": is_main,
                    "no_tax": no_tax,
                    "is_assistant": is_assistant,
                },
            )[1]
        )
        self.stdout.write(f"  Accounts: {len(ACCOUNTS)} total, {created} new")

    def _seed_cards(self):
        from apps.fleet.models import Card

        created = sum(
            1
            for pk, number in CARDS
            if Card.objects.update_or_create(
                id=pk, defaults={"number": number, "is_active": True}
            )[1]
        )
        self.stdout.write(f"  Cards: {len(CARDS)} total, {created} new")
