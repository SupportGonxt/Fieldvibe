-- Seed initial data for FieldVibe D1 Database

-- Default tenant
INSERT OR IGNORE INTO tenants (id, name, code, domain, status, subscription_plan, max_users, created_at)
VALUES ('default-tenant-001', 'Demo Company', 'DEMO', 'demo.fieldvibe.com', 'active', 'enterprise', 100, datetime('now'));

-- Super Admin user (password: SuperAdmin@2026!)
INSERT OR IGNORE INTO users (id, tenant_id, email, password_hash, first_name, last_name, phone, role, status, is_active, created_at)
VALUES ('super-admin-001', 'default-tenant-001', 'superadmin@fieldvibe.com', '$2b$10$IkVFZiNQrkDanLSKHT/rXeCbL7eTXkCnpWcES9VjlVuRA97pwe4eW', 'Super', 'Admin', '+27100000000', 'super_admin', 'active', 1, datetime('now'));

-- Admin user (password: admin123)
INSERT OR IGNORE INTO users (id, tenant_id, email, password_hash, first_name, last_name, phone, role, status, is_active, created_at)
VALUES ('admin-user-001', 'default-tenant-001', 'admin@demo.com', '$2b$10$KjbItQZTANkje1iozLTl3e9v57UTrSkwo12chehtr8IEr6HMhBGky', 'Admin', 'User', '+27123456789', 'admin', 'active', 1, datetime('now'));

-- Agent user (password: agent123)
INSERT OR IGNORE INTO users (id, tenant_id, email, password_hash, first_name, last_name, phone, role, status, is_active, manager_id, created_at)
VALUES ('agent-user-001', 'default-tenant-001', 'agent@demo.com', '$2b$10$KjbItQZTANkje1iozLTl3e9v57UTrSkwo12chehtr8IEr6HMhBGky', 'John', 'Agent', '+27987654321', 'agent', 'active', 1, 'admin-user-001', datetime('now'));

-- Manager user (password: admin123)
INSERT OR IGNORE INTO users (id, tenant_id, email, password_hash, first_name, last_name, phone, role, status, is_active, created_at)
VALUES ('manager-user-001', 'default-tenant-001', 'manager@demo.com', '$2b$10$KjbItQZTANkje1iozLTl3e9v57UTrSkwo12chehtr8IEr6HMhBGky', 'Sarah', 'Manager', '+27111222333', 'manager', 'active', 1, datetime('now'));

-- Sample regions
INSERT OR IGNORE INTO regions (id, tenant_id, name, code, status, created_at)
VALUES 
  ('region-001', 'default-tenant-001', 'Gauteng', 'GP', 'active', datetime('now')),
  ('region-002', 'default-tenant-001', 'Western Cape', 'WC', 'active', datetime('now')),
  ('region-003', 'default-tenant-001', 'KwaZulu-Natal', 'KZN', 'active', datetime('now'));

-- Sample areas
INSERT OR IGNORE INTO areas (id, tenant_id, region_id, name, code, status, created_at)
VALUES 
  ('area-001', 'default-tenant-001', 'region-001', 'Johannesburg CBD', 'JHB', 'active', datetime('now')),
  ('area-002', 'default-tenant-001', 'region-001', 'Sandton', 'SDT', 'active', datetime('now')),
  ('area-003', 'default-tenant-001', 'region-002', 'Cape Town', 'CPT', 'active', datetime('now'));

-- Sample routes
INSERT OR IGNORE INTO routes (id, tenant_id, area_id, name, code, salesman_id, status, created_at)
VALUES 
  ('route-001', 'default-tenant-001', 'area-001', 'Route Alpha', 'RA', 'agent-user-001', 'active', datetime('now')),
  ('route-002', 'default-tenant-001', 'area-001', 'Route Beta', 'RB', NULL, 'active', datetime('now')),
  ('route-003', 'default-tenant-001', 'area-002', 'Route Gamma', 'RC', NULL, 'active', datetime('now'));

-- Sample brands
INSERT OR IGNORE INTO brands (id, tenant_id, name, code, description, status, created_at)
VALUES 
  ('brand-001', 'default-tenant-001', 'Premium Brand', 'premium-brand', 'Premium quality products', 'active', datetime('now')),
  ('brand-002', 'default-tenant-001', 'Value Brand', 'value-brand', 'Great value products', 'active', datetime('now')),
  ('brand-003', 'default-tenant-001', 'Economy Brand', 'economy-brand', 'Affordable products', 'active', datetime('now'));

-- Sample categories
INSERT OR IGNORE INTO categories (id, tenant_id, brand_id, name, code, description, status, created_at)
VALUES 
  ('cat-001', 'default-tenant-001', 'brand-001', 'Beverages', 'beverages', 'Drinks and refreshments', 'active', datetime('now')),
  ('cat-002', 'default-tenant-001', 'brand-002', 'Snacks', 'snacks', 'Snacks and chips', 'active', datetime('now')),
  ('cat-003', 'default-tenant-001', 'brand-001', 'Dairy', 'dairy', 'Dairy products', 'active', datetime('now')),
  ('cat-004', 'default-tenant-001', 'brand-003', 'Frozen', 'frozen', 'Frozen food items', 'active', datetime('now'));

