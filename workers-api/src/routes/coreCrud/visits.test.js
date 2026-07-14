import { describe, it, expect } from 'vitest';
import { pickCustomFieldUpdates, CUSTOM_FIELD_UPDATE_KEYS } from './visits.js';

// PUT /visits/:id merges client custom_field_values into the visit_individuals
// blob (and store visit_responses). That blob also holds verification keys
// (converted, consumer_converted) that drive conversion counts and commissions.
// pickCustomFieldUpdates is the trust-boundary allowlist: only the Goldrush
// backfill/review keys may pass.
describe('pickCustomFieldUpdates', () => {
  it('drops disallowed fields (role, tenant_id, status, conversion/verification keys)', () => {
    const out = pickCustomFieldUpdates({
      role: 'admin',
      tenant_id: 'other-tenant',
      status: 'completed',
      converted: 1,
      consumer_converted: 'Yes',
      commission_amount: 99999,
      goldrush_id: '123456789',
    });
    expect(out).toEqual({ goldrush_id: '123456789' });
  });

  it('passes only the allowlisted goldrush keys, trimmed', () => {
    const out = pickCustomFieldUpdates({
      goldrush_id: '  123456789  ',
      goldrush_id_rejected: true,
      goldrush_id_rejection_reason: '  duplicate entry  ',
    });
    expect(out).toEqual({
      goldrush_id: '123456789',
      goldrush_id_rejected: true,
      goldrush_id_rejection_reason: 'duplicate entry',
    });
  });

  it('coerces goldrush_id_rejected to boolean and caps string lengths', () => {
    const out = pickCustomFieldUpdates({
      goldrush_id_rejected: 'truthy string',
      goldrush_id: '9'.repeat(100),
      goldrush_id_rejection_reason: 'x'.repeat(2000),
    });
    expect(out.goldrush_id_rejected).toBe(true);
    expect(out.goldrush_id.length).toBe(20);
    expect(out.goldrush_id_rejection_reason.length).toBe(500);
  });

  it('preserves explicit un-reject (false + empty reason) sent by the frontend', () => {
    const out = pickCustomFieldUpdates({ goldrush_id_rejected: false, goldrush_id_rejection_reason: '' });
    expect(out).toEqual({ goldrush_id_rejected: false, goldrush_id_rejection_reason: '' });
  });

  it('returns {} for non-object payloads (null, array, string), so no merge write happens', () => {
    for (const bad of [null, undefined, 'x', 42, ['goldrush_id'], { role: 'admin' }]) {
      expect(pickCustomFieldUpdates(bad)).toEqual({});
    }
  });

  it('allowlist stays exactly the goldrush trio', () => {
    expect(CUSTOM_FIELD_UPDATE_KEYS).toEqual(['goldrush_id', 'goldrush_id_rejected', 'goldrush_id_rejection_reason']);
  });
});
