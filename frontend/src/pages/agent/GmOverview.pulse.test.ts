import { describe, it, expect } from 'vitest'
import { buildPulse, type Overview } from './GmOverview'
import type { Issue } from '../../components/field-ops/IssueQueue'

// Minimal payload; each field only carries what buildPulse reads.
const base: Overview = {
  period: 'day', companyId: null, companies: [],
  window: { start: '', end: '', prevStart: '', prevEnd: '', today: '', isCurrent: true },
  money: { revenue: 110, incentiveCost: null, salaryCost: null, net: null, costsAvailable: false, prevRevenue: 100 },
  funnel: { signups: 0, converted: 0, qualified: 0, commissionPerDeposit: 0, conversionRate: 20, prev: { signups: 0, converted: 0, conversionRate: 10 } },
  field: { activeAgents: 0, totalAgents: 0, leastActive: [{ id: 'a', name: 'Idle Guy', today: 0 }], unassignedAgents: 2 },
  leaders: [{ id: 'l', name: 'Sipho Ndlovu', signups: 14, converted: 3 }],
  calls: { contacted: 3, target: 10 }, teams: [], management: { managers: [], boAdmins: [] }, risks: [],
}
const issue = (o: Partial<Issue>): Issue => ({ id: 'i', kind: 'k', subject_id: 's', subject_name: 'n', severity: 1, status: 'open', escalations: 0, owner_since: '', ...o })

describe('buildPulse', () => {
  it('surfaces good and bad, worst-first', () => {
    const chips = buildPulse(base, [issue({ polarity: 'deficit' })], [issue({ breached: true, polarity: 'deficit' })])
    // deficit/breach/rev-up/top all present; bad tones sort ahead of good.
    const first = chips[0].tone
    expect(first).toBe('bad')
    expect(chips.some((c) => c.label === '1 on you' && c.tone === 'bad')).toBe(true)
    expect(chips.some((c) => c.label === '1 past SLA' && c.tone === 'bad')).toBe(true)
    expect(chips.some((c) => c.label === 'rev +10%' && c.tone === 'good')).toBe(true)
    expect(chips.some((c) => c.label === 'top Sipho 14' && c.tone === 'good')).toBe(true)
  })

  it('drops revenue-down to a bad chip, skips clean signals', () => {
    const chips = buildPulse({ ...base, money: { ...base.money, revenue: 80 }, field: { ...base.field, unassignedAgents: 0, leastActive: [] }, calls: { contacted: 10, target: 10 } }, [], [])
    expect(chips.some((c) => c.label === 'rev -20%' && c.tone === 'bad')).toBe(true)
    expect(chips.some((c) => c.label.includes('no lead'))).toBe(false)
    expect(chips.some((c) => c.label.startsWith('calls'))).toBe(false)
  })
})
