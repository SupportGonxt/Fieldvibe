import { describe, it, expect } from 'vitest'
import { canSeeUnmanaged, groupByCompany } from './IssueQueue'

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

describe('groupByCompany', () => {
  it('groups rows by company_name preserving first-seen order, nulls under "Unassigned"', () => {
    const rows: any[] = [
      { id: '1', company_name: 'Goldrush' },
      { id: '2', company_name: 'Stellr' },
      { id: '3', company_name: 'Goldrush' },
      { id: '4', company_name: null },
    ]
    const g = groupByCompany(rows)
    expect(g.map((x) => x.company)).toEqual(['Goldrush', 'Stellr', 'Unassigned'])
    expect(g[0].items.map((i) => i.id)).toEqual(['1', '3'])
  })

  it('single-company list returns one group', () => {
    expect(groupByCompany([{ id: '1', company_name: 'Stellr' }] as any)).toHaveLength(1)
  })
})
