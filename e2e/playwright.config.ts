import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 1,
  // Login API allows 5/15min per IP; parallel workers each hold their own
  // session cache and would multiply logins past the limit.
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://fieldvibe.vantax.co.za',
    trace: 'retain-on-failure',
  },
})
