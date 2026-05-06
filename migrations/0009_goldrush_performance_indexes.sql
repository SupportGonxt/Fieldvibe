-- Add indexes to improve Goldrush Individuals report query performance
-- Issue: Slow initial page load due to missing indexes on frequently queried columns

-- Index for visit_type filtering (used in WHERE clause: LOWER(v.visit_type) = 'individual')
CREATE INDEX IF NOT EXISTS idx_visits_visit_type ON visits(tenant_id, visit_type);

-- Composite index for the most common query pattern in Goldrush reports
-- Covers: tenant_id, visit_type, and created_at (used for date filtering)
CREATE INDEX IF NOT EXISTS idx_visits_goldrush_query ON visits(tenant_id, visit_type, created_at);

-- Index to speed up visit_photos subquery (thumbnail lookups)
CREATE INDEX IF NOT EXISTS idx_visit_photos_visit_r2 ON visit_photos(visit_id, tenant_id, r2_url);

-- Index for visit_individuals JOIN
CREATE INDEX IF NOT EXISTS idx_visit_individuals_visit ON visit_individuals(visit_id, tenant_id);

-- Index for visit_responses lookup (questionnaire data)
CREATE INDEX IF NOT EXISTS idx_visit_responses_visit ON visit_responses(visit_id, visit_type);
