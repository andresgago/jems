// @ts-check
import { expect, test } from '@playwright/test'

// ── JWT helper ────────────────────────────────────────────────────────────────
// jwtDecode only decodes — it does not verify signatures.
// We produce a structurally valid JWT with a future exp so AuthContext accepts it.

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function mockJWT() {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({
    user_id: 1,
    username: 'testuser',
    full_name: 'Test User',
    roles: ['dispatcher'],
    exp: Math.floor(Date.now() / 1000) + 86400,
  })
  return `${header}.${payload}.mock-sig`
}

function mockAdminJWT() {
  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({
    user_id: 1,
    username: 'admin',
    full_name: 'Admin User',
    roles: ['root'],
    exp: Math.floor(Date.now() / 1000) + 86400,
  })
  return `${header}.${payload}.mock-sig`
}

async function withAdminAuth(page) {
  await mockApi(page)
  const token = mockAdminJWT()
  await page.addInitScript((t) => {
    localStorage.setItem('access_token', t)
    localStorage.setItem('refresh_token', 'mock-refresh')
  }, token)
}

// ── Mock API ──────────────────────────────────────────────────────────────────

const TRAILER_TYPES = [
  { id: 1, name: 'Van', short_name: 'V', is_active: true },
  { id: 2, name: 'Reefer', short_name: 'R', is_active: true },
  { id: 3, name: 'Flatbed', short_name: 'F', is_active: true },
]

const CARRIERS = [
  { id: 1, name: 'Jobee Express LLC' },
  { id: 2, name: 'Best Wheels Transport LLC' },
]

const STATES = [
  { id: 9, name: 'Texas', abbreviation: 'TX' },
  { id: 10, name: 'Alabama', abbreviation: 'AL' },
]

const DRIVER_TYPES = [
  { id: 1, name: 'Company Driver', is_active: true },
  { id: 2, name: 'Owner Operator', is_active: true },
]

const DRIVERS = [
  {
    id: 1, first_name: 'John', last_name: 'Doe', full_name: 'John Doe',
    driver_type: 1, driver_type_name: 'Company Driver', status: 1,
    phone: '5551234', email: 'john@example.com',
    license_expiration: '2030-01-01', medical_card_expiration: '2030-01-01',
    on_vacation: false, carrier: 1,
  },
]

const DRIVER_DETAIL = {
  ...DRIVERS[0], address: '1 Main St', license_state: 9, license_number: 'D123',
  contract: true, percent: 25, insurance: 50, documents: [], photo: null,
}

const DRIVER_LAST_VEHICLE = {
  last_truck_id: 1,
  last_trailer_id: 1,
  trucks: [{ id: 1, number: 'T-100', vin: '1VIN001' }],
  trailers: [{ id: 1, number: 'TR-200', vin: '2VIN001', trailer_type__name: 'Van' }],
}

const TRUCK_TYPES = [
  { id: 1, name: 'Sleeper', is_active: true },
  { id: 2, name: 'Day Cab', is_active: true },
]

const TRUCKS = [
  {
    id: 1, number: 'T-100', truck_type: 1, truck_type_name: 'Sleeper',
    plate: 'ABC123', vin: '1FUJ', year: 2022, status: 1,
    avi_expiration: '2030-01-01', registration_expiration: '2030-01-01',
  },
]

const TRUCK_DETAIL = {
  ...TRUCKS[0], transponder: '', make: null, gross_weight: 35000,
  is_leased: false, purchase_cost: 0, maintenance_records: [],
}

const TRAILERS = [
  {
    id: 1, number: 'TRL-100', trailer_type: 1, trailer_type_name: '53ft Dry Van',
    vin: 'VIN001', year: 2021, status: 1, plate_number: 'TX-001',
    annual_inspection_expiration: '2030-06-01', is_rented: false,
  },
]

