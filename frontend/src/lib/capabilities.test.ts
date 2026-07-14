import { describe, it, expect } from 'vitest'
import { roleAllows, canSeeMoney, FIELD_ROLES } from './capabilities'

describe('capabilities mirror', () => {
  it('admin-equivalents pass staff gates', () => {
    expect(roleAllows('backoffice_admin', ['admin'])).toBe(true)
    expect(roleAllows('general_manager', ['manager'])).toBe(true)
  })
  it('super_admin passes everything', () => {
    expect(roleAllows('super_admin', ['team_lead'])).toBe(true)
  })
  it('field roles pass only when listed', () => {
    expect(roleAllows('agent', ['admin'])).toBe(false)
    expect(roleAllows('team_lead', ['team_lead'])).toBe(true)
  })
  it('field roles never see money', () => {
    for (const r of FIELD_ROLES) expect(canSeeMoney(r)).toBe(false)
    expect(canSeeMoney('general_manager')).toBe(true)
  })
})
