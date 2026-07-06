// Pure config-shape helpers. No DB, no I/O. The single source of truth for the
// shapes stored in program_config so migration + routes agree.

export const DEFAULT_CAPTURE_CONFIG = {
  fast_entry_enabled: false,
  qualification_enabled: false,
  qualification_identifier_key: null,
  capture_steps: [],
};

export function identifierQuestion(spec) {
  return {
    type: 'identifier',
    key: spec.key,
    label: spec.label,
    min_length: spec.min_length ?? null,
    max_length: spec.max_length ?? null,
    unique: spec.unique ?? false,
    is_qualification_key: spec.is_qualification_key ?? false,
    validation_kind: spec.validation_kind ?? 'none',
  };
}

// SA ID: 13 digits, Luhn-style check digit (mod-10 doubling from the right).
function saIdValid(v) {
  if (!/^\d{13}$/.test(v)) return false;
  let sum = 0, alt = false;
  for (let i = v.length - 1; i >= 0; i--) {
    let n = Number(v[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

export function validateIdentifier(value, spec = {}) {
  const s = String(value ?? '');
  const kind = spec.validation_kind ?? 'none';
  if (spec.min_length != null && s.length < spec.min_length) return { ok: false, reason: 'too_short' };
  if (spec.max_length != null && s.length > spec.max_length) return { ok: false, reason: 'too_long' };
  if (kind === 'numeric' && !/^\d+$/.test(s)) return { ok: false, reason: 'not_numeric' };
  if (kind === 'sa_id' && !saIdValid(s)) return { ok: false, reason: 'bad_sa_id' };
  if (kind === 'passport' && !/^[A-Za-z0-9]{6,12}$/.test(s)) return { ok: false, reason: 'bad_passport' };
  return { ok: true, reason: null };
}

// Build goldrush's program_config entries from its existing company_custom_questions rows.
// rows: [{ question_key, question_label, field_type, min_length, max_length, check_duplicate,
//          visit_target_type, show_in_reports }]
export function buildGoldrushConfig({ tenantId, companyId, rows }) {
  const captureSteps = rows
    // goldrush_id_entry is collapsed into goldrush_id by canonicalization; its
    // source row would otherwise map to a dead text step nothing writes to.
    .filter(r => r.question_key !== 'goldrush_id_entry')
    .map(r => {
    if (r.question_key === 'goldrush_id') {
      return identifierQuestion({
        key: 'goldrush_id', label: r.question_label,
        min_length: r.min_length ?? 9, max_length: r.max_length ?? 9,
        unique: true, is_qualification_key: true, validation_kind: 'numeric',
      });
    }
    return {
      type: r.field_type || 'text',
      key: r.question_key,
      label: r.question_label,
      show_in_reports: !!r.show_in_reports,
      visit_target_type: r.visit_target_type || 'both',
    };
  });
  const entries = [
    { key: 'fast_entry_enabled', value_json: JSON.stringify(true) },
    { key: 'qualification_enabled', value_json: JSON.stringify(true) },
    { key: 'qualification_identifier_key', value_json: JSON.stringify('goldrush_id') },
    { key: 'capture_steps', value_json: JSON.stringify(captureSteps) },
  ];
  return { tenant_id: tenantId, company_id: companyId, entries };
}