const BROKERS = [
  {
    id: 1, name: 'Sunrise Freight LLC', mc: 'MC001', dba_name: 'Sunrise',
    email: 'sunrise@example.com', phone: '555-0001',
    status: 1, carrier: 1, carrier_name: 'Jobee Express LLC', checked_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
]

const BROKER_DETAIL = {
  ...BROKERS[0],
  accounting_email: null, setup_packet_file: null,
  factor_company: '', factor_account_id: '', buy_status: '', debtor_buy_status: '',
  details: '', physical_address: '123 Main St', mailing_address: '',
  city: null, city_name: null, state: null, state_name: null, zip: '75001',
  usdot_number: '1234567', safer_operating_status: 'AUTHORIZED',
  created_by: null, updated_by: null, updated_at: '2024-01-01T00:00:00Z',
  contacts: [
    { id: 1, broker: 1, name: 'John Smith', email: 'john@sunrise.com', phone: '555-0002', team: false, confirmed: true, is_scam: false, details: '', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
  ],
}

const LOAD_BROKER_CONTACTS = {
  broker: BROKER_DETAIL,
  contacts: BROKER_DETAIL.contacts,
}

const BROKER_STATUS_RESULTS = [
  {
    id: 1, mc: 'MC001', name: 'Sunrise Freight LLC', dba_name: 'Sunrise',
    status: 1, buy_status: '1',
    debtor_buy_status: 'Approved For Purchases',
    safer_operating_status: 'AUTHORIZED',
    factor_company: 'tafs', checked_at: '2025-01-15',
    last_load: {
      id: 42, number: 'LD-00042',
      pickup_city: 'Charlotte, NC', dropoff_city: 'Atlanta, GA',
      payment: '1500.00', pickup_date: '2025-01-10T08:00:00Z',
    },
  },
  {
    id: 2, mc: 'MC002', name: 'Denied Carrier Inc', dba_name: '',
    status: 1, buy_status: '0',
    debtor_buy_status: 'No Buy - Denied For Purchases',
    safer_operating_status: '', factor_company: 'tafs', checked_at: null,
    last_load: null,
  },
]

const ACCOUNTS = [
  { id: 1, code: '90010', name: 'Rate', is_active: true, is_main: false, is_assistant: false, no_tax: false },
  { id: 2, code: '80030', name: 'Fuel', is_active: true, is_main: false, is_assistant: false, no_tax: false },
]

const RECORDS = [
  {
    id: 1, date: '2026-06-01', account: 1, account_code: '90010', amount: 2500.0,
    detail: 'Freight payment', record_type: 1, load: null, driver: null, truck: null,
    created_at: '2026-06-01T10:00:00Z',
  },
]

const RECORD_DETAIL = {
  ...RECORDS[0],
  account_name: 'Rate', quantity: 1.0, team_driver: null, owner: null,
  category: null, category_expire: false, category_expire_date: null,
  dispatcher: null, city: null, card: null, carrier: null,
  is_automatic: false, progress: 0, follow: 0, position: 0,
  product: '', transaction_number: '',
  updated_at: '2026-06-01T10:00:00Z', created_by: null, updated_by: null,
}

const DRIVER_INVOICES = [
  {
    id: 1, number: 101, driver: 1, driver_name: 'John Doe', date: '2026-06-01',
    invoice_type: 0, contract: 0, miles_empty: 0, miles_full: 0,
    percent: 25.0, vacation_now: '', vacation_pay: false, status: 1,
    status_display: 'Open', load_list: '',
    created_at: '2026-06-01T10:00:00Z', updated_at: '2026-06-01T10:00:00Z',
    created_by: null, updated_by: null,
  },
]

const DRIVER_INVOICE_DETAIL = { ...DRIVER_INVOICES[0] }

const DISPATCHERS = [
  { id: 10, full_name: 'Lilian Hernandez', dispatcher_type: 1, color: '#00ffff' },
  { id: 11, full_name: 'Pedro Cancino', dispatcher_type: 1, color: '#1c4587' },
]

const DISPATCH_WORK = [
  {
    id: 1, title: 'Morning shift', dispatcher: 10, dispatcher_name: 'Lilian Hernandez',
    start: '2024-01-15T08:00:00Z', end: '2024-01-15T16:00:00Z',
    is_finished: true, is_paid: false, duration_hours: 8.0,
    invoice_percent: null, invoice_hour: null, session: '',
  },
]

const PERCENT_INVOICES = [
  {
    id: 1, number: 201, dispatcher: 10, dispatcher_name: 'Lilian Hernandez',
    date: '2024-01-31', start: '2024-01-01T00:00:00Z', end: '2024-01-31T23:59:59Z',
    percent: '2.50', status: 1, record: null,
    created_at: '2024-01-31T10:00:00Z', updated_at: '2024-01-31T10:00:00Z',
  },
]

const PERCENT_INVOICE_DETAIL = { ...PERCENT_INVOICES[0] }

const HOUR_INVOICES = [
  {
    id: 1, number: 301, dispatcher: 11, dispatcher_name: 'Pedro Cancino',
    date: '2024-01-31', start: '2024-01-01T00:00:00Z', end: '2024-01-31T23:59:59Z',
    pay_per_hour: '10.00', status: 1, record: null,
    created_at: '2024-01-31T10:00:00Z', updated_at: '2024-01-31T10:00:00Z',
  },
]

const HOUR_INVOICE_DETAIL = { ...HOUR_INVOICES[0] }

const CITIES = [
  { id: 1, name: 'Charlotte', zip: '28201', state: 34, state_name: 'North Carolina', state_abbreviation: 'NC', active: true, timezone: 'America/New_York' },
  { id: 2, name: 'Houston', zip: '77001', state: 44, state_name: 'Texas', state_abbreviation: 'TX', active: false, timezone: 'America/Chicago' },
]

const CITY_DETAIL = {
  ...CITIES[0],
  state_data: { id: 34, name: 'North Carolina', abbreviation: 'NC' },
}

const USERS = [
  {
    id: 1, username: 'lilian', first_name: 'Lilian', last_name: 'Hernandez',
    full_name: 'Lilian Hernandez', email: 'lilian@example.com', phone: '704-264-7316',
    status: 10, is_dispatcher: true, dispatcher_type: 0,
    dispatcher_type_display: 'Main', contract: 0, contract_display: 'By Percent',
    percent: 2.5, hours: 0, color: '#00ffff',
  },
]

const USER_DETAIL = {
  ...USERS[0],
  start_hour: '08:00:00', end_hour: '17:00:00', address: '1 Dispatch Way',
  social_security_number: '', position: null, position_name: null,
  main_dispatcher: null, main_dispatcher_name: null,
  carriers_access: [], dispatcher_access: [], carrier: 0,
  photo: null, is_staff: true,
}

const SYSTEM_CONFIG = {
  id: 1, start_hours_work_dispatcher: '08:00:00', end_hours_work_dispatcher: '17:00:00',
  dispatcher_invoice_hour: 1000, dispatcher_invoice_percent: 1000,
  driver_invoice: 1000, owner_invoice: 1000, carrier: 0,
}

const DISPLAY_OPTIONS = {
  id: 1, truck: 'number,VIN', trailer: 'number,year', driver: 'name,phone',
}

const RTL_DRIVERS = [
  {
    id: 1, rtl_id: 'rtl-drv-001', company_id: 'comp-1',
    first_name: 'Mike', last_name: 'Driver',
    email: 'mike@example.com', phone_num: '555-9001',
    license_number: 'DRV001', license_state: 'TX',
    active: true, synced_at: '2024-01-01T00:00:00Z',
    latest_status: {
      hos_event_code: 'DS_D', location_state: 'TX',
      location_lat: 29.76, location_lon: -95.36,
      vehicle_vin: '1HTMKAAR3BH000001', daily_hours_driven: 4.5,
      daily_hours_on_duty: 5.0, eta: '', synced_at: '2024-01-01T00:00:00Z',
    },
  },
]

const RTL_DRIVER_DETAIL = {
  ...RTL_DRIVERS[0],
  latest_status: RTL_DRIVERS[0].latest_status,
}

const RTL_TRUCKS = [
  {
    id: 1, rtl_id: 'rtl-trk-001', company_id: 'comp-1',
    name: 'ELD-100', vin: '1HTMKAAR3BH000001', year: '2022',
    make: 'International', model: 'LT', plate_number: 'TX001',
    eld_serial_number: 'SN001', active: true, synced_at: '2024-01-01T00:00:00Z',
    latest_status: {
      speed: 62.5, odometer: 150000, lat: 29.76, lon: -95.36,
      calculated_location: 'Houston, TX', timestamp: '2024-01-01T12:00:00Z',
      vin: '1HTMKAAR3BH000001', synced_at: '2024-01-01T12:00:00Z',
    },
  },
]

const RTL_TRUCK_DETAIL = { ...RTL_TRUCKS[0] }

const RTL_IFTA = [
  {
    id: 1, rtl_id: 'ifta-001', company_id: 'comp-1',
    type_id: 'IftaReport', status_id: 'READY',
    time_submitted: '2024-04-01T00:00:00Z', time_generated: '2024-04-01T01:00:00Z',
    url: 'https://example.com/ifta-001.pdf', csv_url: 'https://example.com/ifta-001.csv',
    from_date: '2024-01-01', to_date: '2024-03-31',
    vehicle_vin: '1HTMKAAR3BH000001', vehicle_id: 'rtl-trk-001', vehicle_name: 'ELD-100',
    synced_at: '2024-04-01T01:00:00Z',
  },
]

const TRAILER_DETAIL = {
  ...TRAILERS[0],
  width: 8.5, height: 13.5, plate_state: 9, plate_state_name: 'Texas',
  annual_inspection_file: null, registration_file: null, agreement_file: null,
  purchase_date: null, purchase_cost: 0, loss_payee: '',
  owner: null, owner_name: null, carrier: 1, carrier_name: 'Jobee Express LLC',
  carrier_start_date: '2023-01-01', carrier_end_date: null, carrier_end_reason: '',
  maintenance_records: [],
}

/**
 * Intercepts all /api/v1/ requests.
 * Throws on any unmocked endpoint to catch missing coverage immediately.
 */
async function mockApi(page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const { pathname } = url
    const method = route.request().method()

    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

    if (pathname.endsWith('/version/') && method === 'GET') {
      return json({ version: '6.0' })
    }
    if (pathname.endsWith('/auth/login/') && method === 'POST') {
      return json({ access: mockJWT(), refresh: 'test-refresh-token' })
    }
    if (pathname.endsWith('/auth/refresh/') && method === 'POST') {
      return json({ access: mockJWT() })
    }
    if (pathname.endsWith('/accounts/') && method === 'GET') return json(ACCOUNTS)
    if (pathname.endsWith('/categories/') && method === 'GET') return json([])
    if (pathname.endsWith('/category-types/') && method === 'GET') return json([])
    if (pathname.endsWith('/records/') && method === 'GET') return json(RECORDS)
    if (/\/records\/\d+\/$/.test(pathname) && method === 'GET') return json(RECORD_DETAIL)
    if (pathname.endsWith('/driver-invoices/') && method === 'GET') return json(DRIVER_INVOICES)
    if (/\/driver-invoices\/\d+\/$/.test(pathname) && method === 'GET') return json(DRIVER_INVOICE_DETAIL)
    if (pathname.endsWith('/fleet/trailer-types/')) return json(TRAILER_TYPES)
    if (pathname.endsWith('/fleet/truck-types/')) return json(TRUCK_TYPES)
    if (pathname.endsWith('/fleet/cards/')) return json([])
    if (/\/fleet\/(makes|engine-types|cabin-types|transmission-types|tire-sizes|owners|loss-payees)\/$/.test(pathname)) return json([])
    if (pathname.endsWith('/fleet/trucks/options/')) return json(TRUCKS)
    if (pathname.endsWith('/fleet/trucks/') && method === 'GET') return json(TRUCKS)
    if (/\/fleet\/trucks\/\d+\/$/.test(pathname) && method === 'GET') return json(TRUCK_DETAIL)
    if (pathname.endsWith('/brokers/options/')) return json(BROKERS.map((b) => ({ id: b.id, label: b.name })))
    if (pathname.endsWith('/brokers/status-search/') && method === 'GET') return json(BROKER_STATUS_RESULTS)
    if (pathname.endsWith('/brokers/search/')) return json(BROKERS)
    if (/\/brokers\/\d+\/contacts\/$/.test(pathname)) return json(BROKER_DETAIL.contacts)
    if (/\/brokers\/\d+\/$/.test(pathname) && method === 'GET') return json(BROKER_DETAIL)
    if (pathname.endsWith('/brokers/') && method === 'GET') return json(BROKERS)
    if (pathname.endsWith('/fleet/trailers/options/')) return json(TRAILERS)
    if (pathname.endsWith('/fleet/trailers/') && method === 'GET') return json(TRAILERS)
    if (/\/fleet\/trailers\/\d+\/$/.test(pathname) && method === 'GET') return json(TRAILER_DETAIL)
    if (pathname.endsWith('/carriers/')) return json(CARRIERS)
    if (pathname.endsWith('/locations/states/')) return json(STATES)
    if (pathname.endsWith('/locations/cities/') && method === 'GET') return json({ count: 2, results: CITIES, next: null, previous: null })
    if (/\/locations\/cities\/\d+\/$/.test(pathname) && method === 'GET') return json(CITY_DETAIL)
    if (/\/locations\/cities\/\d+\/toggle-status\/$/.test(pathname) && method === 'POST') return json({ id: 1, active: false })
    if (pathname.endsWith('/users/options/') && method === 'GET') return json(USERS.map((u) => ({ id: u.id, label: u.full_name, full_name: u.full_name })))
    if (pathname.endsWith('/users/positions/') && method === 'GET') return json([])
    if (pathname.endsWith('/users/settings/config/') && method === 'GET') return json(SYSTEM_CONFIG)
    if (pathname.endsWith('/users/settings/config/') && method === 'PATCH') return json(SYSTEM_CONFIG)
    if (pathname.endsWith('/users/settings/display-options/') && method === 'GET') return json(DISPLAY_OPTIONS)
    if (pathname.endsWith('/users/settings/display-options/') && method === 'PATCH') return json(DISPLAY_OPTIONS)
    if (/\/users\/\d+\/$/.test(pathname) && method === 'GET') return json(USER_DETAIL)
    if (pathname.endsWith('/users/') && method === 'GET') return json(USERS)
    // Integrations — RTL / ELD (must come before generic /drivers/ checks)
    if (pathname.endsWith('/integrations/rtl/fetch-and-sync/') && method === 'POST') return json({ synced: { drivers: 3, trucks: 2, driver_statuses: 3, truck_statuses: 2 } })
    if (pathname.endsWith('/integrations/rtl/drivers/') && method === 'GET') return json(RTL_DRIVERS)
    if (/\/integrations\/rtl\/drivers\/\d+\/$/.test(pathname) && method === 'GET') return json(RTL_DRIVER_DETAIL)
    if (pathname.endsWith('/integrations/rtl/trucks/') && method === 'GET') return json(RTL_TRUCKS)
    if (/\/integrations\/rtl\/trucks\/\d+\/$/.test(pathname) && method === 'GET') return json(RTL_TRUCK_DETAIL)
    if (pathname.endsWith('/integrations/rtl/ifta/') && method === 'GET') return json(RTL_IFTA)
    if (/\/integrations\/rtl\/ifta\/\d+\/$/.test(pathname) && method === 'GET') return json(RTL_IFTA[0])
    if (pathname.endsWith('/integrations/ifta-reports/') && method === 'GET') return json([])
    if (pathname.endsWith('/drivers/types/')) return json(DRIVER_TYPES)
    if (pathname.endsWith('/drivers/options/')) return json(DRIVERS)
    if (pathname.endsWith('/drivers/') && method === 'GET') return json(DRIVERS)
    if (/\/drivers\/\d+\/last-vehicle\/$/.test(pathname) && method === 'GET') return json(DRIVER_LAST_VEHICLE)
    if (/\/drivers\/\d+\/$/.test(pathname) && method === 'GET') return json(DRIVER_DETAIL)
    if (pathname.endsWith('/loads/send-driver-info/') && method === 'POST') return json({ detail: 'Driver information sent successfully.' })
    if (/\/loads\/\d+\/broker-contacts\/$/.test(pathname) && method === 'GET') return json(LOAD_BROKER_CONTACTS)
    if (/\/loads\/\d+\/set-rating\/$/.test(pathname) && method === 'POST') return json({})
    if (/\/loads\/\d+\/set-status\/$/.test(pathname) && method === 'POST') return json({ id: 1, status: 3 })
    if (/\/loads\/\d+\/files\/[^/]+\/$/.test(pathname)) return json({})
    if (pathname.endsWith('/loads/bulk-delete/') && method === 'POST') return json({ deleted: 1 })
    if (/\/loads\/\d+\/$/.test(pathname) && method === 'DELETE') return route.fulfill({ status: 204 })
    if (pathname.endsWith('/loads/') && method === 'GET') return json({ results: [], count: 0 })
    if (pathname.endsWith('/loads/cities/search/')) return json([])
    if (pathname.endsWith('/brokers/search/')) return json([])
    if (pathname.endsWith('/brokers/business/search/')) return json([])
    // Dispatch
    if (pathname.endsWith('/dispatch/dispatchers/')) return json(DISPATCHERS)
    if (pathname.endsWith('/dispatch/work/') && method === 'GET') return json(DISPATCH_WORK)
    if (/\/dispatch\/work\/\d+\/$/.test(pathname) && method === 'GET') return json(DISPATCH_WORK[0])
    if (pathname.endsWith('/dispatch/invoices/percent/') && method === 'GET') return json(PERCENT_INVOICES)
    if (/\/dispatch\/invoices\/percent\/\d+\/$/.test(pathname) && method === 'GET') return json(PERCENT_INVOICE_DETAIL)
    if (/\/dispatch\/invoices\/percent\/\d+\/amount\/$/.test(pathname)) return json({ amount: '125.00' })
    if (pathname.endsWith('/dispatch/invoices/hour/') && method === 'GET') return json(HOUR_INVOICES)
    if (/\/dispatch\/invoices\/hour\/\d+\/$/.test(pathname) && method === 'GET') return json(HOUR_INVOICE_DETAIL)
    if (/\/dispatch\/invoices\/hour\/\d+\/amount\/$/.test(pathname)) return json({ amount: '80.00' })

    throw new Error(`Unmocked API call: ${method} ${pathname}${url.search}`)
  })
}

