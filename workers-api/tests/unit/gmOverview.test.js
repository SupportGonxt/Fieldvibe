import { describe, it, expect } from 'vitest';
import { periodRange } from '../../src/routes/field-ops/gm.js';

describe('periodRange', () => {
  it('month: first to next-month-first', () => {
    const r = periodRange('month', '2026-07-06T09:00:00.000Z');
    expect(r.start).toBe('2026-07-01');
    expect(r.end).toBe('2026-08-01');
    expect(r.today).toBe('2026-07-06');
    expect(r.mode).toBe('month');
  });
  it('month wraps December to next year', () => {
    const r = periodRange('month', '2026-12-15T09:00:00.000Z');
    expect(r.start).toBe('2026-12-01');
    expect(r.end).toBe('2027-01-01');
  });
  it('day: today to tomorrow', () => {
    const r = periodRange('day', '2026-07-06T09:00:00.000Z');
    expect(r.start).toBe('2026-07-06');
    expect(r.end).toBe('2026-07-07');
  });
  it('week: Monday to tomorrow (2026-07-06 is a Monday)', () => {
    const r = periodRange('week', '2026-07-06T09:00:00.000Z');
    expect(r.start).toBe('2026-07-06');
    expect(r.end).toBe('2026-07-07');
  });
  it('week: mid-week resolves back to Monday', () => {
    // 2026-07-09 is a Thursday -> Monday is 2026-07-06
    const r = periodRange('week', '2026-07-09T09:00:00.000Z');
    expect(r.start).toBe('2026-07-06');
    expect(r.end).toBe('2026-07-10');
  });
  it('defaults unknown period to month', () => {
    expect(periodRange('bogus', '2026-07-06T09:00:00.000Z').start).toBe('2026-07-01');
  });
});
