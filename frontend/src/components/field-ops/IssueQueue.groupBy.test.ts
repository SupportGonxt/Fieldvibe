import { describe, it, expect } from 'vitest'
import { groupByCompany } from './IssueQueue'

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
