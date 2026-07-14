import { test, expect } from '@playwright/test'
import { ROLE_CREDS, haveCreds } from '../fixtures/roles'
import { seedSession } from '../fixtures/session'

// Canonical business rule (spec §2): field roles see signup/verified/deposit
// COUNTS per day — never rand amounts. GM sees revenue = deposits × config rate.
const RAND_TEXT = /R\s?\d[\d\s,]*(\.\d{2})?/

// Sessions are seeded via one API login per role (see fixtures/session.ts);
// the interactive login form gets its own single smoke test below so the UI
// path stays covered without tripping the 5/15min login rate limit.

// The PWA polls continuously, so 'networkidle' never settles — wait for the
// screen to have rendered real content instead.
async function settled(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => (document.body.innerText || '').trim().length > 80)
}

for (const role of ['agent', 'team_lead']) {
  test(`${role} field-ops screens show no rand values`, async ({ page }) => {
    test.skip(!process.env.E2E_BASE_URL || !haveCreds(role), 'E2E env not configured')
    await seedSession(page, role)
    for (const path of ['/agent/dashboard', '/field-operations']) {
      await page.goto(path)
      await settled(page)
      const body = await page.locator('body').innerText()
      expect(body, `${role} sees rand text on ${path}`).not.toMatch(RAND_TEXT)
    }
  })
}

test('general_manager sees revenue on GM overview', async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL || !haveCreds('general_manager'), 'E2E env not configured')
  await seedSession(page, 'general_manager')
  await page.goto('/dashboard/gm')
  // The shell renders before the overview query resolves — poll until the
  // revenue figures actually appear instead of reading innerText once.
  await expect
    .poll(async () => page.locator('body').innerText(), { timeout: 30_000 })
    .toMatch(RAND_TEXT)
})

test('login form authenticates an agent', async ({ page }) => {
  test.skip(!process.env.E2E_BASE_URL || !haveCreds('agent'), 'E2E env not configured')
  const { email, password } = ROLE_CREDS['agent']
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email!)
  await page.getByLabel(/password/i).fill(password!)
  await page.getByRole('button', { name: /sign in|log in/i }).click()
  await page.waitForURL(/dashboard|agent/)
})
