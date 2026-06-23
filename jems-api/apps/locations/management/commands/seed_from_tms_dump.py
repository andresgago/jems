"""
Import selected legacy TMS reference data from a local SQL dump.

The command reads INSERT statements directly from tms_dump/full_dump.sql by
default. It is intentionally explicit about the imported tables so production
data is not pulled into JEMS accidentally.
"""

from __future__ import annotations

from datetime import datetime, time
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

DEFAULT_TABLES = ("cities", "brokers", "broker_contacts", "business")
LEGACY_TABLES = {
    "cities": "city",
    "brokers": "broker",
    "broker_contacts": "broker_contacts",
    "business": "business",
}


class Command(BaseCommand):
    help = (
        "Import cities, brokers, broker contacts, and businesses from a TMS SQL dump."
    )

    def add_arguments(self, parser):
        default_dump = settings.BASE_DIR.parent.parent / "tms_dump" / "full_dump.sql"
        parser.add_argument(
            "--dump",
            default=str(default_dump),
            help=f"Path to the legacy SQL dump. Defaults to {default_dump}",
        )
        parser.add_argument(
            "--tables",
            nargs="+",
            choices=DEFAULT_TABLES,
            default=list(DEFAULT_TABLES),
            help="Subset of tables to import.",
        )

    def handle(self, *args, **options):
        dump_path = Path(options["dump"]).expanduser().resolve()
        if not dump_path.exists():
            raise CommandError(f"Dump file does not exist: {dump_path}")

        selected_tables = tuple(options["tables"])
        self.stdout.write(f"Reading legacy dump: {dump_path}")

        with transaction.atomic():
            if "cities" in selected_tables:
                self._seed_cities(dump_path)
            if "brokers" in selected_tables:
                self._seed_brokers(dump_path)
            if "broker_contacts" in selected_tables:
                self._seed_broker_contacts(dump_path)
            if "business" in selected_tables:
                self._seed_business(dump_path)

        self.stdout.write(self.style.SUCCESS("TMS dump import complete."))

    def _seed_cities(self, dump_path: Path) -> None:
        from apps.locations.models import City, State

        states_by_id = {state.id: state for state in State.objects.all()}
        rows = _read_insert_rows(dump_path, LEGACY_TABLES["cities"])
        count = 0
        for row in rows:
            pk = _to_int(row[0])
            if pk is None:
                continue
            state_id = _to_int(row[3])
            state = states_by_id.get(state_id) if state_id is not None else None
            City.objects.update_or_create(
                id=pk,
                defaults={
                    "name": _clean_text(row[1])[:100],
                    "zip": _clean_text(row[2])[:10],
                    "state": state,
                    "active": bool(_to_int(row[4])),
                },
            )
            count += 1
        _reset_sequence(City)
        self.stdout.write(f"  Cities: {count} imported")

    def _seed_brokers(self, dump_path: Path) -> None:
        from apps.brokers.models import Broker
        from apps.carriers.models import Carrier

        carriers_by_id = {carrier.id: carrier for carrier in Carrier.objects.all()}
        seen_mcs = {
            broker.mc.lower(): broker.id
            for broker in Broker.objects.only("id", "mc")
            if broker.mc
        }
        seen_emails = {
            broker.email.lower(): broker.id
            for broker in Broker.objects.only("id", "email")
            if broker.email
        }
        rows = _read_insert_rows(dump_path, LEGACY_TABLES["brokers"])
        count = 0
        skipped = 0
        for row in rows:
            pk = _to_int(row[0])
            mc = _clean_text(row[1])
            name = _clean_text(row[2])
            if pk is None or not mc or not name:
                skipped += 1
                continue
            mc_key = mc.lower()
            if mc_key in seen_mcs and seen_mcs[mc_key] != pk:
                skipped += 1
                continue
            seen_mcs[mc_key] = pk

            carrier_id = _to_int(row[19])
            email = _clean_email(row[4])
            if email:
                email_key = email.lower()
                if email_key in seen_emails and seen_emails[email_key] != pk:
                    email = None
                else:
                    seen_emails[email_key] = pk

            Broker.objects.update_or_create(
                id=pk,
                defaults={
                    "mc": mc[:60],
                    "name": name[:255],
                    "dba_name": _clean_text(row[3])[:255],
                    "email": email,
                    "phone": _clean_text(row[5])[:255],
                    "status": _to_int(row[6]) or Broker.Status.INACTIVE,
                    "setup_packet_file": _clean_text(row[7]),
                    "accounting_email": _clean_email(row[8]),
                    "factor_company": _clean_text(row[9])[:255],
                    "factor_account_id": _clean_text(row[10])[:255],
                    "debtor_buy_status": _clean_text(row[11])[:100],
                    "checked_at": _parse_datetime(row[12]),
                    "details": _clean_text(row[13]),
                    "buy_status": _clean_text(row[14])[:100],
                    "carrier": (
                        carriers_by_id.get(carrier_id)
                        if carrier_id is not None
                        else None
                    ),
                },
            )
            count += 1
        _reset_sequence(Broker)
        self.stdout.write(f"  Brokers: {count} imported, {skipped} skipped")

    def _seed_broker_contacts(self, dump_path: Path) -> None:
        from apps.brokers.models import Broker, BrokerContact

        broker_ids = set(Broker.objects.values_list("id", flat=True))
        seen_emails: set[str] = set()
        rows = _read_insert_rows(dump_path, LEGACY_TABLES["broker_contacts"])
        count = 0
        skipped = 0
        for row in rows:
            pk = _to_int(row[0])
            broker_id = _to_int(row[4])
            email = _clean_email(row[2])
            if (
                pk is None
                or broker_id is None
                or broker_id not in broker_ids
                or not email
            ):
                skipped += 1
                continue
            if email.lower() in seen_emails:
                skipped += 1
                continue
            seen_emails.add(email.lower())

            BrokerContact.objects.update_or_create(
                id=pk,
                defaults={
                    "broker_id": broker_id,
                    "name": _clean_text(row[1])[:255] or email,
                    "email": email,
                    "phone": _clean_text(row[3])[:255],
                },
            )
            count += 1
        _reset_sequence(BrokerContact)
        self.stdout.write(f"  Broker contacts: {count} imported, {skipped} skipped")

    def _seed_business(self, dump_path: Path) -> None:
        from apps.brokers.models import Business
        from apps.locations.models import City

        city_ids = set(City.objects.values_list("id", flat=True))
        rows = _read_insert_rows(dump_path, LEGACY_TABLES["business"])
        count = 0
        skipped = 0
        for row in rows:
            pk = _to_int(row[0])
            name = _clean_text(row[1])
            if pk is None or not name:
                skipped += 1
                continue
            city_id = _to_int(row[5])
            Business.objects.update_or_create(
                id=pk,
                defaults={
                    "name": name[:255],
                    "status": _to_int(row[2]) or Business.Status.INACTIVE,
                    "rating": float(row[3] or 0),
                    "address": _clean_text(row[4])[:500],
                    "city_id": city_id if city_id in city_ids else None,
                    "lat": _to_float(row[6]) if len(row) > 6 else None,
                    "lon": _to_float(row[7]) if len(row) > 7 else None,
                },
            )
            count += 1
        _reset_sequence(Business)
        self.stdout.write(f"  Businesses: {count} imported, {skipped} skipped")


