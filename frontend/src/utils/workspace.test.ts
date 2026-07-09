import { describe, it, expect } from 'vitest'
import { postLoginTarget, isDualAccess } from './workspace'

describe('postLoginTarget', () => {
  // The bug: admin/super_admin (the seeded owner logins) skipped the chooser
  // and force-routed to /dashboard, so the workspace switch never appeared.
  it('routes admin/super_admin to the chooser in a browser', () => {
    expect(postLoginTarget('admin', false)).toBe('/choose')
    expect(postLoginTarget('super_admin', false)).toBe('/choose')
  })

  it('still routes other dual-access roles to the chooser in a browser', () => {
    expect(postLoginTarget('manager', false)).toBe('/choose')
    expect(postLoginTarget('general_manager', false)).toBe('/choose')
  })

  it('skips the chooser for dual-access roles in an installed PWA', () => {
    expect(postLoginTarget('admin', true)).toBe('/agent/dashboard')
    expect(postLoginTarget('general_manager', true)).toBe('/agent/overview')
  })

  it('routes mobile-only field roles straight to the field app', () => {
    expect(postLoginTarget('agent', false)).toBe('/agent/dashboard')
    expect(postLoginTarget('sales_rep', false)).toBe('/agent/dashboard')
  })

  it('treats admin and super_admin as dual-access', () => {
    expect(isDualAccess('admin')).toBe(true)
    expect(isDualAccess('super_admin')).toBe(true)
  })
})
