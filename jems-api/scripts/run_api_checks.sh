#!/usr/bin/env bash
# End-to-end API smoke-test for the JEMS Django backend.
# Creates a fresh test database, runs migrations, seeds one admin user,
# starts the dev server, exercises every endpoint in dependency order,
# then cleans up on exit.
#
# Usage:  ./scripts/run_api_checks.sh
# Prereqs: uv, psql client, a running PostgreSQL + PostGIS server.
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "${SCRIPT_DIR}")"
DB_NAME="jems_api_test"
SERVER_PORT="8877"
API_URL="http://localhost:${SERVER_PORT}"
SERVER_PID=""
_EMPTY_BODY='{}'   # used as default body in post/patch helpers — avoids bash brace-parsing bug

# Read DB credentials from the project .env so the script works out of the box
# without requiring the developer to export any variables.
# Format expected: DATABASE_URL=postgis://user:pass@host:port/dbname
_ENV_FILE="${BACKEND_DIR}/.env"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_PASS="postgres"

if [[ -f "${_ENV_FILE}" ]]; then
  _DB_URL="$(grep '^DATABASE_URL=' "${_ENV_FILE}" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  if [[ -n "${_DB_URL}" ]]; then
    # Extract each component from postgis://user:pass@host:port/dbname
    DB_USER="$(echo "${_DB_URL}" | sed 's|.*://\([^:]*\):.*|\1|')"
    DB_PASS="$(echo "${_DB_URL}" | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|')"
    DB_HOST="$(echo "${_DB_URL}" | sed 's|.*@\([^:/]*\)[:/].*|\1|')"
    DB_PORT="$(echo "${_DB_URL}" | sed 's|.*@[^:]*:\([0-9]*\)/.*|\1|')"
  fi
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
step() { echo; echo "===> $1"; }

pass() { echo "    OK: $1"; }

fail() {
  echo
  echo "============================================"
  echo " FAIL: $1"
  echo "============================================"
  if [[ -n "${2:-}" ]]; then
    echo "Response:"
    echo "$2" | head -20
  fi
  exit 1
}

# Called by set -e when any command exits non-zero (outside of fail()).
# Prints the line that blew up and the last server log lines for diagnosis.
on_error() {
  local line="${BASH_LINENO[0]:-?}"
  echo
  echo "============================================"
  echo " SCRIPT ABORTED at line ${line}"
  echo "============================================"
  echo "Last 30 lines of server log:"
  tail -30 /tmp/jems-server.log 2>/dev/null || echo "(no server log found)"
}

psql_no_db() {
  PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
    -v ON_ERROR_STOP=1 -q -c "$1" 2>/dev/null
}

psql_db() {
  PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
    -d "${DB_NAME}" -v ON_ERROR_STOP=1 -q -c "$1" 2>/dev/null
}

drop_test_db() {
  PGPASSWORD="${DB_PASS}" dropdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
    --if-exists --force "${DB_NAME}" 2>/dev/null || \
  PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
    -q -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true
}

assert_status() {
  local label="$1" expected="$2" actual="$3" resp="${4:-}"
  if [[ "${actual}" != "${expected}" ]]; then
    fail "${label}: expected HTTP ${expected}, got ${actual}" "${resp}"
  fi
  pass "${label} → ${actual}"
}

assert_contains() {
  local label="$1" resp="$2" pattern="$3"
  if ! echo "${resp}" | grep -qF "${pattern}"; then
    fail "${label}: expected to contain '${pattern}'" "${resp}"
  fi
  pass "${label} contains '${pattern}'"
}

assert_not_contains() {
  local label="$1" resp="$2" pattern="$3"
  if echo "${resp}" | grep -qF "${pattern}"; then
    fail "${label}: must NOT contain '${pattern}'" "${resp}"
  fi
  pass "${label} does not contain '${pattern}'"
}

# Extract first value of a JSON string field: json_get "key" <<< "$json"
json_get() {
  local key="$1"
  grep -o "\"${key}\":[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*": *"\(.*\)"/\1/'
}

# Extract first numeric value of a JSON field: json_get_num "key" <<< "$json"
json_get_num() {
  local key="$1"
  grep -o "\"${key}\":[[:space:]]*[0-9]*" | head -1 | grep -o '[0-9]*$'
}

# Shared curl options: bound hangs (--max-time) and auto-recover from a
# momentary connection blip / server restart (--retry --retry-connrefused) so a
# transient failure surfaces as a clear HTTP error rather than a silent set -e exit.
_CURL_OPTS=(-s --max-time 60 --retry 2 --retry-connrefused -w "\n%{http_code}")

# GET wrapper
get() {
  curl "${_CURL_OPTS[@]}" -H "Authorization: Bearer ${TOKEN}" \
    "${API_URL}${1}"
}

# POST wrapper (JSON body)
post() {
  curl "${_CURL_OPTS[@]}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -X POST "${API_URL}${1}" \
    -d "${2:-$_EMPTY_BODY}"
}

# POST without auth
post_anon() {
  curl "${_CURL_OPTS[@]}" \
    -H "Content-Type: application/json" \
    -X POST "${API_URL}${1}" \
    -d "${2:-$_EMPTY_BODY}"
}

# PATCH wrapper
patch() {
  curl "${_CURL_OPTS[@]}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -X PATCH "${API_URL}${1}" \
    -d "${2:-$_EMPTY_BODY}"
}

# PUT wrapper
put() {
  curl "${_CURL_OPTS[@]}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -X PUT "${API_URL}${1}" \
    -d "${2:-$_EMPTY_BODY}"
}

# DELETE wrapper
delete() {
  curl "${_CURL_OPTS[@]}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -X DELETE "${API_URL}${1}"
}

# Split response into body and status code (last line)
# sed '$d' removes the last line (the HTTP code) — portable on macOS and Linux
body() { printf '%s\n' "$1" | sed '$d'; }
code() { printf '%s\n' "$1" | tail -n 1; }

free_port() {
  if command -v lsof >/dev/null 2>&1; then
    local pid
    pid="$(lsof -ti tcp:"${SERVER_PORT}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pid}" ]]; then
      echo "  Stopping process on port ${SERVER_PORT} (pid ${pid})"
      kill "${pid}" 2>/dev/null || true
      sleep 1
    fi
  fi
}

cleanup() {
  # Disable ERR trap inside cleanup so its own commands don't re-trigger on_error.
  trap - ERR
  if [[ -n "${SERVER_PID}" ]]; then
    kill "${SERVER_PID}" 2>/dev/null || true
  fi
  echo
  echo "==> Cleaning up test DB ${DB_NAME}"
  drop_test_db
  echo "==> Cleaning up uploaded media files"
  rm -rf "${BACKEND_DIR}/media/documents" "${BACKEND_DIR}/media/trucks" \
         "${BACKEND_DIR}/media/trailers" "${BACKEND_DIR}/media/drivers" \
         "${BACKEND_DIR}/media/loads" "${BACKEND_DIR}/media/carriers" \
         "${BACKEND_DIR}/media/accidents"
}

wait_for_server() {
  local tries=30
  for _ in $(seq 1 "${tries}"); do
    if curl -s --max-time 1 "${API_URL}/api/v1/auth/login/" > /dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "ERROR: Django server did not start on port ${SERVER_PORT}"
  cat /tmp/jems-server.log 2>/dev/null | tail -30
  exit 1
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────
if ! command -v psql >/dev/null 2>&1; then
  echo "ERROR: psql client not found."
  exit 1
fi
if ! command -v dropdb >/dev/null 2>&1 || ! command -v createdb >/dev/null 2>&1; then
  echo "ERROR: PostgreSQL dropdb/createdb clients not found."
  exit 1
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "ERROR: uv not found."
  exit 1
fi

trap 'cleanup' EXIT INT TERM
trap 'on_error' ERR
TOKEN=""

# ── Database setup ────────────────────────────────────────────────────────────
step "Reset test database"
PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid <> pg_backend_pid();" 2>/dev/null || true
drop_test_db
PGPASSWORD="${DB_PASS}" createdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}"
PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  -d "${DB_NAME}" -q -c "CREATE EXTENSION IF NOT EXISTS postgis;" 2>/dev/null
pass "Database ${DB_NAME} ready"

step "Apply migrations"
cd "${BACKEND_DIR}"
DATABASE_URL="postgis://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  uv run python manage.py migrate --no-input -v 0
pass "Migrations applied"

step "Seed admin user"
DATABASE_URL="postgis://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  uv run python manage.py shell -c "
from apps.users.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@jems.test', 'admin1234', first_name='Admin', last_name='Test')
"
pass "Admin user created (admin / admin1234)"

step "Seed second dispatcher user"
DATABASE_URL="postgis://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  uv run python manage.py shell -c "
from apps.users.models import User
if not User.objects.filter(username='dispatcher1').exists():
    u = User.objects.create_user('dispatcher1', 'dispatcher1@jems.test', 'disp1234', first_name='Dispatch', last_name='One')
    u.is_dispatcher = True
    u.save()
"
pass "Dispatcher user created (dispatcher1 / disp1234)"

step "Seed reference data (state + city)"
DATABASE_URL="postgis://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  uv run python manage.py shell -c "
from apps.locations.models import State, City
state, _ = State.objects.get_or_create(name='Texas', abbreviation='TX')
City.objects.get_or_create(name='Houston', zip='77001', state=state, active=True)
"
STATE_ID="$(PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  -d "${DB_NAME}" -q -t -c "SELECT id FROM states WHERE abbreviation='TX';" | tr -d ' ')"
CITY_ID="$(PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" \
  -d "${DB_NAME}" -q -t -c "SELECT id FROM cities WHERE name='Houston' LIMIT 1;" | tr -d ' ')"
pass "State TX id=${STATE_ID}, City Houston id=${CITY_ID}"

step "Seed legacy accounting catalogs"
DATABASE_URL="postgis://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  uv run python manage.py shell -c "
from apps.accounting.models import Account
from apps.drivers.models import DriverType

DriverType.objects.get_or_create(id=4, defaults={'name': 'Solo Driver', 'is_active': True})
for code, name in {
    '90010': 'Income by Rate',
    '90011': 'Income by Detention',
    '90014': 'Income by Drop Trailer',
    '10040': '% Factor dispatch by load',
    '10041': '% Factor dispatch Drop',
    '80011': 'Expenses By Detention',
}.items():
    Account.objects.get_or_create(code=code, defaults={'name': name})
"
pass "Legacy driver/accounting catalogs ready"

step "Start Django dev server on port ${SERVER_PORT}"
free_port
DATABASE_URL="postgis://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  uv run python manage.py runserver --noreload "${SERVER_PORT}" > /tmp/jems-server.log 2>&1 &
SERVER_PID=$!
wait_for_server
pass "Server running (pid ${SERVER_PID})"

# ── Auth ──────────────────────────────────────────────────────────────────────
step "Auth: login"
resp="$(post_anon "/api/v1/auth/login/" '{"username":"admin","password":"admin1234"}')"
assert_status "login" "200" "$(code "$resp")" "$(body "$resp")"
TOKEN="$(body "$resp" | json_get access)"
REFRESH_TOKEN="$(body "$resp" | json_get refresh)"
if [[ -z "${TOKEN}" ]]; then fail "login: could not extract access token" "$(body "$resp")"; fi
pass "Got access token"

step "Auth: refresh token"
resp="$(post_anon "/api/v1/auth/refresh/" "{\"refresh\":\"${REFRESH_TOKEN}\"}")"
assert_status "refresh" "200" "$(code "$resp")" "$(body "$resp")"
TOKEN="$(body "$resp" | json_get access)"
pass "Token refreshed"

step "Auth: unauthenticated request blocked"
resp="$(curl -s -w "\n%{http_code}" "${API_URL}/api/v1/users/")"
assert_status "unauth blocked" "401" "$(code "$resp")"

# ── Users & Positions ─────────────────────────────────────────────────────────
step "Users: list"
resp="$(get "/api/v1/users/")"
assert_status "user list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "user list" "$(body "$resp")" "admin"

step "Users: create"
resp="$(post "/api/v1/users/" '{"username":"newuser1","email":"newuser1@jems.test","password":"Xk9!mPq2#rLv","first_name":"New","last_name":"User","is_dispatcher":false,"dispatcher_type":0,"contract":0,"percent":2.5,"hours":0,"color":"#00ffff","address":"1 Main St"}')"
assert_status "user create" "201" "$(code "$resp")" "$(body "$resp")"
NEW_USER_ID="$(body "$resp" | json_get_num id)"
assert_contains "user created" "$(body "$resp")" "newuser1"
assert_contains "user created has contract" "$(body "$resp")" '"contract":0'

step "Users: retrieve"
resp="$(get "/api/v1/users/${NEW_USER_ID}/")"
assert_status "user retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "user retrieve has dispatcher display" "$(body "$resp")" "dispatcher_type_display"
assert_contains "user retrieve has address" "$(body "$resp")" "1 Main St"

step "Users: update via PATCH"
resp="$(patch "/api/v1/users/${NEW_USER_ID}/" '{"first_name":"Updated","last_name":"User","email":"newuser1-upd@jems.test","percent":3}')"
assert_status "user update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "user updated" "$(body "$resp")" "Updated"
assert_contains "user updated percent" "$(body "$resp")" '"percent":3'

step "Users: options endpoint"
resp="$(get "/api/v1/users/options/?dispatchers=1")"
assert_status "user options" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "user options has label" "$(body "$resp")" "label"

step "Users: system config retrieve and patch"
resp="$(get "/api/v1/users/settings/config/")"
assert_status "system config retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "system config has driver invoice" "$(body "$resp")" "driver_invoice"
resp="$(patch "/api/v1/users/settings/config/" '{"driver_invoice":1500}')"
assert_status "system config patch" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "system config patched" "$(body "$resp")" '"driver_invoice":1500'

step "Users: display options retrieve and patch"
resp="$(get "/api/v1/users/settings/display-options/")"
assert_status "display options retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "display options has truck fields" "$(body "$resp")" "number"
resp="$(patch "/api/v1/users/settings/display-options/" '{"driver":"name,phone"}')"
assert_status "display options patch" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "display options patched" "$(body "$resp")" "name,phone"

step "Users: change password"
resp="$(post "/api/v1/users/${NEW_USER_ID}/change-password/" '{"password":"Tz7@nWq5!kBv","password_confirm":"Tz7@nWq5!kBv"}')"
assert_status "change password" "200" "$(code "$resp")" "$(body "$resp")"

step "Users: toggle status (deactivate)"
resp="$(post "/api/v1/users/${NEW_USER_ID}/toggle-status/" '{}')"
assert_status "toggle status" "200" "$(code "$resp")" "$(body "$resp")"

step "Users: toggle dispatcher (promote)"
resp="$(post "/api/v1/users/${NEW_USER_ID}/toggle-dispatcher/" '{}')"
assert_status "toggle dispatcher on" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "dispatcher flag on" "$(body "$resp")" '"is_dispatcher":true'

step "Users: toggle dispatcher (demote)"
resp="$(post "/api/v1/users/${NEW_USER_ID}/toggle-dispatcher/" '{}')"
assert_status "toggle dispatcher off" "200" "$(code "$resp")" "$(body "$resp")"

step "Users: delete"
resp="$(delete "/api/v1/users/${NEW_USER_ID}/")"
assert_status "user delete" "204" "$(code "$resp")"

step "Users: deleted → 404"
resp="$(get "/api/v1/users/${NEW_USER_ID}/")"
assert_status "user gone" "404" "$(code "$resp")"

step "Users: /me"
resp="$(get "/api/v1/users/me/")"
assert_status "me" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "me username" "$(body "$resp")" "admin"

