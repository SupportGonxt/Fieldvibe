-- In-app voice calls: BO admin calls field agents over WebRTC (no tel:/WhatsApp).
-- bo_calls logs every call for productivity tracking; push_subscriptions rings the
-- agent PWA; bo_call_targets holds each BO admin's daily "agents contacted" target.

CREATE TABLE IF NOT EXISTS bo_calls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT,
  caller_id TEXT NOT NULL,          -- BO admin who initiated
  callee_id TEXT NOT NULL,          -- field agent
  status TEXT NOT NULL DEFAULT 'ringing', -- ringing|answered|missed|declined|failed
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  answered_at TEXT,
  ended_at TEXT,
  duration_s INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bo_calls_callee ON bo_calls(callee_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bo_calls_caller ON bo_calls(caller_id, created_at);

-- Web Push subscriptions per user. endpoint UNIQUE so re-subscribe upserts.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

-- Sparse: a missing row means the default target (20). PK on user_id.
CREATE TABLE IF NOT EXISTS bo_call_targets (
  user_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  company_id TEXT,
  daily_target INTEGER NOT NULL DEFAULT 20
);
