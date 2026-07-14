import { test, expect, Page } from '@playwright/test'
import { ROLE_CREDS, haveCreds } from '../fixtures/roles'

// Canonical business rule (spec §2): field roles see signup/verified/deposit
// COUNTS per day — never rand amounts. GM sees revenue = deposits × config rate.
const RAND_TEXT = /R\s?\d[\d\s,]*(\.\d{2})?/

async function login(page: Page, role: string) {
  const { email, password } = ROLE_CREDS[role]
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email!)
  await page.getByLabel(/password/i).fill(password!)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/dashboard|agent/)
}

for (const role of ['agent', 'team_lead']) {
  test(`${role} field-ops screens show no rand values`, async ({ page }) => {
    test.skip(!process.env.E2E_BASE_URL || !haveCreds(role), 'E2E env not configured')
    await login(page, role)
    for (const path of ['/agent/dashboard', '/field-operations']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const body = await page.locator('body').innerText()
      expect(body, `${role} sees rand text on ${path}`).not.toMatch(RAND_TEXT)
    }
  })
}

test('general_manager sees revenue on GM overview', async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL || !haveCreds('general_manager'), 'E2E env not configured')
  await login(page, 'general_manager')
  await page.goto('/dashboard/gm')
  await page.waitForLoadState('networkidle')
  const body = await page.locator('body').innerText()
  expect(body).toMatch(RAND_TEXT)
})
