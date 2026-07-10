-- Rebuild push_subscriptions in the Web Push (VAPID/aes128gcm) shape.
--
-- 0012_voice_calls.sql tried to create this table with CREATE TABLE IF NOT EXISTS, but
-- 0001_baseline.sql had already created a legacy native-token table
-- (id, user_id, token, platform, created_at), so 0012 silently no-opped. Every reader and
-- writer since then expects (tenant_id, endpoint, p256dh, auth) and throws against the
-- legacy shape: calls.js (ringing), kpi.js (remediation push), notify() in index.js.
--
-- DESTRUCTIVE: this drops the table. It is safe today only because the legacy table holds
-- zero rows in prod — no subscription is lost. Re-verify before applying:
--   npx wrangler d1 execute fieldvibe-db --remote --command "SELECT COUNT(*) FROM push_subscriptions"

DROP TABLE IF EXISTS push_subscriptions;

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(tenant_id, user_id);
