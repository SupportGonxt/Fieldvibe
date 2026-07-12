import { describe, it, expect } from 'vitest';
import { scoreAgentDay, demo } from './presenceScore.js';

// Johannesburg-ish customer; local SAST hour h -> UTC string (UTC = SAST-2).
const CUST = [{ latitude: -26.2041, longitude: 28.0473 }];
const at = (h) => `2026-07-12 ${String(h - 2).padStart(2, '0')}:00:00`;
const near = (h) => ({ latitude: -26.2042, longitude: 28.0474, recorded_at: at(h) });
const far = (h) => ({ latitude: -25.7479, longitude: 28.2293, recorded_at: at(h) }); // Pretoria ~55km

describe('scoreAgentDay statuses', () => {
  it('no_show when no points', () => {
    expect(scoreAgentDay([], CUST, {}).status).toBe('no_show');
  });

  it('no_show when all points fall outside work hours', () => {
    // 06:00 and 20:00 local — outside [8,17)
    const res = scoreAgentDay([near(6), near(20)], CUST, {});
    expect(res.status).toBe('no_show');
    expect(res.sampleCount).toBe(0);
  });

  it('low_coverage with fewer than minSamples in-window points', () => {
    expect(scoreAgentDay([near(10), near(12)], CUST, {}).status).toBe('low_coverage');
  });

  it('ok when enough near-customer points', () => {
    const res = scoreAgentDay([near(9), near(11), near(15)], CUST, {});
    expect(res.status).toBe('ok');
    expect(res.offZonePct).toBe(0);
    expect(res.sampleCount).toBe(3);
  });

  it('off_zone when >=60% of points are far from any customer', () => {
    const res = scoreAgentDay([far(9), far(11), far(14)], CUST, {});
    expect(res.status).toBe('off_zone');
    expect(res.offZonePct).toBe(100);
    expect(res.dominantCluster.nearCustomer).toBe(false);
  });
});

describe('empty customers guard', () => {
  it('never flags off_zone with no zones to judge', () => {
    const res = scoreAgentDay([far(9), far(11), far(14)], [], {});
    expect(res.status).toBe('ok');
    expect(res.offZonePct).toBe(0);
    expect(res.dominantCluster.nearCustomer).toBe(false);
  });
});

describe('lastSeenAt', () => {
  it('is the max recorded_at across ALL points, including out-of-window ones', () => {
    // 20:00 local is out of window but still the latest fix
    const res = scoreAgentDay([near(9), near(11), near(20)], CUST, {});
    expect(res.lastSeenAt).toBe(at(20));
    expect(res.sampleCount).toBe(2); // 20:00 excluded from window
  });

  it('is null with no points', () => {
    expect(scoreAgentDay([], CUST, {}).lastSeenAt).toBeNull();
  });
});

describe('demo self-check', () => {
  it('passes', () => {
    expect(demo()).toBe(true);
  });
});
