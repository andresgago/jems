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
    if (pathname.endsWith('/users/') && method === 'GET') return json([])
    if (pathname.endsWith('/drivers/types/')) return json(DRIVER_TYPES)
    if (pathname.endsWith('/drivers/options/')) return json(DRIVERS)
    if (pathname.endsWith('/drivers/') && method === 'GET') return json(DRIVERS)
    if (/\/drivers\/\d+\/$/.test(pathname) && method === 'GET') return json(DRIVER_DETAIL)
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
