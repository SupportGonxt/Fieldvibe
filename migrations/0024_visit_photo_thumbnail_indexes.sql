-- Report thumbnails: stop reading the inline base64 blob.
--
-- visit_photos.r2_url holds the whole JPEG as a `data:` URI for 6,326 of 8,758 rows
-- (~85 KB each). Every report/list query selected it as thumbnail_url, so the goldrush
-- individuals report at its default LIMIT 5000 pulled ~430 MB through the D1 isolate and
-- failed outright with "D1 DB's isolate exceeded its memory limit" (code 7429).
--
-- Those queries now select '/api/uploads/'||r2_key instead. This index makes that path
-- index-only: it carries id as well as r2_key because a SQLite secondary index stores the
-- rowid, not a TEXT PRIMARY KEY, and without id the planner would fetch the base row and
-- read the blob anyway.
CREATE INDEX IF NOT EXISTS idx_visit_photos_visit_key ON visit_photos(visit_id, tenant_id, r2_key, id);

-- The legacy rows' R2 objects were never written (a `migrated/` key 404s in the bucket),
-- so /api/uploads/:key falls back to the D1 blob, looked up by r2_key.
CREATE INDEX IF NOT EXISTS idx_visit_photos_r2_key ON visit_photos(r2_key);

-- Undo 0009's idx_visit_photos_visit_r2 ON visit_photos(visit_id, tenant_id, r2_url).
-- It was created as a covering index for the thumbnail lookup, but its third column IS
-- the inline base64 JPEG, so "covering" meant every lookup read ~85 KB of index — 7.4s
-- for the 5,000 lookups one report page does, and roughly half a gigabyte of the 1.44 GB
-- database. SQLite preferred it over the new index, so the new index is inert until this
-- is gone. idx_visit_photos_visit_id(visit_id, tenant_id) and
-- idx_visit_photos_visit_key(visit_id, tenant_id, r2_key, id) both lead with the same
-- columns, so nothing loses its access path.
DROP INDEX IF EXISTS idx_visit_photos_visit_r2;
