import { describe, it, expect } from 'vitest';
import {
  defaultDashboardConfig,
  assertPortalToken,
  inviteTokenExpired,
  serializeIndividualForPortal,
  serializeStoreForPortal,
  PORTAL_AGENT_FIELDS,
} from '../../src/services/portal.js';

describe('defaultDashboardConfig', () => {
  it('returns overview KPIs + individuals + stores + insights widgets scoped to the company', () => {
    const cfg = defaultDashboardConfig('co-1');
    expect(cfg.company_id).toBe('co-1');
    const types = cfg.widgets.map(w => w.type);
    expect(types).toEqual(['kpi', 'individuals_table', 'stores_table', 'insights']);
    cfg.widgets.forEach(w => {
      expect(typeof w.title).toBe('string');
      expect(w.title.length).toBeGreaterThan(0);
    });
  });
});

describe('assertPortalToken', () => {
  it('accepts a portal token', () => {
    expect(assertPortalToken({ aud: 'portal', portalUserId: 'p1', companyId: 'c1' })).toBe(true);
  });
  it('rejects a staff token (no aud) or wrong aud or missing portalUserId', () => {
    expect(() => assertPortalToken({ userId: 'u1', role: 'admin' })).toThrow();
    expect(() => assertPortalToken({ aud: 'staff', portalUserId: 'p1' })).toThrow();
    expect(() => assertPortalToken({ aud: 'portal' })).toThrow();
  });
});

describe('inviteTokenExpired', () => {
  it('true when past expiry, false when before', () => {
    const now = 1_000_000;
    expect(inviteTokenExpired(new Date((now - 10) * 1000).toISOString(), now)).toBe(true);
    expect(inviteTokenExpired(new Date((now + 10) * 1000).toISOString(), now)).toBe(false);
  });
  it('true for null/blank/unparseable expiry (fail closed)', () => {
    expect(inviteTokenExpired(null, 1000)).toBe(true);
    expect(inviteTokenExpired('', 1000)).toBe(true);
    expect(inviteTokenExpired('not-a-date', 1000)).toBe(true);
  });
});

describe('serializeIndividualForPortal / serializeStoreForPortal', () => {
  it('strips every agent/pay field from the row', () => {
    const row = { id: 'v1', first_name: 'A', agent_id: 'ag1', agent_name: 'Spy', commission: 5, tier: 'gold', keep: 'yes' };
    const out = serializeIndividualForPortal(row);
    PORTAL_AGENT_FIELDS.forEach(f => expect(out).not.toHaveProperty(f));
    expect(out.first_name).toBe('A');
    expect(out.keep).toBe('yes');
    const s = serializeStoreForPortal({ id: 's1', store_name: 'X', agent_name: 'Spy', uploaded_by: 'ag1' });
    expect(s).not.toHaveProperty('agent_name');
    expect(s).not.toHaveProperty('uploaded_by');
    expect(s.store_name).toBe('X');
  });
});
