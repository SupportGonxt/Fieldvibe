import { describe, it, expect } from 'vitest';
import {
  roleAllows, canSeeMoney, stripMonetary, ADMIN_EQUIVALENT, FIELD_ROLES,
} from '../../src/lib/capabilities.js';

describe('roleAllows', () => {
  it('super_admin passes any gate', () => {
    expect(roleAllows('super_admin', ['team_lead'])).toBe(true);
  });
  it('admin-equivalents pass every staff gate below super_admin', () => {
    for (const r of ['admin', 'backoffice_admin', 'general_manager']) {
      expect(roleAllows(r, ['manager'])).toBe(true);
      expect(roleAllows(r, ['admin'])).toBe(true);
    }
  });
  it('field roles pass only when listed', () => {
    expect(roleAllows('team_lead', ['team_lead', 'manager'])).toBe(true);
    expect(roleAllows('agent', ['team_lead', 'manager'])).toBe(false);
  });
  it('company portal roles never pass staff gates', () => {
    expect(roleAllows('company_viewer', ['admin'])).toBe(false);
    expect(roleAllows('company_admin', ['manager'])).toBe(false);
  });
  it('unknown/missing role fails closed', () => {
    expect(roleAllows(undefined, ['admin'])).toBe(false);
    expect(roleAllows('', ['admin'])).toBe(false);
  });
});

describe('canSeeMoney', () => {
  it('GM and admin-equivalents see money', () => {
    for (const r of ['super_admin', 'admin', 'backoffice_admin', 'general_manager']) {
      expect(canSeeMoney(r)).toBe(true);
    }
  });
  it('field roles never see money — including manager and team_lead', () => {
    for (const r of FIELD_ROLES) expect(canSeeMoney(r)).toBe(false);
  });
});

describe('stripMonetary', () => {
  const payload = {
    signups: 12, verified: 8, deposits: 5,
    revenue: 375, payable: 1200,
    nested: { deposits: 5, amount: 75, list: [{ converted: 3, commission: 10 }] },
  };
  it('passes counts, strips rand fields deep, for field roles', () => {
    const out = stripMonetary(payload, 'team_lead');
    expect(out.signups).toBe(12);
    expect(out.deposits).toBe(5);
    expect(out.revenue).toBeUndefined();
    expect(out.payable).toBeUndefined();
    expect(out.nested.amount).toBeUndefined();
    expect(out.nested.deposits).toBe(5);
    expect(out.nested.list[0].commission).toBeUndefined();
    expect(out.nested.list[0].converted).toBe(3);
  });
  it('returns payload untouched for money-visible roles', () => {
    expect(stripMonetary(payload, 'general_manager')).toEqual(payload);
  });
  it('fails closed on unknown role — strips', () => {
    expect(stripMonetary(payload, 'company_viewer').revenue).toBeUndefined();
    expect(stripMonetary(payload, undefined).revenue).toBeUndefined();
  });
  it('handles primitives and arrays', () => {
    expect(stripMonetary(7, 'agent')).toBe(7);
    expect(stripMonetary([{ payable: 1, signups: 2 }], 'agent')).toEqual([{ signups: 2 }]);
  });
});

describe('role lists', () => {
  it('admin-equivalent and field lists are disjoint', () => {
    expect(ADMIN_EQUIVALENT.filter((r) => FIELD_ROLES.includes(r))).toEqual([]);
  });
});

// append to workers-api/tests/unit/capabilities.test.js
import { requireRole } from '../../src/lib/middleware.js';

describe('requireRole middleware (consolidated)', () => {
  const run = async (role, ...roles) => {
    let nexted = false;
    let jsonArgs = null;
    const c = {
      get: (k) => (k === 'role' ? role : undefined),
      json: (...a) => { jsonArgs = a; return 'json-response'; },
    };
    await requireRole(...roles)(c, async () => { nexted = true; });
    return { nexted, jsonArgs };
  };

  it('backoffice_admin passes an admin gate (equivalence)', async () => {
    expect((await run('backoffice_admin', 'admin')).nexted).toBe(true);
  });
  it('general_manager passes a manager gate', async () => {
    expect((await run('general_manager', 'manager')).nexted).toBe(true);
  });
  it('agent blocked from admin gate with 403', async () => {
    const { nexted, jsonArgs } = await run('agent', 'admin');
    expect(nexted).toBe(false);
    expect(jsonArgs[1]).toBe(403);
  });
  it('listed role passes', async () => {
    expect((await run('team_lead', 'team_lead')).nexted).toBe(true);
  });
});
