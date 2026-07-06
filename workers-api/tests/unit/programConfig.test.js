import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CAPTURE_CONFIG, buildGoldrushConfig, identifierQuestion, validateIdentifier,
} from '../../src/services/programConfig.js';

describe('DEFAULT_CAPTURE_CONFIG', () => {
  it('is inert: no fast entry, no qualification', () => {
    expect(DEFAULT_CAPTURE_CONFIG).toEqual({
      fast_entry_enabled: false, qualification_enabled: false,
      qualification_identifier_key: null, capture_steps: [],
    });
  });
});

describe('identifierQuestion', () => {
  it('normalizes with defaults', () => {
    const q = identifierQuestion({ key: 'goldrush_id', label: 'Goldrush ID' });
    expect(q).toEqual({
      type: 'identifier', key: 'goldrush_id', label: 'Goldrush ID',
      min_length: null, max_length: null, unique: false,
      is_qualification_key: false, validation_kind: 'none',
    });
  });
});

describe('validateIdentifier', () => {
  it('numeric enforces digits + length', () => {
    const spec = { validation_kind: 'numeric', min_length: 9, max_length: 9 };
    expect(validateIdentifier('123456789', spec)).toEqual({ ok: true, reason: null });
    expect(validateIdentifier('12345678', spec).ok).toBe(false);   // too short
    expect(validateIdentifier('12345678a', spec).ok).toBe(false);  // non-digit
  });
  it('sa_id rejects bad checksum, accepts valid', () => {
    const spec = { validation_kind: 'sa_id' };
    expect(validateIdentifier('8001015009087', spec).ok).toBe(true);   // valid SA ID checksum
    expect(validateIdentifier('8001015009088', spec).ok).toBe(false);  // wrong check digit
  });
  it('passport is alphanumeric 6-12', () => {
    const spec = { validation_kind: 'passport' };
    expect(validateIdentifier('AB123456', spec).ok).toBe(true);
    expect(validateIdentifier('AB!23', spec).ok).toBe(false);
  });
});

describe('buildGoldrushConfig', () => {
  it('turns custom-question rows into config entries', () => {
    const rows = [
      { question_key: 'goldrush_id', question_label: 'Goldrush ID', field_type: 'text',
        min_length: 9, max_length: 9, check_duplicate: 1, visit_target_type: 'individual', show_in_reports: 1 },
      { question_key: 'likes_goldrush', question_label: 'Do they like Goldrush?', field_type: 'radio',
        visit_target_type: 'individual', show_in_reports: 1 },
    ];
    const cfg = buildGoldrushConfig({ tenantId: 't1', companyId: 'c1', rows });
    const byKey = Object.fromEntries(cfg.entries.map(e => [e.key, JSON.parse(e.value_json)]));
    expect(byKey['fast_entry_enabled']).toBe(true);
    expect(byKey['qualification_enabled']).toBe(true);
    expect(byKey['qualification_identifier_key']).toBe('goldrush_id');
    const step = byKey['capture_steps'].find(s => s.key === 'goldrush_id');
    expect(step).toMatchObject({ type: 'identifier', unique: true, is_qualification_key: true });
  });
});
