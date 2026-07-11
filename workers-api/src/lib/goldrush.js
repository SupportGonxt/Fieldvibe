// KYC / goldrush capture helpers extracted from index.js (Task 22, verbatim).
// Shared: extractGoldrushId + goldrushIdExists still called by index.js visit handlers.

// Validate South African ID number (13 digits, valid date, Luhn checksum)
function validateSAIdNumber(idNumber) {
  if (!idNumber) return { valid: false, error: 'ID number is required' };
  const cleaned = String(idNumber).replace(/\s/g, '');
  if (!/^\d{13}$/.test(cleaned)) return { valid: false, error: 'ID number must be exactly 13 digits' };
  const month = parseInt(cleaned.substring(2, 4));
  const day = parseInt(cleaned.substring(4, 6));
  if (month < 1 || month > 12) return { valid: false, error: 'ID number contains invalid birth month' };
  if (day < 1 || day > 31) return { valid: false, error: 'ID number contains invalid birth day' };
  const citizenDigit = parseInt(cleaned[10]);
  if (citizenDigit !== 0 && citizenDigit !== 1) return { valid: false, error: 'ID number has invalid citizenship digit' };
  // Luhn check
  let sum = 0;
  let isEven = false;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]);
    if (isEven) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
    isEven = !isEven;
  }
  if (sum % 10 !== 0) return { valid: false, error: 'ID number failed checksum validation' };
  return { valid: true };
}

// Validate Goldrush ID (must be exactly 9 digits)
function validateGoldrushId(goldrushId) {
  if (!goldrushId) return { valid: false, error: 'Goldrush ID is required' };
  if (!/^\d{9}$/.test(String(goldrushId).trim())) return { valid: false, error: 'Goldrush ID must be exactly 9 digits' };
  return { valid: true };
}

// Find a goldrush player ID in a custom-field map (key contains 'goldrush_id',
// excluding the *_rejected / *_rejection_reason metadata keys).
function extractGoldrushId(obj) {
  if (!obj || typeof obj !== 'object') return '';
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (lk.includes('goldrush_id') && !lk.includes('rejected') && !lk.includes('rejection')) {
      if (v != null && String(v).trim()) return String(v).trim();
    }
  }
  return '';
}

// Whether a goldrush_id already exists in any visit_individuals row for the
// tenant. excludeVisitId skips the row(s) of the visit being edited so a
// re-save of the same value isn't flagged against itself.
async function goldrushIdExists(db, tenantId, goldrushId, excludeVisitId = null) {
  if (!goldrushId) return false;
  const sql = 'SELECT custom_field_values FROM visit_individuals WHERE tenant_id = ? AND custom_field_values LIKE ?'
    + (excludeVisitId ? ' AND visit_id != ?' : '');
  const binds = excludeVisitId
    ? [tenantId, `%${goldrushId}%`, excludeVisitId]
    : [tenantId, `%${goldrushId}%`];
  const rows = await db.prepare(sql).bind(...binds).all();
  for (const row of (rows.results || [])) {
    let parsed;
    try { parsed = JSON.parse(row.custom_field_values || '{}'); } catch { parsed = {}; }
    if (extractGoldrushId(parsed) === goldrushId) return true;
  }
  return false;
}
// Convergence: capture_failures is the generalized home for capture rejections
// (goldrush_upload_failures kept as a compat VIEW so legacy read sites keep resolving).
// Idempotent + recovery-safe: safe to call on every write; each abrupt-stop midpoint
// converges on the next call. ponytail: one sqlite_master probe per call = cheap early-return.
async function ensureCaptureFailures(db) {
  // Fast path: once the legacy name is a VIEW, migration is complete.
  const meta = await db.prepare(
    "SELECT type FROM sqlite_master WHERE name = 'goldrush_upload_failures'"
  ).first();
  if (meta && meta.type === 'view') return;

  await db.prepare(`CREATE TABLE IF NOT EXISTS capture_failures (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT, agent_id TEXT, agent_name TEXT,
    team_lead_id TEXT, team_lead_name TEXT, first_name TEXT, last_name TEXT, id_number TEXT,
    identifier_value TEXT, phone TEXT, error_id_number TEXT, error_goldrush_id TEXT,
    error_photo_mismatch TEXT, error_no_btag TEXT, visit_id TEXT, visit_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();

  if (meta && meta.type === 'table') {
    // The old physical table may predate later ALTER-added columns on a DB that never
    // logged a failure under recent code — add them (guarded) so the backfill SELECT resolves.
    try { await db.prepare("ALTER TABLE goldrush_upload_failures ADD COLUMN error_photo_mismatch TEXT").run(); } catch {}
    try { await db.prepare("ALTER TABLE goldrush_upload_failures ADD COLUMN error_no_btag TEXT").run(); } catch {}
    try { await db.prepare("ALTER TABLE goldrush_upload_failures ADD COLUMN visit_id TEXT").run(); } catch {}
    // Lossless backfill of historic rejections (goldrush_id -> identifier_value), then retire
    // the old physical table so the compat view can take its name.
    await db.prepare(`INSERT OR IGNORE INTO capture_failures
      (id, tenant_id, company_id, agent_id, agent_name, team_lead_id, team_lead_name,
       first_name, last_name, id_number, identifier_value, phone, error_id_number,
       error_goldrush_id, error_photo_mismatch, error_no_btag, visit_id, visit_date, created_at)
      SELECT id, tenant_id, company_id, agent_id, agent_name, team_lead_id, team_lead_name,
       first_name, last_name, id_number, goldrush_id, phone, error_id_number,
       error_goldrush_id, error_photo_mismatch, error_no_btag, visit_id, visit_date, created_at
      FROM goldrush_upload_failures`).run();
    await db.prepare("DROP TABLE goldrush_upload_failures").run();
  }

  // Compat view: every legacy read of `goldrush_upload_failures` keeps working; the renamed
  // identifier_value column is re-exposed under its old name `goldrush_id`.
  await db.prepare(
    "CREATE VIEW IF NOT EXISTS goldrush_upload_failures AS SELECT *, identifier_value AS goldrush_id FROM capture_failures"
  ).run();
}

export { validateSAIdNumber, validateGoldrushId, extractGoldrushId, goldrushIdExists, ensureCaptureFailures };
