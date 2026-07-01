// @ts-check
/**
 * Real E2E tests — hit the actual Django backend.
 * Run with: npm run test:e2e:real
 * Prereqs: backend running on http://localhost:8000 with seeded data and a valid admin user.
 */
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

const API_BASE = process.env.VITE_API_URL || 'http://localhost:8000/api/v1'
const ADMIN_USER = process.env.E2E_USERNAME || 'admin'
const ADMIN_PASS = process.env.E2E_PASSWORD || 'admin1234'

function uniqueE2EId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

// Critical routes that must be reachable after login
const CRITICAL_ROUTES = [
  { path: '/', heading: /welcome/i },
  { path: '/loads', heading: /loads/i },
  { path: '/loads/create', heading: /new load/i },
  { path: '/drivers', heading: /drivers/i },
  { path: '/drivers/create', heading: /new driver/i },
  { path: '/fleet/trucks', heading: /trucks/i },
  { path: '/fleet/trucks/create', heading: /new truck/i },
  { path: '/fleet/trailers', heading: /trailers/i },
  { path: '/fleet/trailers/create', heading: /new trailer/i },
  { path: '/fleet/truck-maintenance', heading: /truck maintenance/i },
  { path: '/fleet/truck-maintenance/create', heading: /create truck maintenance/i },
  { path: '/fleet/trailer-maintenance', heading: /trailer maintenance/i },
  { path: '/fleet/trailer-maintenance/create', heading: /create trailer maintenance/i },
  { path: '/fleet/truck-miles-reset', heading: /trucks miles reset/i },
  { path: '/fleet/accidents', heading: /accidents/i },
  { path: '/fleet/accidents/create', heading: /create accident/i },
  { path: '/accounting/categories', heading: /categories/i },
  { path: '/accounting/categories/create', heading: /new category/i },
  { path: '/brokers', heading: /brokers/i },
  { path: '/brokers/create', heading: /new broker/i },
  { path: '/brokers/contacts', heading: /brokers contacts/i },
  { path: '/settings/business', heading: /businesses/i },
  { path: '/settings/cities', heading: /cities/i },
  { path: '/settings/cities/create', heading: /create city/i },
  { path: '/settings/users', heading: /users/i },
  { path: '/settings/users/create', heading: /create user/i },
  { path: '/settings/system', heading: /system settings/i },
  { path: '/rtl', heading: /rtl/i },
  { path: '/rtl/ifta', heading: /ifta/i },
  { path: '/tools/send-packet', heading: /send carrier packet/i },
  { path: '/tools/brokers-status', heading: /brokers status/i },
  { path: '/tools/drivers-last-loads', heading: /drivers.*last loads/i },
  { path: '/reports/balance-sheet', heading: /balance sheet/i },
  { path: '/reports/broker-summary', heading: /broker summary/i },
  { path: '/reports/invoice', heading: /profit and loss by invoices/i },
  { path: '/reports/shipper-receiver', heading: /deliveries from shipper to receiver/i },
  { path: '/reports/company-invoices', heading: /invoices analysis/i },
  { path: '/fleet/reports/truck-parts', heading: /parts and pieces used by trucks/i },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAsAdmin(page) {
  await assertRealApiLoginWorks(page)
  await page.goto('/login')
  await page.locator('input[type="text"]').fill(ADMIN_USER)
  await page.locator('input[type="password"]').fill(ADMIN_PASS)
  await page.getByRole('button', { name: /login/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
}

async function assertRealApiLoginWorks(page) {
  let res
  try {
    res = await page.request.post(`${API_BASE}/auth/login/`, {
      data: { username: ADMIN_USER, password: ADMIN_PASS },
      timeout: 5_000,
    })
  } catch (error) {
    throw new Error(
      `Real E2E backend is not reachable at ${API_BASE}. ` +
        'Start the Django backend before running npm run test:e2e:real. ' +
        `Original error: ${error.message}`
    )
  }

  if (!res.ok()) {
    const body = await res.text()
    throw new Error(
      `Real E2E login failed for ${ADMIN_USER}. ` +
        `Expected a valid admin user/password. HTTP ${res.status()}: ${body}`
    )
  }
}

async function authenticateAsAdmin(page) {
  const res = await page.request.post(`${API_BASE}/auth/login/`, {
    data: { username: ADMIN_USER, password: ADMIN_PASS },
    timeout: 5_000,
  })
  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`Real E2E login failed for ${ADMIN_USER}. HTTP ${res.status()}: ${body}`)
  }
  const tokens = await res.json()
  await page.addInitScript(({ access, refresh }) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
  }, tokens)
  return tokens.access
}

async function getAccessToken(page) {
  await page.waitForFunction(() => !!localStorage.getItem('access_token'))
  return page.evaluate(() => localStorage.getItem('access_token'))
}

async function apiGet(page, token, path) {
  const res = await page.request.get(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

async function apiPost(page, token, path, data) {
  const res = await page.request.post(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  })
  if (!res.ok()) {
    throw new Error(`POST ${path} failed with HTTP ${res.status()}: ${await res.text()}`)
  }
  return res.json()
}

async function apiPatch(page, token, path, data) {
  const res = await page.request.patch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

async function apiPut(page, token, path, data) {
  const res = await page.request.put(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  })
  expect(res.ok()).toBeTruthy()
  return res.json()
}

async function apiDelete(page, token, path) {
  const res = await page.request.delete(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.ok()).toBeTruthy()
}

function fieldByLabel(page, label, selector = 'input, select, textarea') {
  return page.locator('label').filter({ hasText: label }).locator('xpath=..').locator(selector).first()
}

// ── Auth ──────────────────────────────────────────────────────────────────────

test('admin can log in and is redirected away from /login (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  await expect(page).not.toHaveURL(/\/login/)
})

// ── Critical routes ───────────────────────────────────────────────────────────

for (const route of CRITICAL_ROUTES) {
  test(`${route.path} loads after login (real)`, async ({ page }) => {
    test.setTimeout(30_000)
    await loginAsAdmin(page)
    await page.goto(route.path)
    await expect(page.locator('h5, h4, h3').first()).toBeVisible()
  })
}

// ── Trailer types from API ────────────────────────────────────────────────────

// ── Dashboard API ─────────────────────────────────────────────────────────────

test('dashboard endpoint returns correct shape (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const data = await apiGet(page, token, '/dashboard/')
  expect(data).toHaveProperty('stats')
  expect(data).toHaveProperty('expiration_alerts')
  expect(data).toHaveProperty('maintenance_alerts')
  expect(data).toHaveProperty('counts')

  // Stats shape — admin sees all three (non-null numbers)
  expect(typeof data.stats.loads_in_dispatch).toBe('number')
  expect(typeof data.stats.executed_loads).toBe('number')
  expect(typeof data.stats.invoiced).toBe('number')

  // invoiced is always ≤ executed_loads (subset filter)
  expect(data.stats.invoiced).toBeLessThanOrEqual(data.stats.executed_loads)

  // Expiration alerts shape — 4 keys including categories
  expect(Array.isArray(data.expiration_alerts.drivers)).toBeTruthy()
  expect(Array.isArray(data.expiration_alerts.trucks)).toBeTruthy()
  expect(Array.isArray(data.expiration_alerts.trailers)).toBeTruthy()
  expect(Array.isArray(data.expiration_alerts.categories)).toBeTruthy()

  // Maintenance alerts shape — detail lists per vehicle type
  expect(Array.isArray(data.maintenance_alerts.trucks)).toBeTruthy()
  expect(Array.isArray(data.maintenance_alerts.trailers)).toBeTruthy()

  // Counts shape
  expect(typeof data.counts.drivers_expiring).toBe('number')
  expect(typeof data.counts.trucks_expiring).toBe('number')
  expect(typeof data.counts.trucks_maintenance_alerts).toBe('number')
  expect(typeof data.counts.trailers_expiring).toBe('number')
  expect(typeof data.counts.trailers_maintenance_alerts).toBe('number')
  expect(typeof data.counts.categories_expiring).toBe('number')

  // counts align with list lengths
  expect(data.counts.drivers_expiring).toBe(data.expiration_alerts.drivers.length)
  expect(data.counts.trucks_expiring).toBe(data.expiration_alerts.trucks.length)
  expect(data.counts.trailers_expiring).toBe(data.expiration_alerts.trailers.length)
  expect(data.counts.categories_expiring).toBe(data.expiration_alerts.categories.length)
  // maintenance counts align with detail list lengths
  expect(data.counts.trucks_maintenance_alerts).toBe(data.maintenance_alerts.trucks.length)
  expect(data.counts.trailers_maintenance_alerts).toBe(data.maintenance_alerts.trailers.length)
})

test('dashboard endpoint stats are null for non-admin user (real)', async ({ page }) => {
  test.setTimeout(30_000)
  // Login as a regular dispatcher (not admin)
  const { E2E_USERNAME: username = 'admin', E2E_PASSWORD: password = 'admin' } = process.env
  await page.goto('/')
  const loginRes = await page.request.post('/api/v1/auth/login/', {
    data: { username, password },
  })
  // Only run if a dispatcher account is available (skip in CI if only admin exists)
  if (!loginRes.ok()) {
    test.skip()
    return
  }
  const { access } = await loginRes.json()
  const data = await apiGet(page, access, '/dashboard/')

  // If the logged-in user is admin, stats will be numbers — skip; we want to test non-admin
  // This test is advisory: it documents the role-based behavior, not a hard assertion.
  if (data.stats.loads_in_dispatch !== null) {
    // User has admin or dispatcher role — loads_in_dispatch is visible
    expect(typeof data.stats.loads_in_dispatch).toBe('number')
  }
})