step "Positions: create"
resp="$(post "/api/v1/users/positions/" '{"name":"Dispatcher"}')"
assert_status "position create" "201" "$(code "$resp")" "$(body "$resp")"
POSITION_ID="$(body "$resp" | json_get_num id)"

step "Positions: list"
resp="$(get "/api/v1/users/positions/")"
assert_status "position list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "position listed" "$(body "$resp")" "Dispatcher"

step "Positions: update"
resp="$(patch "/api/v1/users/positions/${POSITION_ID}/" '{"name":"Senior Dispatcher"}')"
assert_status "position update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "position updated" "$(body "$resp")" "Senior Dispatcher"

# STATE_ID and CITY_ID are already set from the seed step.
step "Locations: states list"
resp="$(get "/api/v1/locations/states/")"
assert_status "states list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "states list has abbreviation" "$(body "$resp")" "abbreviation"
assert_contains "states list includes TX" "$(body "$resp")" "TX"

step "Locations: cities list (paginated)"
resp="$(get "/api/v1/locations/cities/?active=1")"
assert_status "cities list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "cities list has count" "$(body "$resp")" "count"
assert_contains "cities list has results" "$(body "$resp")" "results"

step "Locations: city retrieve"
resp="$(get "/api/v1/locations/cities/${CITY_ID}/")"
assert_status "city retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "city has name" "$(body "$resp")" "Houston"
assert_contains "city has zip" "$(body "$resp")" "77001"
assert_contains "city has state_data" "$(body "$resp")" "state_data"

step "Locations: city PATCH (timezone)"
resp="$(patch "/api/v1/locations/cities/${CITY_ID}/" '{"timezone":"America/Chicago"}')"
assert_status "city patch" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "city patch timezone" "$(body "$resp")" "America/Chicago"

step "Locations: city PATCH restore timezone"
resp="$(patch "/api/v1/locations/cities/${CITY_ID}/" '{"timezone":""}')"
assert_status "city patch restore" "200" "$(code "$resp")" "$(body "$resp")"

step "Locations: city toggle-status (active → inactive)"
resp="$(post "/api/v1/locations/cities/${CITY_ID}/toggle-status/" '{}')"
assert_status "city toggle to inactive" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "city is now inactive" "$(body "$resp")" "false"

step "Locations: city toggle-status (inactive → active)"
resp="$(post "/api/v1/locations/cities/${CITY_ID}/toggle-status/" '{}')"
assert_status "city toggle to active" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "city is now active" "$(body "$resp")" "true"

step "Locations: cities list filter by q=Hous"
resp="$(get "/api/v1/locations/cities/?q=Hous")"
assert_status "cities filter q" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "cities filter q has Houston" "$(body "$resp")" "Houston"

step "Locations: city create"
resp="$(post "/api/v1/locations/cities/" "{\"name\":\"Smoke Test City\",\"zip\":\"99999\",\"state\":${STATE_ID}}")"
assert_status "city create" "201" "$(code "$resp")" "$(body "$resp")"
assert_contains "city create has state_data" "$(body "$resp")" "state_data"

# ── Fleet catalogs ────────────────────────────────────────────────────────────
step "Fleet catalogs: truck type"
resp="$(post "/api/v1/fleet/truck-types/" '{"name":"Dry Van","is_active":true}')"
assert_status "truck type create" "201" "$(code "$resp")" "$(body "$resp")"
TRUCK_TYPE_ID="$(body "$resp" | json_get_num id)"

step "Fleet catalogs: truck type list"
resp="$(get "/api/v1/fleet/truck-types/")"
assert_status "truck type list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "truck type listed" "$(body "$resp")" "Dry Van"

step "Fleet catalogs: trailer type"
resp="$(post "/api/v1/fleet/trailer-types/" '{"name":"53ft Dry Van","short_name":"DV","is_active":true}')"
assert_status "trailer type create" "201" "$(code "$resp")" "$(body "$resp")"
assert_contains "trailer type has short_name" "$(body "$resp")" "DV"
TRAILER_TYPE_ID="$(body "$resp" | json_get_num id)"

step "Fleet catalogs: trailer type list"
resp="$(get "/api/v1/fleet/trailer-types/")"
assert_status "trailer type list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "trailer type listed" "$(body "$resp")" "53ft"
assert_contains "trailer type list has short_name" "$(body "$resp")" "DV"

step "Fleet catalogs: make"
resp="$(post "/api/v1/fleet/makes/" '{"name":"Freightliner"}')"
assert_status "make create" "201" "$(code "$resp")" "$(body "$resp")"
MAKE_ID="$(body "$resp" | json_get_num id)"

step "Fleet catalogs: make update"
resp="$(patch "/api/v1/fleet/makes/${MAKE_ID}/" '{"name":"Freightliner Inc."}')"
assert_status "make update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "make updated" "$(body "$resp")" "Freightliner Inc."

step "Fleet catalogs: engine type"
resp="$(post "/api/v1/fleet/engine-types/" '{"name":"Cummins ISX15"}')"
assert_status "engine type create" "201" "$(code "$resp")" "$(body "$resp")"
ENGINE_TYPE_ID="$(body "$resp" | json_get_num id)"

step "Fleet catalogs: engine type update"
resp="$(patch "/api/v1/fleet/engine-types/${ENGINE_TYPE_ID}/" '{"name":"Cummins ISX15 v2"}')"
assert_status "engine type update" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet catalogs: cabin type"
resp="$(post "/api/v1/fleet/cabin-types/" '{"name":"Sleeper"}')"
assert_status "cabin type create" "201" "$(code "$resp")" "$(body "$resp")"
CABIN_TYPE_ID="$(body "$resp" | json_get_num id)"

step "Fleet catalogs: cabin type update"
resp="$(patch "/api/v1/fleet/cabin-types/${CABIN_TYPE_ID}/" '{"name":"Day Cab"}')"
assert_status "cabin type update" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet catalogs: transmission type"
resp="$(post "/api/v1/fleet/transmission-types/" '{"name":"Automatic"}')"
assert_status "transmission type create" "201" "$(code "$resp")" "$(body "$resp")"
TRANS_TYPE_ID="$(body "$resp" | json_get_num id)"

step "Fleet catalogs: transmission type update"
resp="$(patch "/api/v1/fleet/transmission-types/${TRANS_TYPE_ID}/" '{"name":"10-speed Manual"}')"
assert_status "transmission type update" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet catalogs: tire size"
resp="$(post "/api/v1/fleet/tire-sizes/" '{"name":"22.5"}')"
assert_status "tire size create" "201" "$(code "$resp")" "$(body "$resp")"
TIRE_SIZE_ID="$(body "$resp" | json_get_num id)"

step "Fleet catalogs: tire size update"
resp="$(patch "/api/v1/fleet/tire-sizes/${TIRE_SIZE_ID}/" '{"name":"24.5"}')"
assert_status "tire size update" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet catalogs: card"
resp="$(post "/api/v1/fleet/cards/" '{"number":"PILOT-001","is_active":true}')"
assert_status "card create" "201" "$(code "$resp")" "$(body "$resp")"
CARD_ID="$(body "$resp" | json_get_num id)"

step "Fleet catalogs: card deactivate"
resp="$(patch "/api/v1/fleet/cards/${CARD_ID}/" '{"is_active":false}')"
assert_status "card deactivate" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet catalogs: card reactivate"
resp="$(patch "/api/v1/fleet/cards/${CARD_ID}/" '{"is_active":true}')"
assert_status "card reactivate" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet catalogs: loss payee"
resp="$(post "/api/v1/fleet/loss-payees/" '{"name":"Chase Bank","address":"100 Main St","is_active":true}')"
assert_status "loss payee create" "201" "$(code "$resp")" "$(body "$resp")"
LOSS_PAYEE_ID="$(body "$resp" | json_get_num id)"

step "Fleet catalogs: loss payee update"
resp="$(patch "/api/v1/fleet/loss-payees/${LOSS_PAYEE_ID}/" '{"name":"Chase Bank NA"}')"
assert_status "loss payee update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "loss payee updated" "$(body "$resp")" "Chase Bank NA"

# ── Truck owner ───────────────────────────────────────────────────────────────
step "Fleet: truck owner create"
resp="$(post "/api/v1/fleet/owners/" '{"first_name":"Carlos","last_name":"Morales","email":"carlos@example.com","phone":"5551234567","status":1}')"
assert_status "truck owner create" "201" "$(code "$resp")" "$(body "$resp")"
TRUCK_OWNER_ID="$(body "$resp" | json_get_num id)"

step "Fleet: truck owner list"
resp="$(get "/api/v1/fleet/owners/")"
assert_status "truck owner list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "truck owner listed" "$(body "$resp")" "Carlos"

step "Fleet: truck owner retrieve"
resp="$(get "/api/v1/fleet/owners/${TRUCK_OWNER_ID}/")"
assert_status "truck owner retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "truck owner email" "$(body "$resp")" "carlos@example.com"

step "Fleet: truck owner update (PATCH)"
resp="$(patch "/api/v1/fleet/owners/${TRUCK_OWNER_ID}/" '{"phone":"5559999999"}')"
assert_status "truck owner update patch" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: truck owner update (PUT)"
resp="$(put "/api/v1/fleet/owners/${TRUCK_OWNER_ID}/" '{"email":"carlos-updated@example.com"}')"
assert_status "truck owner update put" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "truck owner put updated" "$(body "$resp")" "carlos-updated"

step "Fleet: truck owner toggle status (deactivate)"
resp="$(post "/api/v1/fleet/owners/${TRUCK_OWNER_ID}/toggle-status/" '{}')"
assert_status "truck owner toggle off" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: truck owner toggle status (reactivate)"
resp="$(post "/api/v1/fleet/owners/${TRUCK_OWNER_ID}/toggle-status/" '{}')"
assert_status "truck owner toggle on" "200" "$(code "$resp")" "$(body "$resp")"

# ── Truck ─────────────────────────────────────────────────────────────────────
step "Fleet: truck create"
resp="$(post "/api/v1/fleet/trucks/" "{\"number\":\"T-001\",\"vin\":\"1HTMKAAR3BH000001\",\"year\":2022,\"truck_type\":${TRUCK_TYPE_ID},\"status\":1}")"
assert_status "truck create" "201" "$(code "$resp")" "$(body "$resp")"
TRUCK_ID="$(body "$resp" | json_get_num id)"

step "Fleet: truck retrieve"
resp="$(get "/api/v1/fleet/trucks/${TRUCK_ID}/")"
assert_status "truck retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "truck number" "$(body "$resp")" "T-001"

step "Fleet: truck list"
resp="$(get "/api/v1/fleet/trucks/")"
assert_status "truck list" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: truck update (PATCH)"
resp="$(patch "/api/v1/fleet/trucks/${TRUCK_ID}/" '{"year":2023}')"
assert_status "truck update patch" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: truck update (PUT)"
resp="$(put "/api/v1/fleet/trucks/${TRUCK_ID}/" '{"year":2024}')"
assert_status "truck update put" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "truck put updated year" "$(body "$resp")" "2024"

step "Fleet: truck toggle status (deactivate)"
resp="$(post "/api/v1/fleet/trucks/${TRUCK_ID}/toggle-status/" '{}')"
assert_status "truck toggle off" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: truck toggle status (reactivate)"
resp="$(post "/api/v1/fleet/trucks/${TRUCK_ID}/toggle-status/" '{}')"
assert_status "truck toggle on" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: truck maintenance create"
resp="$(post "/api/v1/fleet/trucks/${TRUCK_ID}/maintenance/" '{"date":"2024-03-01","detail":"Oil change"}')"
assert_status "truck maintenance create" "201" "$(code "$resp")" "$(body "$resp")"
TRUCK_MAINT_ID="$(body "$resp" | json_get_num id)"

step "Fleet: truck maintenance list"
resp="$(get "/api/v1/fleet/trucks/${TRUCK_ID}/maintenance/")"
assert_status "truck maintenance list" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: truck file upload (document slots)"
_TMP_DOC="$(mktemp /tmp/jems_truck_doc.XXXXXX.pdf)"
printf '%%PDF-1.4 fake' > "${_TMP_DOC}"
for slot in avi registration agreement leased; do
  resp="$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -F "file=@${_TMP_DOC};type=application/pdf" \
    "${API_URL}/api/v1/fleet/trucks/${TRUCK_ID}/files/${slot}/")"
  assert_status "truck ${slot} file upload" "200" "$(code "$resp")" "$(body "$resp")"
  assert_contains "truck has ${slot}_file" "$(body "$resp")" "/media/trucks/"
done
rm -f "${_TMP_DOC}"

step "Fleet: truck photo upload"
_TMP_PHOTO="$(mktemp /tmp/jems_truck_photo.XXXXXX).png"
DATABASE_URL="postgis://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  uv run python -c "from PIL import Image; Image.new('RGB', (1, 1)).save('${_TMP_PHOTO}')"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${_TMP_PHOTO};type=image/png" \
  "${API_URL}/api/v1/fleet/trucks/${TRUCK_ID}/files/photo/")"
rm -f "${_TMP_PHOTO}"
assert_status "truck photo upload" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "truck has photo" "$(body "$resp")" "/media/trucks/photos/"

step "Fleet: truck photo non-image rejected"
_TMP_BAD="$(mktemp /tmp/jems_truck_bad.XXXXXX.txt)"
printf 'not an image' > "${_TMP_BAD}"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${_TMP_BAD};type=text/plain" \
  "${API_URL}/api/v1/fleet/trucks/${TRUCK_ID}/files/photo/")"
rm -f "${_TMP_BAD}"
assert_status "truck photo rejects non-image" "400" "$(code "$resp")"

step "Fleet: truck unknown file slot rejected"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@/dev/null" \
  "${API_URL}/api/v1/fleet/trucks/${TRUCK_ID}/files/bogus/")"
assert_status "truck unknown slot" "400" "$(code "$resp")"

step "Fleet: truck file clear"
resp="$(delete "/api/v1/fleet/trucks/${TRUCK_ID}/files/avi/")"
assert_status "truck file clear" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: miles reset create"
resp="$(post "/api/v1/fleet/miles-resets/" "{\"truck\":${TRUCK_ID},\"date\":\"2024-01-01\"}")"
assert_status "miles reset create" "201" "$(code "$resp")" "$(body "$resp")"
MILES_RESET_ID="$(body "$resp" | json_get_num id)"

step "Fleet: miles reset filter by truck"
resp="$(get "/api/v1/fleet/miles-resets/?truck=${TRUCK_ID}")"
assert_status "miles reset filter" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: miles reset delete"
resp="$(delete "/api/v1/fleet/miles-resets/${MILES_RESET_ID}/")"
assert_status "miles reset delete" "204" "$(code "$resp")"

# ── Trailer ───────────────────────────────────────────────────────────────────
step "Fleet: trailer create"
resp="$(post "/api/v1/fleet/trailers/" "{\"number\":\"TRL-001\",\"year\":2021,\"trailer_type\":${TRAILER_TYPE_ID},\"status\":1}")"
assert_status "trailer create" "201" "$(code "$resp")" "$(body "$resp")"
TRAILER_ID="$(body "$resp" | json_get_num id)"

step "Fleet: trailer list"
resp="$(get "/api/v1/fleet/trailers/")"
assert_status "trailer list" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: trailer options (active, not rented)"
resp="$(get "/api/v1/fleet/trailers/options/")"
assert_status "trailer options" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "trailer in options" "$(body "$resp")" "TRL-001"

step "Fleet: trailer retrieve"
resp="$(get "/api/v1/fleet/trailers/${TRAILER_ID}/")"
assert_status "trailer retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "trailer number" "$(body "$resp")" "TRL-001"
assert_contains "trailer has carrier field" "$(body "$resp")" '"carrier"'

