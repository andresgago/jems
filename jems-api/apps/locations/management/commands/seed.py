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
    (
        1,
        "041672",
        "3035327",
        "JOBEE EXPRESS LLC",
        "Jobee Express",
        "dispatch@jobeeexpress.com",
        "(980) 298-1291",
        "4401 E Independence Blvd",
        "Charlotte",
        34,
        "28205",
    ),
    (
        2,
        "1447438",
        "3916656",
        "BEST WHEELS TRANSPORT LLC",
        "BEST WHEELS",
        "dispatch@bwheelstransport.com",
        "(980) 298-4209",
        "4401 E Independence Blvd Suite 206",
        "Charlotte",
        34,
        "28205",
    ),
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
        from apps.carriers.models import Carrier
        from apps.locations.models import State

        created = 0
        for (
            pk,
            mc,
            dot,
            name,
            dba,
            email,
            phone,
            address,
            city,
            state_id,
            zip_code,
        ) in CARRIERS:
            state = State.objects.filter(pk=state_id).first()
            _, is_new = Carrier.objects.update_or_create(
                id=pk,
                defaults={
                    "mc": mc,
                    "dot_number": dot,
                    "name": name,
                    "dba_name": dba,
                    "email": email,
                    "phone": phone,
                    "address": address,
                    "city": city,
                    "state": state,
                    "zip": zip_code,
                    "active": True,
                },
            )
            if is_new:
                created += 1
        self.stdout.write(f"  Carriers: {len(CARRIERS)} total, {created} new")

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
