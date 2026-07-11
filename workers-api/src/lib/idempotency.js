// Moved verbatim from index.js.
import { v4 as uuidv4 } from 'uuid';

// ==================== IDEMPOTENCY HELPER (BUG-006) ====================
async function checkIdempotency(c, db, tenantId) {
  const key = c.req.header('X-Idempotency-Key');
  if (!key) return null;
  try {
    const existing = await db.prepare('SELECT response_body, response_status FROM idempotency_keys WHERE idempotency_key = ? AND tenant_id = ?').bind(key, tenantId).first();
    if (existing) return c.json(JSON.parse(existing.response_body), existing.response_status);
  } catch(e) {}
  return null;
}
async function saveIdempotency(db, tenantId, c, responseBody, status) {
  const key = c.req.header('X-Idempotency-Key');
  if (!key) return;
  try {
    await db.prepare("INSERT OR IGNORE INTO idempotency_keys (id, tenant_id, idempotency_key, response_body, response_status) VALUES (?, ?, ?, ?, ?)").bind(uuidv4(), tenantId, key, JSON.stringify(responseBody), status).run();
  } catch(e) {}
}

export { checkIdempotency, saveIdempotency };