step "Fleet: trailer update (PATCH)"
resp="$(patch "/api/v1/fleet/trailers/${TRAILER_ID}/" '{"plate_number":"TX-12345"}')"
assert_status "trailer update patch" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "trailer patched" "$(body "$resp")" "TX-12345"

step "Fleet: trailer update (PUT)"
resp="$(put "/api/v1/fleet/trailers/${TRAILER_ID}/" "{\"number\":\"TRL-001\",\"year\":2022,\"trailer_type\":${TRAILER_TYPE_ID},\"status\":1}")"
assert_status "trailer update put" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "trailer updated year" "$(body "$resp")" "2022"

step "Fleet: trailer toggle status (deactivate)"
resp="$(post "/api/v1/fleet/trailers/${TRAILER_ID}/toggle-status/" '{}')"
assert_status "trailer toggle off" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: trailer toggle status (reactivate)"
resp="$(post "/api/v1/fleet/trailers/${TRAILER_ID}/toggle-status/" '{}')"
assert_status "trailer toggle on" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: trailer maintenance create"
resp="$(post "/api/v1/fleet/trailers/${TRAILER_ID}/maintenance/" '{"date":"2024-04-01","detail":"Brake inspection"}')"
assert_status "trailer maintenance create" "201" "$(code "$resp")" "$(body "$resp")"

step "Fleet: trailer maintenance list"
resp="$(get "/api/v1/fleet/trailers/${TRAILER_ID}/maintenance/")"
assert_status "trailer maintenance list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "trailer maintenance listed" "$(body "$resp")" "Brake inspection"

step "Fleet: trailer file upload (3 slots)"
_TMP_TDOC="$(mktemp /tmp/jems_trailer_doc.XXXXXX.pdf)"
printf '%%PDF-1.4 fake' > "${_TMP_TDOC}"
for slot in annual_inspection registration agreement; do
  resp="$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -F "file=@${_TMP_TDOC};type=application/pdf" \
    "${API_URL}/api/v1/fleet/trailers/${TRAILER_ID}/files/${slot}/")"
  assert_status "trailer ${slot} file upload" "200" "$(code "$resp")" "$(body "$resp")"
  assert_contains "trailer has ${slot}_file" "$(body "$resp")" "/media/trailers/"
done
rm -f "${_TMP_TDOC}"

step "Fleet: trailer unknown file slot rejected"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@/dev/null" \
  "${API_URL}/api/v1/fleet/trailers/${TRAILER_ID}/files/bogus/")"
assert_status "trailer unknown slot" "400" "$(code "$resp")"

step "Fleet: trailer file clear"
resp="$(delete "/api/v1/fleet/trailers/${TRAILER_ID}/files/registration/")"
assert_status "trailer file clear" "200" "$(code "$resp")" "$(body "$resp")"

# ── Accident ──────────────────────────────────────────────────────────────────
step "Fleet: accident create"
resp="$(post "/api/v1/fleet/accidents/" "{\"date\":\"2024-06-01T10:00:00Z\",\"truck\":${TRUCK_ID},\"address\":\"I-10 Mile 220\",\"state\":${STATE_ID},\"crash_number\":\"TX-2024-001\",\"tow_aways\":false,\"death_count\":0,\"fatal_injuries\":0}")"
assert_status "accident create" "201" "$(code "$resp")" "$(body "$resp")"
ACCIDENT_ID="$(body "$resp" | json_get_num id)"

step "Fleet: accident list"
resp="$(get "/api/v1/fleet/accidents/")"
assert_status "accident list" "200" "$(code "$resp")" "$(body "$resp")"

step "Fleet: accident retrieve"
resp="$(get "/api/v1/fleet/accidents/${ACCIDENT_ID}/")"
assert_status "accident retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "accident crash number" "$(body "$resp")" "TX-2024-001"

step "Fleet: accident picture upload"
_TMP_IMG="$(mktemp /tmp/jems_test_img.XXXXXX.png)"
# Generate a minimal valid 1×1 PNG using Python (bash printf can't write raw binary reliably)
python3 -c "
import struct, zlib
def make_png():
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
    idat = zlib.compress(b'\\x00\\xff\\x00\\x00')
    return b'\\x89PNG\\r\\n\\x1a\\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
import sys; sys.stdout.buffer.write(make_png())
" > "${_TMP_IMG}"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${_TMP_IMG};type=image/png" \
  -F "description=Scene photo" \
  -F "rank=1" \
  "${API_URL}/api/v1/fleet/accidents/${ACCIDENT_ID}/pictures/")"
rm -f "${_TMP_IMG}"
assert_status "accident picture upload" "201" "$(code "$resp")" "$(body "$resp")"
ACCIDENT_PICTURE_ID="$(body "$resp" | json_get_num id)"

step "Fleet: accident retrieve with picture"
resp="$(get "/api/v1/fleet/accidents/${ACCIDENT_ID}/")"
assert_status "accident retrieve with picture" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "accident has pictures" "$(body "$resp")" "Scene photo"

step "Fleet: accident picture delete"
resp="$(delete "/api/v1/fleet/accidents/${ACCIDENT_ID}/pictures/${ACCIDENT_PICTURE_ID}/")"
assert_status "accident picture delete" "204" "$(code "$resp")"

step "Fleet: accident update"
resp="$(patch "/api/v1/fleet/accidents/${ACCIDENT_ID}/" '{"address":"I-10 Mile 221 (updated)"}')"
assert_status "accident update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "accident updated address" "$(body "$resp")" "updated"

step "Fleet: accident delete"
resp="$(delete "/api/v1/fleet/accidents/${ACCIDENT_ID}/")"
assert_status "accident delete" "204" "$(code "$resp")"

step "Fleet: accident deleted → 404"
resp="$(get "/api/v1/fleet/accidents/${ACCIDENT_ID}/")"
assert_status "accident gone" "404" "$(code "$resp")"

step "Fleet: accident not found"
resp="$(get "/api/v1/fleet/accidents/99999/")"
assert_status "accident 404" "404" "$(code "$resp")"

# ── Drivers ───────────────────────────────────────────────────────────────────
step "Drivers: type create"
resp="$(post "/api/v1/drivers/types/" '{"name":"Company Driver","is_active":true}')"
assert_status "driver type create" "201" "$(code "$resp")" "$(body "$resp")"
DRIVER_TYPE_ID="$(body "$resp" | json_get_num id)"

step "Drivers: type list"
resp="$(get "/api/v1/drivers/types/")"
assert_status "driver type list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "driver type listed" "$(body "$resp")" "Company Driver"

step "Drivers: create"
resp="$(post "/api/v1/drivers/" "{\"first_name\":\"Juan\",\"last_name\":\"Perez\",\"driver_type\":4,\"status\":1,\"phone\":\"5559876543\",\"email\":\"juan@example.com\",\"factor\":25,\"license_number\":\"TX123456\"}")"
assert_status "driver create" "201" "$(code "$resp")" "$(body "$resp")"
DRIVER_ID="$(body "$resp" | json_get_num id)"

step "Drivers: retrieve"
resp="$(get "/api/v1/drivers/${DRIVER_ID}/")"
assert_status "driver retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "driver name" "$(body "$resp")" "Juan"

step "Drivers: update"
resp="$(put "/api/v1/drivers/${DRIVER_ID}/" '{"first_name":"Juan","last_name":"Perez Updated","license_number":"TX123456"}')"
assert_status "driver update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "driver updated" "$(body "$resp")" "Perez Updated"

step "Drivers: list"
resp="$(get "/api/v1/drivers/")"
assert_status "driver list" "200" "$(code "$resp")" "$(body "$resp")"

step "Drivers: toggle status"
resp="$(post "/api/v1/drivers/${DRIVER_ID}/toggle-status/" '{}')"
assert_status "driver toggle status" "200" "$(code "$resp")" "$(body "$resp")"

# toggle back to active
resp="$(post "/api/v1/drivers/${DRIVER_ID}/toggle-status/" '{}')"
assert_status "driver toggle back" "200" "$(code "$resp")" "$(body "$resp")"

step "Drivers: vacation create"
resp="$(post "/api/v1/drivers/${DRIVER_ID}/vacations/" '{"start":"2024-07-01","end":"2024-07-14","note":"Summer vacation"}')"
assert_status "vacation create" "201" "$(code "$resp")" "$(body "$resp")"
VACATION_ID="$(body "$resp" | json_get_num id)"

step "Drivers: vacation list"
resp="$(get "/api/v1/drivers/${DRIVER_ID}/vacations/")"
assert_status "vacation list" "200" "$(code "$resp")" "$(body "$resp")"

step "Drivers: vacation delete"
resp="$(delete "/api/v1/drivers/${DRIVER_ID}/vacations/${VACATION_ID}/")"
assert_status "vacation delete" "204" "$(code "$resp")"

step "Drivers: vacation deleted → 404"
resp="$(delete "/api/v1/drivers/${DRIVER_ID}/vacations/${VACATION_ID}/")"
assert_status "vacation gone" "404" "$(code "$resp")"

step "Drivers: document upload"
_TMP_DOC="$(mktemp /tmp/jems_test_doc.XXXXXX.pdf)"
printf '%%PDF-1.4 fake' > "${_TMP_DOC}"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "document_type=2" \
  -F "file=@${_TMP_DOC};type=application/pdf" \
  -F "expiration_date=2026-01-01" \
  "${API_URL}/api/v1/drivers/${DRIVER_ID}/documents/")"
rm -f "${_TMP_DOC}"
assert_status "driver document upload" "201" "$(code "$resp")" "$(body "$resp")"
DRIVER_DOC_ID="$(body "$resp" | json_get_num id)"

step "Drivers: document list"
resp="$(get "/api/v1/drivers/${DRIVER_ID}/documents/")"
assert_status "driver document list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "document listed" "$(body "$resp")" "${DRIVER_DOC_ID}"

step "Drivers: document delete"
resp="$(delete "/api/v1/drivers/documents/${DRIVER_DOC_ID}/")"
assert_status "driver document delete" "204" "$(code "$resp")"

step "Drivers: document deleted → 404"
resp="$(delete "/api/v1/drivers/documents/${DRIVER_DOC_ID}/")"
assert_status "driver document gone" "404" "$(code "$resp")"

step "Drivers: legacy-parity document type (Social Security Card = 7)"
_TMP_DOC="$(mktemp /tmp/jems_test_ssn.XXXXXX.pdf)"
printf '%%PDF-1.4 fake' > "${_TMP_DOC}"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "document_type=7" \
  -F "file=@${_TMP_DOC};type=application/pdf" \
  "${API_URL}/api/v1/drivers/${DRIVER_ID}/documents/")"
rm -f "${_TMP_DOC}"
assert_status "parity document upload" "201" "$(code "$resp")" "$(body "$resp")"
assert_contains "parity document type" "$(body "$resp")" "Social Security Card"

step "Drivers: photo upload"
_TMP_PHOTO="$(mktemp /tmp/jems_test_photo.XXXXXX).png"
DATABASE_URL="postgis://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  uv run python -c "from PIL import Image; Image.new('RGB', (1, 1)).save('${_TMP_PHOTO}')"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "photo=@${_TMP_PHOTO};type=image/png" \
  "${API_URL}/api/v1/drivers/${DRIVER_ID}/photo/")"
rm -f "${_TMP_PHOTO}"
assert_status "driver photo upload" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "driver has photo" "$(body "$resp")" "/media/drivers/photos/"

step "Drivers: photo non-image rejected"
_TMP_BAD="$(mktemp /tmp/jems_test_bad.XXXXXX.txt)"
printf 'not an image' > "${_TMP_BAD}"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "photo=@${_TMP_BAD};type=text/plain" \
  "${API_URL}/api/v1/drivers/${DRIVER_ID}/photo/")"
rm -f "${_TMP_BAD}"
assert_status "driver photo rejects non-image" "400" "$(code "$resp")"

step "Drivers: photo delete"
resp="$(delete "/api/v1/drivers/${DRIVER_ID}/photo/")"
assert_status "driver photo delete" "200" "$(code "$resp")" "$(body "$resp")"

step "Drivers: last-vehicle endpoint (driver with no loads → nulls + empty lists)"
resp="$(get "/api/v1/drivers/${DRIVER_ID}/last-vehicle/")"
assert_status "driver last-vehicle" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "last-vehicle has last_truck_id" "$(body "$resp")" "last_truck_id"
assert_contains "last-vehicle has last_trailer_id" "$(body "$resp")" "last_trailer_id"
assert_contains "last-vehicle has trucks list" "$(body "$resp")" '"trucks"'
assert_contains "last-vehicle has trailers list" "$(body "$resp")" '"trailers"'

step "Drivers: last-vehicle returns null IDs when no matching load exists"
if ! echo "$(body "$resp")" | grep -qF '"last_truck_id":null'; then
  fail "last-vehicle last_truck_id should be null for new driver with no loads" "$(body "$resp")"
fi
pass "last_truck_id is null (no prior loads)"

# ── Carriers ──────────────────────────────────────────────────────────────────
step "Carriers: create"
resp="$(post "/api/v1/carriers/" "{\"mc\":\"MC123456\",\"dot_number\":\"DOT654321\",\"name\":\"Jobee Express LLC\",\"dba_name\":\"Jobee\",\"email\":\"ops@jobee.com\",\"active\":true,\"state\":${STATE_ID}}")"
assert_status "carrier create" "201" "$(code "$resp")" "$(body "$resp")"
CARRIER_ID="$(body "$resp" | json_get_num id)"

step "Carriers: retrieve"
resp="$(get "/api/v1/carriers/${CARRIER_ID}/")"
assert_status "carrier retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "carrier name" "$(body "$resp")" "Jobee Express"

step "Carriers: update"
resp="$(put "/api/v1/carriers/${CARRIER_ID}/" '{"name":"Jobee Express LLC (updated)"}')"
assert_status "carrier update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "carrier updated" "$(body "$resp")" "updated"

step "Carriers: search by name"
resp="$(get "/api/v1/carriers/search/?q=Jobee")"
assert_status "carrier search" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "carrier found" "$(body "$resp")" "Jobee"

step "Carriers: search empty query returns empty"
resp="$(get "/api/v1/carriers/search/")"
assert_status "carrier search empty" "200" "$(code "$resp")"

step "Carriers: options list"
resp="$(get "/api/v1/carriers/options/")"
assert_status "carrier options" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "carrier in options" "$(body "$resp")" "label"

step "Carriers: toggle status (deactivate)"
resp="$(post "/api/v1/carriers/${CARRIER_ID}/toggle-status/" '{}')"
assert_status "carrier toggle off" "200" "$(code "$resp")" "$(body "$resp")"

step "Carriers: toggle status (reactivate)"
resp="$(post "/api/v1/carriers/${CARRIER_ID}/toggle-status/" '{}')"
assert_status "carrier toggle on" "200" "$(code "$resp")" "$(body "$resp")"

step "Carriers: factor create"
resp="$(post "/api/v1/carriers/factors/" '{"value":"1000.00","percent":"2.50"}')"
assert_status "factor create" "201" "$(code "$resp")" "$(body "$resp")"
FACTOR_ID="$(body "$resp" | json_get_num id)"

step "Carriers: factor duplicate rejected"
resp="$(post "/api/v1/carriers/factors/" '{"value":"1000.00","percent":"3.00"}')"
assert_status "factor duplicate" "400" "$(code "$resp")"

step "Carriers: factor update"
resp="$(patch "/api/v1/carriers/factors/${FACTOR_ID}/" '{"percent":"2.25"}')"
assert_status "factor update" "200" "$(code "$resp")" "$(body "$resp")"

step "Carriers: factor list"
resp="$(get "/api/v1/carriers/factors/")"
assert_status "factor list" "200" "$(code "$resp")" "$(body "$resp")"

