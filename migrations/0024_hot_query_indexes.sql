-- Perf follow-up to 0023, driven by `wrangler d1 insights` on production.
--
-- 1. The incentive/leaderboard rollup filters visit_individuals by a created_at window
--    (`vi.created_at >= ? AND vi.created_at < ?`) but the table was only indexed on
--    visit_id, so SQLite drove the join from visits — all 50k of the tenant's rows —
--    and seeked vi per row: 190k rows read per run, 186 runs/day, 389ms average.
--    Note the query has no vi.tenant_id predicate, so a (tenant_id, created_at) index
--    is useless here: the leading column would be unconstrained. created_at alone is
--    what the planner can actually use.
CREATE INDEX IF NOT EXISTS idx_visit_individuals_created
  ON visit_individuals(created_at);

-- 2. The DB had no sqlite_stat1 at all. Without stats SQLite falls back to "assume
--    every index is equally selective", and it consistently chose to scan visits and
--    seek visit_individuals per row rather than range-scan the month-sized created_at
--    window. Verified with EXPLAIN QUERY PLAN against production: identical query,
--    before ANALYZE `SEARCH v USING INDEX idx_visits_agent (tenant_id=?)`, after
--    `SEARCH vi USING INDEX idx_visit_individuals_created (created_at>? AND ...)`.
--    This is a whole-DB effect, not one query's — every report join gets to pick a
--    plan on real cardinalities now.
--    Per-table rather than a bare `ANALYZE`: the DB is 1.4GB and a full ANALYZE risks
--    the D1 statement timeout. These are the tables the reports actually join.
ANALYZE visits;
ANALYZE visit_individuals;
ANALYZE visit_photos;
ANALYZE users;
ANALYZE capture_failures;