/**
 * Injects a valid JWT directly into localStorage before page load.
 * Used by tests that need auth but are NOT testing the login flow itself.
 */
async function withAuth(page) {
  await mockApi(page)
  const token = mockJWT()
  await page.addInitScript((t) => {
    localStorage.setItem('access_token', t)
    localStorage.setItem('refresh_token', 'mock-refresh')
  }, token)
}

/**
 * Performs login through the form UI (tests the login flow itself).
 * Labels have no htmlFor — use CSS type selectors.
 */
async function loginViaForm(page) {
  await mockApi(page)
  await page.goto('/login')
  await page.locator('input[type="text"]').fill('testuser')
  await page.locator('input[type="password"]').fill('testpass')
  await page.getByRole('button', { name: /login/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
}

// ── Auth ──────────────────────────────────────────────────────────────────────

test('unauthenticated user is redirected to /login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('login page shows username and password fields', async ({ page }) => {
  await mockApi(page)
  await page.goto('/login')
  await expect(page.locator('input[type="text"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.getByRole('button', { name: /login/i })).toBeEnabled()
})

test('successful login redirects away from /login', async ({ page }) => {
  await loginViaForm(page)
  await expect(page).not.toHaveURL(/\/login/)
})

// ── Loads list ────────────────────────────────────────────────────────────────

test('loads page is reachable after auth', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await expect(page).toHaveURL(/\/loads/)
})

// ── New load form ─────────────────────────────────────────────────────────────

test('new load form: weight defaults to 42000', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads/create')
  await expect(page.locator('input[value="42000"]')).toBeVisible()
})

test('new load form: Weight (lbs) label shows required asterisk', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads/create')
  await expect(page.locator('label', { hasText: 'Weight (lbs)' })).toContainText('*')
})