step "Carriers: factor delete"
resp="$(delete "/api/v1/carriers/factors/${FACTOR_ID}/")"
assert_status "factor delete" "204" "$(code "$resp")"

step "Carriers: factor deleted → 404"
resp="$(delete "/api/v1/carriers/factors/${FACTOR_ID}/")"
assert_status "factor gone" "404" "$(code "$resp")"

# ── Brokers ───────────────────────────────────────────────────────────────────
step "Brokers: create"
resp="$(post "/api/v1/brokers/" '{"name":"Echo Global Logistics","mc":"MC999888","email":"echo@broker.com","phone":"8005551234","status":1}')"
assert_status "broker create" "201" "$(code "$resp")" "$(body "$resp")"
BROKER_ID="$(body "$resp" | json_get_num id)"

step "Brokers: retrieve (includes new fields)"
resp="$(get "/api/v1/brokers/${BROKER_ID}/")"
assert_status "broker retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "broker name" "$(body "$resp")" "Echo"
assert_contains "broker has physical_address" "$(body "$resp")" "physical_address"
assert_contains "broker has usdot_number" "$(body "$resp")" "usdot_number"
assert_contains "broker has safer_operating_status" "$(body "$resp")" "safer_operating_status"

step "Brokers: PATCH new fields"
resp="$(patch "/api/v1/brokers/${BROKER_ID}/" '{"name":"Echo Global Logistics (updated)","usdot_number":"1234567","physical_address":"123 Main St"}')"
assert_status "broker patch" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "broker updated" "$(body "$resp")" "updated"
assert_contains "broker usdot_number" "$(body "$resp")" "1234567"

step "Brokers: search by name"
resp="$(get "/api/v1/brokers/search/?q=Echo")"
assert_status "broker search" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "broker found" "$(body "$resp")" "Echo"

step "Brokers: search empty query returns empty"
resp="$(get "/api/v1/brokers/search/")"
assert_status "broker search empty" "200" "$(code "$resp")"

step "Brokers: status-search by name"
resp="$(get "/api/v1/brokers/status-search/?q=Echo")"
assert_status "broker status-search" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "broker name in status-search" "$(body "$resp")" "Echo"
assert_contains "status-search has debtor_buy_status" "$(body "$resp")" "debtor_buy_status"
assert_contains "status-search has safer_operating_status" "$(body "$resp")" "safer_operating_status"
assert_contains "status-search has last_load key" "$(body "$resp")" "last_load"

step "Brokers: status-search by MC"
resp="$(get "/api/v1/brokers/status-search/?q=MC999888")"
assert_status "broker status-search by mc" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "broker mc in status-search" "$(body "$resp")" "MC999888"

step "Brokers: status-search without q returns 400"
resp="$(get "/api/v1/brokers/status-search/")"
assert_status "broker status-search no-q" "400" "$(code "$resp")"

step "Brokers: options list"
resp="$(get "/api/v1/brokers/options/")"
assert_status "broker options" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "broker in options" "$(body "$resp")" "label"

step "Brokers: toggle status (deactivate)"
resp="$(post "/api/v1/brokers/${BROKER_ID}/toggle-status/" '{}')"
assert_status "broker toggle off" "200" "$(code "$resp")" "$(body "$resp")"

step "Brokers: toggle status (reactivate)"
resp="$(post "/api/v1/brokers/${BROKER_ID}/toggle-status/" '{}')"
assert_status "broker toggle on" "200" "$(code "$resp")" "$(body "$resp")"

step "Brokers: contact create"
resp="$(post "/api/v1/brokers/${BROKER_ID}/contacts/" '{"name":"Alice Johnson","email":"alice@echo.com","phone":"8005550001"}')"
assert_status "broker contact create" "201" "$(code "$resp")" "$(body "$resp")"
BROKER_CONTACT_ID="$(body "$resp" | json_get_num id)"

step "Brokers: contact list"
resp="$(get "/api/v1/brokers/${BROKER_ID}/contacts/")"
assert_status "broker contact list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "contact listed" "$(body "$resp")" "Alice"

step "Brokers: contact retrieve"
resp="$(get "/api/v1/brokers/${BROKER_ID}/contacts/${BROKER_CONTACT_ID}/")"
assert_status "broker contact retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "contact name" "$(body "$resp")" "Alice"

step "Brokers: contact PATCH (name + confirmed flag)"
resp="$(patch "/api/v1/brokers/${BROKER_ID}/contacts/${BROKER_CONTACT_ID}/" '{"name":"Alice Smith","confirmed":true}')"
assert_status "broker contact update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "contact updated" "$(body "$resp")" "Alice Smith"
assert_contains "contact confirmed" "$(body "$resp")" "true"

step "Brokers: contact delete"
resp="$(delete "/api/v1/brokers/${BROKER_ID}/contacts/${BROKER_CONTACT_ID}/")"
assert_status "broker contact delete" "204" "$(code "$resp")"

step "Brokers: contact deleted → 404"
resp="$(get "/api/v1/brokers/${BROKER_ID}/contacts/${BROKER_CONTACT_ID}/")"
assert_status "contact gone" "404" "$(code "$resp")"

step "Brokers: setup packet file upload"
_TMP_PACKET="$(mktemp /tmp/jems_broker_packet.XXXXXX.pdf)"
printf '%%PDF-1.4 fake' > "${_TMP_PACKET}"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@${_TMP_PACKET};type=application/pdf" \
  "${API_URL}/api/v1/brokers/${BROKER_ID}/files/setup-packet/")"
assert_status "broker setup-packet upload" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "broker has setup_packet_file" "$(body "$resp")" "/media/brokers/"
rm -f "${_TMP_PACKET}"

step "Brokers: unknown file slot → 400"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "file=@/dev/null;type=application/pdf" \
  "${API_URL}/api/v1/brokers/${BROKER_ID}/files/does-not-exist/")"
assert_status "broker bad slot" "400" "$(code "$resp")"

step "Brokers: clear setup packet"
resp="$(delete "/api/v1/brokers/${BROKER_ID}/files/setup-packet/")"
assert_status "broker clear packet" "200" "$(code "$resp")"

# get dispatcher user id for load assignment
resp="$(get "/api/v1/users/")"
DISPATCHER_USER_ID="$(body "$resp" | grep -o '"id":[0-9]*,"username":"dispatcher1"' | grep -o '[0-9]*' | head -1)"
if [[ -z "${DISPATCHER_USER_ID}" ]]; then
  # fallback: use admin id
  resp2="$(get "/api/v1/users/me/")"
  DISPATCHER_USER_ID="$(body "$resp2" | json_get_num id)"
fi

# ── Business (Shippers / Receivers) ───────────────────────────────────────────
step "Business: create shipper"
resp="$(post "/api/v1/brokers/business/" '{"name":"Acme Warehouse"}')"
assert_status "business create shipper" "201" "$(code "$resp")" "$(body "$resp")"
SHIPPER_ID="$(body "$resp" | json_get_num id)"
assert_contains "shipper name" "$(body "$resp")" "Acme Warehouse"

step "Business: create receiver"
resp="$(post "/api/v1/brokers/business/" '{"name":"Beta Distribution Center"}')"
assert_status "business create receiver" "201" "$(code "$resp")" "$(body "$resp")"
RECEIVER_ID="$(body "$resp" | json_get_num id)"

step "Business: retrieve"
resp="$(get "/api/v1/brokers/business/${SHIPPER_ID}/")"
assert_status "business retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "business name" "$(body "$resp")" "Acme Warehouse"

step "Business: update"
resp="$(put "/api/v1/brokers/business/${SHIPPER_ID}/" '{"name":"Acme Warehouse LLC"}')"
assert_status "business update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "business updated" "$(body "$resp")" "LLC"

step "Business: search by name"
resp="$(get "/api/v1/brokers/business/search/?q=Acme")"
assert_status "business search" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "business found" "$(body "$resp")" "Acme"
assert_contains "business has city_display" "$(body "$resp")" "city_display"

step "Business: search empty query returns empty"
resp="$(get "/api/v1/brokers/business/search/")"
assert_status "business search empty" "200" "$(code "$resp")"

step "Business: name required on create"
resp="$(post "/api/v1/brokers/business/" '{}')"
assert_status "business no name" "400" "$(code "$resp")"

# ── Loads ─────────────────────────────────────────────────────────────────────
step "Loads: broker contact fixture"
resp="$(post "/api/v1/brokers/${BROKER_ID}/contacts/" '{"name":"Load Broker Contact","email":"load-contact@echo.com","phone":"8005550002"}')"
assert_status "load broker contact create" "201" "$(code "$resp")" "$(body "$resp")"
LOAD_BROKER_CONTACT_ID="$(body "$resp" | json_get_num id)"

step "Loads: create"
resp="$(post "/api/v1/loads/" "{\"number\":\"L-0001\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"123 Warehouse Rd\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"456 Dock St\",\"payment\":\"2500.00\",\"miles\":800,\"miles_empty\":50,\"broker\":${BROKER_ID},\"broker_contacts\":\"${LOAD_BROKER_CONTACT_ID}\",\"dispatcher\":${DISPATCHER_USER_ID},\"truck\":${TRUCK_ID},\"trailer\":${TRAILER_ID},\"driver\":${DRIVER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID},\"status\":1}")"
assert_status "load create" "201" "$(code "$resp")" "$(body "$resp")"
LOAD_ID="$(body "$resp" | json_get_num id)"
LOAD_NUMBER="$(body "$resp" | json_get_num number)"

step "Loads: create without shipper rejected"
resp="$(post "/api/v1/loads/" "{\"number\":\"L-NOSHP\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"payment\":\"1000.00\",\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"receiver\":${RECEIVER_ID}}")"
assert_status "load no shipper" "400" "$(code "$resp")"

step "Loads: create without receiver rejected"
resp="$(post "/api/v1/loads/" "{\"number\":\"L-NORCV\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"payment\":\"1000.00\",\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID}}")"
assert_status "load no receiver" "400" "$(code "$resp")"

step "Loads: retrieve"
resp="$(get "/api/v1/loads/${LOAD_ID}/")"
assert_status "load retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "load number" "$(body "$resp")" "${LOAD_NUMBER}"

step "Loads: broker contacts modal data"
resp="$(get "/api/v1/loads/${LOAD_ID}/broker-contacts/")"
assert_status "load broker contacts" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "load broker contacts includes broker" "$(body "$resp")" '"broker"'
assert_contains "load broker contacts includes selected contact" "$(body "$resp")" "Load Broker Contact"

step "Loads: list"
resp="$(get "/api/v1/loads/")"
assert_status "load list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "load list has count" "$(body "$resp")" '"count"'
assert_contains "load list has results" "$(body "$resp")" '"results"'
assert_contains "load list includes created load" "$(body "$resp")" "${LOAD_ID}"
assert_contains "load list has driver_rtl_event_code field" "$(body "$resp")" '"driver_rtl_event_code"'
assert_contains "load list has driver_rtl_id field" "$(body "$resp")" '"driver_rtl_id"'
assert_contains "load list has driver_rtl_has_violations field" "$(body "$resp")" '"driver_rtl_has_violations"'

step "Loads: list paginated page_size"
resp="$(get "/api/v1/loads/?page=1&page_size=1")"
assert_status "load list paginated" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "load paginated count" "$(body "$resp")" '"count"'
assert_contains "load paginated results" "$(body "$resp")" '"results"'

step "Loads: list all filtered rows"
resp="$(get "/api/v1/loads/?dispatcher=${DISPATCHER_USER_ID}&all=true")"
assert_status "load list all rows" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "load all count" "$(body "$resp")" '"count"'
assert_contains "load all next null" "$(body "$resp")" '"next":null'
assert_contains "load all previous null" "$(body "$resp")" '"previous":null'
assert_contains "load all preserves dispatcher filter" "$(body "$resp")" "${LOAD_ID}"

step "Loads: load stop create"
resp="$(post "/api/v1/loads/${LOAD_ID}/stops/" "{\"stop_type\":1,\"city\":${CITY_ID},\"address\":\"789 Stop Ave\",\"from_date\":\"2024-08-01\",\"to_date\":\"2024-08-01\"}")"
assert_status "load stop create" "201" "$(code "$resp")" "$(body "$resp")"
STOP_ID="$(body "$resp" | json_get_num id)"

step "Loads: load stop list"
resp="$(get "/api/v1/loads/${LOAD_ID}/stops/")"
assert_status "load stop list" "200" "$(code "$resp")" "$(body "$resp")"

step "Loads: stop retrieve"
resp="$(get "/api/v1/loads/${LOAD_ID}/stops/${STOP_ID}/")"
assert_status "stop retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "stop address" "$(body "$resp")" "Stop Ave"

step "Loads: stop update"
resp="$(put "/api/v1/loads/${LOAD_ID}/stops/${STOP_ID}/" '{"address":"789 Stop Ave (updated)"}')"
assert_status "stop update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "stop updated" "$(body "$resp")" "updated"

step "Loads: load stop delete"
resp="$(delete "/api/v1/loads/${LOAD_ID}/stops/${STOP_ID}/")"
assert_status "load stop delete" "204" "$(code "$resp")"

step "Loads: load stop deleted → 404"
resp="$(get "/api/v1/loads/${LOAD_ID}/stops/${STOP_ID}/")"
assert_status "load stop gone" "404" "$(code "$resp")"

step "Loads: city search"
resp="$(get "/api/v1/loads/cities/search/?q=Hous")"
assert_status "city search" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "city found" "$(body "$resp")" "Houston"

step "Loads: city search empty query returns empty"
resp="$(get "/api/v1/loads/cities/search/")"
assert_status "city search empty" "200" "$(code "$resp")"

step "Loads: assign (reassign truck/trailer/driver)"
resp="$(post "/api/v1/loads/${LOAD_ID}/assign/" "{\"truck\":${TRUCK_ID},\"trailer\":${TRAILER_ID},\"driver\":${DRIVER_ID}}")"
assert_status "load assign" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "load assigned truck" "$(body "$resp")" "${TRUCK_ID}"
assert_contains "load assign must not auto-execute" "$(body "$resp")" '"execute":false'

step "Loads: assign with drop trailer fields"
resp="$(post "/api/v1/loads/${LOAD_ID}/assign/" "{\"truck\":${TRUCK_ID},\"trailer\":${TRAILER_ID},\"driver\":${DRIVER_ID},\"is_drop\":1,\"drop_place\":${TRAILER_ID},\"drop_trailer\":150.0,\"days_in_drop\":3}")"
assert_status "load assign drop" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "load assign is_drop set" "$(body "$resp")" '"is_drop":true'
assert_contains "load assign days_in_drop" "$(body "$resp")" '"days_in_drop":3'

step "Loads: assign with invalid truck ID returns 400"
resp="$(post "/api/v1/loads/${LOAD_ID}/assign/" '{"truck":999999}')"
assert_status "load assign invalid truck" "400" "$(code "$resp")" "$(body "$resp")"

step "Loads: set-rating (shipper and receiver)"
resp="$(post "/api/v1/loads/${LOAD_ID}/set-rating/" '{"shipper_rating":8,"receiver_rating":6}')"
assert_status "load set-rating" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "load shipper_rating saved" "$(body "$resp")" '"shipper_rating":8'
assert_contains "load receiver_rating saved" "$(body "$resp")" '"receiver_rating":6'

step "Loads: set-rating out-of-range returns 400"
resp="$(post "/api/v1/loads/${LOAD_ID}/set-rating/" '{"shipper_rating":11,"receiver_rating":5}')"
assert_status "load set-rating out-of-range" "400" "$(code "$resp")" "$(body "$resp")"

step "Loads: set-status (advance to STARTED)"
resp="$(post "/api/v1/loads/${LOAD_ID}/set-status/" '{"status":2}')"
assert_status "load set status" "200" "$(code "$resp")" "$(body "$resp")"

