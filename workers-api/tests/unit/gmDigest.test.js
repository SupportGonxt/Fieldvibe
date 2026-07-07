import { describe, it, expect } from 'vitest';
import { digestSlot } from '../../src/routes/field-ops/gm.js';

describe('digestSlot', () => {
  it('06:00 SAST -> morning', () => expect(digestSlot(6)).toBe('morning'));
  it('12:00 SAST -> midday', () => expect(digestSlot(12)).toBe('midday'));
  it('18:00 SAST -> evening', () => expect(digestSlot(18)).toBe('evening'));
  it('other hours -> null', () => {
    expect(digestSlot(9)).toBe(null);
    expect(digestSlot(0)).toBe(null);
    expect(digestSlot(23)).toBe(null);
  });
});