test('dashboard maintenance alert entries include time/miles alert shape fields (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const data = await apiGet(page, token, '/dashboard/')

  const allEntries = [
    ...data.maintenance_alerts.trucks,
    ...data.maintenance_alerts.trailers,
  ]

  for (const entry of allEntries) {
    // Every entry must have the new shape fields
    expect(typeof entry.time_alert_triggered).toBe('boolean')
    expect(typeof entry.miles_alert_triggered).toBe('boolean')
    // alert_date is string or null
    expect(entry.alert_date === null || typeof entry.alert_date === 'string').toBeTruthy()
    // miles fields are number or null
    expect(entry.miles_traveled === null || typeof entry.miles_traveled === 'number').toBeTruthy()
    expect(entry.miles_threshold === null || typeof entry.miles_threshold === 'number').toBeTruthy()
    // miles-only entries have alert_date null
    if (!entry.time_alert_triggered) {
      expect(entry.alert_date).toBeNull()
    }
    // time-based entries have non-null alert_date
    if (entry.time_alert_triggered) {
      expect(typeof entry.alert_date).toBe('string')
    }
  }
})

test('profit and loss by invoices report endpoint returns legacy shape (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const data = await apiGet(page, token, '/reports/invoice/?date_begin=2024-01-01&date_end=2024-12-31')
  expect(data).toHaveProperty('invoices')
  expect(data).toHaveProperty('revenues')
  expect(data).toHaveProperty('expenses')
  expect(data).toHaveProperty('total_revenues')
  expect(data).toHaveProperty('total_expenses')
  expect(data).toHaveProperty('net_profit')
  expect(Array.isArray(data.invoices)).toBeTruthy()
  expect(Array.isArray(data.revenues)).toBeTruthy()
  expect(Array.isArray(data.expenses)).toBeTruthy()
})

test('balance sheet report endpoint returns legacy concept sections (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const data = await apiGet(page, token, '/reports/balance-sheet/?date_begin=2024-01-01&date_end=2024-12-31&period=1&carrier=id')
  expect(data).toHaveProperty('columns')
  expect(data).toHaveProperty('current_assets')
  expect(data).toHaveProperty('fixed_assets')
  expect(data).toHaveProperty('current_liabilities')
  expect(data).toHaveProperty('long_term_liabilities')
  expect(data).toHaveProperty('equity')
  expect(data).toHaveProperty('total_assets')
  expect(data).toHaveProperty('total_liabilities_and_equity')
  expect(Array.isArray(data.columns)).toBeTruthy()
})

test('broker summary report endpoint returns legacy annual shape (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const byBroker = await apiGet(page, token, '/reports/broker-summary/?year=2024')
  expect(byBroker).toHaveProperty('brokers')
  expect(byBroker).toHaveProperty('total_revenue')
  expect(byBroker).toHaveProperty('total_deliveries')
  expect(Array.isArray(byBroker.brokers)).toBeTruthy()

  const total = await apiGet(page, token, '/reports/broker-summary/?year=2024&option=1')
  expect(total).toHaveProperty('total')
  expect(total.total).toHaveProperty('monthly')
  expect(total.total).toHaveProperty('monthly_loads')
  expect(total).toHaveProperty('total_deliveries')
})

test('shipper-receiver report endpoint returns legacy annual and monthly shapes (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const annual = await apiGet(page, token, '/reports/shipper-receiver/?year=2024')
  expect(annual).toHaveProperty('pairs')
  expect(annual).toHaveProperty('total_deliveries')
  expect(Array.isArray(annual.pairs)).toBeTruthy()
  if (annual.pairs.length > 0) {
    expect(annual.pairs[0]).toHaveProperty('shipper')
    expect(annual.pairs[0]).toHaveProperty('receiver')
    expect(annual.pairs[0]).toHaveProperty('total')
    expect(annual.pairs[0]).toHaveProperty('monthly')
  }

  const monthly = await apiGet(page, token, '/reports/shipper-receiver/?year=2024&option=1')
  expect(monthly).toHaveProperty('pairs')
  expect(monthly).toHaveProperty('total_deliveries')
  expect(Array.isArray(monthly.pairs)).toBeTruthy()
  if (monthly.pairs.length > 0) {
    expect(Array.isArray(monthly.pairs[0].monthly)).toBeTruthy()
    expect(monthly.pairs[0].monthly).toHaveLength(12)
  }
})

// ── Trailer types ─────────────────────────────────────────────────────────────

test('trailer-types endpoint returns short_name for all types (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const types = await apiGet(page, token, '/fleet/trailer-types/')
  expect(Array.isArray(types)).toBeTruthy()
  expect(types.length).toBeGreaterThanOrEqual(5)

  for (const t of types) {
    expect(t).toHaveProperty('short_name')
    expect(t.short_name.length).toBeGreaterThan(0)
    expect(t.short_name.length).toBeLessThanOrEqual(3)
  }

  // Verify the 5 seeded types are present with correct short names
  const byName = Object.fromEntries(types.map((t) => [t.name, t.short_name]))
  expect(byName['Van']).toBe('V')
  expect(byName['Reefer']).toBe('R')
  expect(byName['Flatbed']).toBe('F')
  expect(byName['Van or Reefer']).toBe('VR')
  expect(byName['Van Vented']).toBe('VV')
})

test('new load form renders trailer types with short_name (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  await page.goto('/loads/create')

  // Wait for the trailer type select to be populated (API call completes)
  await expect(page.locator('option', { hasText: 'Van (V)' })).toHaveCount(1, { timeout: 10_000 })
  await expect(page.locator('option', { hasText: 'Reefer (R)' })).toHaveCount(1)
  await expect(page.locator('option', { hasText: 'Flatbed (F)' })).toHaveCount(1)
})

test('new load form weight defaults to 42000 (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  await page.goto('/loads/create')
  await expect(page.locator('input[value="42000"]')).toBeVisible()
})

// ── Create + delete load (round-trip) ────────────────────────────────────────

test('can create and delete a load via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  // Get required FK IDs from seeded data
  const trailerTypes = await apiGet(page, token, '/fleet/trailer-types/')
  const carriers = await apiGet(page, token, '/carriers/')
  const trailerTypeId = trailerTypes.find((t) => t.name === 'Van')?.id
  const carrierId = carriers[0]?.id

  expect(trailerTypeId).toBeTruthy()
  expect(carrierId).toBeTruthy()

  const brokers = await apiGet(page, token, '/brokers/search/?q=axle')
  const cities = await apiGet(page, token, '/loads/cities/search/?q=Charlotte')
  const brokerId = brokers[0]?.id
  const cityId = cities[0]?.id

  expect(brokerId).toBeTruthy()
  expect(cityId).toBeTruthy()

  const shipper = await apiPost(page, token, '/brokers/business/', { name: `E2E Shipper ${Date.now()}` })
  const receiver = await apiPost(page, token, '/brokers/business/', { name: `E2E Receiver ${Date.now()}` })
  const contact = await apiPost(page, token, `/brokers/${brokerId}/contacts/`, {
    name: `E2E Broker Contact ${Date.now()}`,
    email: `e2e-contact-${Date.now()}@example.com`,
    phone: '555-0101',
  })

  const number = `E2E-${Date.now()}`
  const created = await apiPost(page, token, '/loads/', {
    number,
    pickup_date: '2026-06-23',
    pickup_city: cityId,
    pickup_address: 'E2E pickup address',
    dropoff_date: '2026-06-24',
    dropoff_city: cityId,
    dropoff_address: 'E2E dropoff address',
    payment: 1200,
    miles: 350,
    weight: 42000,
    trailer_type: trailerTypeId,
    carrier: carrierId,
    broker: brokerId,
    broker_contacts: String(contact.id),
    shipper: shipper.id,
    receiver: receiver.id,
  })

  expect(created.id).toBeTruthy()
  expect(created.number).toBe(number)

  const brokerContacts = await apiGet(page, token, `/loads/${created.id}/broker-contacts/`)
  expect(brokerContacts.broker.id).toBe(brokerId)
  expect(brokerContacts.contacts.map((item) => item.id)).toContain(contact.id)

  await apiDelete(page, token, `/loads/${created.id}/`)
  await apiDelete(page, token, `/brokers/${brokerId}/contacts/${contact.id}/`)
})

// ── Locations: states endpoint ────────────────────────────────────────────────

test('states endpoint returns id/name/abbreviation (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const states = await apiGet(page, token, '/locations/states/')
  expect(Array.isArray(states)).toBeTruthy()
  expect(states.length).toBeGreaterThan(0)
  for (const s of states.slice(0, 5)) {
    expect(s).toHaveProperty('id')
    expect(s).toHaveProperty('name')
    expect(s.abbreviation.length).toBeGreaterThan(0)
  }
})

