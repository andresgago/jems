# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.real.spec.js >> can create and delete a broker via API (real)
- Location: tests/e2e/smoke.real.spec.js:355:1

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - generic [ref=e4]:
      - link "JEMS" [ref=e5] [cursor=pointer]:
        - /url: /
        - img "JEMS" [ref=e6]
      - list [ref=e8]:
        - listitem [ref=e9]:
          - link " Loads" [ref=e10] [cursor=pointer]:
            - /url: /loads
            - generic [ref=e11]: 
            - text: Loads
        - listitem [ref=e12]:
          - link " History" [ref=e13] [cursor=pointer]:
            - /url: /loads/history
            - generic [ref=e14]: 
            - text: History
        - listitem [ref=e15]:
          - link " Accounting" [ref=e16] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e17]: 
            - text: Accounting
        - listitem [ref=e18]:
          - link " RTL" [ref=e19] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e20]: 
            - text: RTL
        - listitem [ref=e21]:
          - link "" [ref=e22] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e23]: 
        - listitem [ref=e24]:
          - link "" [ref=e25] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e26]: 
        - listitem [ref=e27]:
          - link "" [ref=e28] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e29]: 
        - listitem [ref=e30]:
          - link " System" [ref=e31] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e32]: 
            - text: System
        - listitem [ref=e33]:
          - link " Admin Test" [ref=e34] [cursor=pointer]:
            - /url: "#"
            - generic [ref=e35]: 
            - text: Admin Test
          - text: 
  - generic [ref=e39]:
    - heading "Welcome, Admin Test" [level=4] [ref=e40]
    - paragraph [ref=e41]: Select an option from the menu to get started.
  - contentinfo [ref=e42]:
    - strong [ref=e44]: JEMS © 2019 – 2026