step "Loads: set-status legacy dropdown allows FINISHED to DETENTION"
resp="$(post "/api/v1/loads/${LOAD_ID}/set-status/" '{"status":3}')"
assert_status "load set status finished" "200" "$(code "$resp")" "$(body "$resp")"
resp="$(post "/api/v1/loads/${LOAD_ID}/set-status/" '{"status":4}')"
assert_status "load set status detention" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "load status detention" "$(body "$resp")" '"status":4'

step "Loads: set-invoiced (toggle invoiced flag)"
resp="$(post "/api/v1/loads/${LOAD_ID}/set-invoiced/" '{}')"
assert_status "load set invoiced" "200" "$(code "$resp")" "$(body "$resp")"

step "Loads: set-paid (toggle paid flag)"
resp="$(post "/api/v1/loads/${LOAD_ID}/set-paid/" '{}')"
assert_status "load set paid" "200" "$(code "$resp")" "$(body "$resp")"

step "Loads: set-history (toggle history flag)"
resp="$(post "/api/v1/loads/${LOAD_ID}/set-history/" '{}')"
assert_status "load set history" "200" "$(code "$resp")" "$(body "$resp")"

step "Loads: update (mark executed)"
resp="$(patch "/api/v1/loads/${LOAD_ID}/" '{"execute":true}')"
assert_status "load mark executed" "200" "$(code "$resp")" "$(body "$resp")"

step "Loads: history search mirrors legacy executed search"
resp="$(get "/api/v1/loads/?history_search=true&all=true")"
assert_status "history search empty" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "history search empty results" "$(body "$resp")" '"results":[]'

resp="$(get "/api/v1/loads/?history_search=true&all=true&date_type=3&number=L-0001")"
assert_status "history search filtered" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "history search includes executed load" "$(body "$resp")" "L-0001"

step "Loads: invoicing/payments list filters use legacy executed queue"
resp="$(patch "/api/v1/loads/${LOAD_ID}/" '{"history":false}')"
assert_status "load restore from history" "200" "$(code "$resp")" "$(body "$resp")"
resp="$(get "/api/v1/loads/?execute=true&history=false&all=true&date_type=3&broker=${BROKER_ID}&driver=${DRIVER_ID}&number=L-0001")"
assert_status "executed queue high-use filters" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "executed queue filter includes load" "$(body "$resp")" "L-0001"

step "Loads: payroll list shows executed, unhistoried, driver-unpaid loads only"
resp="$(post "/api/v1/loads/" "{\"number\":\"PAYROLL-IN\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 Main St\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 Oak Ave\",\"payment\":\"500.00\",\"miles\":50,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID},\"status\":3}")"
assert_status "payroll visible load create" "201" "$(code "$resp")" "$(body "$resp")"
PAYROLL_IN_ID="$(body "$resp" | json_get_num id)"
resp="$(patch "/api/v1/loads/${PAYROLL_IN_ID}/" '{"execute":true,"history":false,"drivers_paid":false}')"
assert_status "payroll visible load mark" "200" "$(code "$resp")" "$(body "$resp")"

resp="$(post "/api/v1/loads/" "{\"number\":\"PAYROLL-PAID\",\"pickup_date\":\"2024-08-03\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 Main St\",\"dropoff_date\":\"2024-08-04\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 Oak Ave\",\"payment\":\"500.00\",\"miles\":50,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID},\"status\":3}")"
assert_status "payroll paid load create" "201" "$(code "$resp")" "$(body "$resp")"
PAYROLL_PAID_ID="$(body "$resp" | json_get_num id)"
resp="$(patch "/api/v1/loads/${PAYROLL_PAID_ID}/" '{"execute":true,"history":false,"drivers_paid":true}')"
assert_status "payroll paid load mark" "200" "$(code "$resp")" "$(body "$resp")"

resp="$(get "/api/v1/loads/?payroll=true&all=true&number=PAYROLL")"
assert_status "payroll list filter" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "payroll includes driver-unpaid load" "$(body "$resp")" "PAYROLL-IN"
assert_not_contains "payroll excludes driver-paid load" "$(body "$resp")" "PAYROLL-PAID"

step "Loads: 404 on missing load"
resp="$(get "/api/v1/loads/99999/")"
assert_status "load 404" "404" "$(code "$resp")"

step "Loads: send-driver-info missing fields → 400"
resp="$(post "/api/v1/loads/send-driver-info/" '{"carrier_id":1}')"
assert_status "send-driver-info missing fields" "400" "$(code "$resp")" "$(body "$resp")"
assert_contains "send-driver-info error detail" "$(body "$resp")" "Missing fields"

# ── index_view filter (legacy main-index parity) ─────────────────────────────
step "Loads: index_view=true hides cancelled loads"
resp="$(post "/api/v1/loads/" "{\"number\":\"IDX-CANCEL\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 Main St\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 Oak Ave\",\"payment\":\"500.00\",\"miles\":50,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID},\"status\":5}")"
assert_status "index cancel create" "201" "$(code "$resp")" "$(body "$resp")"
IDX_CANCEL_ID="$(body "$resp" | json_get_num id)"

resp="$(get "/api/v1/loads/?index_view=true&all=true")"
assert_status "index_view list" "200" "$(code "$resp")" "$(body "$resp")"
# Cancelled load must NOT appear in the index view
if body "$resp" | grep -q "IDX-CANCEL"; then
  fail "index_view=true should hide cancelled loads" "$(body "$resp")"
else
  pass "index_view=true hides cancelled loads (IDX-CANCEL absent)"
fi

resp="$(get "/api/v1/loads/?all=true&number=IDX-CANCEL")"
assert_status "index_view cancel visible without filter" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "cancelled load exists without filter" "$(body "$resp")" "IDX-CANCEL"

resp="$(delete "/api/v1/loads/${IDX_CANCEL_ID}/")"
assert_status "index cancel cleanup" "204" "$(code "$resp")"

step "Loads: index_view=true hides executed non-detention loads"
resp="$(post "/api/v1/loads/" "{\"number\":\"IDX-EXEC\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 Main St\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 Oak Ave\",\"payment\":\"500.00\",\"miles\":50,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID},\"status\":3}")"
assert_status "index exec create" "201" "$(code "$resp")" "$(body "$resp")"
IDX_EXEC_ID="$(body "$resp" | json_get_num id)"

resp="$(patch "/api/v1/loads/${IDX_EXEC_ID}/" '{"execute":true}')"
assert_status "index exec mark executed" "200" "$(code "$resp")" "$(body "$resp")"

resp="$(get "/api/v1/loads/?index_view=true&all=true&number=IDX-EXEC")"
assert_status "index exec filter" "200" "$(code "$resp")" "$(body "$resp")"
if body "$resp" | grep -q "IDX-EXEC"; then
  fail "index_view=true should hide executed non-detention loads" "$(body "$resp")"
else
  pass "index_view=true hides executed non-detention loads (IDX-EXEC absent)"
fi

resp="$(delete "/api/v1/loads/${IDX_EXEC_ID}/")"
assert_status "index exec cleanup" "204" "$(code "$resp")"

step "Loads: index_view=true shows executed detention (status=4) loads"
resp="$(post "/api/v1/loads/" "{\"number\":\"IDX-DET\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 Main St\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 Oak Ave\",\"payment\":\"500.00\",\"miles\":50,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID},\"status\":4}")"
assert_status "index det create" "201" "$(code "$resp")" "$(body "$resp")"
IDX_DET_ID="$(body "$resp" | json_get_num id)"

resp="$(patch "/api/v1/loads/${IDX_DET_ID}/" '{"execute":true}')"
assert_status "index det mark executed" "200" "$(code "$resp")" "$(body "$resp")"

resp="$(get "/api/v1/loads/?index_view=true&all=true&number=IDX-DET")"
assert_status "index det filter" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "index_view=true shows executed detention load" "$(body "$resp")" "IDX-DET"

resp="$(delete "/api/v1/loads/${IDX_DET_ID}/")"
assert_status "index det cleanup" "204" "$(code "$resp")"

# ── Bulk invoiced / paid ───────────────────────────────────────────────────────
step "Loads: bulk-invoiced marks loads as invoiced"
resp="$(post "/api/v1/loads/" "{\"number\":\"BULK-INV-A\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 Main St\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 Oak Ave\",\"payment\":\"500.00\",\"miles\":50,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID}}")"
assert_status "bulk-inv load A create" "201" "$(code "$resp")" "$(body "$resp")"
BULK_INV_A="$(body "$resp" | json_get_num id)"

resp="$(post "/api/v1/loads/" "{\"number\":\"BULK-INV-B\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 Main St\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 Oak Ave\",\"payment\":\"500.00\",\"miles\":50,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID}}")"
assert_status "bulk-inv load B create" "201" "$(code "$resp")" "$(body "$resp")"
BULK_INV_B="$(body "$resp" | json_get_num id)"

resp="$(post "/api/v1/loads/bulk-invoiced/" "{\"ids\":[${BULK_INV_A},${BULK_INV_B}]}")"
assert_status "bulk-invoiced" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "bulk-invoiced updated=2" "$(body "$resp")" '"updated":2'

resp="$(get "/api/v1/loads/${BULK_INV_A}/")"
assert_contains "load A is invoiced" "$(body "$resp")" '"invoiced":true'
resp="$(get "/api/v1/loads/${BULK_INV_B}/")"
assert_contains "load B is invoiced" "$(body "$resp")" '"invoiced":true'

resp="$(delete "/api/v1/loads/${BULK_INV_A}/")"
assert_status "bulk-inv A cleanup" "204" "$(code "$resp")"
resp="$(delete "/api/v1/loads/${BULK_INV_B}/")"
assert_status "bulk-inv B cleanup" "204" "$(code "$resp")"

step "Loads: bulk-paid marks loads as paid"
resp="$(post "/api/v1/loads/" "{\"number\":\"BULK-PAID-A\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 Main St\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 Oak Ave\",\"payment\":\"500.00\",\"miles\":50,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID}}")"
assert_status "bulk-paid load A create" "201" "$(code "$resp")" "$(body "$resp")"
BULK_PAID_A="$(body "$resp" | json_get_num id)"

resp="$(post "/api/v1/loads/" "{\"number\":\"BULK-PAID-B\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 Main St\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 Oak Ave\",\"payment\":\"500.00\",\"miles\":50,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID}}")"
assert_status "bulk-paid load B create" "201" "$(code "$resp")" "$(body "$resp")"
BULK_PAID_B="$(body "$resp" | json_get_num id)"

resp="$(post "/api/v1/loads/bulk-paid/" "{\"ids\":[${BULK_PAID_A},${BULK_PAID_B}]}")"
assert_status "bulk-paid" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "bulk-paid updated=2" "$(body "$resp")" '"updated":2'

resp="$(get "/api/v1/loads/${BULK_PAID_A}/")"
assert_contains "load A is paid" "$(body "$resp")" '"paid":true'
resp="$(get "/api/v1/loads/${BULK_PAID_B}/")"
assert_contains "load B is paid" "$(body "$resp")" '"paid":true'

resp="$(delete "/api/v1/loads/${BULK_PAID_A}/")"
assert_status "bulk-paid A cleanup" "204" "$(code "$resp")"
resp="$(delete "/api/v1/loads/${BULK_PAID_B}/")"
assert_status "bulk-paid B cleanup" "204" "$(code "$resp")"

step "Loads: bulk-invoiced with empty ids returns updated=0"
resp="$(post "/api/v1/loads/bulk-invoiced/" '{"ids":[]}')"
assert_status "bulk-invoiced empty" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "bulk-invoiced empty updated=0" "$(body "$resp")" '"updated":0'

step "Loads: bulk-paid with empty ids returns updated=0"
resp="$(post "/api/v1/loads/bulk-paid/" '{"ids":[]}')"
assert_status "bulk-paid empty" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "bulk-paid empty updated=0" "$(body "$resp")" '"updated":0'

step "Loads: bulk-invoiced with non-list ids returns 400"
resp="$(post "/api/v1/loads/bulk-invoiced/" '{"ids":"1,2"}')"
assert_status "bulk-invoiced non-list" "400" "$(code "$resp")" "$(body "$resp")"

step "Loads: bulk-paid with non-list ids returns 400"
resp="$(post "/api/v1/loads/bulk-paid/" '{"ids":"1,2"}')"
assert_status "bulk-paid non-list" "400" "$(code "$resp")" "$(body "$resp")"

# ── Accounting ────────────────────────────────────────────────────────────────
step "Accounting: account create"
resp="$(post "/api/v1/accounting/accounts/" '{"code":"4010","name":"Fuel Expenses","is_active":true,"is_main":false,"is_assistant":false,"no_tax":false}')"
assert_status "account create" "201" "$(code "$resp")" "$(body "$resp")"
ACCOUNT_ID="$(body "$resp" | json_get_num id)"

step "Accounting: account list"
resp="$(get "/api/v1/accounting/accounts/")"
assert_status "account list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "account listed" "$(body "$resp")" "Fuel Expenses"

step "Accounting: account retrieve"
resp="$(get "/api/v1/accounting/accounts/${ACCOUNT_ID}/")"
assert_status "account retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "account code" "$(body "$resp")" "4010"

step "Accounting: account update"
resp="$(patch "/api/v1/accounting/accounts/${ACCOUNT_ID}/" '{"name":"Fuel & Oil Expenses"}')"
assert_status "account update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "account updated" "$(body "$resp")" "Fuel & Oil"

step "Accounting: category type create"
resp="$(post "/api/v1/accounting/category-types/" '{"name":"Documents","unit_of_measure":"days","is_active":true}')"
assert_status "category type create" "201" "$(code "$resp")" "$(body "$resp")"
CAT_TYPE_ID="$(body "$resp" | json_get_num id)"

step "Accounting: category create"
resp="$(post "/api/v1/accounting/categories/" "{\"code\":\"MED\",\"name\":\"Medical Card\",\"category_type\":${CAT_TYPE_ID},\"is_active\":true}")"
assert_status "category create" "201" "$(code "$resp")" "$(body "$resp")"
CAT_ID="$(body "$resp" | json_get_num id)"

step "Accounting: category retrieve"
resp="$(get "/api/v1/accounting/categories/${CAT_ID}/")"
assert_status "category retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "category code" "$(body "$resp")" "MED"

step "Accounting: category update"
resp="$(patch "/api/v1/accounting/categories/${CAT_ID}/" '{"name":"Medical Certificate"}')"
assert_status "category update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "category updated" "$(body "$resp")" "Medical Certificate"

step "Accounting: record create"
set +e
resp="$(post "/api/v1/accounting/records/" "{\"date\":\"2024-08-01\",\"account\":${ACCOUNT_ID},\"amount\":\"-350.00\",\"detail\":\"Diesel fill-up Houston\",\"record_type\":2,\"load\":${LOAD_ID},\"truck\":${TRUCK_ID},\"driver\":${DRIVER_ID},\"carrier\":${CARRIER_ID}}")"
curl_status=$?
set -e
if [[ "${curl_status}" -ne 0 ]]; then
  fail "record create request failed (curl exit ${curl_status})" "${resp}"
fi
assert_status "record create" "201" "$(code "$resp")" "$(body "$resp")"
RECORD_ID="$(body "$resp" | json_get_num id)"

step "Accounting: record retrieve (assert carrier field present)"
resp="$(get "/api/v1/accounting/records/${RECORD_ID}/")"
assert_status "record retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "record detail" "$(body "$resp")" "Houston"
assert_contains "record has carrier field" "$(body "$resp")" '"carrier"'

