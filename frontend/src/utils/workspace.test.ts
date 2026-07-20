import { describe, it, expect } from 'vitest'
import { postLoginTarget, isDualAccess } from './workspace'

describe('postLoginTarget', () => {
  // admin/super_admin are back-office only — no field/agent view, even on mobile.
  it('routes admin/super_admin straight to the back-office dashboard', () => {
    expect(postLoginTarget('admin', false)).toBe('/dashboard')
    expect(postLoginTarget('super_admin', false)).toBe('/dashboard')
  })

  it('keeps admin/super_admin on the dashboard even in an installed PWA', () => {
    expect(postLoginTarget('admin', true)).toBe('/dashboard')
    expect(postLoginTarget('super_admin', true)).toBe('/dashboard')
  })

  it('routes dual-access roles to the chooser in a browser', () => {
    expect(postLoginTarget('manager', false)).toBe('/choose')
    expect(postLoginTarget('general_manager', false)).toBe('/choose')
    expect(postLoginTarget('backoffice_admin', false)).toBe('/choose')
  })

  it('skips the chooser for dual-access roles in an installed PWA', () => {
    expect(postLoginTarget('general_manager', true)).toBe('/agent/overview')
    expect(postLoginTarget('backoffice_admin', true)).toBe('/agent/reconcile')
  })

  it('routes mobile-only field roles straight to the field app', () => {
    expect(postLoginTarget('agent', false)).toBe('/agent/dashboard')
    expect(postLoginTarget('sales_rep', false)).toBe('/agent/dashboard')
  })

  it('does not treat admin/super_admin as dual-access', () => {
    expect(isDualAccess('admin')).toBe(false)
    expect(isDualAccess('super_admin')).toBe(false)
  })

  it('treats manager/general_manager/backoffice_admin as dual-access', () => {
    expect(isDualAccess('manager')).toBe(true)
    expect(isDualAccess('general_manager')).toBe(true)
    expect(isDualAccess('backoffice_admin')).toBe(true)
  })
})
