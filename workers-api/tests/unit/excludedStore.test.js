import { describe, it, expect } from 'vitest';
import { normalizeStoreName, boundingBox, storesWithinRadius } from '../../src/services/excludedStore.js';

// Johannesburg CBD-ish; ~0.0009 deg latitude is ~100m.
const LAT = -26.2041;
const LNG = 28.0473;

describe('normalizeStoreName', () => {
  it('strips case, spaces and punctuation so the two checks agree on a store', () => {
    expect(normalizeStoreName('Shoprite (Soweto)')).toBe('SHOPRITESOWETO');
    expect(normalizeStoreName('  shoprite - soweto  ')).toBe('SHOPRITESOWETO');
    expect(normalizeStoreName("Pick n Pay #12")).toBe('PICKNPAY12');
  });

  it('is empty for nothing usable', () => {
    expect(normalizeStoreName('')).toBe('');
    expect(normalizeStoreName(null)).toBe('');
    expect(normalizeStoreName('---')).toBe('');
  });
});

describe('boundingBox', () => {
  it('covers the radius in both directions', () => {
    const box = boundingBox(LAT, LNG, 200);
    expect(box.minLat).toBeLessThan(LAT);
    expect(box.maxLat).toBeGreaterThan(LAT);
    // 200m of latitude is a touch under 0.0018 degrees
    expect(box.maxLat - LAT).toBeCloseTo(0.0018, 4);
    // Longitude degrees are smaller away from the equator, so its span is wider
    expect(box.maxLng - LNG).toBeGreaterThan(box.maxLat - LAT);
  });

  it('stays finite at the pole', () => {
    const box = boundingBox(90, 0, 200);
    expect(Number.isFinite(box.minLng)).toBe(true);
    expect(Number.isFinite(box.maxLng)).toBe(true);
  });
});

describe('storesWithinRadius', () => {
  const stores = [
    { id: 'near', name: 'Near Store', latitude: LAT + 0.0002, longitude: LNG },       // ~22m
    { id: 'edge', name: 'Edge Store', latitude: LAT + 0.0015, longitude: LNG },       // ~167m
    { id: 'far', name: 'Far Store', latitude: LAT + 0.01, longitude: LNG },           // ~1.1km
    { id: 'nogps', name: 'No GPS Store', latitude: null, longitude: null },
  ];

  it('keeps only stores inside the radius, nearest first', () => {
    const out = storesWithinRadius(LAT, LNG, stores, 200);
    expect(out.map(s => s.id)).toEqual(['near', 'edge']);
    expect(out[0].distance_meters).toBeLessThan(out[1].distance_meters);
  });

  it('tightening the radius drops the edge store', () => {
    expect(storesWithinRadius(LAT, LNG, stores, 50).map(s => s.id)).toEqual(['near']);
  });

  it('ignores stores with no coordinates', () => {
    expect(storesWithinRadius(LAT, LNG, stores, 200).some(s => s.id === 'nogps')).toBe(false);
  });

  it('handles an empty or missing list', () => {
    expect(storesWithinRadius(LAT, LNG, [], 200)).toEqual([]);
    expect(storesWithinRadius(LAT, LNG, undefined, 200)).toEqual([]);
  });
});