-- Sample products
INSERT OR IGNORE INTO products (id, tenant_id, name, code, sku, category_id, brand_id, unit_of_measure, price, cost_price, tax_rate, status, created_at)
VALUES 
  ('prod-001', 'default-tenant-001', 'Cola 500ml', 'COLA500', 'SKU001', 'cat-001', 'brand-001', 'bottle', 15.00, 8.50, 15, 'active', datetime('now')),
  ('prod-002', 'default-tenant-001', 'Orange Juice 1L', 'OJ1L', 'SKU002', 'cat-001', 'brand-001', 'bottle', 25.00, 14.50, 15, 'active', datetime('now')),
  ('prod-003', 'default-tenant-001', 'Potato Chips 150g', 'CHIPS150', 'SKU003', 'cat-002', 'brand-002', 'pack', 18.00, 10.00, 15, 'active', datetime('now')),
  ('prod-004', 'default-tenant-001', 'Milk 1L', 'MILK1L', 'SKU004', 'cat-003', 'brand-001', 'carton', 20.00, 12.00, 0, 'active', datetime('now')),
  ('prod-005', 'default-tenant-001', 'Ice Cream 500ml', 'ICE500', 'SKU005', 'cat-004', 'brand-003', 'tub', 45.00, 25.00, 15, 'active', datetime('now'));

-- Sample warehouses
INSERT OR IGNORE INTO warehouses (id, tenant_id, name, code, type, address, status, created_at)
VALUES 
  ('wh-001', 'default-tenant-001', 'Main Warehouse', 'MAIN', 'main', '123 Industrial Ave, Johannesburg', 'active', datetime('now')),
  ('wh-002', 'default-tenant-001', 'Distribution Center', 'DC01', 'distribution', '456 Logistics Blvd, Sandton', 'active', datetime('now'));

-- Sample stock levels
INSERT OR IGNORE INTO stock_levels (id, tenant_id, warehouse_id, product_id, quantity, reserved_quantity, reorder_level, created_at)
VALUES 
  ('sl-001', 'default-tenant-001', 'wh-001', 'prod-001', 1000, 0, 100, datetime('now')),
  ('sl-002', 'default-tenant-001', 'wh-001', 'prod-002', 500, 0, 50, datetime('now')),
  ('sl-003', 'default-tenant-001', 'wh-001', 'prod-003', 800, 0, 80, datetime('now')),
  ('sl-004', 'default-tenant-001', 'wh-001', 'prod-004', 600, 0, 60, datetime('now')),
  ('sl-005', 'default-tenant-001', 'wh-001', 'prod-005', 200, 0, 20, datetime('now'));

-- Sample customers
INSERT OR IGNORE INTO customers (id, tenant_id, name, code, type, customer_type, phone, email, address, latitude, longitude, route_id, credit_limit, outstanding_balance, payment_terms, category, status, created_at)
VALUES 
  ('cust-001', 'default-tenant-001', 'ABC Supermarket', 'ABC001', 'retail', 'SHOP', '+27111111111', 'abc@example.com', '100 Main St, Johannesburg', -26.2041, 28.0473, 'route-001', 10000, 0, 30, 'A', 'active', datetime('now')),
  ('cust-002', 'default-tenant-001', 'XYZ Convenience', 'XYZ001', 'retail', 'SHOP', '+27222222222', 'xyz@example.com', '200 Oak Ave, Sandton', -26.1076, 28.0567, 'route-001', 5000, 0, 15, 'B', 'active', datetime('now')),
  ('cust-003', 'default-tenant-001', 'Quick Mart', 'QM001', 'retail', 'SHOP', '+27333333333', 'qm@example.com', '300 Pine Rd, Randburg', -26.0939, 28.0069, 'route-002', 7500, 0, 30, 'B', 'active', datetime('now')),
  ('cust-004', 'default-tenant-001', 'Fresh Foods Wholesale', 'FF001', 'wholesale', 'DISTRIBUTOR', '+27444444444', 'ff@example.com', '400 Elm St, Midrand', -25.9868, 28.1237, 'route-002', 25000, 0, 45, 'A', 'active', datetime('now')),
  ('cust-005', 'default-tenant-001', 'Corner Store', 'CS001', 'retail', 'SHOP', '+27555555555', 'cs@example.com', '500 Maple Dr, Roodepoort', -26.1499, 27.8626, 'route-003', 3000, 0, 7, 'C', 'active', datetime('now'));

-- Sample campaign
INSERT OR IGNORE INTO campaigns (id, tenant_id, name, description, campaign_type, start_date, end_date, budget, status, created_by, created_at)
VALUES 
  ('camp-001', 'default-tenant-001', 'Summer Promo 2026', 'Summer promotional campaign', 'field_marketing', '2026-01-01', '2026-03-31', 50000, 'active', 'admin-user-001', datetime('now')),
  ('camp-002', 'default-tenant-001', 'New Product Launch', 'Launching new beverage line', 'product_launch', '2026-02-01', '2026-04-30', 25000, 'draft', 'admin-user-001', datetime('now'));

-- Sample commission rules
INSERT OR IGNORE INTO commission_rules (id, tenant_id, name, source_type, rate, min_threshold, is_active, created_at)
VALUES 
  ('cr-001', 'default-tenant-001', 'Sales Commission 5%', 'sales_order', 5.0, 0, 1, datetime('now')),
  ('cr-002', 'default-tenant-001', 'Visit Bonus R10', 'visit', 10.0, 0, 1, datetime('now'));

-- Sample questionnaire
INSERT OR IGNORE INTO questionnaires (id, tenant_id, name, visit_type, questions, is_default, is_active, created_at)
VALUES ('quest-001', 'default-tenant-001', 'Customer Visit Survey', 'customer', '[{"id":"q1","question":"Is the store open?","type":"boolean"},{"id":"q2","question":"Stock availability rating","type":"rating","min":1,"max":5},{"id":"q3","question":"Notes","type":"text"}]', 1, 1, datetime('now'));
