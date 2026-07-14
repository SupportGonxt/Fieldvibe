import { describe, it, expect } from 'vitest'
import { toApiDateTime, applyPeriodParams } from './ReportPage'

describe('toApiDateTime', () => {
  it('converts datetime-local T separator to the space D1 stores', () => {
    expect(toApiDateTime('2026-07-01T08:30')).toBe('2026-07-01 08:30')
  })
})

describe('applyPeriodParams', () => {
  it('includes normalized start_date/end_date for custom period', () => {
    expect(applyPeriodParams({ region: 'gauteng' }, 'custom', '2026-07-01T08:30', '2026-07-14T17:00')).toEqual({
      region: 'gauteng',
      period: 'custom',
      start_date: '2026-07-01 08:30',
      end_date: '2026-07-14 17:00'
    })
  })

  it('omits empty values', () => {
    expect(applyPeriodParams({}, 'custom', '2026-07-01T08:30', '')).toEqual({
      period: 'custom',
      start_date: '2026-07-01 08:30'
    })
  })

  it('strips start_date/end_date when switching back to a preset', () => {
    const custom = applyPeriodParams({}, 'custom', '2026-07-01T08:30', '2026-07-14T17:00')
    expect(applyPeriodParams(custom, 'mtd', '2026-07-01T08:30', '2026-07-14T17:00')).toEqual({ period: 'mtd' })
  })
})
