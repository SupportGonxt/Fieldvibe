import { describe, it, expect } from 'vitest'
import { canCoach, canSeeUnmanaged, toGroups, kindLabel } from './IssueQueue'

describe('canSeeUnmanaged', () => {
  // Mirrors backend requireRole('admin','general_manager') — backoffice_admin
  // is admin-equivalent and must pass; field roles must not (403 loop guard).
  it('admits admin-equivalents and GM', () => {
    expect(canSeeUnmanaged('admin')).toBe(true)
    expect(canSeeUnmanaged('backoffice_admin')).toBe(true)
    expect(canSeeUnmanaged('general_manager')).toBe(true)
  })
  it('rejects field roles and undefined', () => {
    expect(canSeeUnmanaged('manager')).toBe(false)
    expect(canSeeUnmanaged('team_lead')).toBe(false)
    expect(canSeeUnmanaged(undefined)).toBe(false)
  })
})

describe('canCoach', () => {
  // Mirrors backend ACTION_REGISTRY checkin/resource/recognition roles exactly —
  // no admin expansion: admin/backoffice_admin would 403 on these actions.
  it('admits supervising field roles and GM only', () => {
    expect(canCoach('team_lead')).toBe(true)
    expect(canCoach('manager')).toBe(true)
    expect(canCoach('general_manager')).toBe(true)
    expect(canCoach('admin')).toBe(false)
    expect(canCoach('backoffice_admin')).toBe(false)
    expect(canCoach('agent')).toBe(false)
    expect(canCoach(undefined)).toBe(false)
  })
})

describe('toGroups', () => {
  // Client fallback for cached responses that predate the server's grouped shape —
  // must mirror workers-api issues.js dedupCap grouping: worst-first order kept,
  // worst 3 per kind, breached tallied.
  it('groups by kind preserving worst-first order, capping worst at 3', () => {
    const rows: any[] = [
      { id: '1', kind: 'gone_quiet', breached: true },
      { id: '2', kind: 'below_gate' },
      { id: '3', kind: 'gone_quiet' },
      { id: '4', kind: 'gone_quiet' },
      { id: '5', kind: 'gone_quiet' },
    ]
    const g = toGroups(rows)
    expect(g.map((x) => x.kind)).toEqual(['gone_quiet', 'below_gate'])
    expect(g[0]).toMatchObject({ count: 4, breached: 1, polarity: 'deficit' })
    expect(g[0].worst.map((i) => i.id)).toEqual(['1', '3', '4'])
  })

  it('carries recognition polarity through', () => {
    const g = toGroups([{ id: '1', kind: 'hit_gate_early', polarity: 'recognition' } as any])
    expect(g[0].polarity).toBe('recognition')
  })
})

describe('kindLabel', () => {
  it('uses the registry label, humanising unknown kinds', () => {
    expect(kindLabel('gone_quiet')).toBe('Gone quiet')
    expect(kindLabel('mystery_signal')).toBe('mystery signal')
  })
})