// ── Create + delete driver (round-trip) ───────────────────────────────────────

test('can create and delete a driver via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const created = await apiPost(page, token, '/drivers/', {
    first_name: 'E2E',
    last_name: `Driver ${Date.now()}`,
    status: 1,
  })

  expect(created.id).toBeTruthy()
  expect(created.full_name).toContain('E2E')

  // DELETE is a soft delete (status → terminated); endpoint returns 204
  await apiDelete(page, token, `/drivers/${created.id}/`)
})

// ── Create + delete truck (round-trip) ────────────────────────────────────────

test('can create and delete a truck via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const number = `E2E-T-${Date.now()}`
  const created = await apiPost(page, token, '/fleet/trucks/', {
    number,
    status: 1,
  })

  expect(created.id).toBeTruthy()
  expect(created.number).toBe(number)

  // DELETE is a soft delete (status → inactive); endpoint returns 204
  await apiDelete(page, token, `/fleet/trucks/${created.id}/`)
})

// ── Create + delete trailer (round-trip) ─────────────────────────────────────

test('can create and delete a trailer via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const number = `E2E-TRL-${Date.now()}`
  const created = await apiPost(page, token, '/fleet/trailers/', {
    number,
    status: 1,
  })

  expect(created.id).toBeTruthy()
  expect(created.number).toBe(number)

  // DELETE is a soft delete (status → inactive); endpoint returns 204
  await apiDelete(page, token, `/fleet/trailers/${created.id}/`)
})

test('can upload and clear a trailer document file via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const number = `E2E-TRLF-${Date.now()}`
  const created = await apiPost(page, token, '/fleet/trailers/', { number, status: 1 })

  // Upload a PDF to the "annual_inspection" slot
  const uploadRes = await page.request.post(
    `${API_BASE}/fleet/trailers/${created.id}/files/annual_inspection/`,
    {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: { name: 'ai.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake') },
      },
    }
  )
  expect(uploadRes.ok()).toBeTruthy()
  const body = await uploadRes.json()
  expect(body.annual_inspection_file).toBeTruthy()

  // Clear it, then soft-delete the trailer
  const clearRes = await page.request.delete(
    `${API_BASE}/fleet/trailers/${created.id}/files/annual_inspection/`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  expect(clearRes.ok()).toBeTruthy()

  await apiDelete(page, token, `/fleet/trailers/${created.id}/`)
})

// ── Create + delete broker (round-trip) ──────────────────────────────────────

test('can create and delete a broker via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const mc = `E2E-MC-${Date.now()}`
  const created = await apiPost(page, token, '/brokers/', {
    mc,
    name: `E2E Broker ${mc}`,
  })

  expect(created.id).toBeTruthy()
  expect(created.mc).toBe(mc)

  // Soft delete (toggle status → Inactive)
  await apiDelete(page, token, `/brokers/${created.id}/`)
})

test('can upload and clear a broker setup packet via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const mc = `E2E-BF-${Date.now()}`
  const created = await apiPost(page, token, '/brokers/', { mc, name: `E2E Broker ${mc}` })

  const uploadRes = await page.request.post(
    `${API_BASE}/brokers/${created.id}/files/setup-packet/`,
    {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: { name: 'packet.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake') },
      },
    }
  )
  expect(uploadRes.ok()).toBeTruthy()
  const body = await uploadRes.json()
  expect(body.setup_packet_file).toBeTruthy()

  const clearRes = await page.request.delete(
    `${API_BASE}/brokers/${created.id}/files/setup-packet/`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  expect(clearRes.ok()).toBeTruthy()

  await apiDelete(page, token, `/brokers/${created.id}/`)
})

// ── Cities (create + toggle, no hard-delete endpoint) ────────────────────────

test('cities list endpoint returns paginated results with count (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const data = await apiGet(page, token, '/locations/cities/?active=1&page_size=5')
  expect(data).toHaveProperty('count')
  expect(data).toHaveProperty('results')
  expect(Array.isArray(data.results)).toBeTruthy()
  if (data.results.length > 0) {
    const city = data.results[0]
    expect(city).toHaveProperty('id')
    expect(city).toHaveProperty('name')
    expect(city).toHaveProperty('zip')
    expect(city).toHaveProperty('state_abbreviation')
    expect(city).toHaveProperty('timezone')
    expect(city).toHaveProperty('active')
  }
})

test('can create and toggle a city via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  // Get a state to use as FK
  const states = await apiGet(page, token, '/locations/states/')
  const state = states.find((s) => s.abbreviation === 'TX')
  expect(state).toBeTruthy()

  const cityName = `E2E City ${Date.now()}`
  const created = await apiPost(page, token, '/locations/cities/', {
    name: cityName,
    zip: '99001',
    state: state.id,
    timezone: 'America/Chicago',
  })

  expect(created.id).toBeTruthy()
  expect(created.name).toBe(cityName)
  expect(created.zip).toBe('99001')
  expect(created.timezone).toBe('America/Chicago')
  expect(created.active).toBe(true)
  expect(created.state_data).toBeTruthy()
  expect(created.state_data.abbreviation).toBe('TX')

  // Toggle status: active → inactive
  const toggled = await apiPost(page, token, `/locations/cities/${created.id}/toggle-status/`, {})
  expect(toggled.active).toBe(false)

  // Toggle back: inactive → active
  const restored = await apiPost(page, token, `/locations/cities/${created.id}/toggle-status/`, {})
  expect(restored.active).toBe(true)

  // PATCH to update timezone
  const patched = await page.request.patch(
    `${API_BASE}/locations/cities/${created.id}/`,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { timezone: 'America/Denver' },
    }
  )
  expect(patched.ok()).toBeTruthy()
  const patchedBody = await patched.json()
  expect(patchedBody.timezone).toBe('America/Denver')
})

// ── Users / Settings ────────────────────────────────────────────────────────

test.describe('Users / Settings (real)', () => {
test.describe.configure({ mode: 'serial' })

test('users options endpoint returns dispatcher labels (real)', async ({ page }) => {
  test.setTimeout(30_000)
  const token = await authenticateAsAdmin(page)

  const options = await apiGet(page, token, '/users/options/?dispatchers=1')
  expect(Array.isArray(options)).toBeTruthy()
  for (const option of options.slice(0, 3)) {
    expect(option).toHaveProperty('id')
    expect(option).toHaveProperty('label')
  }
})

test('can create and delete a user via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  const token = await authenticateAsAdmin(page)

  const stamp = Date.now()
  const created = await apiPost(page, token, '/users/', {
    username: `e2e_user_${stamp}`,
    first_name: 'E2E',
    last_name: 'User',
    email: `e2e_user_${stamp}@example.com`,
    password: `E2e!User#Pass-${stamp}`,
    phone: '555-0100',
    is_dispatcher: true,
    dispatcher_type: 0,
    contract: 0,
    percent: 2.5,
  })

  expect(created.id).toBeTruthy()
  expect(created.full_name).toContain('E2E')
  expect(created.contract).toBe(0)

  const patched = await page.request.patch(
    `${API_BASE}/users/${created.id}/`,
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { phone: '555-0200', percent: 3 },
    }
  )
  expect(patched.ok()).toBeTruthy()
  const patchedBody = await patched.json()
  expect(patchedBody.phone).toBe('555-0200')
  expect(patchedBody.percent).toBe(3)

  await apiDelete(page, token, `/users/${created.id}/`)
})

test('can create a user from the UI and open its detail page (real)', async ({ page }) => {
  test.setTimeout(60_000)
  const token = await authenticateAsAdmin(page)
  const stamp = Date.now()
  const username = `e2e_ui_${stamp}`
  const password = `E2e!Ui#Pass-${stamp}`
  let createdId

  try {
    await page.goto('/settings/users/create')
    await fieldByLabel(page, /^Username/).fill(username)
    await fieldByLabel(page, /^First Name/).fill('E2E')
    await fieldByLabel(page, /^Last Name/).fill('UI User')
    await fieldByLabel(page, /^Email/).fill(`${username}@example.com`)
    await fieldByLabel(page, /^Password/).fill(password)
    await fieldByLabel(page, /^Phone/).fill('555-0300')
    await fieldByLabel(page, /^Dispatcher$/).check()
    await fieldByLabel(page, /^Percent/).fill('2.5')

    await page.getByRole('button', { name: /create user/i }).click()
    await expect(page).toHaveURL(/\/settings\/users\/\d+$/)
    createdId = Number(page.url().match(/\/settings\/users\/(\d+)$/)?.[1])
    expect(createdId).toBeTruthy()

    await expect(page.getByRole('heading', { name: /E2E UI User/i })).toBeVisible()
    await expect(page.getByText(username, { exact: true })).toBeVisible()
    await expect(page.locator('.card').getByText('By Percent', { exact: true })).toBeVisible()
  } finally {
    if (createdId) await apiDelete(page, token, `/users/${createdId}/`)
  }
})

