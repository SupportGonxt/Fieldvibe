-- Polarity-aware issues: deficit (existing accountability spine) vs recognition
-- (new positive-signal highlights). See docs/superpowers/specs/2026-07-11-field-ops-insights-actions-design.md
ALTER TABLE issues ADD COLUMN polarity TEXT NOT NULL DEFAULT 'deficit';

-- widen live-issue uniqueness so a subject can hold one live deficit issue
-- AND one live recognition highlight at the same time (previously subject-only).
DROP INDEX IF EXISTS idx_issues_live;
CREATE UNIQUE INDEX idx_issues_live ON issues(tenant_id, subject_id, polarity) WHERE status != 'resolved';

ALTER TABLE coaching_notes ADD COLUMN follow_up_date TEXT;
ALTER TABLE coaching_notes ADD COLUMN resource_link TEXT;
