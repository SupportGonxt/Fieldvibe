-- Diplomat store-audit flow. Idempotent — safe to re-run. Company is matched by
-- code 'DP' in the default tenant, so the same file works on both databases:
--
--   cd workers-api
--   npx wrangler d1 execute fieldvibe-dev --remote --file ../scripts/seed-diplomat-store-audit.sql   # preview
--   npx wrangler d1 execute fieldvibe-db  --remote --file ../scripts/seed-diplomat-store-audit.sql   # prod (after the frontend that knows these step keys is live)
--
-- Wizard pages: GPS → Visit Type → Store → Store Questions → Product Stock →
-- Product Photos → Store Photos (outside + layout) → Review & Submit.
-- Store Questions / Product Stock write into the product_audit question below;
-- Product Photos are visit photos of type 'product'.

-- 1. The product_audit question, with the 17-product range. Only inserted when the
--    company has no active product_audit question yet (preview already has one).
INSERT INTO company_custom_questions
  (id, tenant_id, company_id, question_label, question_key, field_type, field_options, is_required, display_order, visit_target_type, is_active, show_in_reports, created_at, updated_at)
SELECT
  'ccq-diplomat-product-range-audit', c.tenant_id, c.id, 'Product Range Audit', 'product_range_audit', 'product_audit',
  '["CDM ORIGINAL 12G LUP","CHAPPIES SPEARMINT 100''S","CHAPPIES WATERMELON 100''S","CLORETS FRESH MINT SUGARED 2PC 56X40","CLORETS ORIGINAL SUGARED 2PC 56X40","ECLAIRS ORIGINAL 230G","HALLS CHERRY 72 X 48","HALLS FRUIT EXPLOSION POLY BAGS","HALLS ICE BLUE 72 X 48","HALLS XTRA STRONG POLYBAG 72PC","MINI LUNCH BAR MINI X 24","MINI PS CARAMILK X 24","OREO ORIGINAL LUP 41.57G","STIMOROL AR MNTHL SF 2PX50X30","STIMOROL INFINITY MINT 50PC","STIMOROL INFINITY TROPICAL 50PC","STIMOROL W/CHERY SF 2PX50X30"]',
  1, 1, 'store', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM field_companies c
WHERE c.code = 'DP' AND c.tenant_id = 'default-tenant-001'
  AND NOT EXISTS (
    SELECT 1 FROM company_custom_questions q
    WHERE q.company_id = c.id AND q.field_type = 'product_audit' AND q.is_active = 1
  );

-- 2. The process flow and its steps (steps are replaced wholesale so re-runs converge).
INSERT OR IGNORE INTO process_flows (id, tenant_id, name, description, is_default, is_active)
VALUES ('pf-diplomat-store-audit', 'default-tenant-001', 'Diplomat Store Audit',
        'Store questions, product stock check, bulk product photos, two store photos', 0, 1);
UPDATE process_flows SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 'pf-diplomat-store-audit';

DELETE FROM process_flow_steps WHERE process_flow_id = 'pf-diplomat-store-audit';
INSERT INTO process_flow_steps (id, tenant_id, process_flow_id, step_key, step_label, step_order, is_required, is_active, config) VALUES
  ('pf-diplomat-store-audit-1', 'default-tenant-001', 'pf-diplomat-store-audit', 'gps',             'GPS Check-in',    1, 1, 1, '{}'),
  ('pf-diplomat-store-audit-2', 'default-tenant-001', 'pf-diplomat-store-audit', 'visit_type',      'Visit Type',      2, 1, 1, '{}'),
  ('pf-diplomat-store-audit-3', 'default-tenant-001', 'pf-diplomat-store-audit', 'details',         'Store',           3, 1, 1, '{}'),
  ('pf-diplomat-store-audit-4', 'default-tenant-001', 'pf-diplomat-store-audit', 'store_questions', 'Store Questions', 4, 1, 1, '{}'),
  ('pf-diplomat-store-audit-5', 'default-tenant-001', 'pf-diplomat-store-audit', 'stock_check',     'Product Stock',   5, 1, 1, '{}'),
  ('pf-diplomat-store-audit-6', 'default-tenant-001', 'pf-diplomat-store-audit', 'product_photos',  'Product Photos',  6, 1, 1, '{}'),
  ('pf-diplomat-store-audit-7', 'default-tenant-001', 'pf-diplomat-store-audit', 'photo',           'Store Photos',    7, 1, 1, '{}'),
  ('pf-diplomat-store-audit-8', 'default-tenant-001', 'pf-diplomat-store-audit', 'review',          'Review & Submit', 8, 1, 1, '{}');

-- 3. Make it the company's store flow (replacing whatever store flow was assigned).
DELETE FROM company_process_flows
WHERE visit_target_type IN ('store', 'both')
  AND company_id IN (SELECT id FROM field_companies WHERE code = 'DP' AND tenant_id = 'default-tenant-001');
INSERT INTO company_process_flows (id, tenant_id, company_id, process_flow_id, visit_target_type)
SELECT 'cpf-diplomat-store-audit', c.tenant_id, c.id, 'pf-diplomat-store-audit', 'store'
FROM field_companies c
WHERE c.code = 'DP' AND c.tenant_id = 'default-tenant-001';
