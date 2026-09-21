-- GPS check-in asks "is the agent standing at a store this company must not visit?"
-- (/visits/check-location-excluded). It answers that with a bounding-box scan of
-- customers around the captured point, which without this index walks every
-- customer in the tenant on every check-in.
--
-- Leading tenant_id keeps it usable for the existing tenant-scoped reads too; the
-- latitude range is what the box actually narrows on, longitude is filtered from
-- the index entry rather than the row.
CREATE INDEX IF NOT EXISTS idx_customers_geo ON customers(tenant_id, latitude, longitude);