test('new load form: Trailer Type label shows required asterisk', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads/create')
  await expect(page.locator('label', { hasText: 'Trailer Type' })).toContainText('*')
})

test('new load form: trailer types render with short_name in parentheses', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads/create')
  // options inside a closed <select> are never "visible" — assert presence instead
  await expect(page.locator('option', { hasText: 'Van (V)' })).toHaveCount(1)
  await expect(page.locator('option', { hasText: 'Reefer (R)' })).toHaveCount(1)
  await expect(page.locator('option', { hasText: 'Flatbed (F)' })).toHaveCount(1)
})

test('new load form: Trailer Type select starts with empty placeholder', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads/create')
  const trailerSelect = page.locator('select').filter({
    has: page.locator('option', { hasText: 'Van (V)' }),
  })
  await expect(trailerSelect).toHaveValue('')
})

test('new load form: submit button reads "Create Load"', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads/create')
  await expect(page.getByRole('button', { name: /create load/i })).toBeVisible()
})

test('new load form: dispatcher label is visible', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads/create')
  await expect(page.locator('label').filter({ hasText: /^dispatcher$/i })).toBeVisible()
})

test('new load form: all 4 file slot labels are visible', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads/create')
  await expect(page.getByText(/rate confirmation/i)).toBeVisible()
  await expect(page.getByText(/^pod$/i)).toBeVisible()
  await expect(page.getByText(/lumper file/i)).toBeVisible()
  await expect(page.getByText(/detention file/i)).toBeVisible()
})

test('new load form: renders 4 file inputs', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads/create')
  const fileInputs = page.locator('input[type="file"]')
  await expect(fileInputs).toHaveCount(4)
})

// ── Drivers ─────────────────────────────────────────────────────────────────

test('drivers list renders a driver returned by the API', async ({ page }) => {
  await withAuth(page)
  await page.goto('/drivers')
  await expect(page.getByRole('link', { name: 'John Doe' })).toBeVisible()
})

test('driver detail renders sections and resolves carrier/state names', async ({ page }) => {
  await withAuth(page)
  await page.goto('/drivers/1')
  await expect(page.getByRole('heading', { name: 'John Doe' })).toBeVisible()
  // carrier id 1 resolved via /carriers/, state id 9 via /locations/states/
  await expect(page.getByText('Jobee Express LLC')).toBeVisible()
  await expect(page.getByText('Texas (TX)')).toBeVisible()
})

test('new driver form: First Name label shows required asterisk', async ({ page }) => {
  await withAuth(page)
  await page.goto('/drivers/create')
  await expect(page.locator('label', { hasText: 'First Name' })).toContainText('*')
})

test('new driver form: driver types render in the type select', async ({ page }) => {
  await withAuth(page)
  await page.goto('/drivers/create')
  await expect(page.locator('option', { hasText: 'Company Driver' })).toHaveCount(1)
  await expect(page.locator('option', { hasText: 'Owner Operator' })).toHaveCount(1)
})

test('new driver form: submit button reads "Create Driver"', async ({ page }) => {
  await withAuth(page)
  await page.goto('/drivers/create')
  await expect(page.getByRole('button', { name: /create driver/i })).toBeVisible()
})

// ── Trucks ──────────────────────────────────────────────────────────────────

test('trucks list renders a truck returned by the API', async ({ page }) => {
  await withAuth(page)
  await page.goto('/fleet/trucks')
  await expect(page.getByRole('link', { name: 'T-100' })).toBeVisible()
})

test('truck detail renders header and resolves type name', async ({ page }) => {
  await withAuth(page)
  await page.goto('/fleet/trucks/1')
  await expect(page.getByRole('heading', { name: /Truck T-100/i })).toBeVisible()
  await expect(page.getByText('Sleeper')).toBeVisible()
})