step "Accounting: record update (PATCH)"
resp="$(patch "/api/v1/accounting/records/${RECORD_ID}/" "{\"amount\":\"-400.00\",\"detail\":\"Updated Diesel fill-up\"}")"
assert_status "record update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "record updated" "$(body "$resp")" "Updated Diesel"

step "Accounting: record list"
resp="$(get "/api/v1/accounting/records/")"
assert_status "record list" "200" "$(code "$resp")" "$(body "$resp")"

step "Accounting: record delete"
resp="$(delete "/api/v1/accounting/records/${RECORD_ID}/")"
assert_status "record delete" "204" "$(code "$resp")"

step "Accounting: record deleted → 404"
resp="$(get "/api/v1/accounting/records/${RECORD_ID}/")"
assert_status "record gone" "404" "$(code "$resp")"

step "Accounting: driver invoice create"
resp="$(post "/api/v1/accounting/driver-invoices/" "{\"driver\":${DRIVER_ID},\"date\":\"2024-08-05\",\"invoice_type\":1,\"percent\":\"25.00\",\"miles_empty\":50,\"miles_full\":800}")"
assert_status "driver invoice create" "201" "$(code "$resp")" "$(body "$resp")"
DI_ID="$(body "$resp" | json_get_num id)"

step "Accounting: driver invoice retrieve"
resp="$(get "/api/v1/accounting/driver-invoices/${DI_ID}/")"
assert_status "driver invoice retrieve" "200" "$(code "$resp")" "$(body "$resp")"

step "Accounting: driver invoice update"
resp="$(put "/api/v1/accounting/driver-invoices/${DI_ID}/" "{\"driver\":${DRIVER_ID},\"date\":\"2024-08-06\",\"invoice_type\":1,\"percent\":\"30.00\",\"miles_empty\":50,\"miles_full\":800}")"
assert_status "driver invoice update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "driver invoice updated" "$(body "$resp")" '"percent":30'

step "Accounting: driver invoice close"
resp="$(post "/api/v1/accounting/driver-invoices/${DI_ID}/close/" '{}')"
assert_status "driver invoice close" "200" "$(code "$resp")" "$(body "$resp")"

step "Accounting: driver invoice close again (already closed → 400)"
resp="$(post "/api/v1/accounting/driver-invoices/${DI_ID}/close/" '{}')"
assert_status "driver invoice double-close" "400" "$(code "$resp")"

step "Accounting: driver invoice open"
resp="$(post "/api/v1/accounting/driver-invoices/${DI_ID}/open/" '{}')"
assert_status "driver invoice open" "200" "$(code "$resp")" "$(body "$resp")"

step "Accounting: driver invoice delete"
resp="$(delete "/api/v1/accounting/driver-invoices/${DI_ID}/")"
assert_status "driver invoice delete" "204" "$(code "$resp")"

step "Accounting: driver invoice deleted → 404"
resp="$(get "/api/v1/accounting/driver-invoices/${DI_ID}/")"
assert_status "driver invoice gone" "404" "$(code "$resp")"

step "Accounting: owner invoice create"
resp="$(post "/api/v1/accounting/owner-invoices/" "{\"owner\":${TRUCK_OWNER_ID},\"date\":\"2024-08-05\",\"percent\":\"70.00\"}")"
assert_status "owner invoice create" "201" "$(code "$resp")" "$(body "$resp")"
OI_ID="$(body "$resp" | json_get_num id)"

step "Accounting: owner invoice retrieve"
resp="$(get "/api/v1/accounting/owner-invoices/${OI_ID}/")"
assert_status "owner invoice retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "owner invoice owner" "$(body "$resp")" "${TRUCK_OWNER_ID}"

step "Accounting: owner invoice update"
resp="$(put "/api/v1/accounting/owner-invoices/${OI_ID}/" "{\"owner\":${TRUCK_OWNER_ID},\"date\":\"2024-08-06\",\"percent\":\"75.00\"}")"
assert_status "owner invoice update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "owner invoice updated" "$(body "$resp")" '"percent":75'

step "Accounting: owner invoice close"
resp="$(post "/api/v1/accounting/owner-invoices/${OI_ID}/close/" '{}')"
assert_status "owner invoice close" "200" "$(code "$resp")" "$(body "$resp")"

step "Accounting: owner invoice open"
resp="$(post "/api/v1/accounting/owner-invoices/${OI_ID}/open/" '{}')"
assert_status "owner invoice open" "200" "$(code "$resp")" "$(body "$resp")"

step "Accounting: owner invoice delete"
resp="$(delete "/api/v1/accounting/owner-invoices/${OI_ID}/")"
assert_status "owner invoice delete" "204" "$(code "$resp")"

step "Accounting: owner invoice deleted → 404"
resp="$(get "/api/v1/accounting/owner-invoices/${OI_ID}/")"
assert_status "owner invoice gone" "404" "$(code "$resp")"

step "Accounting: card gain create"
resp="$(post "/api/v1/accounting/card-gains/" "{\"card\":${CARD_ID},\"date\":\"2024-08-01\",\"gain\":125.50}")"
assert_status "card gain create" "201" "$(code "$resp")" "$(body "$resp")"
CARD_GAIN_ID="$(body "$resp" | json_get_num id)"

step "Accounting: card gain list filtered by card"
resp="$(get "/api/v1/accounting/card-gains/?card=${CARD_ID}")"
assert_status "card gain filter" "200" "$(code "$resp")" "$(body "$resp")"

step "Accounting: card gain delete"
resp="$(delete "/api/v1/accounting/card-gains/${CARD_GAIN_ID}/")"
assert_status "card gain delete" "204" "$(code "$resp")"

step "Accounting: card gain deleted → 404"
resp="$(get "/api/v1/accounting/card-gains/${CARD_GAIN_ID}/")"
assert_status "card gain gone" "404" "$(code "$resp")"

step "Loads: delete"
resp="$(delete "/api/v1/loads/${LOAD_ID}/")"
assert_status "load delete" "204" "$(code "$resp")"

step "Loads: deleted → 404"
resp="$(get "/api/v1/loads/${LOAD_ID}/")"
assert_status "load gone" "404" "$(code "$resp")"

step "Loads: bulk-delete — create two loads"
resp="$(post "/api/v1/loads/" "{\"number\":\"BULK-DEL-A\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 Main St\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 Oak Ave\",\"payment\":\"1000.00\",\"miles\":100,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID}}")"
assert_status "bulk del load A create" "201" "$(code "$resp")" "$(body "$resp")"
BULK_DEL_A="$(body "$resp" | json_get_num id)"

resp="$(post "/api/v1/loads/" "{\"number\":\"BULK-DEL-B\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 Main St\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 Oak Ave\",\"payment\":\"1000.00\",\"miles\":100,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID}}")"
assert_status "bulk del load B create" "201" "$(code "$resp")" "$(body "$resp")"
BULK_DEL_B="$(body "$resp" | json_get_num id)"

step "Loads: bulk-delete — delete both"
resp="$(post "/api/v1/loads/bulk-delete/" "{\"ids\":[${BULK_DEL_A},${BULK_DEL_B}]}")"
assert_status "load bulk delete" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "bulk delete count" "$(body "$resp")" '"deleted":2'

step "Loads: bulk-delete — verify both gone"
resp="$(get "/api/v1/loads/${BULK_DEL_A}/")"
assert_status "bulk del A gone" "404" "$(code "$resp")"
resp="$(get "/api/v1/loads/${BULK_DEL_B}/")"
assert_status "bulk del B gone" "404" "$(code "$resp")"

step "Loads: bulk-delete — empty list returns 0"
resp="$(post "/api/v1/loads/bulk-delete/" "{\"ids\":[]}")"
assert_status "bulk delete empty" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "bulk delete empty count" "$(body "$resp")" '"deleted":0'

step "Loads: bulk-delete — invalid ids type returns 400"
resp="$(post "/api/v1/loads/bulk-delete/" "{\"ids\":\"1,2\"}")"
assert_status "bulk delete invalid type" "400" "$(code "$resp")"

# ── Dispatch ──────────────────────────────────────────────────────────────────
step "Dispatch: create work session"
resp="$(post "/api/v1/dispatch/work/" "{\"start\":\"2024-08-05T08:00:00Z\",\"end\":\"2024-08-05T18:00:00Z\",\"title\":\"Monday shift\",\"dispatcher\":${DISPATCHER_USER_ID},\"session\":\"sess-001\"}")"
assert_status "dispatch work create" "201" "$(code "$resp")" "$(body "$resp")"
WORK_ID="$(body "$resp" | json_get_num id)"

step "Dispatch: work list"
resp="$(get "/api/v1/dispatch/work/")"
assert_status "dispatch work list" "200" "$(code "$resp")" "$(body "$resp")"

step "Dispatch: work retrieve"
resp="$(get "/api/v1/dispatch/work/${WORK_ID}/")"
assert_status "dispatch work retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "work title" "$(body "$resp")" "Monday shift"

step "Dispatch: finish work"
resp="$(post "/api/v1/dispatch/work/${WORK_ID}/finish/" '{}')"
assert_status "dispatch work finish" "200" "$(code "$resp")" "$(body "$resp")"

step "Dispatch: finish already-finished (→ 400)"
resp="$(post "/api/v1/dispatch/work/${WORK_ID}/finish/" '{}')"
assert_status "dispatch work double-finish" "400" "$(code "$resp")"

step "Dispatch: mark work paid"
resp="$(post "/api/v1/dispatch/work/${WORK_ID}/mark-paid/" '{}')"
assert_status "dispatch work mark-paid" "200" "$(code "$resp")" "$(body "$resp")"

step "Dispatch: update work session"
resp="$(patch "/api/v1/dispatch/work/${WORK_ID}/" '{"title":"Monday shift (updated)"}')"
assert_status "dispatch work update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "work title updated" "$(body "$resp")" "updated"

step "Dispatch: delete work session"
resp="$(delete "/api/v1/dispatch/work/${WORK_ID}/")"
assert_status "dispatch work delete" "204" "$(code "$resp")"

step "Dispatch: work session deleted → 404"
resp="$(get "/api/v1/dispatch/work/${WORK_ID}/")"
assert_status "work gone" "404" "$(code "$resp")"

step "Dispatch: invoice by percent create"
resp="$(post "/api/v1/dispatch/invoices/percent/" "{\"dispatcher\":${DISPATCHER_USER_ID},\"date\":\"2024-08-05\",\"start\":\"2024-08-01T00:00:00Z\",\"end\":\"2024-08-31T23:59:59Z\",\"percent\":\"10.00\"}")"
assert_status "dispatch invoice percent create" "201" "$(code "$resp")" "$(body "$resp")"
INV_PERCENT_ID="$(body "$resp" | json_get_num id)"

step "Dispatch: invoice by percent retrieve"
resp="$(get "/api/v1/dispatch/invoices/percent/${INV_PERCENT_ID}/")"
assert_status "dispatch percent retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "percent value" "$(body "$resp")" "10.00"

step "Dispatch: invoice by percent amount"
resp="$(get "/api/v1/dispatch/invoices/percent/${INV_PERCENT_ID}/amount/")"
assert_status "dispatch percent amount" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "amount field" "$(body "$resp")" "amount"

step "Dispatch: invoice by percent close"
resp="$(post "/api/v1/dispatch/invoices/percent/${INV_PERCENT_ID}/close/" '{}')"
assert_status "dispatch percent close" "200" "$(code "$resp")" "$(body "$resp")"

step "Dispatch: invoice by percent close again (→ 400)"
resp="$(post "/api/v1/dispatch/invoices/percent/${INV_PERCENT_ID}/close/" '{}')"
assert_status "dispatch percent double-close" "400" "$(code "$resp")"

step "Dispatch: invoice by percent open"
resp="$(post "/api/v1/dispatch/invoices/percent/${INV_PERCENT_ID}/open/" '{}')"
assert_status "dispatch percent open" "200" "$(code "$resp")" "$(body "$resp")"

step "Dispatch: update invoice by percent"
resp="$(patch "/api/v1/dispatch/invoices/percent/${INV_PERCENT_ID}/" '{"percent":"12.00"}')"
assert_status "dispatch percent update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "percent updated" "$(body "$resp")" "12.00"

step "Dispatch: invoice by hour create"
resp="$(post "/api/v1/dispatch/invoices/hour/" "{\"dispatcher\":${DISPATCHER_USER_ID},\"date\":\"2024-08-05\",\"start\":\"2024-08-01T00:00:00Z\",\"end\":\"2024-08-31T23:59:59Z\",\"pay_per_hour\":\"25.00\"}")"
assert_status "dispatch invoice hour create" "201" "$(code "$resp")" "$(body "$resp")"
INV_HOUR_ID="$(body "$resp" | json_get_num id)"

step "Dispatch: invoice by hour retrieve"
resp="$(get "/api/v1/dispatch/invoices/hour/${INV_HOUR_ID}/")"
assert_status "dispatch hour retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "pay per hour" "$(body "$resp")" "25.00"

step "Dispatch: invoice by hour amount"
resp="$(get "/api/v1/dispatch/invoices/hour/${INV_HOUR_ID}/amount/")"
assert_status "dispatch hour amount" "200" "$(code "$resp")" "$(body "$resp")"

step "Dispatch: invoice by hour close / open cycle"
resp="$(post "/api/v1/dispatch/invoices/hour/${INV_HOUR_ID}/close/" '{}')"
assert_status "dispatch hour close" "200" "$(code "$resp")" "$(body "$resp")"
resp="$(post "/api/v1/dispatch/invoices/hour/${INV_HOUR_ID}/open/" '{}')"
assert_status "dispatch hour open" "200" "$(code "$resp")" "$(body "$resp")"

step "Dispatch: update invoice by hour"
resp="$(patch "/api/v1/dispatch/invoices/hour/${INV_HOUR_ID}/" '{"pay_per_hour":"30.00"}')"
assert_status "dispatch hour update" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "pay updated" "$(body "$resp")" "30.00"

# ── Documents ─────────────────────────────────────────────────────────────────
step "Documents: import record file create"
resp="$(post "/api/v1/documents/import-record-files/" '{"type":1,"filename":"pilot_aug.xlsx","sha1_file":"aabbccdd"}')"
assert_status "import record file create" "201" "$(code "$resp")" "$(body "$resp")"
IMPORT_FILE_ID="$(body "$resp" | json_get_num id)"

step "Documents: import record file list"
resp="$(get "/api/v1/documents/import-record-files/")"
assert_status "import record file list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "filename listed" "$(body "$resp")" "pilot_aug.xlsx"

step "Documents: import record file delete"
resp="$(delete "/api/v1/documents/import-record-files/${IMPORT_FILE_ID}/")"
assert_status "import record file delete" "204" "$(code "$resp")"

step "Documents: import record file deleted → 404"
set +e
resp="$(delete "/api/v1/documents/import-record-files/${IMPORT_FILE_ID}/")"
curl_status=$?
set -e
if [[ "${curl_status}" -ne 0 ]]; then
  fail "import record file gone request failed (curl exit ${curl_status})" "${resp}"
fi
assert_status "import record file gone" "404" "$(code "$resp")"

# driver-files, truck-files, trailer-files require multipart file upload.
# Upload a real file, verify list, then delete, then confirm 404.
step "Documents: driver-file upload"
_TMP_DFILE="$(mktemp /tmp/jems_test_dfile.XXXXXX.pdf)"
printf '%%PDF-1.4 driver-doc' > "${_TMP_DFILE}"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "driver=${DRIVER_ID}" \
  -F "type=1" \
  -F "expiry_date=2026-12-31" \
  -F "file=@${_TMP_DFILE};type=application/pdf" \
  "${API_URL}/api/v1/documents/driver-files/")"
rm -f "${_TMP_DFILE}"
assert_status "driver-file upload" "201" "$(code "$resp")" "$(body "$resp")"
DRIVER_FILE_ID="$(body "$resp" | json_get_num id)"

