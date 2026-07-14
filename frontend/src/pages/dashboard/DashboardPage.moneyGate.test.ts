import { describe, it, expect } from 'vitest'
import { primaryStatCard } from './DashboardPage'
import { FIELD_ROLES, ADMIN_EQUIVALENT } from '../../lib/capabilities'

// Regression test for the office /dashboard money-gate bug: field roles must see
// per-day COUNTS only, never rand/revenue amounts. Admin-equivalents see revenue.
const stats = { total_revenue: 125000, total_orders: 42, total_visits: 300, revenue_growth: 5 }

describe('DashboardPage primaryStatCard money gate', () => {
  it.each(FIELD_ROLES)('shows counts, not revenue, for field role %s', (role) => {
    const card = primaryStatCard(role, stats)
    expect(card.title).toBe('Total Orders')
    expect(card.value).not.toMatch(/R\s?125/) // no formatted currency leaking through
    expect(card.value).toContain('42')
    expect(card.change).toBeUndefined() // no revenue_growth surfaced for field roles
  })

  it.each([...ADMIN_EQUIVALENT, 'super_admin'])('shows revenue for admin-equivalent role %s', (role) => {
    const card = primaryStatCard(role, stats)
    expect(card.title).toBe('Total Revenue')
    expect(card.value).toContain('125')
    expect(card.change).toBe(5)
  })
})
