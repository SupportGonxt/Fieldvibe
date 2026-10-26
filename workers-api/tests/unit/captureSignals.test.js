import { describe, it, expect } from 'vitest';
import { captureSignals } from '../../src/lib/captureSignals.js';

const codes = (r) => r.map(f => `${f.code}:${f.level}`);
const base = { at: '2026-10-20T10:00:00.000Z', lat: -26.204103, lng: 28.047305, phone: '0821234590', idNumber: '9001015009087', name: 'Thabo Mokoena', goldrushId: '5550100', battery: '74' };
const ip = { country: 'ZA', lat: -26.2, lng: 28.04 };

describe('captureSignals', () => {
  it('passes a normal check-in', () => {
    const recent = [{ at: '2026-10-20T09:40:00.000Z', lat: -26.21, lng: 28.05, phone: '0731112233', idNumber: '8501015009081', name: 'Other Person', goldrushId: '5559999' }];
    expect(captureSignals({ cur: base, ip, recent, device: { otherAgents: 0, agentDevices: 1 } })).toEqual([]);
  });

  it('flags fake GPS', () => {
    expect(codes(captureSignals({ cur: { ...base, lat: 51.5, lng: -0.12 }, ip: { country: 'GB' } })))
      .toEqual(expect.arrayContaining(['GPS_OUTSIDE_SA:likely', 'IP_NOT_ZA:likely']));
    expect(codes(captureSignals({ cur: { ...base, lat: -26.2, lng: 28.05 }, ip }))).toContain('GPS_ROUNDED:review');
    expect(codes(captureSignals({ cur: base, ip: { country: 'ZA', lat: -33.92, lng: 18.42 } }))).toContain('GPS_IP_FAR:review');
  });

  it('flags a shared phone', () => {
    expect(codes(captureSignals({ cur: base, device: { otherAgents: 2, agentDevices: 1 } }))).toContain('DEVICE_SHARED:likely');
    expect(codes(captureSignals({ cur: base, device: { otherAgents: 1, agentDevices: 3 } }))).toEqual(['DEVICE_SHARED:review', 'AGENT_MULTI_DEVICE:review']);
  });

  it('flags impossible speed', () => {
    const near = [{ at: '2026-10-20T09:59:30.000Z', lat: -26.2041, lng: 28.0473 }];
    expect(codes(captureSignals({ cur: base, recent: near }))).toEqual(['BURST:review']);
    const far = [{ at: '2026-10-20T09:30:00.000Z', lat: -33.92, lng: 18.42 }];
    expect(codes(captureSignals({ cur: base, recent: far }))).toEqual(['GPS_TELEPORT:likely']);
  });

  it('flags generated customer details', () => {
    expect(codes(captureSignals({ cur: { ...base, phone: '0111111111' } }))).toContain('PHONE_PATTERN:likely');
    const recent = [{ at: '2026-10-19T10:00:00.000Z', phone: '0821234592', idNumber: '9001015009123', name: 'Thabo Mokoena', goldrushId: '5550101' }];
    expect(codes(captureSignals({ cur: base, recent })))
      .toEqual(['SEQUENTIAL_PHONE:review', 'SEQUENTIAL_SA_ID:likely', 'SAME_NAME_NEW_ID:review', 'SEQUENTIAL_GOLDRUSH_ID:review']);
  });

  it('flags a frozen battery but not 100% or a short span', () => {
    const b = (min) => ({ at: new Date(Date.parse(base.at) - min * 60e3).toISOString(), battery: '74' });
    expect(codes(captureSignals({ cur: base, batteryToday: [b(90), b(30)] }))).toEqual(['BATTERY_STUCK:likely']);
    expect(captureSignals({ cur: base, batteryToday: [b(40), b(20)] })).toEqual([]);
    expect(captureSignals({ cur: { ...base, battery: '100' }, batteryToday: [{ ...b(90), battery: '100' }, { ...b(30), battery: '100' }] })).toEqual([]);
  });
});
