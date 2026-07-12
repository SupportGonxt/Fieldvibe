import { describe, it, expect } from 'vitest'
import { buildHomePulse, type HomePulseCtx } from './AgentDashboard'
import type { Issue } from '../../components/field-ops/IssueQueue'

const issue = (o: Partial<Issue>): Issue => ({ id: 'i', kind: 'k', subject_id: 's', subject_name: 'n', severity: 1, status: 'open', escalations: 0, owner_since: '', ...o })
const ctx = (o: Partial<HomePulseCtx>): HomePulseCtx => ({
  agent: false, leader: false, orgLeader: false, mine: [], unmanaged: [],
  todayIndiv: 0, dailyIndivTarget: 0, monthAchievement: 0, streak: 0,
  teamAchievement: null, reshoots: 0, idRejects: 0, uploadFails: 0, ...o,
})

describe('buildHomePulse', () => {
  it('agent: pace warn under target, reshoots/rejects bad, streak + mo good, worst-first', () => {
    const chips = buildHomePulse(ctx({
      agent: true, todayIndiv: 3, dailyIndivTarget: 10, streak: 5,
      monthAchievement: 120, reshoots: 2, idRejects: 1,
      mine: [issue({ polarity: 'deficit' }), issue({ polarity: 'recognition' })],
    }))
    expect(chips[0].tone).toBe('bad') // bad sorts first
    expect(chips.some((c) => c.label === '1 on you' && c.tone === 'bad')).toBe(true)
    expect(chips.some((c) => c.label === 'today 3/10' && c.tone === 'warn')).toBe(true)
    expect(chips.some((c) => c.label === '2 reshoots' && c.tone === 'bad')).toBe(true)
    expect(chips.some((c) => c.label === '1 ID reject' && c.tone === 'bad')).toBe(true)
    expect(chips.some((c) => c.label === '5d streak' && c.tone === 'good')).toBe(true)
    expect(chips.some((c) => c.label === 'mo 120%' && c.tone === 'good')).toBe(true)
    expect(chips.some((c) => c.label === '1 highlight' && c.tone === 'good')).toBe(true)
  })

  it('agent: today good when at/over target', () => {
    const chips = buildHomePulse(ctx({ agent: true, todayIndiv: 10, dailyIndivTarget: 10 }))
    expect(chips.some((c) => c.label === 'today 10/10' && c.tone === 'good')).toBe(true)
  })

  it('org leader: past SLA beats plain unmanaged, team% toned by achievement', () => {
    const chips = buildHomePulse(ctx({
      leader: true, orgLeader: true, teamAchievement: 60, uploadFails: 3,
      unmanaged: [issue({ breached: true, polarity: 'deficit' }), issue({ polarity: 'deficit' })],
    }))
    expect(chips.some((c) => c.label === '1 past SLA' && c.tone === 'bad')).toBe(true)
    expect(chips.some((c) => c.label.startsWith('unmanaged'))).toBe(false) // suppressed when breached present
    expect(chips.some((c) => c.label === 'team 60%' && c.tone === 'bad')).toBe(true)
    expect(chips.some((c) => c.label === '3 upload fails' && c.tone === 'bad')).toBe(true)
  })

  it('org leader: unmanaged warn when nothing breached', () => {
    const chips = buildHomePulse(ctx({ orgLeader: true, unmanaged: [issue({ polarity: 'deficit' }), issue({ polarity: 'deficit' })] }))
    expect(chips.some((c) => c.label === '2 unmanaged' && c.tone === 'warn')).toBe(true)
  })

  it('empty when nothing to report', () => {
    expect(buildHomePulse(ctx({ agent: true }))).toEqual([])
  })
})
