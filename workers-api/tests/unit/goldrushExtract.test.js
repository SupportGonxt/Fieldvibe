import { describe, it, expect } from 'vitest';
import { extractGoldrushId } from '../../src/lib/goldrush.js';

// Guards the admin photo-review goldrush_id line: it depends on extractGoldrushId
// pulling the id out of a dynamic custom-field key while ignoring the *_rejected /
// *_rejection_reason metadata keys that sit alongside it.
describe('extractGoldrushId (photo-review dependency)', () => {
  it('finds the id under a dynamic custom-field key', () => {
    expect(extractGoldrushId({ cf_9f3_goldrush_id: '123456789' })).toBe('123456789');
  });
  it('skips rejection metadata keys, returns the real id', () => {
    expect(extractGoldrushId({
      goldrush_id_rejected: 'true',
      goldrush_id_rejection_reason: 'blurry',
      goldrush_id_entry: '392536147',
    })).toBe('392536147');
  });
  it('returns empty string when absent or malformed input', () => {
    expect(extractGoldrushId({ other: 'x' })).toBe('');
    expect(extractGoldrushId(null)).toBe('');
    expect(extractGoldrushId('not-an-object')).toBe('');
  });
});
