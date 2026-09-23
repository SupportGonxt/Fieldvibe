import { describe, it, expect } from 'vitest';
import { isOutsideAgentHours, agentHoursEnforced, agentHoursBlocked } from '../../src/lib/agentHours.js';

// 06:59 / 07:00 / 18:59 / 19:00 SAST expressed in UTC (SAST = UTC+2)
const at = (hhmmUtc) => new Date(`2026-09-21T${hhmmUtc}:00.000Z`);

describe('isOutsideAgentHours', () => {
  it('is a 07:00–19:00 SAST window, end exclusive', () => {
    expect(isOutsideAgentHours(at('04:59'))).toBe(true);   // 06:59 SAST
    expect(isOutsideAgentHours(at('05:00'))).toBe(false);  // 07:00 SAST
    expect(isOutsideAgentHours(at('16:59'))).toBe(false);  // 18:59 SAST
    expect(isOutsideAgentHours(at('17:00'))).toBe(true);   // 19:00 SAST
    expect(isOutsideAgentHours(at('19:30'))).toBe(true);   // 21:30 SAST
  });
});

describe('agentHoursEnforced', () => {
  it('enforces in production and whenever the environment is unknown', () => {
    expect(agentHoursEnforced({ ENVIRONMENT: 'production' })).toBe(true);
    expect(agentHoursEnforced({})).toBe(true);
    expect(agentHoursEnforced(undefined)).toBe(true);
    expect(agentHoursEnforced({ ENVIRONMENT: 42 })).toBe(true);
  });

  it('is off for preview and local environments', () => {
    for (const e of ['preview', 'Preview', 'development', 'dev', 'test', 'local']) {
      expect(agentHoursEnforced({ ENVIRONMENT: e })).toBe(false);
    }
  });
});

describe('agentHoursBlocked', () => {
  it('blocks only when outside the window in an enforcing environment', () => {
    const evening = at('19:30');
    const midday = at('10:00');
    expect(agentHoursBlocked({ ENVIRONMENT: 'production' }, evening)).toBe(true);
    expect(agentHoursBlocked({ ENVIRONMENT: 'production' }, midday)).toBe(false);
    expect(agentHoursBlocked({ ENVIRONMENT: 'preview' }, evening)).toBe(false);
    expect(agentHoursBlocked({}, evening)).toBe(true);
  });
});
