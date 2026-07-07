/**
 * Call finalization logic — decides final status + duration when a call ends.
 * answered => duration from answered_at; never-answered => missed (or failed).
 */
import { describe, it, expect } from 'vitest';
import { finalizeCall } from '../../src/routes/field-ops/calls.js';

describe('finalizeCall', () => {
  it('answered call: status answered, duration from answered_at', () => {
    const r = finalizeCall(
      { answered_at: '2026-07-06T10:00:00.000Z', started_at: '2026-07-06T09:59:50.000Z' },
      '2026-07-06T10:01:30.000Z'
    );
    expect(r.status).toBe('answered');
    expect(r.duration_s).toBe(90);
  });

  it('never answered, no reason: missed, duration 0', () => {
    const r = finalizeCall({ answered_at: null, started_at: '2026-07-06T10:00:00.000Z' }, '2026-07-06T10:00:35.000Z');
    expect(r.status).toBe('missed');
    expect(r.duration_s).toBe(0);
  });

  it('never answered, reason=no_mic: failed', () => {
    const r = finalizeCall({ answered_at: null }, '2026-07-06T10:00:05.000Z', 'no_mic');
    expect(r.status).toBe('failed');
  });

  it('never answered, reason=failed: failed', () => {
    const r = finalizeCall({ answered_at: null }, '2026-07-06T10:00:05.000Z', 'failed');
    expect(r.status).toBe('failed');
  });

  it('clamps negative duration to 0 (clock skew)', () => {
    const r = finalizeCall({ answered_at: '2026-07-06T10:00:10.000Z' }, '2026-07-06T10:00:05.000Z');
    expect(r.duration_s).toBe(0);
  });
});