test('truck detail shows the Files section with the legacy-parity leased slot', async ({ page }) => {
  await withAuth(page)
  await page.goto('/fleet/trucks/1')
  await expect(page.getByRole('cell', { name: 'Leased Agreement' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'AVI' })).toBeVisible()
})

test('new truck form: Number label shows required asterisk', async ({ page }) => {
  await withAuth(page)
  await page.goto('/fleet/trucks/create')
  // anchor to avoid also matching "Serial Number"
  await expect(page.locator('label').filter({ hasText: /^Number/ })).toContainText('*')
})

test('new truck form: submit button reads "Create Truck"', async ({ page }) => {
  await withAuth(page)
  await page.goto('/fleet/trucks/create')
  await expect(page.getByRole('button', { name: /create truck/i })).toBeVisible()
})

// ── Trailers ─────────────────────────────────────────────────────────────────

test('trailers list renders a trailer returned by the API', async ({ page }) => {
  await withAuth(page)
  await page.goto('/fleet/trailers')
  await expect(page.getByRole('link', { name: 'TRL-100' })).toBeVisible()
})

test('trailer detail renders header and resolves type name', async ({ page }) => {
  await withAuth(page)
  await page.goto('/fleet/trailers/1')
  await expect(page.getByRole('heading', { name: /Trailer TRL-100/i })).toBeVisible()
  await expect(page.getByText('53ft Dry Van')).toBeVisible()
})

test('trailer detail shows Files section with 3 document slots (no Photo)', async ({ page }) => {
  await withAuth(page)
  await page.goto('/fleet/trailers/1')
  await expect(page.getByRole('cell', { name: 'Annual Inspection' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Registration' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Agreement' })).toBeVisible()
})

test('new trailer form: Number label shows required asterisk', async ({ page }) => {
  await withAuth(page)
  await page.goto('/fleet/trailers/create')
  await expect(page.locator('label').filter({ hasText: /^Number/ })).toContainText('*')
})

test('new trailer form: submit button reads "Create Trailer"', async ({ page }) => {
  await withAuth(page)
  await page.goto('/fleet/trailers/create')
  await expect(page.getByRole('button', { name: /create trailer/i })).toBeVisible()
})

// ── Brokers ──────────────────────────────────────────────────────────────────

test('brokers list renders a broker returned by the API', async ({ page }) => {
  await withAuth(page)
  await page.goto('/brokers')
  await expect(page.getByRole('link', { name: 'Sunrise Freight LLC' })).toBeVisible()
})

test('broker detail renders name, MC and carrier', async ({ page }) => {
  await withAuth(page)
  await page.goto('/brokers/1')
  await expect(page.getByRole('heading', { name: /Sunrise Freight LLC/i })).toBeVisible()
  await expect(page.getByText('MC001')).toBeVisible()
  await expect(page.getByText('Jobee Express LLC')).toBeVisible()
})

test('broker detail shows Contacts section with contact name', async ({ page }) => {
  await withAuth(page)
  await page.goto('/brokers/1')
  await expect(page.getByText('John Smith')).toBeVisible()
  await expect(page.getByText('john@sunrise.com')).toBeVisible()
  // confirmed badge is a span inside a td
  await expect(page.locator('td > span.badge', { hasText: 'Confirmed' })).toBeVisible()
})

test('new broker form: MC label shows required asterisk', async ({ page }) => {
  await withAuth(page)
  await page.goto('/brokers/create')
  await expect(page.locator('label').filter({ hasText: /^MC/ })).toContainText('*')
})

test('new broker form: submit button reads "Create Broker"', async ({ page }) => {
  await withAuth(page)
  await page.goto('/brokers/create')
  await expect(page.getByRole('button', { name: /create broker/i })).toBeVisible()
})

// ── Accounting: Records ───────────────────────────────────────────────────────

test('records list renders a record returned by the API', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/records')
  await expect(page.getByText('90010')).toBeVisible()
  await expect(page.getByText('Freight payment')).toBeVisible()
})

test('record detail renders heading with record id and account code', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/records/1')
  await expect(page.getByRole('heading', { name: /Record #1/i })).toBeVisible()
  await expect(page.getByText('90010')).toBeVisible()
})

test('new record form has "New Record" heading and Create button', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/records/create')
  await expect(page.getByText('New Record')).toBeVisible()
  await expect(page.getByRole('button', { name: /create record/i })).toBeVisible()
})

test('new record form: account options render from the API', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/records/create')
  await expect(page.locator('option', { hasText: '90010 – Rate' })).toHaveCount(1)
  await expect(page.locator('option', { hasText: '80030 – Fuel' })).toHaveCount(1)
})

// ── Accounting: Driver Invoices ───────────────────────────────────────────────

test('driver invoices list renders an invoice returned by the API', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/invoices/drivers')
  await expect(page.getByRole('link', { name: '#101' })).toBeVisible()
  await expect(page.getByText('John Doe')).toBeVisible()
})

test('driver invoice detail renders heading with invoice number and status', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/invoices/drivers/1')
  await expect(page.getByRole('heading', { name: /Driver Invoice #101/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /close invoice/i })).toBeVisible()
})

// ── Dispatch: Work Sessions ───────────────────────────────────────────────────

test('dispatch calendar renders a work session', async ({ page }) => {
  await withAuth(page)
  await page.goto('/dispatch/calendar')
  await expect(page.getByText('Morning shift')).toBeVisible()
  await expect(page.getByText('Lilian Hernandez')).toBeVisible()
})

test('dispatch my-calendar renders heading', async ({ page }) => {
  await withAuth(page)
  await page.goto('/dispatch/my-calendar')
  await expect(page.getByText('My Work Sessions')).toBeVisible()
})

test('dispatch calendar shows Done badge for finished session', async ({ page }) => {
  await withAuth(page)
  await page.goto('/dispatch/calendar')
  await expect(page.getByText('Done')).toBeVisible()
})

test('new work session form has Create Session button', async ({ page }) => {
  await withAuth(page)
  await page.goto('/dispatch/work/create')
  await expect(page.getByRole('button', { name: 'Create Session' })).toBeVisible()
})

test('new work session form renders dispatcher options', async ({ page }) => {
  await withAuth(page)
  await page.goto('/dispatch/work/create')
  await expect(page.locator('option', { hasText: 'Lilian Hernandez' })).toHaveCount(1)
})

// ── Dispatch: Percent Invoices ────────────────────────────────────────────────

test('percent invoices list renders an invoice', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/invoices/dispatchers-percent')
  await expect(page.getByRole('link', { name: '#201' })).toBeVisible()
  await expect(page.getByText('Lilian Hernandez')).toBeVisible()
})

test('percent invoice detail renders heading and computed amount', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/invoices/dispatchers-percent/1')
  await expect(page.getByText(/Percent Invoice #201/)).toBeVisible()
  await expect(page.getByText('$125')).toBeVisible()
})

test('new percent invoice form has Create Invoice button', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/invoices/dispatchers-percent/create')
  await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeVisible()
})

// ── Dispatch: Hour Invoices ───────────────────────────────────────────────────

test('hour invoices list renders an invoice', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/invoices/dispatchers-hour')
  await expect(page.getByRole('link', { name: '#301' })).toBeVisible()
  await expect(page.getByText('Pedro Cancino')).toBeVisible()
})

