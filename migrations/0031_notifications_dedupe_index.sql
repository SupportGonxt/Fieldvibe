-- Cron dedupe lookup (src/cron/jobs.js) scanned ~34k notification rows per call.
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_type_related ON notifications(tenant_id, type, related_id);
