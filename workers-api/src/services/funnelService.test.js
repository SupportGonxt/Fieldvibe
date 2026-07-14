import { describe, it, expect } from 'vitest';
import {
  CONVERTED_SQL, VERIFIED_SQL, NOT_REJECTED_SQL,
  isConverted, sastDay, waterfall,
} from './funnelService.js';

describe('SQL fragments', () => {
  it('converted covers both legacy flags, parameterised alias', () => {
    const sql = CONVERTED_SQL('vi');
    expect(sql).toContain("json_extract(vi.custom_field_values,'$.consumer_converted') = 'Yes'");
    expect(sql).toContain("json_extract(vi.custom_field_values,'$.converted') = 1");
  });
  it('verified means BO-qualified', () => {
    expect(VERIFIED_SQL('vi')).toContain("'$.verification_status') = 'qualified'");
  });
  it('not-rejected defaults missing status to provisional', () => {
    expect(NOT_REJECTED_SQL('vi')).toContain("COALESCE(json_extract(vi.custom_field_values,'$.verification_status'),'provisional') != 'rejected'");
  });
});

describe('isConverted', () => {
  it('accepts object with either flag', () => {
    expect(isConverted({ consumer_converted: 'Yes' })).toBe(true);
    expect(isConverted({ converted: 1 })).toBe(true);
    expect(isConverted({ converted: '1' })).toBe(true);
  });
  it('accepts JSON string', () => {
    expect(isConverted('{"consumer_converted":"Yes"}')).toBe(true);
  });
  it('rejects everything else, never throws', () => {
    expect(isConverted({ consumer_converted: 'No' })).toBe(false);
    expect(isConverted(null)).toBe(false);
    expect(isConverted('not-json')).toBe(false);
    expect(isConverted(undefined)).toBe(false);
  });
});

describe('sastDay', () => {
  it('shifts UTC +2h', () => {
    // 23:30 UTC on Jan 1 = 01:30 SAST on Jan 2
    expect(sastDay(Date.parse('2026-01-01T23:30:00Z'))).toBe('2026-01-02');
    expect(sastDay(Date.parse('2026-01-01T12:00:00Z'))).toBe('2026-01-01');
  });
});

describe('waterfall', () => {
  it('multiplicative identity holds: factors recompose to deposits/target', () => {
    const w = waterfall({ fieldHours: 40, visits: 80, signups: 40, verified: 30, deposits: 15, target: 20 });
    const recomposed = 40 * w.visitsPerHour * w.signupsPerVisit * w.verifyRate * w.depositRate / 20;
    expect(recomposed).toBeCloseTo(w.attainment, 10);
    expect(w.attainment).toBeCloseTo(0.75, 10);
  });
  it('zero denominators yield null, never NaN/Infinity', () => {
    const w = waterfall({ fieldHours: 0, visits: 0, signups: 0, verified: 0, deposits: 0, target: 0 });
    expect(w.visitsPerHour).toBeNull();
    expect(w.signupsPerVisit).toBeNull();
    expect(w.verifyRate).toBeNull();
    expect(w.depositRate).toBeNull();
    expect(w.attainment).toBeNull();
    for (const v of Object.values(w)) expect(Number.isNaN(v)).toBe(false);
  });
});