test('hour invoice detail renders heading and rate', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/invoices/dispatchers-hour/1')
  await expect(page.getByText(/Hour Invoice #301/)).toBeVisible()
  await expect(page.getByText('$10.00/h')).toBeVisible()
})

test('new hour invoice form has Create Invoice button', async ({ page }) => {
  await withAuth(page)
  await page.goto('/accounting/invoices/dispatchers-hour/create')
  await expect(page.getByRole('button', { name: 'Create Invoice' })).toBeVisible()
})

// ── Settings: Cities ──────────────────────────────────────────────────────────

test('cities list renders city rows returned by the API', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/cities')
  await expect(page.getByRole('link', { name: 'Charlotte' })).toBeVisible()
  await expect(page.getByText('28201')).toBeVisible()
})

test('cities list shows Create City button', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/cities')
  await expect(page.getByRole('link', { name: /Create City/i })).toBeVisible()
})

test('city detail renders name and state', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/cities/1')
  await expect(page.getByRole('heading', { name: /Charlotte, NC 28201/i })).toBeVisible()
  await expect(page.getByText(/North Carolina \(NC\)/)).toBeVisible()
})

test('city detail shows timezone', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/cities/1')
  await expect(page.getByText('America/New_York')).toBeVisible()
})

test('new city form has Create City button', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/cities/create')
  await expect(page.getByRole('button', { name: /Create City/i })).toBeVisible()
})

test('new city form: Name label shows required asterisk', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/cities/create')
  await expect(page.locator('label').filter({ hasText: /Name/ }).first()).toContainText('*')
})

test('new city form: state options render in the select', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/cities/create')
  await expect(page.locator('option', { hasText: 'Texas (TX)' })).toHaveCount(1)
  await expect(page.locator('option', { hasText: 'Alabama (AL)' })).toHaveCount(1)
})

// ── Settings: Users / System ─────────────────────────────────────────────────

test('users list renders a user returned by the API', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/users')
  await expect(page.getByRole('link', { name: 'Lilian Hernandez' })).toBeVisible()
  await expect(page.getByText('lilian@example.com')).toBeVisible()
})

test('user detail renders heading and dispatcher type', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/users/1')
  await expect(page.getByRole('heading', { name: 'Lilian Hernandez' })).toBeVisible()
  await expect(page.getByText('By Percent')).toBeVisible()
})

test('new user form has Create User button', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/users/create')
  await expect(page.getByRole('button', { name: /Create User/i })).toBeVisible()
})

test('new user form: Username label shows required asterisk', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/users/create')
  await expect(page.locator('label').filter({ hasText: /^Username/ })).toContainText('*')
})

test('system settings page renders invoice counters and display options', async ({ page }) => {
  await withAuth(page)
  await page.goto('/settings/system')
  await expect(page.getByRole('heading', { name: /System Settings/i })).toBeVisible()
  await expect(page.locator('input[value="number,VIN"]')).toBeVisible()
})

// ── RTL / ELD ─────────────────────────────────────────────────────────────────

const ELD_LOAD_BASE = {
  id: 99, number: 'LD-ELD-01', status: 2, payment: '1500.00',
  pickup_city_display: 'Dallas (TX)', pickup_city_zip: '75201',
  dropoff_city_display: 'Houston (TX)', dropoff_city_zip: '77001',
  broker: 1, broker_name: 'Test Broker', broker_contacts: null,
  broker_denied: false, broker_buy_status: '1', broker_debtor_buy_status: '',
  carrier_name: 'Jobee Express', dispatcher: 1, dispatcher_name: 'Admin',
  driver: 4, driver_name: 'John Doe', driver_code: '0001', driver_photo: null,
  driver_rtl_event_code: 'DS_D', driver_rtl_id: 42, driver_rtl_has_violations: false,
  team_driver: null, team_driver_name: null,
  truck: 1, truck_number: 'T100',
  trailer: 1, trailer_number: 'TR100', trailer_type_short_name: 'V',
  load_trailer_type_short_name: 'V', trailer_type: 1,
  rate_file: null, bill_file: null, lumper_file: null, detention_file: null,
  assignment_complete: true, ready_to_execute: false, execute: false,
  shipper_rating: 0, receiver_rating: 0,
  is_drop: false, drop_place: null, days_in_drop: 0,
  invoiced: false, paid: false, created_at: '2025-01-01T00:00:00Z',
}

async function withEldLoad(page, loadOverrides = {}) {
  await withAuth(page)
  const ts = Date.now()
  const load = {
    ...ELD_LOAD_BASE,
    pickup_date: new Date(ts - 2 * 3600 * 1000).toISOString(),
    dropoff_date: new Date(ts + 6 * 3600 * 1000).toISOString(),
    ...loadOverrides,
  }
  await page.route('**/api/v1/loads/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/loads/') && route.request().method() === 'GET') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ results: [load], count: 1 }),
      })
    }
    return route.continue()
  })
}

test('RTL page renders drivers tab by default with HOS status', async ({ page }) => {
  await withAuth(page)
  await page.goto('/rtl')
  await expect(page.getByText('Mike Driver')).toBeVisible()
  await expect(page.getByText('Driving')).toBeVisible()
})

test('RTL page switches to trucks tab and shows speed', async ({ page }) => {
  await withAuth(page)
  await page.goto('/rtl')
  await page.getByRole('button', { name: /trucks/i }).click()
  await expect(page.getByText('ELD-100')).toBeVisible()
  await expect(page.getByText('63 mph')).toBeVisible()
})

test('RTL driver detail renders name and HOS event code', async ({ page }) => {
  await withAuth(page)
  await page.goto('/rtl/drivers/1')
  await expect(page.getByRole('heading', { name: /Mike Driver/i })).toBeVisible()
  await expect(page.getByText('Driving')).toBeVisible()
})

test('RTL truck detail renders truck name and GPS status', async ({ page }) => {
  await withAuth(page)
  await page.goto('/rtl/trucks/1')
  await expect(page.getByRole('heading', { name: /ELD-100/i })).toBeVisible()
  await expect(page.getByText('63 mph')).toBeVisible()
  await expect(page.getByText('Houston, TX')).toBeVisible()
})

test('IFTA page renders report list with status badge', async ({ page }) => {
  await withAuth(page)
  await page.goto('/rtl/ifta')
  await expect(page.getByRole('heading', { name: /IFTA Reports/i })).toBeVisible()
  await expect(page.getByText('ELD-100')).toBeVisible()
  await expect(page.getByText('READY')).toBeVisible()
})

// ── ELD badge in loads list ────────────────────────────────────────────────────