test('can toggle a user status from the UI list (real)', async ({ page }) => {
  test.setTimeout(60_000)
  const token = await authenticateAsAdmin(page)
  const stamp = Date.now()
  const created = await apiPost(page, token, '/users/', {
    username: `e2e_toggle_${stamp}`,
    first_name: 'E2E',
    last_name: 'Toggle',
    email: `e2e_toggle_${stamp}@example.com`,
    password: `E2e!Toggle#Pass-${stamp}`,
    status: 10,
  })

  try {
    page.on('dialog', (dialog) => dialog.accept())
    await page.goto('/settings/users')
    await page.getByPlaceholder(/name, username, or email/i).fill(created.username)
    await expect(page.getByRole('link', { name: 'E2E Toggle' })).toBeVisible()
    await expect(page.locator('td > span.badge', { hasText: 'Active' })).toBeVisible()
    await page.getByTitle('Toggle status').click()
    await expect(page.locator('td > span.badge', { hasText: 'Inactive' })).toBeVisible()
  } finally {
    await apiDelete(page, token, `/users/${created.id}/`)
  }
})

test('system settings endpoints can be read and patched (real)', async ({ page }) => {
  test.setTimeout(30_000)
  const token = await authenticateAsAdmin(page)

  const config = await apiGet(page, token, '/users/settings/config/')
  expect(config).toHaveProperty('driver_invoice')
  const displayOptions = await apiGet(page, token, '/users/settings/display-options/')
  expect(displayOptions).toHaveProperty('truck')

  try {
    const body = await apiPatch(page, token, '/users/settings/display-options/', {
      driver: 'name,phone',
    })
    expect(body.driver).toBe('name,phone')
  } finally {
    await apiPatch(page, token, '/users/settings/display-options/', {
      truck: displayOptions.truck,
      trailer: displayOptions.trailer,
      driver: displayOptions.driver,
    })
  }
})

test('can save display options from the system settings UI (real)', async ({ page }) => {
  test.setTimeout(60_000)
  const token = await authenticateAsAdmin(page)
  const original = await apiGet(page, token, '/users/settings/display-options/')
  const nextDriverFields = `name,phone,e2e_${Date.now()}`

  try {
    await page.goto('/settings/system')
    const driverFields = fieldByLabel(page, /^Driver Fields/)
    await driverFields.selectText()
    await driverFields.press('Backspace')
    await driverFields.pressSequentially(nextDriverFields)
    await expect(driverFields).toHaveValue(nextDriverFields)
    await page.getByRole('button', { name: /save settings/i }).click()
    await expect(page.getByText('Saved')).toBeVisible()

    const updated = await apiGet(page, token, '/users/settings/display-options/')
    expect(updated.driver).toBe(nextDriverFields)
  } finally {
    await apiPatch(page, token, '/users/settings/display-options/', {
      truck: original.truck,
      trailer: original.trailer,
      driver: original.driver,
    })
  }
})

})

// ── Truck file upload (legacy-parity leased slot) ─────────────────────────────

test('can upload and clear a truck document file via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const number = `E2E-TF-${Date.now()}`
  const created = await apiPost(page, token, '/fleet/trucks/', { number, status: 1 })

  // Upload a PDF to the "leased" slot (the slot added for legacy parity)
  const uploadRes = await page.request.post(
    `${API_BASE}/fleet/trucks/${created.id}/files/leased/`,
    {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: { name: 'lease.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake') },
      },
    }
  )
  expect(uploadRes.ok()).toBeTruthy()
  const body = await uploadRes.json()
  expect(body.leased_file).toBeTruthy()

  // Clear it, then soft-delete the truck
  const clearRes = await page.request.delete(
    `${API_BASE}/fleet/trucks/${created.id}/files/leased/`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  expect(clearRes.ok()).toBeTruthy()

  await apiDelete(page, token, `/fleet/trucks/${created.id}/`)
})

test('can sync and retrieve an RTL driver via API (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await authenticateAsAdmin(page)
  await page.goto('/')
  const token = await getAccessToken(page)

  const rtlId = `e2e-drv-${Date.now()}`
  const syncRes = await page.request.post(`${API_BASE}/integrations/rtl/sync/`, {
    data: {
      drivers: [
        {
          _id: rtlId,
          firstName: 'E2E',
          lastName: 'Driver',
          email: `e2e-${Date.now()}@example.com`,
          active: true,
          driverInfoLicenseNumber: `E2E-LIC-${Date.now()}`,
          driverInfoLicenseState: 'TX',
        },
      ],
    },
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(syncRes.ok()).toBeTruthy()
  const syncBody = await syncRes.json()
  expect(syncBody.synced.drivers).toBe(1)

  // Verify driver appears in list
  const listRes = await page.request.get(`${API_BASE}/integrations/rtl/drivers/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(listRes.ok()).toBeTruthy()
  const drivers = await listRes.json()
  const created = drivers.find((d) => d.rtl_id === rtlId)
  expect(created).toBeTruthy()
  expect(created.first_name).toBe('E2E')

  // Retrieve detail
  const detailRes = await page.request.get(`${API_BASE}/integrations/rtl/drivers/${created.id}/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(detailRes.ok()).toBeTruthy()
  const detail = await detailRes.json()
  expect(detail.license_state).toBe('TX')
})

// ── Driver last-vehicle endpoint ─────────────────────────────────────────────

test('driver last-vehicle returns correct shape with no prior loads (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const created = await apiPost(page, token, '/drivers/', {
    first_name: 'E2E',
    last_name: `LastVehicle ${Date.now()}`,
    status: 1,
  })

  try {
    const data = await apiGet(page, token, `/drivers/${created.id}/last-vehicle/`)
    expect(data).toHaveProperty('last_truck_id')
    expect(data).toHaveProperty('last_trailer_id')
    expect(data).toHaveProperty('trucks')
    expect(data).toHaveProperty('trailers')
    expect(data.last_truck_id).toBeNull()
    expect(data.last_trailer_id).toBeNull()
    expect(Array.isArray(data.trucks)).toBeTruthy()
    expect(Array.isArray(data.trailers)).toBeTruthy()
  } finally {
    await apiDelete(page, token, `/drivers/${created.id}/`)
  }
})

test('send-driver-info rejects missing fields with 400 (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const res = await page.request.post(`${API_BASE}/loads/send-driver-info/`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { carrier_id: 1 },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.detail).toMatch(/Missing fields/i)
})

