import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173'
const useWebServer = !process.env.E2E_BASE_URL
const reuseServer = process.env.E2E_REUSE_SERVER === 'true'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mock',
      testMatch: /.*\.mock\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'real',
      testMatch: /.*\.real\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: useWebServer
    ? {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: reuseServer,
        timeout: 60_000,
        env: {
          VITE_API_URL: process.env.VITE_API_URL || 'http://localhost:8000/api/v1',
        },
      }
    : undefined,
})