test('ELD badge renders as a link to RTL driver detail page', async ({ page }) => {
  await withEldLoad(page)
  await page.goto('/loads')
  const badge = page.getByText('Driving')
  await expect(badge).toBeVisible()
  await expect(badge).toHaveAttribute('href', '/integrations/rtl/drivers/42')
})

test('ELD badge shows danger class when driver has HOS violations', async ({ page }) => {
  await withEldLoad(page, { driver_rtl_has_violations: true })
  await page.goto('/loads')
  const badge = page.getByText('Driving')
  await expect(badge).toBeVisible()
  await expect(badge).toHaveClass(/bg-danger/)
})

test('ELD badge shows success class for Driving status when no violations', async ({ page }) => {
  await withEldLoad(page)
  await page.goto('/loads')
  const badge = page.getByText('Driving')
  await expect(badge).toHaveClass(/bg-success/)
})

// ── Driver Info Modal ─────────────────────────────────────────────────────────

test('Driver info button opens Send driver information modal', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /driver info/i }).click()
  await expect(page.getByText('Send driver information')).toBeVisible()
})

test('Driver info modal populates carrier and driver dropdowns', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /driver info/i }).click()
  // Wait for async data to load then verify options are attached to the DOM
  await expect(page.locator('option', { hasText: 'Jobee Express LLC' })).toHaveCount(1)
  await expect(page.locator('option', { hasText: 'John Doe' })).toHaveCount(1)
})

test('Driver info modal: selecting driver loads trucks and trailers', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /driver info/i }).click()
  const modal = page.locator('.modal-content')
  await expect(modal.locator('option', { hasText: 'John Doe' })).toHaveCount(1)
  await modal.locator('select').nth(1).selectOption({ label: 'John Doe' })
  await expect(modal.locator('option', { hasText: 'T-100' })).toHaveCount(1)
  await expect(modal.locator('option', { hasText: 'TR-200' })).toHaveCount(1)
})

test('Driver info modal: In reply to is disabled', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /driver info/i }).click()
  const modal = page.locator('.modal-content')
  await expect(modal.locator('select').last()).toBeDisabled()
})

test('Driver info modal: Send shows success message', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /driver info/i }).click()
  const modal = page.locator('.modal-content')
  await expect(modal.locator('option', { hasText: 'Jobee Express LLC' })).toHaveCount(1)
  await modal.locator('select').nth(0).selectOption({ index: 1 })
  await modal.locator('select').nth(1).selectOption({ label: 'John Doe' })
  await expect(modal.locator('option', { hasText: 'T-100' })).toHaveCount(1)
  await modal.locator('input[type="email"]').fill('broker@test.com')
  await page.getByRole('button', { name: /^send$/i }).click()
  await expect(page.getByText(/sent successfully/i)).toBeVisible()
})

test('Driver info modal: Close button dismisses the modal', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /driver info/i }).click()
  await expect(page.getByText('Send driver information')).toBeVisible()
  await page.getByRole('button', { name: /close/i }).click()
  await expect(page.getByText('Send driver information')).not.toBeVisible()
})

// ── Brokers Status Modal ───────────────────────────────────────────────────────

test('Brokers status button opens Find broker modal', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /brokers status/i }).click()
  const modal = page.locator('.modal-content')
  await expect(modal.getByText('Find broker')).toBeVisible()
})

test('Brokers status modal: has search input and Search button', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /brokers status/i }).click()
  const modal = page.locator('.modal-content')
  await expect(modal.locator('input[placeholder*="Search"]')).toBeVisible()
  await expect(modal.getByRole('button', { name: /^search$/i })).toBeVisible()
})

test('Brokers status modal: Search button disabled when input is empty', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /brokers status/i }).click()
  const modal = page.locator('.modal-content')
  await expect(modal.getByRole('button', { name: /^search$/i })).toBeDisabled()
})

test('Brokers status modal: shows broker results after search', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /brokers status/i }).click()
  const modal = page.locator('.modal-content')
  await modal.locator('input[placeholder*="Search"]').fill('Sunrise')
  await modal.getByRole('button', { name: /^search$/i }).click()
  await expect(modal.getByText('Sunrise Freight LLC')).toBeVisible()
  await expect(modal.getByText('Denied Carrier Inc')).toBeVisible()
})

test('Brokers status modal: shows debtor buy status in results', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /brokers status/i }).click()
  const modal = page.locator('.modal-content')
  await modal.locator('input[placeholder*="Search"]').fill('freight')
  await modal.getByRole('button', { name: /^search$/i }).click()
  await expect(modal.getByText('Approved For Purchases')).toBeVisible()
  await expect(modal.getByText('No Buy - Denied For Purchases')).toBeVisible()
})

test('Brokers status modal: shows last load number in results', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /brokers status/i }).click()
  const modal = page.locator('.modal-content')
  await modal.locator('input[placeholder*="Search"]').fill('freight')
  await modal.getByRole('button', { name: /^search$/i }).click()
  await expect(modal.getByText('#LD-00042')).toBeVisible()
})

test('Brokers status modal: Close button dismisses the modal', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.getByRole('button', { name: /brokers status/i }).click()
  const modal = page.locator('.modal-content')
  await expect(modal.getByText('Find broker')).toBeVisible()
  await modal.getByRole('button', { name: /^close$/i }).click()
  await expect(page.getByText('Find broker')).not.toBeVisible()
})

// ── Update location button ────────────────────────────────────────────────────

test('Update location button is visible in the loads toolbar', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await expect(page.getByRole('button', { name: /update location/i })).toBeVisible()
})

test('Update location: clicking the button triggers a confirm dialog', async ({ page }) => {
  await withAuth(page)
  let dialogText = ''
  page.once('dialog', (dialog) => {
    dialogText = dialog.message()
    dialog.dismiss()  // dismiss to avoid blocking
  })
  await page.goto('/loads')
  await page.getByRole('button', { name: /update location/i }).click()
  await expect.poll(() => dialogText).toMatch(/update driver/i)
})

// ── List all loads / List only my loads toggle ─────────────────────────────────

test('scope toggle button shows "List all loads" when auto-scoped to own dispatcher', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await expect(page.locator('button.btn-link', { hasText: 'List all loads' })).toBeVisible()
})

test('scope toggle: clicking "List all loads" changes heading to All Loads', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.locator('button.btn-link', { hasText: 'List all loads' }).click()
  await expect(page.getByRole('heading', { name: /All Loads/i })).toBeVisible()
})

test('scope toggle: clicking "List all loads" changes button label to "List only my loads"', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  const toggleBtn = page.locator('button.btn-link').filter({ hasText: /List (all|only my) loads/i })
  await expect(toggleBtn).toHaveText(/List all loads/i)
  await toggleBtn.click()
  await expect(toggleBtn).toHaveText(/List only my loads/i)
})

test('scope toggle: clicking "List only my loads" restores My Loads heading', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  const toggleBtn = page.locator('button.btn-link').filter({ hasText: /List (all|only my) loads/i })
  await expect(toggleBtn).toHaveText(/List all loads/i)
  await toggleBtn.click()
  await expect(toggleBtn).toHaveText(/List only my loads/i)
  await toggleBtn.click()
  await expect(page.getByRole('heading', { name: /My Loads/i })).toBeVisible()
})