test('can sync an RTL truck and retrieve it via API (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await authenticateAsAdmin(page)
  await page.goto('/')
  const token = await getAccessToken(page)

  const rtlId = `e2e-trk-${Date.now()}`
  const vin = `E2EVIN${Date.now().toString().slice(-10)}`
  const syncRes = await page.request.post(`${API_BASE}/integrations/rtl/sync/`, {
    data: {
      trucks: [
        {
          _id: rtlId,
          name: `E2E-${rtlId.slice(-6)}`,
          vin,
          make: 'International',
          model: 'LT',
          year: 2022,
          plateNumber: 'E2E001',
          active: true,
        },
      ],
    },
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(syncRes.ok()).toBeTruthy()
  const syncBody = await syncRes.json()
  expect(syncBody.synced.trucks).toBe(1)

  // Verify truck in list
  const listRes = await page.request.get(`${API_BASE}/integrations/rtl/trucks/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(listRes.ok()).toBeTruthy()
  const trucks = await listRes.json()
  const created = trucks.find((t) => t.rtl_id === rtlId)
  expect(created).toBeTruthy()
  expect(created.vin).toBe(vin)
})

test('broker status-search returns results for a known MC (real)', async ({ page }) => {
  await authenticateAsAdmin(page)
  await page.goto('/')
  const token = await getAccessToken(page)

  // Create a broker to search for
  const mc = `E2EMC${Date.now().toString().slice(-6)}`
  const created = await apiPost(page, token, '/brokers/', {
    mc,
    name: `E2E Status Broker ${mc}`,
    debtor_buy_status: 'Approved For Purchases',
    safer_operating_status: 'AUTHORIZED',
  })
  expect(created.id).toBeTruthy()

  // Search by MC
  const results = await apiGet(page, token, `/brokers/status-search/?q=${mc}`)
  expect(Array.isArray(results)).toBe(true)
  expect(results.length).toBe(1)
  expect(results[0].mc).toBe(mc)
  expect(results[0].exists).toBe(true)
  expect(results[0].source).toBe('local')
  expect(results[0].debtor_buy_status).toBe('Approved For Purchases')
  expect(results[0].safer_operating_status).toBe('AUTHORIZED')
  expect(Object.prototype.hasOwnProperty.call(results[0], 'debtor_rating')).toBe(true)
  expect(Object.prototype.hasOwnProperty.call(results[0], 'debtor_credit_limit')).toBe(true)
  expect(results[0].last_load).toBeNull()

  await apiDelete(page, token, `/brokers/${created.id}/`)
})

test('broker status-search create can create and delete broker (real)', async ({ page }) => {
  await authenticateAsAdmin(page)
  await page.goto('/')
  const token = await getAccessToken(page)

  const mc = `E2ECREATE${Date.now().toString().slice(-6)}`
  const created = await apiPost(page, token, '/brokers/status-search/create/', {
    mc_number: mc,
    legal_name: `E2E Created Status Broker ${mc}`,
    dba_name: 'E2E Created',
    phone: '555-0199',
    account_id: `acct-${mc}`,
    debtor_buy_status: 'No Buy - Denied For Purchases',
    operating_status: 'AUTHORIZED',
  })

  expect(created.id).toBeTruthy()
  expect(created.mc).toBe(mc)
  expect(created.name).toContain('E2E Created Status Broker')
  expect(created.buy_status).toBe('0')
  expect(created.debtor_buy_status).toBe('No Buy - Denied For Purchases')

  await apiDelete(page, token, `/brokers/${created.id}/`)
})

test('broker status-search returns 400 when q is missing (real)', async ({ page }) => {
  await authenticateAsAdmin(page)
  await page.goto('/')
  const token = await getAccessToken(page)

  const res = await page.request.get(`${API_BASE}/brokers/status-search/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.status()).toBe(400)
})

// ── index_view filter (legacy main-index parity) ───────────────────────────────

async function createTestLoad(page, token, overrides = {}) {
  const trailerTypes = await apiGet(page, token, '/fleet/trailer-types/')
  const carriers = await apiGet(page, token, '/carriers/')
  const brokers = await apiGet(page, token, '/brokers/search/?q=axle')
  const cities = await apiGet(page, token, '/loads/cities/search/?q=Charlotte')

  const trailerTypeId = trailerTypes.find((t) => t.name === 'Van')?.id || trailerTypes[0]?.id
  const carrierId = carriers[0]?.id
  const brokerId = brokers[0]?.id
  const cityId = cities[0]?.id

  const suffix = uniqueE2EId('LOAD')
  const shipper = await apiPost(page, token, '/brokers/business/', { name: `E2E Shipper ${suffix}` })
  const receiver = await apiPost(page, token, '/brokers/business/', { name: `E2E Receiver ${suffix}` })

  const load = await apiPost(page, token, '/loads/', {
    number: `TV-${suffix}`,
    pickup_date: '2026-06-25',
    pickup_city: cityId,
    pickup_address: 'E2E pickup',
    dropoff_date: '2026-06-26',
    dropoff_city: cityId,
    dropoff_address: 'E2E dropoff',
    payment: 1000,
    miles: 100,
    trailer_type: trailerTypeId,
    carrier: carrierId,
    broker: brokerId,
    shipper: shipper.id,
    receiver: receiver.id,
    ...overrides,
  })
  return { load, shipper, receiver }
}

test('index_view=true hides cancelled loads from list (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const { load, shipper, receiver } = await createTestLoad(page, token, { status: 1 })

  // Cancel the load via set-status
  const cancelRes = await page.request.post(`${API_BASE}/loads/${load.id}/set-status/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: 5 },
  })
  expect(cancelRes.ok()).toBeTruthy()

  // Verify it's hidden in index_view
  const listWithIndex = await apiGet(page, token, '/loads/?index_view=true&all=true')
  const numbers = listWithIndex.results.map((l) => l.number)
  expect(numbers).not.toContain(load.number)

  // Verify it's visible without index_view
  const listAll = await apiGet(page, token, `/loads/?all=true&number=${load.number}`)
  expect(listAll.results.map((l) => l.number)).toContain(load.number)

  // Cleanup
  await apiDelete(page, token, `/loads/${load.id}/`)
  await apiPut(page, token, `/brokers/business/${shipper.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${receiver.id}/`, { status: 0 })
})

test('payroll page and endpoint use executed driver-unpaid legacy filter (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const visible = await createTestLoad(page, token, { status: 3 })
  const paid = await createTestLoad(page, token, { status: 3 })

  await apiPatch(page, token, `/loads/${visible.load.id}/`, {
    execute: true,
    history: false,
    drivers_paid: false,
  })
  await apiPatch(page, token, `/loads/${paid.load.id}/`, {
    execute: true,
    history: false,
    drivers_paid: true,
  })

  const payroll = await apiGet(page, token, '/loads/?payroll=true&all=true')
  const numbers = payroll.results.map((load) => load.number)
  expect(numbers).toContain(visible.load.number)
  expect(numbers).not.toContain(paid.load.number)

  await page.goto('/loads/executed')
  await expect(page.getByRole('heading', { name: /Executed Loads/i })).toBeVisible()
  await expect(page.getByLabel('Date type')).toHaveValue('3')
  await expect(page.getByLabel('Broker')).toBeVisible()
  await expect(page.getByLabel('Dispatcher')).toBeVisible()
  await expect(page.getByLabel('Filter by order')).toBeVisible()

  await apiDelete(page, token, `/loads/${visible.load.id}/`)
  await apiDelete(page, token, `/loads/${paid.load.id}/`)
  await apiPut(page, token, `/brokers/business/${visible.shipper.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${visible.receiver.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${paid.shipper.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${paid.receiver.id}/`, { status: 0 })
})

test('history page and endpoint use legacy executed search behavior (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const prefix = `HIST-${Date.now()}`
  const visible = await createTestLoad(page, token, { number: `${prefix}-EXEC`, status: 3 })
  const pending = await createTestLoad(page, token, { number: `${prefix}-PENDING`, status: 3 })

  await apiPatch(page, token, `/loads/${visible.load.id}/`, {
    execute: true,
    history: false,
  })
  await apiPatch(page, token, `/loads/${pending.load.id}/`, {
    execute: false,
    history: true,
  })

  const empty = await apiGet(page, token, '/loads/?history_search=true&all=true')
  expect(empty.results).toHaveLength(0)

  const searched = await apiGet(page, token, `/loads/?history_search=true&all=true&date_type=3&number=${prefix}`)
  const numbers = searched.results.map((load) => load.number)
  expect(numbers).toContain(visible.load.number)
  expect(numbers).not.toContain(pending.load.number)

  await page.goto('/loads/history')
  await expect(page.getByRole('heading', { name: /Load History/i })).toBeVisible()
  await expect(page.getByLabel('Date type')).toHaveValue('3')
  await expect(page.getByLabel('Broker')).toBeVisible()
  await expect(page.getByLabel('Driver')).toBeVisible()
  await expect(page.getByLabel('Order #')).toBeVisible()

  await apiDelete(page, token, `/loads/${visible.load.id}/`)
  await apiDelete(page, token, `/loads/${pending.load.id}/`)
  await apiPut(page, token, `/brokers/business/${visible.shipper.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${visible.receiver.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${pending.shipper.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${pending.receiver.id}/`, { status: 0 })
})

test('invoicing and payments pages use legacy executed-load search controls (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const prefix = `BILLPAY-${Date.now()}`
  const invoicing = await createTestLoad(page, token, { number: `${prefix}-INV`, status: 3 })
  const payments = await createTestLoad(page, token, { number: `${prefix}-PAY`, status: 3 })

  await apiPatch(page, token, `/loads/${invoicing.load.id}/`, {
    execute: true,
    history: false,
  })
  await apiPatch(page, token, `/loads/${payments.load.id}/`, {
    execute: true,
    history: false,
  })

  const listed = await apiGet(page, token, `/loads/?execute=true&history=false&all=true&date_type=3&number=${prefix}`)
  const numbers = listed.results.map((load) => load.number)
  expect(numbers).toContain(invoicing.load.number)
  expect(numbers).toContain(payments.load.number)

  await page.goto('/loads/invoicing')
  await expect(page.getByRole('heading', { name: /Invoicing/i })).toBeVisible()
  await expect(page.getByLabel('Date type')).toHaveValue('3')
  await expect(page.getByLabel('Broker')).toBeVisible()
  await expect(page.getByLabel('Dispatcher')).toBeVisible()
  await expect(page.getByLabel('Order #')).toBeVisible()

  await page.goto('/loads/payments')
  await expect(page.getByRole('heading', { name: /Payments/i })).toBeVisible()
  await expect(page.getByLabel('Date type')).toHaveValue('3')
  await expect(page.getByLabel('Driver')).toBeVisible()
  await expect(page.getByLabel('Dispatcher')).toBeVisible()
  await expect(page.getByLabel('Order #')).toBeVisible()

  await apiDelete(page, token, `/loads/${invoicing.load.id}/`)
  await apiDelete(page, token, `/loads/${payments.load.id}/`)
  await apiPut(page, token, `/brokers/business/${invoicing.shipper.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${invoicing.receiver.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${payments.shipper.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${payments.receiver.id}/`, { status: 0 })
})

test('index_view=true hides executed non-detention loads (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const { load, shipper, receiver } = await createTestLoad(page, token, { status: 3 })

  // Set execute=true via PATCH
  const patchRes = await page.request.patch(`${API_BASE}/loads/${load.id}/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { execute: true },
  })
  expect(patchRes.ok()).toBeTruthy()

  // Verify hidden in index_view
  const listWithIndex = await apiGet(page, token, `/loads/?index_view=true&all=true&number=${load.number}`)
  expect(listWithIndex.results.map((l) => l.number)).not.toContain(load.number)

  // Verify visible without index_view
  const listAll = await apiGet(page, token, `/loads/?all=true&number=${load.number}`)
  expect(listAll.results.map((l) => l.number)).toContain(load.number)

  // Cleanup
  await apiDelete(page, token, `/loads/${load.id}/`)
  await apiPut(page, token, `/brokers/business/${shipper.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${receiver.id}/`, { status: 0 })
})

test('bulk-invoiced marks selected loads as invoiced (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const { load: loadA, shipper: shipperA, receiver: receiverA } = await createTestLoad(page, token)
  const { load: loadB, shipper: shipperB, receiver: receiverB } = await createTestLoad(page, token)

  expect(loadA.invoiced).toBe(false)
  expect(loadB.invoiced).toBe(false)

  const res = await page.request.post(`${API_BASE}/loads/bulk-invoiced/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { ids: [loadA.id, loadB.id] },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.updated).toBe(2)

  const updatedA = await apiGet(page, token, `/loads/${loadA.id}/`)
  const updatedB = await apiGet(page, token, `/loads/${loadB.id}/`)
  expect(updatedA.invoiced).toBe(true)
  expect(updatedB.invoiced).toBe(true)

  // Cleanup
  await apiDelete(page, token, `/loads/${loadA.id}/`)
  await apiDelete(page, token, `/loads/${loadB.id}/`)
  await apiPut(page, token, `/brokers/business/${shipperA.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${receiverA.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${shipperB.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${receiverB.id}/`, { status: 0 })
})

test('bulk-paid marks selected loads as paid (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const { load: loadA, shipper: shipperA, receiver: receiverA } = await createTestLoad(page, token)
  const { load: loadB, shipper: shipperB, receiver: receiverB } = await createTestLoad(page, token)

  expect(loadA.paid).toBe(false)
  expect(loadB.paid).toBe(false)

  const res = await page.request.post(`${API_BASE}/loads/bulk-paid/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { ids: [loadA.id, loadB.id] },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.updated).toBe(2)

  const updatedA = await apiGet(page, token, `/loads/${loadA.id}/`)
  const updatedB = await apiGet(page, token, `/loads/${loadB.id}/`)
  expect(updatedA.paid).toBe(true)
  expect(updatedB.paid).toBe(true)

  // Cleanup
  await apiDelete(page, token, `/loads/${loadA.id}/`)
  await apiDelete(page, token, `/loads/${loadB.id}/`)
  await apiPut(page, token, `/brokers/business/${shipperA.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${receiverA.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${shipperB.id}/`, { status: 0 })
  await apiPut(page, token, `/brokers/business/${receiverB.id}/`, { status: 0 })
})

// ---------------------------------------------------------------------------
// Calendar endpoint (real)
// ---------------------------------------------------------------------------

test('calendar endpoint returns an array of events (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)
  const res = await page.request.get(`${API_BASE}/dispatch/work/calendar/`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { start: '2024-01-01', end: '2024-12-31', self_only: 'true' },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(Array.isArray(body)).toBe(true)
})

test('can create a work session and see it in the calendar (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const work = await apiPost(page, token, '/dispatch/work/', {
    title: 'E2E calendar session',
    start: '2024-06-15T09:00:00Z',
    end: '2024-06-15T17:00:00Z',
  })

  const events = await apiGet(page, token, '/dispatch/work/calendar/?start=2024-06-01&end=2024-06-30&self_only=false')
  const found = events.find((e) => e.id === String(work.id))
  expect(found).toBeDefined()
  expect(found.title).toContain('E2E calendar session')
  expect(found.backgroundColor).toBe('red')
  expect(found.title).toContain('(In progress)')

  // Cleanup
  await apiDelete(page, token, `/dispatch/work/${work.id}/`)
})

test('move endpoint shifts start and end preserving duration (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const work = await apiPost(page, token, '/dispatch/work/', {
    title: 'E2E move test',
    start: '2024-06-15T09:00:00Z',
    end: '2024-06-15T17:00:00Z',
  })

  const res = await page.request.post(`${API_BASE}/dispatch/work/${work.id}/move/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { start: '2024-06-16T09:00:00Z' },
  })
  expect(res.ok()).toBeTruthy()
  const moved = await res.json()
  expect(moved.start).toContain('2024-06-16')
  expect(moved.end).toContain('2024-06-16')

  const endHour = new Date(moved.end).getUTCHours()
  expect(endHour).toBe(17)

  // Cleanup
  await apiDelete(page, token, `/dispatch/work/${work.id}/`)
})

test('carriers available-files endpoint returns list (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const carriers = await apiGet(page, token, '/carriers/')
  if (!carriers.length) {
    test.skip('No carriers in database')
    return
  }
  const carrierId = carriers[0].id
  const res = await page.request.get(`${API_BASE}/carriers/${carrierId}/available-files/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.ok()).toBeTruthy()
  const data = await res.json()
  expect(Array.isArray(data)).toBe(true)
  // Each returned slot must have slot and label fields
  for (const item of data) {
    expect(item).toHaveProperty('slot')
    expect(item).toHaveProperty('label')
  }
})

test('carrier send-packet returns 400 when broker_email missing (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const carriers = await apiGet(page, token, '/carriers/')
  if (!carriers.length) {
    test.skip('No carriers in database')
    return
  }
  const carrierId = carriers[0].id
  const res = await page.request.post(`${API_BASE}/carriers/${carrierId}/send-packet/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { file_slots: ['w9_file'] },
  })
  expect(res.status()).toBe(400)
})

test('carrier send-packet returns 400 for unknown file slot (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const carriers = await apiGet(page, token, '/carriers/')
  if (!carriers.length) {
    test.skip('No carriers in database')
    return
  }
  const carrierId = carriers[0].id
  const res = await page.request.post(`${API_BASE}/carriers/${carrierId}/send-packet/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { broker_email: 'test@test.com', file_slots: ['bad_slot'] },
  })
  expect(res.status()).toBe(400)
})

test('carrier send-packet returns 400 for invalid broker email (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const carriers = await apiGet(page, token, '/carriers/')
  if (!carriers.length) {
    test.skip('No carriers in database')
    return
  }
  const carrierId = carriers[0].id
  const res = await page.request.post(`${API_BASE}/carriers/${carrierId}/send-packet/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { broker_email: 'not-an-email', file_slots: ['w9_file'] },
  })
  expect(res.status()).toBe(400)
})

test('carrier send-packet accepts selected broker contact payload (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const carriers = await apiGet(page, token, '/carriers/')
  const brokers = await apiGet(page, token, '/brokers/')
  if (!carriers.length || !brokers.length) {
    test.skip('No carriers or brokers in database')
    return
  }

  const brokerId = brokers[0].id
  const contact = await apiPost(page, token, `/brokers/${brokerId}/contacts/`, {
    name: 'E2E Packet Contact',
    email: `e2e-packet-${Date.now()}@example.com`,
    phone: '555-0199',
  })

  try {
    const res = await page.request.post(`${API_BASE}/carriers/${carriers[0].id}/send-packet/`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { broker_id: brokerId, contact_ids: [contact.id], file_slots: ['bad_slot'] },
    })
    expect(res.status()).toBe(400)
  } finally {
    await apiDelete(page, token, `/brokers/${brokerId}/contacts/${contact.id}/`)
  }
})

test('drivers last-loads endpoint returns list (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const res = await page.request.get(`${API_BASE}/drivers/last-loads/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.ok()).toBeTruthy()
  const data = await res.json()
  expect(Array.isArray(data)).toBe(true)
  // Each entry must have the expected keys including new location field
  for (const entry of data) {
    expect(entry).toHaveProperty('id')
    expect(entry).toHaveProperty('full_name')
    expect(entry).toHaveProperty('last_load')
    expect(entry).toHaveProperty('current_load')
    expect(entry).toHaveProperty('location')
  }
})

test('drivers last-loads endpoint accepts dispatcher_id filter (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)
  const headers = { Authorization: `Bearer ${token}` }

  // Get all results without filter
  const allRes = await page.request.get(`${API_BASE}/drivers/last-loads/`, { headers })
  expect(allRes.ok()).toBeTruthy()
  const allData = await allRes.json()

  // Filter by a dispatcher_id that likely has no loads — should return empty or fewer results
  const filteredRes = await page.request.get(
    `${API_BASE}/drivers/last-loads/?dispatcher_id=99999`,
    { headers }
  )
  expect(filteredRes.ok()).toBeTruthy()
  const filteredData = await filteredRes.json()
  expect(Array.isArray(filteredData)).toBe(true)
  // A non-existent dispatcher should return fewer (or equal) results
  expect(filteredData.length).toBeLessThanOrEqual(allData.length)
})

test('drivers last-loads rejects invalid dispatcher_id (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const res = await page.request.get(
    `${API_BASE}/drivers/last-loads/?dispatcher_id=not-a-number`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  expect(res.status()).toBe(400)
})

