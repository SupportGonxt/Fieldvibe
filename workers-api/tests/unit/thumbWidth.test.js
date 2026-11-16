import { describe, it, expect } from 'vitest';
import { parseThumbWidth } from '../../src/lib/photoAi.js';

describe('parseThumbWidth', () => {
  it('returns 0 for missing or invalid widths', () => {
    for (const raw of [undefined, '', 'abc', '0', '-5']) expect(parseThumbWidth(raw)).toBe(0);
  });
  it('parses and caps widths', () => {
    expect(parseThumbWidth('160')).toBe(160);
    expect(parseThumbWidth('99999')).toBe(1600);
  });
});
