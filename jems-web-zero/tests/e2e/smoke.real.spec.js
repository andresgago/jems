// @ts-check
/**
 * Real E2E tests — hit the actual Django backend.
 * Run with: npm run test:e2e:real
 * Prereqs: backend running on http://localhost:8000 with seeded data and a valid admin user.
 */
import { expect, test } from '@playwright/test'

const API_BASE = process.env.VITE_API_URL || 'http://localhost:8000/api/v1'
const ADMIN_USER = process.env.E2E_USERNAME || 'admin'
const ADMIN_PASS = process.env.E2E_PASSWORD || 'admin1234'

// Critical routes that must be reachable after login
const CRITICAL_ROUTES = [
  { path: '/loads', heading: /loads/i },
  { path: '/loads/create', heading: /new load/i },
  { path: '/drivers', heading: /drivers/i },
  { path: '/drivers/create', heading: /new driver/i },
  { path: '/fleet/trucks', heading: /trucks/i },
  { path: '/fleet/trucks/create', heading: /new truck/i },
  { path: '/fleet/trailers', heading: /trailers/i },
  { path: '/fleet/trailers/create', heading: /new trailer/i },
  { path: '/brokers', heading: /brokers/i },
  { path: '/brokers/create', heading: /new broker/i },
  { path: '/settings/cities', heading: /cities/i },
  { path: '/settings/cities/create', heading: /create city/i },
  { path: '/settings/users', heading: /users/i },
  { path: '/settings/users/create', heading: /create user/i },
  { path: '/settings/system', heading: /system settings/i },
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
  expect(res.ok()).toBeTruthy()
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
    broker_contacts: 'E2E contact',
    shipper: shipper.id,
    receiver: receiver.id,
  })

  expect(created.id).toBeTruthy()
  expect(created.number).toBe(number)

  await apiDelete(page, token, `/loads/${created.id}/`)
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
    await expect(page.getByText('By Percent', { exact: true })).toBeVisible()
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
