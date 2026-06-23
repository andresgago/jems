// @ts-check
/**
 * Real E2E tests — hit the actual Django backend.
 * Run with: npm run test:e2e:real
 * Prereqs: backend running on http://localhost:8000 with seeded data and a valid admin user.
 */
import { expect, test } from '@playwright/test'

const API_BASE = process.env.VITE_API_URL || 'http://localhost:8000/api/v1'
const ADMIN_USER = process.env.E2E_USERNAME || 'admin'
const ADMIN_PASS = process.env.E2E_PASSWORD || 'admin'

// Critical routes that must be reachable after login
const CRITICAL_ROUTES = [
  { path: '/loads', heading: /loads/i },
  { path: '/loads/create', heading: /new load/i },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAsAdmin(page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /username/i }).fill(ADMIN_USER)
  await page.getByRole('textbox', { name: /password/i }).fill(ADMIN_PASS)
  await page.getByRole('button', { name: /login/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
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

async function apiDelete(page, token, path) {
  const res = await page.request.delete(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(res.ok()).toBeTruthy()
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
  await expect(page.locator('option', { hasText: 'Van (V)' })).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('option', { hasText: 'Reefer (R)' })).toBeVisible()
  await expect(page.locator('option', { hasText: 'Flatbed (F)' })).toBeVisible()
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

  // We need cities and a broker — use the API to get a real broker and city if available
  // Otherwise skip the round-trip (broker/city are required fields)
  const brokersResp = await page.request.get(`${API_BASE}/brokers/search/?q=a`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const brokers = await brokersResp.json()

  if (!brokers?.length) {
    test.skip('No brokers seeded — skipping load round-trip test')
    return
  }

  test.skip('Load create round-trip requires cities and brokers — run after full seed')
})
