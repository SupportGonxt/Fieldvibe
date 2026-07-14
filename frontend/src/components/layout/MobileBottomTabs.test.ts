import { describe, it, expect } from 'vitest'
import { visibleTabsForRole } from './MobileBottomTabs'

const paths = (role: string) => visibleTabsForRole(role).map((t) => t.path)

describe('visibleTabsForRole (derived from capabilities.ts)', () => {
  it('manager (field role) never gets the Finance tab — /finance/* is admin-gated rand data', () => {
    expect(paths('manager')).not.toContain('/finance')
  })
  it('manager gets 5 tabs ending in More, from its allowed modules', () => {
    expect(paths('manager')).toEqual(['/dashboard', '/field-operations', '/sales', '/customers', '/more'])
  })
  it('backoffice_admin is admin-equivalent: Finance not filtered out by role', () => {
    expect(paths('backoffice_admin')).toEqual(paths('admin'))
  })
  it('field agent sees field/sales only, never Stock/Finance/Marketing', () => {
    expect(paths('agent')).toEqual(['/dashboard', '/field-operations', '/sales', '/customers', '/more'])
  })
  it('More tab is always present', () => {
    for (const role of ['agent', 'manager', 'admin', 'backoffice_admin', 'super_admin']) {
      expect(paths(role)).toContain('/more')
    }
  })
})