test('scope toggle: clicking "List only my loads" changes button label back to "List all loads"', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  const toggleBtn = page.locator('button.btn-link').filter({ hasText: /List (all|only my) loads/i })
  await expect(toggleBtn).toHaveText(/List all loads/i)
  await toggleBtn.click()
  await expect(toggleBtn).toHaveText(/List only my loads/i)
  await toggleBtn.click()
  await expect(toggleBtn).toHaveText(/List all loads/i)
})

test('scope toggle: dispatcher trigger shows "All dispatchers" after clicking "List all loads"', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  await page.locator('button.btn-link', { hasText: 'List all loads' }).click()
  await expect(page.locator('.dispatcher-select-trigger', { hasText: /All dispatchers/i })).toBeVisible()
})

// ── Load delete buttons ────────────────────────────────────────────────────────

test('loads page: individual delete button is present in action column', async ({ page }) => {
  await withAdminAuth(page)
  await mockApi(page)
  // Load a page with one row
  await page.route('**/api/v1/loads/**', async (route) => {
    const method = route.request().method()
    const url = new URL(route.request().url())
    const { pathname } = url
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (pathname.endsWith('/loads/') && method === 'GET') {
      return json({ results: [{ id: 1, number: 'LD-001', payment: 1500, status: 1, broker: 1, broker_name: 'Acme', pickup_city_display: 'Dallas (TX)', dropoff_city_display: 'Austin (TX)', pickup_date: '2026-06-01T10:00:00Z', dropoff_date: '2026-06-02T10:00:00Z', assignment_complete: false, ready_to_execute: false, execute: false, invoiced: false, paid: false }], count: 1 })
    }
    return route.continue()
  })
  await page.goto('/loads')
  await expect(page.getByTitle('Delete')).toBeVisible()
})

test('loads page: broker info button opens selected contacts modal', async ({ page }) => {
  await withAuth(page)
  await mockApi(page)
  await page.route('**/api/v1/loads/**', async (route) => {
    const method = route.request().method()
    const url = new URL(route.request().url())
    const { pathname } = url
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (/\/loads\/\d+\/broker-contacts\/$/.test(pathname) && method === 'GET') {
      return json(LOAD_BROKER_CONTACTS)
    }
    if (pathname.endsWith('/loads/') && method === 'GET') {
      return json({
        results: [{
          id: 1,
          number: 'LD-001',
          payment: 1500,
          status: 1,
          broker: 1,
          broker_name: 'Sunrise',
          broker_contacts: '1',
          pickup_city_display: 'Dallas (TX)',
          dropoff_city_display: 'Austin (TX)',
          pickup_date: '2026-06-01T10:00:00Z',
          dropoff_date: '2026-06-02T10:00:00Z',
          assignment_complete: false,
          ready_to_execute: false,
          execute: false,
          invoiced: false,
          paid: false,
        }],
        count: 1,
      })
    }
    return route.continue()
  })

  await page.goto('/loads')
  await page.getByRole('button', { name: /sunrise/i }).click()
  await expect(page.getByRole('heading', { name: /sunrise/i })).toBeVisible()
  await expect(page.getByText("Load's contacts")).toBeVisible()
  await expect(page.getByText('John Smith')).toBeVisible()
})

test('loads page: bulk Delete All button is disabled with no selection', async ({ page }) => {
  await withAdminAuth(page)
  await mockApi(page)
  await page.goto('/loads')
  const bulkBtn = page.getByRole('button', { name: /Delete All/i })
  await expect(bulkBtn).toBeDisabled()
})

test('loads page: bulk-delete endpoint is called after checking a row and confirming', async ({ page }) => {
  await withAdminAuth(page)

  let bulkDeleteCalled = false
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const { pathname } = url
    const method = route.request().method()
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

    if (pathname.endsWith('/version/') && method === 'GET') return json({ version: '6.0' })
    if (pathname.endsWith('/auth/login/') && method === 'POST') return json({ access: mockJWT(), refresh: 'test-refresh-token' })
    if (pathname.endsWith('/auth/refresh/') && method === 'POST') return json({ access: mockJWT() })
    if (pathname.endsWith('/users/options/') && method === 'GET') return json([])
    if (pathname.endsWith('/carriers/options/') && method === 'GET') return json([])
    if (pathname.endsWith('/loads/send-driver-info/') && method === 'POST') return json({})
    if (/\/loads\/\d+\/set-rating\/$/.test(pathname) && method === 'POST') return json({})
    if (/\/loads\/\d+\/set-status\/$/.test(pathname) && method === 'POST') return json({ id: 1, status: 3 })
    if (/\/loads\/\d+\/files\/[^/]+\/$/.test(pathname)) return json({})
    if (/\/loads\/\d+\/$/.test(pathname) && method === 'DELETE') return route.fulfill({ status: 204 })
    if (pathname.endsWith('/loads/bulk-delete/') && method === 'POST') {
      bulkDeleteCalled = true
      return json({ deleted: 1 })
    }
    if (pathname.endsWith('/loads/') && method === 'GET') {
      return json({ results: [{ id: 1, number: 'LD-002', payment: 0, status: 1, broker: 1, broker_name: 'Test', pickup_city_display: 'X', dropoff_city_display: 'Y', pickup_date: '2026-06-01T10:00:00Z', dropoff_date: '2026-06-02T10:00:00Z', assignment_complete: false, ready_to_execute: false, execute: false, invoiced: false, paid: false }], count: 1 })
    }
    if (pathname.endsWith('/loads/cities/search/')) return json([])
    if (pathname.endsWith('/brokers/options/')) return json([])
    if (pathname.endsWith('/brokers/search/')) return json([])
    if (pathname.endsWith('/brokers/business/search/')) return json([])
    return route.continue()
  })

  page.on('dialog', (dialog) => dialog.accept())

  await page.goto('/loads')
  await page.getByRole('checkbox', { name: /Select load LD-002/i }).click()
  await page.getByRole('button', { name: /Delete All/i }).click()

  await page.waitForTimeout(500)
  expect(bulkDeleteCalled).toBe(true)
})

// ── Navbar active state ────────────────────────────────────────────────────────

test('navbar: Loads link is marked active on the loads page', async ({ page }) => {
  await withAuth(page)
  await mockApi(page)
  await page.goto('/loads')
  const loadsLink = page.getByRole('link', { name: /Loads/i }).first()
  await expect(loadsLink).toHaveClass(/\bactive\b/)
})

test('navbar: no dropdown toggle is marked active on the loads page', async ({ page }) => {
  await withAuth(page)
  await page.goto('/loads')
  // None of the dropdown toggles should be active when browsing loads
  const activeDropdowns = page.locator('.navbar-custom .nav-link.dropdown-toggle.active')
  await expect(activeDropdowns).toHaveCount(0)
})
