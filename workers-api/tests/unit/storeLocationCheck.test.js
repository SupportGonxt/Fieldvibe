import { describe, it, expect } from 'vitest';
import { evaluateNewStoreLocation, namePrefix, MISMATCH_DISTANCE_M, WEAK_ACCURACY_M } from '../../src/services/storeLocationCheck.js';

const LAT = -26.2041;
const LNG = 28.0473;
// ~0.0009 deg of latitude is ~100m, so 0.02 is a bit over 2km.
const FAR = { latitude: LAT + 0.02, longitude: LNG };
const NEAR = { latitude: LAT + 0.0002, longitude: LNG };

const store = (over = {}) => ({ name: 'Shoprite Soweto', address: '12 Vilakazi St', latitude: LAT, longitude: LNG, accuracy: 15, ...over });

describe('namePrefix', () => {
  it('takes the leading alphanumeric run for the SQL prefix filter', () => {
    expect(namePrefix('Shoprite (Soweto)')).toBe('SHOPRITE');
    expect(namePrefix('  7-Eleven')).toBe('7');
    expect(namePrefix('---')).toBe('');
    expect(namePrefix(null)).toBe('');
  });
});

describe('evaluateNewStoreLocation', () => {
  it('is quiet when the store is new and the fix is good', () => {
    expect(evaluateNewStoreLocation(store(), [])).toEqual([]);
  });

  it('flags a store whose name already exists far away', () => {
    const findings = evaluateNewStoreLocation(store(), [
      { id: 'c1', name: 'Shoprite (Soweto)', address: 'Old Potch Rd', ...FAR },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe('NAME_EXISTS_ELSEWHERE');
    expect(findings[0].existing_customer_id).toBe('c1');
    expect(findings[0].description).toContain('km from here');
  });

  it('says nothing when the existing store of that name is right here', () => {
    expect(evaluateNewStoreLocation(store(), [
      { id: 'c1', name: 'Shoprite Soweto', ...NEAR },
    ])).toEqual([]);
  });

  it('flags a typed address that already belongs to a store far away', () => {
    const findings = evaluateNewStoreLocation(store({ name: 'Brand New Spaza' }), [
      { id: 'c2', name: 'Kwa Mai Mai', address: '12 vilakazi st.', ...FAR },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe('ADDRESS_EXISTS_ELSEWHERE');
    expect(findings[0].existing_name).toBe('Kwa Mai Mai');
  });

  it('flags a store added with no GPS at all, and checks nothing else', () => {
    const findings = evaluateNewStoreLocation(store({ latitude: undefined, longitude: undefined }), [
      { id: 'c1', name: 'Shoprite Soweto', ...FAR },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].reason).toBe('NO_GPS');
  });

  it('flags a weak fix, since the pin it saves cannot be trusted', () => {
    const findings = evaluateNewStoreLocation(store({ accuracy: WEAK_ACCURACY_M + 50 }), []);
    expect(findings.map(f => f.reason)).toEqual(['WEAK_GPS']);
    expect(findings[0].severity).toBe('LOW');
  });

  it('ignores candidates that have no coordinates to compare against', () => {
    expect(evaluateNewStoreLocation(store(), [
      { id: 'c3', name: 'Shoprite Soweto', latitude: null, longitude: null },
    ])).toEqual([]);
  });

  it('treats just inside the threshold as the same place', () => {
    const justInside = { latitude: LAT + (MISMATCH_DISTANCE_M - 200) / 111320, longitude: LNG };
    expect(evaluateNewStoreLocation(store(), [{ id: 'c1', name: 'Shoprite Soweto', ...justInside }])).toEqual([]);
  });

  it('caps the findings so one bad name cannot bury the agent', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: 'Shoprite Soweto', ...FAR }));
    expect(evaluateNewStoreLocation(store(), many).length).toBeLessThanOrEqual(4);
  });

  it('does not match on an empty name or address', () => {
    expect(evaluateNewStoreLocation(store({ name: '', address: '' }), [
      { id: 'c1', name: '', address: '', ...FAR },
    ])).toEqual([]);
  });
});
