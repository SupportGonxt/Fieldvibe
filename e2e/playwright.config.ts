import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://fieldvibe.vantax.co.za',
    trace: 'retain-on-failure',
  },
})
