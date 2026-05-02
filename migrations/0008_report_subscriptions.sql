-- Email recipients for scheduled report deliveries.
-- Table name is `report_email_subscriptions` to avoid conflict with the
-- existing `report_subscriptions` table (in-app/notification subscriptions
-- keyed by user_id, with a different schema).
CREATE TABLE IF NOT EXISTS report_email_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  report_key TEXT NOT NULL,                    -- e.g. 'goldrush-weekly-individuals' or 'goldrush-weekly-stores'
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_sent_at TEXT,
  last_sent_status TEXT,                        -- 'sent' | 'failed' | NULL
  last_sent_error TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_email_subs_active ON report_email_subscriptions(report_key, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_subs_tenant_report_email
  ON report_email_subscriptions(tenant_id, report_key, recipient_email);