step "Documents: driver-files list"
resp="$(get "/api/v1/documents/driver-files/")"
assert_status "driver-files list" "200" "$(code "$resp")"
assert_contains "driver file listed" "$(body "$resp")" "${DRIVER_FILE_ID}"

step "Documents: driver-file delete"
resp="$(delete "/api/v1/documents/driver-files/${DRIVER_FILE_ID}/")"
assert_status "driver-file delete" "204" "$(code "$resp")"

step "Documents: driver-file deleted → 404"
resp="$(delete "/api/v1/documents/driver-files/${DRIVER_FILE_ID}/")"
assert_status "driver-file gone" "404" "$(code "$resp")"

step "Documents: truck-file upload"
_TMP_TFILE="$(mktemp /tmp/jems_test_tfile.XXXXXX.pdf)"
printf '%%PDF-1.4 truck-doc' > "${_TMP_TFILE}"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "truck=${TRUCK_ID}" \
  -F "type=1" \
  -F "expiry_date=2026-12-31" \
  -F "file=@${_TMP_TFILE};type=application/pdf" \
  "${API_URL}/api/v1/documents/truck-files/")"
rm -f "${_TMP_TFILE}"
assert_status "truck-file upload" "201" "$(code "$resp")" "$(body "$resp")"
TRUCK_FILE_ID="$(body "$resp" | json_get_num id)"

step "Documents: truck-files list"
resp="$(get "/api/v1/documents/truck-files/")"
assert_status "truck-files list" "200" "$(code "$resp")"
assert_contains "truck file listed" "$(body "$resp")" "${TRUCK_FILE_ID}"

step "Documents: truck-file delete"
resp="$(delete "/api/v1/documents/truck-files/${TRUCK_FILE_ID}/")"
assert_status "truck-file delete" "204" "$(code "$resp")"

step "Documents: truck-file deleted → 404"
resp="$(delete "/api/v1/documents/truck-files/${TRUCK_FILE_ID}/")"
assert_status "truck-file gone" "404" "$(code "$resp")"

step "Documents: trailer-file upload"
_TMP_RLFILE="$(mktemp /tmp/jems_test_rlfile.XXXXXX.pdf)"
printf '%%PDF-1.4 trailer-doc' > "${_TMP_RLFILE}"
resp="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "trailer=${TRAILER_ID}" \
  -F "type=1" \
  -F "expiry_date=2026-12-31" \
  -F "file=@${_TMP_RLFILE};type=application/pdf" \
  "${API_URL}/api/v1/documents/trailer-files/")"
rm -f "${_TMP_RLFILE}"
assert_status "trailer-file upload" "201" "$(code "$resp")" "$(body "$resp")"
TRAILER_FILE_ID="$(body "$resp" | json_get_num id)"

step "Documents: trailer-files list"
resp="$(get "/api/v1/documents/trailer-files/")"
assert_status "trailer-files list" "200" "$(code "$resp")"
assert_contains "trailer file listed" "$(body "$resp")" "${TRAILER_FILE_ID}"

step "Documents: trailer-file delete"
resp="$(delete "/api/v1/documents/trailer-files/${TRAILER_FILE_ID}/")"
assert_status "trailer-file delete" "204" "$(code "$resp")"

step "Documents: trailer-file deleted → 404"
resp="$(delete "/api/v1/documents/trailer-files/${TRAILER_FILE_ID}/")"
assert_status "trailer-file gone" "404" "$(code "$resp")"

# ── Integrations ──────────────────────────────────────────────────────────────
step "Integrations: RTL sync (inject driver + truck)"
resp="$(post "/api/v1/integrations/rtl/sync/" '{
  "drivers":[{"_id":"eld-drv-001","firstName":"Mike","lastName":"Smith","email":"mike@eld.com","active":true,"phoneNum":"5550001111","driverInfoLicenseNumber":"TX123456","driverInfoLicenseState":"TX","companyId":"comp-1"}],
  "trucks":[{"_id":"eld-trk-001","name":"T-501","vin":"1HTMKAAR3BH000501","active":true,"make":"Freightliner","model":"Cascadia","year":"2022","companyId":"comp-1"}],
  "driver_statuses":[{"_id":"eld-dstat-001","userId":"eld-drv-001","locationLat":29.76,"locationLon":-95.36,"locationState":"TX","vehicleId":"eld-trk-001","vehicleVin":"1HTMKAAR3BH000501","hosEventCode":"1","dailyLogSummaryTimeDriven":7.5,"dailyLogSummaryTimeOnDuty":9.0}],
  "truck_statuses":[{"_id":"eld-tstat-001","v":"eld-trk-001","vin":"1HTMKAAR3BH000501","lat":29.76,"lon":-95.36,"speed":65.0,"odometer":123456.0}]
}')"
assert_status "rtl sync" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "sync drivers count" "$(body "$resp")" '"drivers":1'
assert_contains "sync trucks count" "$(body "$resp")" '"trucks":1'

step "Integrations: RTL sync is idempotent"
resp="$(post "/api/v1/integrations/rtl/sync/" '{"drivers":[{"_id":"eld-drv-001","firstName":"Mike","lastName":"Smith","active":true}]}')"
assert_status "rtl sync idempotent" "200" "$(code "$resp")" "$(body "$resp")"

step "Integrations: RTL sync stores violations in driver status"
resp="$(post "/api/v1/integrations/rtl/sync/" '{
  "driver_statuses":[{"_id":"eld-dstat-001","userId":"eld-drv-001","hosEventCode":"DS_D","dailyLogSummaryTimeDriven":11.0,"dailyLogSummaryTimeOnDuty":14.5,"dailyLogSummaryViolations":"H11_DRIVING,H14_DUTY_LIMIT"}]
}')"
assert_status "rtl sync with violations" "200" "$(code "$resp")" "$(body "$resp")"

step "Integrations: ELD badge fields appear in loads list when driver has RTL status"
resp="$(post "/api/v1/loads/" "{\"number\":\"ELD-001\",\"pickup_date\":\"2024-08-01\",\"pickup_city\":${CITY_ID},\"pickup_address\":\"1 ELD Ave\",\"dropoff_date\":\"2024-08-02\",\"dropoff_city\":${CITY_ID},\"dropoff_address\":\"2 ELD Blvd\",\"payment\":\"1000.00\",\"miles\":500,\"broker\":${BROKER_ID},\"carrier\":${CARRIER_ID},\"shipper\":${SHIPPER_ID},\"receiver\":${RECEIVER_ID},\"driver\":${DRIVER_ID},\"status\":1}")"
assert_status "eld test load create" "201" "$(code "$resp")" "$(body "$resp")"
ELD_LOAD_ID="$(body "$resp" | json_get_num id)"
resp="$(get "/api/v1/loads/?number=ELD-001")"
assert_status "load with eld driver" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "driver_rtl_event_code populated" "$(body "$resp")" '"driver_rtl_event_code":"DS_D"'
assert_contains "driver_rtl_id populated" "$(body "$resp")" '"driver_rtl_id"'
assert_contains "driver_rtl_has_violations true" "$(body "$resp")" '"driver_rtl_has_violations":true'
resp="$(delete "/api/v1/loads/${ELD_LOAD_ID}/")"
assert_status "eld test load delete" "204" "$(code "$resp")"

step "Integrations: RTL fetch-and-sync (no carriers with ELD credentials seeded — expects empty synced)"
resp="$(post "/api/v1/integrations/rtl/fetch-and-sync/" '{}')"
assert_status "rtl fetch-and-sync" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "rtl fetch-and-sync has synced key" "$(body "$resp")" '"synced"'

step "Integrations: RTL drivers list"
resp="$(get "/api/v1/integrations/rtl/drivers/")"
assert_status "rtl driver list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "rtl driver synced" "$(body "$resp")" "eld-drv-001"

step "Integrations: RTL drivers filter active"
resp="$(get "/api/v1/integrations/rtl/drivers/?active=true")"
assert_status "rtl driver active filter" "200" "$(code "$resp")" "$(body "$resp")"

step "Integrations: RTL driver retrieve with status"
RTL_DRIVER_ID="$(body "$(get "/api/v1/integrations/rtl/drivers/")" | json_get_num id)"
resp="$(get "/api/v1/integrations/rtl/drivers/${RTL_DRIVER_ID}/")"
assert_status "rtl driver retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "rtl driver has status" "$(body "$resp")" "latest_status"

step "Integrations: RTL trucks list"
resp="$(get "/api/v1/integrations/rtl/trucks/")"
assert_status "rtl truck list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "rtl truck synced" "$(body "$resp")" "eld-trk-001"

step "Integrations: RTL truck retrieve"
RTL_TRUCK_ID="$(body "$(get "/api/v1/integrations/rtl/trucks/")" | json_get_num id)"
resp="$(get "/api/v1/integrations/rtl/trucks/${RTL_TRUCK_ID}/")"
assert_status "rtl truck retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "rtl truck vin" "$(body "$resp")" "1HTMKAAR3BH000501"

step "Integrations: IFTA sync"
resp="$(post "/api/v1/integrations/rtl/sync/" '{
  "ifta_reports":[{"_id":"ifta-001","fromDate":"2024-01-01","toDate":"2024-03-31","vehiclevin":"1HTMKAAR3BH000501","vehicleid":"eld-trk-001","vehiclename":"T-501","companyId":"comp-1","url":"https://eld.example.com/ifta/001","csvUrl":"https://eld.example.com/ifta/001.csv"}]
}')"
assert_status "ifta sync" "200" "$(code "$resp")" "$(body "$resp")"

step "Integrations: IFTA list"
resp="$(get "/api/v1/integrations/rtl/ifta/")"
assert_status "ifta list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "ifta vin" "$(body "$resp")" "1HTMKAAR3BH000501"

step "Integrations: IFTA filter by vin"
resp="$(get "/api/v1/integrations/rtl/ifta/?vin=1HTMKAAR3BH000501")"
assert_status "ifta filter" "200" "$(code "$resp")" "$(body "$resp")"
assert_not_contains "wrong vin" "$(body "$resp")" "VIN999"

step "Integrations: RTL IFTA retrieve"
RTL_IFTA_ID="$(body "$(get "/api/v1/integrations/rtl/ifta/")" | json_get_num id)"
resp="$(get "/api/v1/integrations/rtl/ifta/${RTL_IFTA_ID}/")"
assert_status "rtl ifta retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "rtl ifta id" "$(body "$resp")" "ifta-001"

step "Integrations: IFTA report create"
resp="$(post "/api/v1/integrations/ifta-reports/" '{"from_date":"2024-01-01","to_date":"2024-03-31","report":"Q1-2024","vehicles":"[\"eld-trk-001\"]","status":"pending"}')"
assert_status "ifta report create" "201" "$(code "$resp")" "$(body "$resp")"
IFTA_REPORT_ID="$(body "$resp" | json_get_num id)"

step "Integrations: IFTA report list"
resp="$(get "/api/v1/integrations/ifta-reports/")"
assert_status "ifta report list" "200" "$(code "$resp")" "$(body "$resp")"

step "Integrations: IFTA report delete"
resp="$(delete "/api/v1/integrations/ifta-reports/${IFTA_REPORT_ID}/")"
assert_status "ifta report delete" "204" "$(code "$resp")"

step "Integrations: IFTA report deleted → 404"
resp="$(delete "/api/v1/integrations/ifta-reports/${IFTA_REPORT_ID}/")"
assert_status "ifta report gone" "404" "$(code "$resp")"

step "Integrations: unauthenticated RTL blocked"
resp="$(curl -s -w "\n%{http_code}" "${API_URL}/api/v1/integrations/rtl/drivers/")"
assert_status "rtl unauth" "401" "$(code "$resp")"

# ── Dispatch ──────────────────────────────────────────────────────────────────

step "Dispatch: list dispatchers options"
resp="$(get "/api/v1/dispatch/dispatchers/")"
assert_status "dispatchers list" "200" "$(code "$resp")" "$(body "$resp")"

step "Dispatch: list work sessions (empty is OK)"
resp="$(get "/api/v1/dispatch/work/")"
assert_status "work list" "200" "$(code "$resp")" "$(body "$resp")"

step "Dispatch: create work session"
resp="$(post "/api/v1/dispatch/work/" "{\"title\":\"Smoke test session\",\"start\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"end\":\"$(date -u -v+1H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '+1 hour' +%Y-%m-%dT%H:%M:%SZ)\"}")"
assert_status "work create" "201" "$(code "$resp")" "$(body "$resp")"
WORK_ID="$(body "$resp" | json_get_num id)"

step "Dispatch: retrieve work session"
resp="$(get "/api/v1/dispatch/work/${WORK_ID}/")"
assert_status "work retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "work has title" "$(body "$resp")" '"title"'
assert_contains "work has is_finished" "$(body "$resp")" '"is_finished"'
assert_contains "work has duration_hours" "$(body "$resp")" '"duration_hours"'

step "Dispatch: patch work session title"
resp="$(patch "/api/v1/dispatch/work/${WORK_ID}/" '{"title":"Updated session"}')"
assert_status "work patch" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "work patch updated" "$(body "$resp")" '"Updated session"'

step "Dispatch: finish work session"
resp="$(post "/api/v1/dispatch/work/${WORK_ID}/finish/" '{}')"
assert_status "work finish" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "work is finished" "$(body "$resp")" '"is_finished":true'

step "Dispatch: finish already-finished session (→ 400)"
resp="$(post "/api/v1/dispatch/work/${WORK_ID}/finish/" '{}')"
assert_status "work finish again" "400" "$(code "$resp")"

step "Dispatch: mark work session paid"
resp="$(post "/api/v1/dispatch/work/${WORK_ID}/mark-paid/" '{}')"
assert_status "work mark-paid" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "work is paid" "$(body "$resp")" '"is_paid":true'

step "Dispatch: list percent invoices (empty is OK)"
resp="$(get "/api/v1/dispatch/invoices/percent/")"
assert_status "percent invoices list" "200" "$(code "$resp")" "$(body "$resp")"

step "Dispatch: create percent invoice"
resp="$(post "/api/v1/dispatch/invoices/percent/" '{"date":"2024-01-31","start":"2024-01-01T00:00:00Z","end":"2024-01-31T23:59:59Z","percent":"2.50"}')"
assert_status "percent invoice create" "201" "$(code "$resp")" "$(body "$resp")"
PCT_INV_ID="$(body "$resp" | json_get_num id)"

step "Dispatch: retrieve percent invoice"
resp="$(get "/api/v1/dispatch/invoices/percent/${PCT_INV_ID}/")"
assert_status "percent invoice retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "pct inv has number" "$(body "$resp")" '"number"'
assert_contains "pct inv has percent" "$(body "$resp")" '"percent"'

step "Dispatch: percent invoice amount"
resp="$(get "/api/v1/dispatch/invoices/percent/${PCT_INV_ID}/amount/")"
assert_status "percent invoice amount" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "amount field present" "$(body "$resp")" '"amount"'

step "Dispatch: close percent invoice"
resp="$(post "/api/v1/dispatch/invoices/percent/${PCT_INV_ID}/close/" '{}')"
assert_status "pct inv close" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "pct inv closed" "$(body "$resp")" '"status":0'

step "Dispatch: close already-closed percent invoice (→ 400)"
resp="$(post "/api/v1/dispatch/invoices/percent/${PCT_INV_ID}/close/" '{}')"
assert_status "pct inv close again" "400" "$(code "$resp")"

step "Dispatch: reopen percent invoice"
resp="$(post "/api/v1/dispatch/invoices/percent/${PCT_INV_ID}/open/" '{}')"
assert_status "pct inv reopen" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "pct inv reopened" "$(body "$resp")" '"status":1'

