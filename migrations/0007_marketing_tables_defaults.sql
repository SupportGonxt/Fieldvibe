-- Marketing tables decision defaults (item #6).
-- See docs/planning/06-marketing-tables-decision.md for the option matrix this implements:
--   Board installations  -> A: new first-class table (with backfill from visit_photos)
--   Promoters            -> B: filter users by role (no schema)
--   Merchandising compl. -> B: derive from visit_photos.ai_compliance_score (no schema)
--   Channel partners     -> B: add customers.partner_type

-- (1) Board installations table.
CREATE TABLE IF NOT EXISTS board_installations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT,
  visit_id TEXT,
  brand_id TEXT,
  board_type TEXT,                                  -- 'signage' | 'poster' | 'banner' | 'shelf_talker' | 'cooler' | 'other'
  condition TEXT,                                    -- 'good' | 'damaged' | 'faded' | 'missing'
  location_description TEXT,                         -- e.g. 'front entrance', 'aisle 4 endcap'
  placement_position TEXT,                           -- e.g. 'eye_level', 'top_shelf'
  installed_at TEXT,
  installed_by TEXT,                                 -- users.id
  photo_id TEXT,                                     -- visit_photos.id of the install evidence
  status TEXT DEFAULT 'active',                      -- 'active' | 'removed' | 'damaged'
  removed_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (visit_id) REFERENCES visits(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);
CREATE INDEX IF NOT EXISTS idx_board_inst_tenant_cust ON board_installations(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_board_inst_visit ON board_installations(visit_id);
CREATE INDEX IF NOT EXISTS idx_board_inst_status ON board_installations(tenant_id, status);

-- Backfill: one row per visit_photo where board_placement_location is set.
-- Uses INSERT OR IGNORE so re-running the migration won't duplicate.
INSERT OR IGNORE INTO board_installations (
  id, tenant_id, customer_id, visit_id, board_type, condition,
  location_description, placement_position, installed_at, installed_by,
  photo_id, status, created_at
)
SELECT
  vp.id || '-bi',
  vp.tenant_id,
  v.customer_id,
  vp.visit_id,
  COALESCE(vp.photo_type, 'signage'),
  COALESCE(vp.board_condition, 'good'),
  vp.board_placement_location,
  vp.board_placement_position,
  COALESCE(vp.captured_at, vp.created_at),
  vp.uploaded_by,
  vp.id,
  'active',
  vp.created_at
FROM visit_photos vp
LEFT JOIN visits v ON vp.visit_id = v.id AND v.tenant_id = vp.tenant_id
WHERE vp.board_placement_location IS NOT NULL
  AND vp.board_placement_location != '';

-- (2) Channel partners: tag a subset of customers as partners.
ALTER TABLE customers ADD COLUMN partner_type TEXT;
CREATE INDEX IF NOT EXISTS idx_customers_partner_type ON customers(tenant_id, partner_type);