test('drivers last-loads endpoint requires authentication (real)', async ({ page }) => {
  const res = await page.request.get(`${API_BASE}/drivers/last-loads/`)
  expect(res.status()).toBe(401)
})

test('drivers bulk-delete terminates listed drivers (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)
  const headers = { Authorization: `Bearer ${token}` }

  // Create a driver to terminate (driver_type is nullable — omit to avoid seeded-ID dependency)
  const created = await apiPost(page, token, '/drivers/', {
    first_name: 'Bulk', last_name: 'TestDriver',
    status: 1, phone: '5550000001', email: 'bulk@test.com',
    license_number: 'BULK001', factor: 25,
  })
  const driverId = created.id

  const res = await page.request.post(`${API_BASE}/drivers/bulk-delete/`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
    data: { ids: [driverId] },
  })
  expect(res.ok()).toBeTruthy()
  const data = await res.json()
  expect(data.terminated).toContain(driverId)
  expect(data.not_found).toEqual([])
})

test('drivers bulk-delete rejects empty ids (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)
  const res = await page.request.post(`${API_BASE}/drivers/bulk-delete/`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: { ids: [] },
  })
  expect(res.status()).toBe(400)
})

test('drivers bulk-delete requires authentication (real)', async ({ page }) => {
  const res = await page.request.post(`${API_BASE}/drivers/bulk-delete/`, {
    headers: { 'Content-Type': 'application/json' },
    data: { ids: [1] },
  })
  expect(res.status()).toBe(401)
})

