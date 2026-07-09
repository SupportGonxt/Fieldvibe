import { describe, it, expect } from 'vitest';
import { rootCauseSignals } from './rootCauseSignals.js';

// One good-behaviour day: on-time start, full span, steady moving stops (~2km/hop).
function goodDay(date) {
  return [
    { visit_date: date, check_in_time: `${date}T06:00:00Z`, latitude: -26.20, longitude: 28.00 }, // 08:00 SAST
    { visit_date: date, check_in_time: `${date}T08:00:00Z`, latitude: -26.22, longitude: 28.01 },
    { visit_date: date, check_in_time: `${date}T10:30:00Z`, latitude: -26.20, longitude: 28.03 },
    { visit_date: date, check_in_time: `${date}T13:00:00Z`, latitude: -26.23, longitude: 28.02 }, // 15:00 SAST, 7h span
  ];
}

describe('rootCauseSignals', () => {
  it('stays silent below min_days', () => {
    expect(rootCauseSignals(goodDay('2026-07-01'))).toEqual([]);
  });

  it('flags nothing for on-time, full-span, low-travel days', () => {
    const rows = [...goodDay('2026-07-01'), ...goodDay('2026-07-02'), ...goodDay('2026-07-03')];
    expect(rootCauseSignals(rows)).toEqual([]);
  });

  it('flags late_start + short_field_day for late, brief days', () => {
    const late = (d) => [
      { visit_date: d, check_in_time: `${d}T08:30:00Z`, latitude: -26.2, longitude: 28.0 }, // 10:30 SAST
      { visit_date: d, check_in_time: `${d}T10:30:00Z`, latitude: -26.2, longitude: 28.0 }, // 2h span
    ];
    const rows = [...late('2026-07-01'), ...late('2026-07-02'), ...late('2026-07-03')];
    const types = rootCauseSignals(rows).map((s) => s.type);
    expect(types).toContain('late_start');
    expect(types).toContain('short_field_day');
  });

  it('flags excess_travel for far-apart hops', () => {
    const far = (d) => [
      { visit_date: d, check_in_time: `${d}T06:00:00Z`, latitude: -26.2, longitude: 28.0 },
      { visit_date: d, check_in_time: `${d}T13:00:00Z`, latitude: -25.7, longitude: 28.2 }, // ~57km
    ];
    const rows = [...far('2026-07-01'), ...far('2026-07-02'), ...far('2026-07-03')];
    expect(rootCauseSignals(rows).map((s) => s.type)).toContain('excess_travel');
  });

  it('flags idle_gaps for long low-movement gaps', () => {
    const idle = (d) => [
      { visit_date: d, check_in_time: `${d}T06:00:00Z`, latitude: -26.2, longitude: 28.0 },
      { visit_date: d, check_in_time: `${d}T09:00:00Z`, latitude: -26.2, longitude: 28.0 }, // 3h gap, 0km
      { visit_date: d, check_in_time: `${d}T13:00:00Z`, latitude: -26.2, longitude: 28.0 },
    ];
    const rows = [...idle('2026-07-01'), ...idle('2026-07-02'), ...idle('2026-07-03')];
    expect(rootCauseSignals(rows).map((s) => s.type)).toContain('idle_gaps');
  });
});