def _read_insert_rows(dump_path: Path, table: str) -> list[list[Any]]:
    prefix = f"INSERT INTO `{table}` VALUES "
    with dump_path.open("r", encoding="utf-8", errors="replace") as dump:
        for line in dump:
            if line.startswith(prefix):
                values_sql = line[len(prefix) :].rstrip()
                if values_sql.endswith(";"):
                    values_sql = values_sql[:-1]
                return _parse_mysql_values(values_sql)
    raise CommandError(f"No INSERT statement found for legacy table `{table}`.")


def _parse_mysql_values(values_sql: str) -> list[list[Any]]:
    rows: list[list[Any]] = []
    i = 0
    length = len(values_sql)

    while i < length:
        while i < length and values_sql[i] in " \n\r\t,":
            i += 1
        if i >= length:
            break
        if values_sql[i] != "(":
            raise CommandError(
                f"Expected '(' while parsing dump values near: {values_sql[i:i+40]}"
            )

        i += 1
        row: list[Any] = []
        token: list[str] = []
        in_string = False
        was_quoted = False

        while i < length:
            ch = values_sql[i]
            if in_string:
                if ch == "\\":
                    i += 1
                    if i >= length:
                        token.append("\\")
                        break
                    token.append(_unescape_mysql_char(values_sql[i]))
                elif ch == "'":
                    if i + 1 < length and values_sql[i + 1] == "'":
                        token.append("'")
                        i += 1
                    else:
                        in_string = False
                else:
                    token.append(ch)
            else:
                if ch == "'":
                    in_string = True
                    was_quoted = True
                elif ch == ",":
                    row.append(_coerce_token("".join(token), was_quoted))
                    token = []
                    was_quoted = False
                elif ch == ")":
                    row.append(_coerce_token("".join(token), was_quoted))
                    rows.append(row)
                    i += 1
                    break
                else:
                    token.append(ch)
            i += 1

    return rows


def _unescape_mysql_char(ch: str) -> str:
    return {
        "0": "\0",
        "b": "\b",
        "n": "\n",
        "r": "\r",
        "t": "\t",
        "Z": "\x1a",
    }.get(ch, ch)


def _coerce_token(token: str, was_quoted: bool) -> Any:
    if was_quoted:
        return token
    value = token.strip()
    if not value or value.upper() == "NULL":
        return None
    try:
        return int(value)
    except ValueError:
        try:
            return float(value)
        except ValueError:
            return value


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _clean_email(value: Any) -> str | None:
    email = _clean_text(value)
    return email[:255] or None


def _to_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_datetime(value: Any):
    raw = _clean_text(value)
    if not raw or raw == "0000-00-00":
        return None
    parsed = parse_datetime(raw)
    if parsed is None:
        parsed_date = parse_date(raw)
        if parsed_date is None:
            return None
        parsed = datetime.combine(parsed_date, time.min)
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


def _reset_sequence(model) -> None:
    table = model._meta.db_table
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT COALESCE(MAX(id), 1) FROM {table}")
        max_id = cursor.fetchone()[0]
        try:
            cursor.execute(
                "SELECT setval(pg_get_serial_sequence(%s, 'id'), %s, true)",
                [table, max_id],
            )
        except Exception:
            pass
