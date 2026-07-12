import { describe, it, expect } from 'vitest';
import {
  severityOf, isBreached, nextOwnerRole, slaClockOf, slaAppliesTo,
} from './issueEngine.js';

// Ported 1:1 from issueEngine.js's demo() self-check — same assertions, real vitest cases.
const H = 3600000;

describe('issueEngine', () => {
  describe('severityOf', () => {
    it('single heavy signal = weight + 1 (count)', () => {
      expect(severityOf(['gone_quiet'])).toBe(6);
    });
    it('a heavy single still outranks two light signals', () => {
      // low_conversion(2)+late_start(1)+count(2) = 5 < gone_quiet(5)+1 = 6
      expect(severityOf(['low_conversion', 'late_start'])).toBeLessThan(severityOf(['gone_quiet']));
    });
    it('multi sums weights plus count', () => {
      expect(severityOf(['gone_quiet', 'below_target'])).toBe(5 + 4 + 2);
    });
    it('dedups then applies default weight 1 + count 1', () => {
      expect(severityOf(['x', 'x'])).toBe(2);
    });
    it('below_gate weight', () => {
      expect(severityOf(['below_gate'])).toBe(5);
    });
  });

  describe('isBreached', () => {
    it('team_lead breaches at exactly 48h', () => {
      expect(isBreached('team_lead', 0, 48 * H)).toBe(true);
    });
    it('team_lead ok before 48h', () => {
      expect(isBreached('team_lead', 0, 47 * H)).toBe(false);
    });
    it('manager breaches at 72h, not 71h', () => {
      expect(isBreached('manager', 0, 71 * H)).toBe(false);
      expect(isBreached('manager', 0, 72 * H)).toBe(true);
    });
    it('general_manager never breaches (null SLA)', () => {
      expect(isBreached('general_manager', 0, 9999 * H)).toBe(false);
    });
  });

  describe('nextOwnerRole', () => {
    it('climbs the ladder team_lead -> manager -> general_manager', () => {
      expect(nextOwnerRole('team_lead')).toBe('manager');
      expect(nextOwnerRole('manager')).toBe('general_manager');
    });
    it('general_manager tops out (null)', () => {
      expect(nextOwnerRole('general_manager')).toBeNull();
    });
  });

  describe('slaClockOf', () => {
    it('open issue runs from owner_since', () => {
      expect(slaClockOf({ status: 'open', owner_since: 'A', acted_at: 'B' })).toBe('A');
    });
    it('acted issue buys a fresh period from acted_at', () => {
      expect(slaClockOf({ status: 'acted', owner_since: 'A', acted_at: 'B' })).toBe('B');
    });
    it('acted with no acted_at = no clock (never escalate blind)', () => {
      expect(slaClockOf({ status: 'acted', owner_since: 'A' })).toBeNull();
    });
  });

  describe('slaAppliesTo', () => {
    it('deficit issues carry an SLA', () => {
      expect(slaAppliesTo({ polarity: 'deficit' })).toBe(true);
    });
    it('recognition issues never breach', () => {
      expect(slaAppliesTo({ polarity: 'recognition' })).toBe(false);
    });
  });
});
