// workers-api/tests/unit/goldrushVision.test.js
import { describe, it, expect } from 'vitest';
import { clampSharePct, parseStoreInsights } from '../../src/services/goldrushVision.js';

describe('clampSharePct', () => {
  it('rounds to one decimal', () => {
    expect(clampSharePct(42.37)).toBe(42.4);
    expect(clampSharePct(40)).toBe(40);
  });
  it('clamps out-of-range to 0..100', () => {
    expect(clampSharePct(150)).toBe(100);
    expect(clampSharePct(-5)).toBe(0);
  });
  it('parses numeric strings', () => {
    expect(clampSharePct('55.5')).toBe(55.5);
  });
  it('returns null for missing or non-numeric', () => {
    expect(clampSharePct(null)).toBeNull();
    expect(clampSharePct(undefined)).toBeNull();
    expect(clampSharePct('nope')).toBeNull();
    expect(clampSharePct(NaN)).toBeNull();
  });
});

describe('parseStoreInsights', () => {
  it('extracts up to 3 non-empty string insights', () => {
    const raw = JSON.stringify({ insights: ['a', 'b', 'c', 'd'] });
    expect(parseStoreInsights(raw)).toEqual(['a', 'b', 'c']);
  });
  it('drops non-strings and blanks', () => {
    const raw = JSON.stringify({ insights: ['ok', '  ', 5, null, 'two'] });
    expect(parseStoreInsights(raw)).toEqual(['ok', 'two']);
  });
  it('handles JSON wrapped in prose', () => {
    const raw = 'Here you go: {"insights":["clean signage"]} done';
    expect(parseStoreInsights(raw)).toEqual(['clean signage']);
  });
  it('returns [] for missing insights, bad JSON, or empty input', () => {
    expect(parseStoreInsights(JSON.stringify({ brand: 'x' }))).toEqual([]);
    expect(parseStoreInsights('not json at all')).toEqual([]);
    expect(parseStoreInsights('')).toEqual([]);
    expect(parseStoreInsights(null)).toEqual([]);
  });
});