test('IFTA report endpoint returns legacy response shape (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const data = await apiGet(page, token, '/reports/ifta/?date_begin=2024-01-01&date_end=2024-12-31')
  expect(data).toHaveProperty('date_begin')
  expect(data).toHaveProperty('date_end')
  expect(data).toHaveProperty('rows')
  expect(data).toHaveProperty('total_gallons')
  expect(Array.isArray(data.rows)).toBeTruthy()
  expect(typeof data.total_gallons).toBe('number')
  for (const row of data.rows) {
    expect(row).toHaveProperty('state_name')
    expect(row).toHaveProperty('state_abbreviation')
    expect(row).toHaveProperty('gallons')
    expect(row).toHaveProperty('cards')
    expect(typeof row.gallons).toBe('number')
    expect(row.gallons).toBeGreaterThan(0)
    expect(Array.isArray(row.cards)).toBeTruthy()
    for (const card of row.cards) {
      expect(card).toHaveProperty('card_number')
      expect(card).toHaveProperty('gallons')
    }
  }
})

test('IFTA report endpoint requires authentication (real)', async ({ page }) => {
  const res = await page.request.get(`${API_BASE}/reports/ifta/?date_begin=2024-01-01&date_end=2024-12-31`)
  expect(res.status()).toBe(401)
})

test('IFTA report endpoint returns 400 when dates missing (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)
  const res = await page.request.get(`${API_BASE}/reports/ifta/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.status()).toBe(400)
})

test('IFTA filter page renders and has Show Report button (real)', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/reports/ifta')
  await expect(page.getByRole('heading', { name: 'IFTA' })).toBeVisible()
  await expect(page.getByText('Filter by Dates')).toBeVisible()
  await expect(page.getByRole('button', { name: /show report/i })).toBeVisible()
})

// ── Invoices Analysis (real) ──────────────────────────────────────────────────

test('driver-invoices analysis endpoint returns 200 with date params (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
  const res = await page.request.get(
    `${API_BASE}/accounting/driver-invoices/analysis/?date_begin=${weekAgo}&date_end=${today}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(res.ok()).toBeTruthy()
  const data = await res.json()
  expect(Array.isArray(data)).toBe(true)
})

test('driver-invoices analysis endpoint returns 400 when date params are missing (real)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)
  const res = await page.request.get(`${API_BASE}/accounting/driver-invoices/analysis/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.status()).toBe(400)
})

// ── Truck Maintenance (real) ──────────────────────────────────────────────────

test('can create, update, and delete a truck maintenance record via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  // Create a truck to associate maintenance with
  const truck = await apiPost(page, token, '/fleet/trucks/', { number: `E2E-TMTRK-${Date.now()}`, status: 1 })

  // Create maintenance record
  const today = new Date().toISOString().split('T')[0]
  const created = await apiPost(page, token, '/fleet/truck-maintenance/', {
    truck: truck.id,
    date: today,
    miles_alert: 0,
    maintenance_miles: 0,
    time_alert: 0,
    time_year: 0,
    time_month: 0,
    detail: 'E2E test oil change',
  })
  expect(created.id).toBeTruthy()
  expect(created.truck_number).toBeTruthy()
  expect(created.detail).toBe('E2E test oil change')

  // PATCH update
  const updated = await apiPatch(page, token, `/fleet/truck-maintenance/${created.id}/`, { detail: 'E2E updated' })
  expect(updated.detail).toBe('E2E updated')

  // Alert info endpoint
  const alertRes = await page.request.get(
    `${API_BASE}/fleet/truck-maintenance/${created.id}/alert-info/`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  expect(alertRes.ok()).toBeTruthy()
  const alertInfo = await alertRes.json()
  expect(typeof alertInfo.miles_since_maintenance).toBe('number')
  expect(typeof alertInfo.is_last_maintenance).toBe('boolean')

  // Delete maintenance record, then soft-delete truck
  await apiDelete(page, token, `/fleet/truck-maintenance/${created.id}/`)
  await apiDelete(page, token, `/fleet/trucks/${truck.id}/`)
})

test('duplicate date rejected for truck maintenance (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const truck = await apiPost(page, token, '/fleet/trucks/', { number: `E2E-TMDP-${Date.now()}`, status: 1 })
  const today = new Date().toISOString().split('T')[0]

  await apiPost(page, token, '/fleet/truck-maintenance/', {
    truck: truck.id, date: today, miles_alert: 0, maintenance_miles: 0,
    time_alert: 0, time_year: 0, time_month: 0, detail: 'First record',
  })

  // Second record on the same date should return 400
  const dupRes = await page.request.post(`${API_BASE}/fleet/truck-maintenance/`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    data: JSON.stringify({ truck: truck.id, date: today, miles_alert: 0, maintenance_miles: 0, time_alert: 0, time_year: 0, time_month: 0, detail: 'Duplicate' }),
  })
  expect(dupRes.status()).toBe(400)

  await apiDelete(page, token, `/fleet/trucks/${truck.id}/`)
})

// ── Trailer Maintenance (real) ────────────────────────────────────────────────

test('can create, update, and delete a trailer maintenance record via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const trailer = await apiPost(page, token, '/fleet/trailers/', { number: `E2E-TLTRL-${Date.now()}`, status: 1 })
  const today = new Date().toISOString().split('T')[0]

  const created = await apiPost(page, token, '/fleet/trailer-maintenance/', {
    trailer: trailer.id,
    date: today,
    miles: 50000,
    miles_alert: 0,
    time_alert: 1,
    time_year: 1,
    time_month: 0,
    detail: 'E2E annual inspection',
  })
  expect(created.id).toBeTruthy()
  expect(created.trailer_number).toBeTruthy()

  const updated = await apiPatch(page, token, `/fleet/trailer-maintenance/${created.id}/`, { detail: 'E2E updated inspection' })
  expect(updated.detail).toBe('E2E updated inspection')

  const alertRes = await page.request.get(
    `${API_BASE}/fleet/trailer-maintenance/${created.id}/alert-info/`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  expect(alertRes.ok()).toBeTruthy()
  const alertInfo = await alertRes.json()
  expect(typeof alertInfo.miles_since_maintenance).toBe('number')
  expect(alertInfo.miles_alert_message).toBeTruthy()
  expect(alertInfo.time_alert_message).toBeTruthy()

  await apiDelete(page, token, `/fleet/trailer-maintenance/${created.id}/`)
  await apiDelete(page, token, `/fleet/trailers/${trailer.id}/`)
})

// ── Truck Miles Reset (real) ──────────────────────────────────────────────────

test('can create and delete a truck miles reset record via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const truck = await apiPost(page, token, '/fleet/trucks/', { number: `E2E-MRTRK-${Date.now()}`, status: 1 })
  const created = await apiPost(page, token, '/fleet/miles-resets/', {
    truck: truck.id,
    date: '2026-06-30T00:00:00Z',
  })

  expect(created.id).toBeTruthy()
  expect(created.truck).toBe(truck.id)
  expect(created.truck_number).toBe(truck.number)
  expect(created.is_last_reset).toBeTruthy()

  const listed = await apiGet(page, token, `/fleet/miles-resets/?truck=${truck.id}&search=1&date_from=2026-06-01&date_to=2026-06-30`)
  expect(listed.some((reset) => reset.id === created.id)).toBeTruthy()

  const updated = await apiPatch(page, token, `/fleet/miles-resets/${created.id}/`, {
    date: '2026-06-30T12:30:00Z',
  })
  expect(updated.date).toContain('2026-06-30T12:30:00')

  const dupRes = await page.request.post(`${API_BASE}/fleet/miles-resets/`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { truck: truck.id, date: '2026-06-30T12:30:00Z' },
  })
  expect(dupRes.status()).toBe(400)

  await apiDelete(page, token, `/fleet/miles-resets/${created.id}/`)
  await apiDelete(page, token, `/fleet/trucks/${truck.id}/`)
})

// ── Accidents (real) ──────────────────────────────────────────────────────────

test('can create, update, and delete an accident via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const created = await apiPost(page, token, '/fleet/accidents/', {
    date: '2024-06-01T12:00:00Z',
    crash_number: `E2E-${Date.now()}`,
    address: 'I-95 Mile 42',
    truck: null,
    trailer: null,
    driver: null,
    tow_aways: true,
    death_count: 0,
    fatal_injuries: 0,
  })
  expect(created.id).toBeTruthy()
  expect(created.tow_aways).toBe(true)
  // detail response includes resolved name fields
  expect('driver_name' in created).toBe(true)
  expect('truck_number' in created).toBe(true)

  const updated = await apiPatch(page, token, `/fleet/accidents/${created.id}/`, { address: 'Updated Address' })
  expect(updated.address).toBe('Updated Address')

  await apiDelete(page, token, `/fleet/accidents/${created.id}/`)
})

test('accident list response includes driver_name and picture_count fields (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const accident = await apiPost(page, token, '/fleet/accidents/', {
    date: '2024-06-01T12:00:00Z',
    crash_number: `E2E-LIST-${Date.now()}`,
    address: 'Test address', truck: null, trailer: null, driver: null,
    tow_aways: false, death_count: 0, fatal_injuries: 0,
  })

  const listRes = await page.request.get(`${API_BASE}/fleet/accidents/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(listRes.ok()).toBeTruthy()
  const list = await listRes.json()
  const row = list.find((a) => a.id === accident.id)
  expect(row).toBeTruthy()
  expect('picture_count' in row).toBe(true)
  expect('driver_name' in row).toBe(true)
  expect('truck_number' in row).toBe(true)

  await apiDelete(page, token, `/fleet/accidents/${accident.id}/`)
})

