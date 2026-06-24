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
    if (pathname.endsWith('/fleet/trailer-types/')) return json(TRAILER_TYPES)
    if (pathname.endsWith('/fleet/truck-types/')) return json(TRUCK_TYPES)
    if (pathname.endsWith('/fleet/cards/')) return json([])
    if (/\/fleet\/(makes|engine-types|cabin-types|transmission-types|tire-sizes|owners|loss-payees)\/$/.test(pathname)) return json([])
    if (pathname.endsWith('/fleet/trucks/') && method === 'GET') return json(TRUCKS)
    if (/\/fleet\/trucks\/\d+\/$/.test(pathname) && method === 'GET') return json(TRUCK_DETAIL)
    if (pathname.endsWith('/carriers/')) return json(CARRIERS)
    if (pathname.endsWith('/locations/states/')) return json(STATES)
    if (pathname.endsWith('/users/') && method === 'GET') return json([])
    if (pathname.endsWith('/drivers/types/')) return json(DRIVER_TYPES)
    if (pathname.endsWith('/drivers/') && method === 'GET') return json(DRIVERS)
    if (/\/drivers\/\d+\/$/.test(pathname) && method === 'GET') return json(DRIVER_DETAIL)
    if (pathname.endsWith('/loads/') && method === 'GET') return json({ results: [], count: 0 })
    if (pathname.endsWith('/loads/cities/search/')) return json([])
    if (pathname.endsWith('/brokers/search/')) return json([])
    if (pathname.endsWith('/brokers/business/search/')) return json([])

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