step "Dispatch: list hour invoices (empty is OK)"
resp="$(get "/api/v1/dispatch/invoices/hour/")"
assert_status "hour invoices list" "200" "$(code "$resp")" "$(body "$resp")"

step "Dispatch: create hour invoice"
resp="$(post "/api/v1/dispatch/invoices/hour/" '{"date":"2024-01-31","start":"2024-01-01T00:00:00Z","end":"2024-01-31T23:59:59Z","pay_per_hour":"15.00"}')"
assert_status "hour invoice create" "201" "$(code "$resp")" "$(body "$resp")"
HOUR_INV_ID="$(body "$resp" | json_get_num id)"

step "Dispatch: retrieve hour invoice"
resp="$(get "/api/v1/dispatch/invoices/hour/${HOUR_INV_ID}/")"
assert_status "hour invoice retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "hour inv has pay_per_hour" "$(body "$resp")" '"pay_per_hour"'

step "Dispatch: hour invoice amount"
resp="$(get "/api/v1/dispatch/invoices/hour/${HOUR_INV_ID}/amount/")"
assert_status "hour invoice amount" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "hour amount field present" "$(body "$resp")" '"amount"'

step "Dispatch: close hour invoice"
resp="$(post "/api/v1/dispatch/invoices/hour/${HOUR_INV_ID}/close/" '{}')"
assert_status "hour inv close" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "hour inv closed" "$(body "$resp")" '"status":0'

step "Dispatch: reopen hour invoice"
resp="$(post "/api/v1/dispatch/invoices/hour/${HOUR_INV_ID}/open/" '{}')"
assert_status "hour inv reopen" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "hour inv reopened" "$(body "$resp")" '"status":1'

step "Dispatch: delete work session"
resp="$(delete "/api/v1/dispatch/work/${WORK_ID}/")"
assert_status "work delete" "204" "$(code "$resp")"

step "Dispatch: deleted work session → 404"
resp="$(get "/api/v1/dispatch/work/${WORK_ID}/")"
assert_status "work gone" "404" "$(code "$resp")"

# ── AI ────────────────────────────────────────────────────────────────────────
step "AI: create conversation"
resp="$(post "/api/v1/ai/conversations/" '{"topic":"Load planning for Q3"}')"
assert_status "conversation create" "201" "$(code "$resp")" "$(body "$resp")"
CONV_ID="$(body "$resp" | json_get_num id)"
assert_contains "conversation topic" "$(body "$resp")" "Load planning for Q3"

step "AI: list conversations (only own)"
resp="$(get "/api/v1/ai/conversations/")"
assert_status "conversation list" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "conversation listed" "$(body "$resp")" "${CONV_ID}"

step "AI: retrieve conversation"
resp="$(get "/api/v1/ai/conversations/${CONV_ID}/")"
assert_status "conversation retrieve" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "conversation messages field" "$(body "$resp")" "messages"

step "AI: send message without API key (→ 503)"
resp="$(post "/api/v1/ai/conversations/${CONV_ID}/messages/" '{"content":"What loads are active today?"}')"
assert_status "send message no key" "503" "$(code "$resp")"

step "AI: send empty message rejected (→ 400)"
resp="$(post "/api/v1/ai/conversations/${CONV_ID}/messages/" '{"content":""}')"
assert_status "send empty message" "400" "$(code "$resp")"

step "AI: conversation isolation (other user cannot access)"
# Login as dispatcher1
resp="$(post_anon "/api/v1/auth/login/" '{"username":"dispatcher1","password":"disp1234"}')"
assert_status "dispatcher login" "200" "$(code "$resp")" "$(body "$resp")"
DISP_TOKEN="$(body "$resp" | json_get access)"
OTHER_RESP="$(curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${DISP_TOKEN}" \
  "${API_URL}/api/v1/ai/conversations/${CONV_ID}/")"
assert_status "conversation isolation" "404" "$(code "$OTHER_RESP")"

step "AI: delete conversation"
resp="$(delete "/api/v1/ai/conversations/${CONV_ID}/")"
assert_status "conversation delete" "204" "$(code "$resp")"

step "AI: retrieve deleted conversation (→ 404)"
resp="$(get "/api/v1/ai/conversations/${CONV_ID}/")"
assert_status "deleted conversation 404" "404" "$(code "$resp")"

# ── Dashboard ────────────────────────────────────────────────────────────────
step "Dashboard: GET /api/v1/dashboard/"
resp="$(get "/api/v1/dashboard/")"
assert_status "dashboard ok" "200" "$(code "$resp")"
assert_contains "dashboard has stats" "$(body "$resp")" '"stats"'
assert_contains "dashboard has expiration_alerts" "$(body "$resp")" '"expiration_alerts"'
assert_contains "dashboard has maintenance_alerts" "$(body "$resp")" '"maintenance_alerts"'
assert_contains "dashboard has counts" "$(body "$resp")" '"counts"'
assert_contains "dashboard has trucks_maintenance_alerts" "$(body "$resp")" '"trucks_maintenance_alerts"'

step "Dashboard: shape and invariants validation (admin user sees all stats)"
body "$resp" | python3 -c "
import sys, json
d = json.load(sys.stdin)

# Stats — admin user: all three fields are numbers (not null)
assert d['stats']['loads_in_dispatch'] is not None, 'loads_in_dispatch is null for admin'
assert d['stats']['executed_loads'] is not None, 'executed_loads is null for admin'
assert d['stats']['invoiced'] is not None, 'invoiced is null for admin'
assert isinstance(d['stats']['loads_in_dispatch'], int), 'loads_in_dispatch not int'
assert isinstance(d['stats']['executed_loads'], int), 'executed_loads not int'
assert isinstance(d['stats']['invoiced'], int), 'invoiced not int'
# invoiced is always a subset of executed_loads
assert d['stats']['invoiced'] <= d['stats']['executed_loads'], \
    f'invoiced ({d[\"stats\"][\"invoiced\"]}) > executed_loads ({d[\"stats\"][\"executed_loads\"]})'

# Expiration alerts — 4 keys (drivers, trucks, trailers, categories)
for key in ('drivers', 'trucks', 'trailers', 'categories'):
    assert isinstance(d['expiration_alerts'][key], list), f'{key} not list'

# Maintenance alerts — 2 keys (trucks, trailers) with detail records
assert isinstance(d['maintenance_alerts']['trucks'], list), 'maintenance_alerts.trucks not list'
assert isinstance(d['maintenance_alerts']['trailers'], list), 'maintenance_alerts.trailers not list'

# Validate maintenance alert record shape if any exist
for record in d['maintenance_alerts']['trucks']:
    assert 'truck_id' in record, 'truck maintenance record missing truck_id'
    assert 'truck_number' in record, 'truck maintenance record missing truck_number'
    assert 'maintenance_id' in record, 'truck maintenance record missing maintenance_id'
    assert 'date' in record, 'truck maintenance record missing date'
    assert 'detail' in record, 'truck maintenance record missing detail'
    assert 'alert_date' in record, 'truck maintenance record missing alert_date'
    assert 'time_alert_triggered' in record, 'truck maintenance record missing time_alert_triggered'
    assert 'miles_alert_triggered' in record, 'truck maintenance record missing miles_alert_triggered'
    assert 'miles_traveled' in record, 'truck maintenance record missing miles_traveled'
    assert 'miles_threshold' in record, 'truck maintenance record missing miles_threshold'
    assert isinstance(record['time_alert_triggered'], bool), 'time_alert_triggered not bool'
    assert isinstance(record['miles_alert_triggered'], bool), 'miles_alert_triggered not bool'
    # time-only: alert_date is set, miles fields are null
    if record['time_alert_triggered'] and not record['miles_alert_triggered']:
        assert record['alert_date'] is not None, 'time-only alert must have alert_date'
        assert record['miles_traveled'] is None, 'time-only alert must have miles_traveled null'
    # miles-only: alert_date is null, miles fields are set
    if record['miles_alert_triggered'] and not record['time_alert_triggered']:
        assert record['alert_date'] is None, 'miles-only alert must have alert_date null'
        assert record['miles_traveled'] is not None, 'miles-only alert must have miles_traveled'
        assert record['miles_threshold'] is not None, 'miles-only alert must have miles_threshold'
for record in d['maintenance_alerts']['trailers']:
    assert 'trailer_id' in record, 'trailer maintenance record missing trailer_id'
    assert 'trailer_number' in record, 'trailer maintenance record missing trailer_number'
    assert 'maintenance_id' in record, 'trailer maintenance record missing maintenance_id'
    assert 'date' in record, 'trailer maintenance record missing date'
    assert 'detail' in record, 'trailer maintenance record missing detail'
    assert 'alert_date' in record, 'trailer maintenance record missing alert_date'
    assert 'time_alert_triggered' in record, 'trailer maintenance record missing time_alert_triggered'
    assert 'miles_alert_triggered' in record, 'trailer maintenance record missing miles_alert_triggered'
    assert 'miles_traveled' in record, 'trailer maintenance record missing miles_traveled'
    assert 'miles_threshold' in record, 'trailer maintenance record missing miles_threshold'
    assert isinstance(record['time_alert_triggered'], bool), 'trailer time_alert_triggered not bool'
    assert isinstance(record['miles_alert_triggered'], bool), 'trailer miles_alert_triggered not bool'
    if record['time_alert_triggered'] and not record['miles_alert_triggered']:
        assert record['alert_date'] is not None, 'trailer time-only alert must have alert_date'
        assert record['miles_traveled'] is None, 'trailer time-only alert must have miles_traveled null'
    if record['miles_alert_triggered'] and not record['time_alert_triggered']:
        assert record['alert_date'] is None, 'trailer miles-only alert must have alert_date null'
        assert record['miles_traveled'] is not None, 'trailer miles-only alert must have miles_traveled'

# Counts — all present
for key in ('drivers_expiring', 'trucks_expiring', 'trucks_maintenance_alerts',
            'trailers_expiring', 'trailers_maintenance_alerts', 'categories_expiring'):
    assert isinstance(d['counts'][key], int), f'{key} not int'

# Badge counts must match list lengths
assert d['counts']['drivers_expiring'] == len(d['expiration_alerts']['drivers']), \
    'drivers_expiring count mismatch'
assert d['counts']['trucks_expiring'] == len(d['expiration_alerts']['trucks']), \
    'trucks_expiring count mismatch'
assert d['counts']['trailers_expiring'] == len(d['expiration_alerts']['trailers']), \
    'trailers_expiring count mismatch'
assert d['counts']['categories_expiring'] == len(d['expiration_alerts']['categories']), \
    'categories_expiring count mismatch'
# Maintenance counts align with detail list lengths
assert d['counts']['trucks_maintenance_alerts'] == len(d['maintenance_alerts']['trucks']), \
    'trucks_maintenance_alerts count mismatch'
assert d['counts']['trailers_maintenance_alerts'] == len(d['maintenance_alerts']['trailers']), \
    'trailers_maintenance_alerts count mismatch'

print('    OK: dashboard shape and invariants valid')
"

step "Dashboard: driver alerts use 'Record' label for MVR document (legacy parity)"
body "$resp" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for driver in d['expiration_alerts']['drivers']:
    for alert in driver['alerts']:
        if alert['type'] == 'record':
            assert alert['label'] == 'Record', \
                f'MVR alert label should be Record, got {alert[\"label\"]}'
print('    OK: MVR alerts labelled Record')
"

step "Dashboard: every expiration alert has expires_on in YYYY-MM-DD format"
body "$resp" | python3 -c "
import sys, json, re
d = json.load(sys.stdin)
iso_re = re.compile(r'^\d{4}-\d{2}-\d{2}$')
for section in ('drivers', 'trucks', 'trailers', 'categories'):
    for entity in d['expiration_alerts'][section]:
        for alert in entity['alerts']:
            assert 'expires_on' in alert, \
                f'{section} entity {entity.get(\"id\")} alert missing expires_on'
            assert iso_re.match(alert['expires_on']), \
                f'{section} expires_on not ISO date: {alert[\"expires_on\"]}'
print('    OK: all expiration alerts carry expires_on in YYYY-MM-DD format')
"

step "Dashboard: alert days_until matches expires_on date arithmetic"
body "$resp" | python3 -c "
import sys, json
from datetime import date
d = json.load(sys.stdin)
today = date.today()
for section in ('drivers', 'trucks', 'trailers', 'categories'):
    for entity in d['expiration_alerts'][section]:
        for alert in entity['alerts']:
            expected_days = (date.fromisoformat(alert['expires_on']) - today).days
            assert alert['days_until'] == expected_days, \
                f'{section} days_until {alert[\"days_until\"]} != {expected_days} for {alert[\"expires_on\"]}'
            assert alert['expired'] == (expected_days < 0), \
                f'{section} expired flag wrong for days_until={expected_days}'
print('    OK: days_until and expired flag consistent with expires_on')
"

step "Dashboard: unauthenticated request blocked"
resp_code="$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/api/v1/dashboard/")"
assert_status "dashboard 401" "401" "${resp_code}"

# ── Final cleanup (delete remaining resources) ────────────────────────────────
step "Cleanup: driver soft-delete (sets TERMINATED)"
resp="$(delete "/api/v1/drivers/${DRIVER_ID}/")"
assert_status "driver delete" "204" "$(code "$resp")"

step "Cleanup: driver still retrievable after soft-delete"
resp="$(get "/api/v1/drivers/${DRIVER_ID}/")"
assert_status "driver still exists" "200" "$(code "$resp")"

step "Cleanup: truck owner delete"
resp="$(delete "/api/v1/fleet/owners/${TRUCK_OWNER_ID}/")"
assert_status "truck owner delete" "204" "$(code "$resp")"

step "Cleanup: truck owner deleted → 404"
resp="$(get "/api/v1/fleet/owners/${TRUCK_OWNER_ID}/")"
assert_status "truck owner gone" "404" "$(code "$resp")"

step "Cleanup: broker soft-delete (status → Inactive)"
resp="$(delete "/api/v1/brokers/${BROKER_ID}/")"
assert_status "broker soft-delete" "204" "$(code "$resp")"

step "Cleanup: broker still exists but is Inactive"
resp="$(get "/api/v1/brokers/${BROKER_ID}/")"
assert_status "broker retrievable after soft-delete" "200" "$(code "$resp")" "$(body "$resp")"
assert_contains "broker is inactive" "$(body "$resp")" '"status":0'

step "Cleanup: carrier delete"
resp="$(delete "/api/v1/carriers/${CARRIER_ID}/")"
assert_status "carrier delete" "204" "$(code "$resp")"

step "Cleanup: carrier deleted → 404"
resp="$(get "/api/v1/carriers/${CARRIER_ID}/")"
assert_status "carrier gone" "404" "$(code "$resp")"

step "Cleanup: truck soft-delete (sets INACTIVE)"
resp="$(delete "/api/v1/fleet/trucks/${TRUCK_ID}/")"
assert_status "truck delete" "204" "$(code "$resp")"

step "Cleanup: truck still retrievable after soft-delete"
resp="$(get "/api/v1/fleet/trucks/${TRUCK_ID}/")"
assert_status "truck still exists" "200" "$(code "$resp")"

step "Cleanup: trailer soft-delete (sets INACTIVE)"
resp="$(delete "/api/v1/fleet/trailers/${TRAILER_ID}/")"
assert_status "trailer delete" "204" "$(code "$resp")"

step "Cleanup: trailer still retrievable after soft-delete"
resp="$(get "/api/v1/fleet/trailers/${TRAILER_ID}/")"
assert_status "trailer still exists" "200" "$(code "$resp")"

# ── Final summary ─────────────────────────────────────────────────────────────
# Disable ERR trap — we're done, exit 0 is intentional.
trap - ERR
echo
echo "============================================"
echo " All checks passed."
echo "============================================"