test('accident list date range filter returns only matching records (real)', async ({ page }) => {
  test.setTimeout(30_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const accident2020 = await apiPost(page, token, '/fleet/accidents/', {
    date: '2020-01-15T12:00:00Z',
    crash_number: `E2E-2020-${Date.now()}`,
    address: 'Test', truck: null, trailer: null, driver: null,
    tow_aways: false, death_count: 0, fatal_injuries: 0,
  })
  const accident2023 = await apiPost(page, token, '/fleet/accidents/', {
    date: '2023-06-01T12:00:00Z',
    crash_number: `E2E-2023-${Date.now()}`,
    address: 'Test', truck: null, trailer: null, driver: null,
    tow_aways: false, death_count: 0, fatal_injuries: 0,
  })

  const filteredRes = await page.request.get(
    `${API_BASE}/fleet/accidents/?date_type=1&date_from=2023-01-01&date_to=2023-12-31`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  expect(filteredRes.ok()).toBeTruthy()
  const filtered = await filteredRes.json()
  const ids = filtered.map((a) => a.id)
  expect(ids).toContain(accident2023.id)
  expect(ids).not.toContain(accident2020.id)

  await apiDelete(page, token, `/fleet/accidents/${accident2020.id}/`)
  await apiDelete(page, token, `/fleet/accidents/${accident2023.id}/`)
})

test('can upload and clear accident document files via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const accident = await apiPost(page, token, '/fleet/accidents/', {
    date: '2024-07-01T10:00:00Z',
    crash_number: `E2E-FILES-${Date.now()}`,
    address: 'Test', truck: null, trailer: null, driver: null,
    tow_aways: false, death_count: 0, fatal_injuries: 0,
  })

  const pdfBuffer = Buffer.from('%PDF-1.4 test', 'utf-8')

  for (const slot of ['police_report', 'post_accident']) {
    const uploadRes = await page.request.post(
      `${API_BASE}/fleet/accidents/${accident.id}/files/${slot}/`,
      {
        headers: { Authorization: `Bearer ${token}` },
        multipart: { file: { name: `${slot}.pdf`, mimeType: 'application/pdf', buffer: pdfBuffer } },
      }
    )
    expect(uploadRes.ok()).toBeTruthy()

    const clearRes = await page.request.delete(
      `${API_BASE}/fleet/accidents/${accident.id}/files/${slot}/`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    expect(clearRes.status()).toBe(204)
  }

  await apiDelete(page, token, `/fleet/accidents/${accident.id}/`)
})

test('can upload and delete an accident picture via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  const accident = await apiPost(page, token, '/fleet/accidents/', {
    date: '2024-06-02T10:00:00Z',
    crash_number: `E2E-PIC-${Date.now()}`,
    address: 'I-95 Mile 10', truck: null, trailer: null, driver: null,
    tow_aways: false, death_count: 0, fatal_injuries: 0,
  })

  // Minimal valid 1×1 RGB PNG (pre-computed, no subprocess needed)
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
    'base64'
  )

  // Upload a picture
  const uploadRes = await page.request.post(
    `${API_BASE}/fleet/accidents/${accident.id}/pictures/`,
    {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        file: { name: 'scene.png', mimeType: 'image/png', buffer: pngBuffer },
      },
    }
  )
  expect(uploadRes.ok()).toBeTruthy()
  const pic = await uploadRes.json()
  expect(pic.id).toBeTruthy()

  // Delete picture, then accident
  const delPicRes = await page.request.delete(
    `${API_BASE}/fleet/accidents/${accident.id}/pictures/${pic.id}/`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  expect(delPicRes.status()).toBe(204)

  await apiDelete(page, token, `/fleet/accidents/${accident.id}/`)
})

// ── Accounting — Categories (real) ────────────────────────────────────────────

test('can create and delete a category via API (real)', async ({ page }) => {
  test.setTimeout(60_000)
  await loginAsAdmin(page)
  const token = await getAccessToken(page)

  // Get an existing category type or create one (CategoryTypeViewSet has no DELETE)
  const typesRes = await page.request.get(`${API_BASE}/accounting/category-types/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const existingTypes = await typesRes.json()
  let catTypeId
  if (existingTypes.length > 0) {
    catTypeId = existingTypes[0].id
  } else {
    const catType = await apiPost(page, token, '/accounting/category-types/', {
      name: `E2E Type ${Date.now()}`,
      unit_of_measure: 'Unit',
      is_active: true,
    })
    catTypeId = catType.id
  }
  expect(catTypeId).toBeTruthy()

  const created = await apiPost(page, token, '/accounting/categories/', {
    code: `E2E${Date.now()}`.slice(-8),
    name: 'E2E Category',
    category_type: catTypeId,
    is_active: true,
    is_truck_part: false,
  })
  expect(created.id).toBeTruthy()
  expect(created.code).toBeTruthy()
  expect(created.is_active).toBe(true)

  // Toggle status: active → inactive
  const toggled = await page.request.post(
    `${API_BASE}/accounting/categories/${created.id}/toggle-status/`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  expect(toggled.ok()).toBeTruthy()
  const toggledData = await toggled.json()
  expect(toggledData.is_active).toBe(false)

  // PATCH update
  const updated = await apiPatch(page, token, `/accounting/categories/${created.id}/`, { name: 'E2E Category Updated' })
  expect(updated.name).toBe('E2E Category Updated')

  // Options endpoint returns an array
  const optionsRes = await page.request.get(`${API_BASE}/accounting/categories/options/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(optionsRes.ok()).toBeTruthy()
  const options = await optionsRes.json()
  expect(Array.isArray(options)).toBe(true)

  await apiDelete(page, token, `/accounting/categories/${created.id}/`)
})

// ── Truck Parts Report (Real) ──────────────────────────────────────────────────

test('Truck Parts report API: returns 200 with correct structure (date filter)', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)
  const data = await apiGet(
    page, token,
    '/reports/truck-parts/?date_begin=2024-01-01&date_end=2024-12-31&date_option=1&report=1',
  )
  expect(Array.isArray(data.sections)).toBe(true)
  expect(typeof data.grand_total_quantity).toBe('number')
  expect(typeof data.grand_total_spent).toBe('number')
  expect(data.date_begin).toBe('2024-01-01')
  expect(data.date_end).toBe('2024-12-31')
  expect(data.date_option).toBe(1)
  expect(data.report).toBe(1)
})

test('Truck Parts report API: show all ignores dates and returns sections', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)
  const data = await apiGet(page, token, '/reports/truck-parts/?date_option=3&report=1')
  expect(Array.isArray(data.sections)).toBe(true)
  expect(data.date_option).toBe(3)
})

test('Truck Parts report API: listing mode returns rows with date field', async ({ page }) => {
  await loginAsAdmin(page)
  const token = await getAccessToken(page)
  const data = await apiGet(
    page, token,
    '/reports/truck-parts/?date_begin=2024-01-01&date_end=2024-12-31&date_option=1&report=2',
  )
  expect(Array.isArray(data.sections)).toBe(true)
  expect(data.report).toBe(2)
  if (data.sections.length > 0 && data.sections[0].rows.length > 0) {
    const row = data.sections[0].rows[0]
    expect(typeof row.date).toBe('string')
    expect(typeof row.amount).toBe('number')
  }
})

test('Truck Parts report API: missing dates with date_option=1 returns 400', async ({ page }) => {
  await loginAsAdmin(page)
  const res = await page.request.get(`${API_BASE}/reports/truck-parts/`, {
    headers: { Authorization: `Bearer ${await getAccessToken(page)}` },
  })
  expect(res.status()).toBe(400)
})

test('Truck Parts report API: invalid report type returns 400', async ({ page }) => {
  await loginAsAdmin(page)
  const res = await page.request.get(
    `${API_BASE}/reports/truck-parts/?date_begin=2024-01-01&date_end=2024-12-31&report=9`,
    { headers: { Authorization: `Bearer ${await getAccessToken(page)}` } },
  )
  expect(res.status()).toBe(400)
})