```

# Test source

```ts
  4   |  * Run with: npm run test:e2e:real
  5   |  * Prereqs: backend running on http://localhost:8000 with seeded data and a valid admin user.
  6   |  */
  7   | import { expect, test } from '@playwright/test'
  8   | 
  9   | const API_BASE = process.env.VITE_API_URL || 'http://localhost:8000/api/v1'
  10  | const ADMIN_USER = process.env.E2E_USERNAME || 'admin'
  11  | const ADMIN_PASS = process.env.E2E_PASSWORD || 'admin1234'
  12  | 
  13  | // Critical routes that must be reachable after login
  14  | const CRITICAL_ROUTES = [
  15  |   { path: '/loads', heading: /loads/i },
  16  |   { path: '/loads/create', heading: /new load/i },
  17  |   { path: '/drivers', heading: /drivers/i },
  18  |   { path: '/drivers/create', heading: /new driver/i },
  19  |   { path: '/fleet/trucks', heading: /trucks/i },
  20  |   { path: '/fleet/trucks/create', heading: /new truck/i },
  21  |   { path: '/fleet/trailers', heading: /trailers/i },
  22  |   { path: '/fleet/trailers/create', heading: /new trailer/i },
  23  |   { path: '/brokers', heading: /brokers/i },
  24  |   { path: '/brokers/create', heading: /new broker/i },
  25  |   { path: '/settings/cities', heading: /cities/i },
  26  |   { path: '/settings/cities/create', heading: /create city/i },
  27  |   { path: '/settings/users', heading: /users/i },
  28  |   { path: '/settings/users/create', heading: /create user/i },
  29  |   { path: '/settings/system', heading: /system settings/i },
  30  |   { path: '/rtl', heading: /rtl/i },
  31  |   { path: '/rtl/ifta', heading: /ifta/i },
  32  | ]
  33  | 
  34  | // ── Helpers ───────────────────────────────────────────────────────────────────
  35  | 
  36  | async function loginAsAdmin(page) {
  37  |   await assertRealApiLoginWorks(page)
  38  |   await page.goto('/login')
  39  |   await page.locator('input[type="text"]').fill(ADMIN_USER)
  40  |   await page.locator('input[type="password"]').fill(ADMIN_PASS)
  41  |   await page.getByRole('button', { name: /login/i }).click()
  42  |   await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })
  43  | }
  44  | 
  45  | async function assertRealApiLoginWorks(page) {
  46  |   let res
  47  |   try {
  48  |     res = await page.request.post(`${API_BASE}/auth/login/`, {
  49  |       data: { username: ADMIN_USER, password: ADMIN_PASS },
  50  |       timeout: 5_000,
  51  |     })
  52  |   } catch (error) {
  53  |     throw new Error(
  54  |       `Real E2E backend is not reachable at ${API_BASE}. ` +
  55  |         'Start the Django backend before running npm run test:e2e:real. ' +
  56  |         `Original error: ${error.message}`
  57  |     )
  58  |   }
  59  | 
  60  |   if (!res.ok()) {
  61  |     const body = await res.text()
  62  |     throw new Error(
  63  |       `Real E2E login failed for ${ADMIN_USER}. ` +
  64  |         `Expected a valid admin user/password. HTTP ${res.status()}: ${body}`
  65  |     )
  66  |   }
  67  | }
  68  | 
  69  | async function authenticateAsAdmin(page) {
  70  |   const res = await page.request.post(`${API_BASE}/auth/login/`, {
  71  |     data: { username: ADMIN_USER, password: ADMIN_PASS },
  72  |     timeout: 5_000,
  73  |   })
  74  |   if (!res.ok()) {
  75  |     const body = await res.text()
  76  |     throw new Error(`Real E2E login failed for ${ADMIN_USER}. HTTP ${res.status()}: ${body}`)
  77  |   }
  78  |   const tokens = await res.json()
  79  |   await page.addInitScript(({ access, refresh }) => {
  80  |     localStorage.setItem('access_token', access)
  81  |     localStorage.setItem('refresh_token', refresh)
  82  |   }, tokens)
  83  |   return tokens.access
  84  | }
  85  | 
  86  | async function getAccessToken(page) {
  87  |   await page.waitForFunction(() => !!localStorage.getItem('access_token'))
  88  |   return page.evaluate(() => localStorage.getItem('access_token'))
  89  | }
  90  | 
  91  | async function apiGet(page, token, path) {
  92  |   const res = await page.request.get(`${API_BASE}${path}`, {
  93  |     headers: { Authorization: `Bearer ${token}` },
  94  |   })
  95  |   expect(res.ok()).toBeTruthy()
  96  |   return res.json()
  97  | }
  98  | 
  99  | async function apiPost(page, token, path, data) {
  100 |   const res = await page.request.post(`${API_BASE}${path}`, {
  101 |     headers: { Authorization: `Bearer ${token}` },
  102 |     data,
  103 |   })
> 104 |   expect(res.ok()).toBeTruthy()
      |                    ^ Error: expect(received).toBeTruthy()
  105 |   return res.json()
  106 | }
  107 | 
  108 | async function apiPatch(page, token, path, data) {
  109 |   const res = await page.request.patch(`${API_BASE}${path}`, {
  110 |     headers: { Authorization: `Bearer ${token}` },
  111 |     data,
  112 |   })
  113 |   expect(res.ok()).toBeTruthy()
  114 |   return res.json()
  115 | }
  116 | 
  117 | async function apiDelete(page, token, path) {
  118 |   const res = await page.request.delete(`${API_BASE}${path}`, {
  119 |     headers: { Authorization: `Bearer ${token}` },
  120 |   })
  121 |   expect(res.ok()).toBeTruthy()
  122 | }
  123 | 
  124 | function fieldByLabel(page, label, selector = 'input, select, textarea') {
  125 |   return page.locator('label').filter({ hasText: label }).locator('xpath=..').locator(selector).first()
  126 | }
  127 | 
  128 | // ── Auth ──────────────────────────────────────────────────────────────────────
  129 | 
  130 | test('admin can log in and is redirected away from /login (real)', async ({ page }) => {
  131 |   test.setTimeout(30_000)
  132 |   await loginAsAdmin(page)
  133 |   await expect(page).not.toHaveURL(/\/login/)
  134 | })
  135 | 
  136 | // ── Critical routes ───────────────────────────────────────────────────────────
  137 | 
  138 | for (const route of CRITICAL_ROUTES) {
  139 |   test(`${route.path} loads after login (real)`, async ({ page }) => {
  140 |     test.setTimeout(30_000)
  141 |     await loginAsAdmin(page)
  142 |     await page.goto(route.path)
  143 |     await expect(page.locator('h5, h4, h3').first()).toBeVisible()
  144 |   })
  145 | }
  146 | 
  147 | // ── Trailer types from API ────────────────────────────────────────────────────
  148 | 
  149 | test('trailer-types endpoint returns short_name for all types (real)', async ({ page }) => {
  150 |   test.setTimeout(30_000)
  151 |   await loginAsAdmin(page)
  152 |   const token = await getAccessToken(page)
  153 | 
  154 |   const types = await apiGet(page, token, '/fleet/trailer-types/')
  155 |   expect(Array.isArray(types)).toBeTruthy()
  156 |   expect(types.length).toBeGreaterThanOrEqual(5)
  157 | 
  158 |   for (const t of types) {
  159 |     expect(t).toHaveProperty('short_name')
  160 |     expect(t.short_name.length).toBeGreaterThan(0)
  161 |     expect(t.short_name.length).toBeLessThanOrEqual(3)
  162 |   }
  163 | 
  164 |   // Verify the 5 seeded types are present with correct short names
  165 |   const byName = Object.fromEntries(types.map((t) => [t.name, t.short_name]))
  166 |   expect(byName['Van']).toBe('V')
  167 |   expect(byName['Reefer']).toBe('R')
  168 |   expect(byName['Flatbed']).toBe('F')
  169 |   expect(byName['Van or Reefer']).toBe('VR')
  170 |   expect(byName['Van Vented']).toBe('VV')
  171 | })
  172 | 
  173 | test('new load form renders trailer types with short_name (real)', async ({ page }) => {
  174 |   test.setTimeout(30_000)
  175 |   await loginAsAdmin(page)
  176 |   await page.goto('/loads/create')
  177 | 
  178 |   // Wait for the trailer type select to be populated (API call completes)
  179 |   await expect(page.locator('option', { hasText: 'Van (V)' })).toHaveCount(1, { timeout: 10_000 })
  180 |   await expect(page.locator('option', { hasText: 'Reefer (R)' })).toHaveCount(1)
  181 |   await expect(page.locator('option', { hasText: 'Flatbed (F)' })).toHaveCount(1)
  182 | })
  183 | 
  184 | test('new load form weight defaults to 42000 (real)', async ({ page }) => {
  185 |   test.setTimeout(30_000)
  186 |   await loginAsAdmin(page)
  187 |   await page.goto('/loads/create')
  188 |   await expect(page.locator('input[value="42000"]')).toBeVisible()
  189 | })
  190 | 
  191 | // ── Create + delete load (round-trip) ────────────────────────────────────────
  192 | 
  193 | test('can create and delete a load via API (real)', async ({ page }) => {
  194 |   test.setTimeout(60_000)
  195 |   await loginAsAdmin(page)
  196 |   const token = await getAccessToken(page)
  197 | 
  198 |   // Get required FK IDs from seeded data
  199 |   const trailerTypes = await apiGet(page, token, '/fleet/trailer-types/')
  200 |   const carriers = await apiGet(page, token, '/carriers/')
  201 |   const trailerTypeId = trailerTypes.find((t) => t.name === 'Van')?.id
  202 |   const carrierId = carriers[0]?.id
  203 | 
  204 |   expect(trailerTypeId).toBeTruthy()
```