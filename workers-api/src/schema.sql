-- FieldVibe D1 Database Schema
-- Complete schema for Field Operations & Sales Intelligence Platform

-- ==================== CORE TABLES ====================

-- Tenants (Companies)
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  domain TEXT,
  status TEXT DEFAULT 'active',
  subscription_plan TEXT DEFAULT 'basic',
  max_users INTEGER DEFAULT 10,
  features TEXT,
  variance_threshold REAL DEFAULT 0.01,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  manager_id TEXT,
  team_lead_id TEXT,
  status TEXT DEFAULT 'active',
  is_active INTEGER DEFAULT 1,
  admin_viewable_password TEXT,
  last_login TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (manager_id) REFERENCES users(id),
  FOREIGN KEY (team_lead_id) REFERENCES users(id)
);

-- Regions
CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Areas
CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  region_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (region_id) REFERENCES regions(id)
);

-- Routes
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  area_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  salesman_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (area_id) REFERENCES areas(id)
);

-- Brands
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  brand_id TEXT,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  parent_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  category_id TEXT,
  brand_id TEXT,
  unit_of_measure TEXT,
  price REAL DEFAULT 0,
  cost_price REAL DEFAULT 0,
  tax_rate REAL DEFAULT 15,
  image_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

-- ==================== CUSTOMERS / SHOPS ====================

-- Customers (Shops) - Extended with FieldVibe customer fields
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  type TEXT DEFAULT 'retail',
  customer_type TEXT DEFAULT 'SHOP',
  contact_person TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  route_id TEXT,
  credit_limit REAL DEFAULT 0,
  outstanding_balance REAL DEFAULT 0,
  payment_terms INTEGER DEFAULT 0,
  category TEXT DEFAULT 'B',
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (route_id) REFERENCES routes(id)
);

-- ==================== VISITS / CHECK-INS ====================

-- Visits (Check-ins)
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  customer_id TEXT,
  visit_date TEXT NOT NULL,
  visit_type TEXT DEFAULT 'customer',
  check_in_time TEXT,
  check_out_time TEXT,
  latitude REAL,
  longitude REAL,
  photo_url TEXT,
  photo_base64 TEXT,
  additional_photos TEXT,
  brand_id TEXT,
  category_id TEXT,
  product_id TEXT,
  individual_name TEXT,
  individual_surname TEXT,
  individual_id_number TEXT,
  individual_phone TEXT,
  purpose TEXT,
  outcome TEXT,
  notes TEXT,
  questionnaire_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

-- Visit Responses (Questionnaire answers)
CREATE TABLE IF NOT EXISTS visit_responses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  visit_type TEXT,
  responses TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (visit_id) REFERENCES visits(id)
);

-- ==================== QUESTIONNAIRES ====================

CREATE TABLE IF NOT EXISTS questionnaires (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  visit_type TEXT DEFAULT 'customer',
  brand_id TEXT,
  questions TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);

-- ==================== GOALS ====================

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT DEFAULT 'visits',
  target_value REAL NOT NULL,
  current_value REAL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'active',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS goal_assignments (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  target_value REAL,
  current_value REAL DEFAULT 0,
  FOREIGN KEY (goal_id) REFERENCES goals(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==================== WAREHOUSES & STOCK ====================

CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT DEFAULT 'main',
  address TEXT,
  latitude REAL,
  longitude REAL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS stock_levels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  reorder_level INTEGER DEFAULT 10,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  warehouse_id TEXT,
  product_id TEXT NOT NULL,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  po_number TEXT NOT NULL,
  supplier_name TEXT,
  warehouse_id TEXT NOT NULL,
  total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  received_at TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  unit_cost REAL NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ==================== SALES ORDERS ====================

CREATE TABLE IF NOT EXISTS sales_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  customer_id TEXT,
  visit_id TEXT,
  order_type TEXT DEFAULT 'direct_sale',
  status TEXT DEFAULT 'draft',
  subtotal REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'pending',
  notes TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  van_stock_load_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (agent_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (visit_id) REFERENCES visits(id)
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id TEXT PRIMARY KEY,
  sales_order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  discount_percent REAL DEFAULT 0,
  line_total REAL NOT NULL,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  sales_order_id TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  reference TEXT,
  status TEXT DEFAULT 'completed',
  received_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id)
);

-- ==================== VAN SALES ====================

CREATE TABLE IF NOT EXISTS van_stock_loads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  vehicle_reg TEXT NOT NULL,
  warehouse_id TEXT,
  status TEXT DEFAULT 'loaded',
  load_date TEXT DEFAULT CURRENT_TIMESTAMP,
  depart_time TEXT,
  return_time TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (agent_id) REFERENCES users(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE IF NOT EXISTS van_stock_load_items (
  id TEXT PRIMARY KEY,
  van_stock_load_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity_loaded INTEGER NOT NULL DEFAULT 0,
  quantity_sold INTEGER DEFAULT 0,
  quantity_returned INTEGER DEFAULT 0,
  quantity_damaged INTEGER DEFAULT 0,
  FOREIGN KEY (van_stock_load_id) REFERENCES van_stock_loads(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS van_reconciliations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  van_stock_load_id TEXT NOT NULL,
  cash_expected REAL DEFAULT 0,
  cash_actual REAL DEFAULT 0,
  variance REAL DEFAULT 0,
  denominations TEXT,
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_at TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (van_stock_load_id) REFERENCES van_stock_loads(id)
);

-- ==================== CAMPAIGNS & PROMOTIONS ====================

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT DEFAULT 'field_marketing',
  start_date TEXT,
  end_date TEXT,
  budget REAL DEFAULT 0,
  actual_cost REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS campaign_assignments (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  territory_notes TEXT,
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  name TEXT NOT NULL,
  location_description TEXT,
  customer_id TEXT,
  agent_id TEXT,
  scheduled_start TEXT,
  scheduled_end TEXT,
  actual_start TEXT,
  actual_end TEXT,
  start_latitude REAL,
  start_longitude REAL,
  end_latitude REAL,
  end_longitude REAL,
  status TEXT DEFAULT 'scheduled',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (agent_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activation_performances (
  id TEXT PRIMARY KEY,
  activation_id TEXT NOT NULL,
  interactions_count INTEGER DEFAULT 0,
  samples_distributed INTEGER DEFAULT 0,
  sales_generated REAL DEFAULT 0,
  photos TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activation_id) REFERENCES activations(id)
);

CREATE TABLE IF NOT EXISTS promotion_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rule_type TEXT DEFAULT 'discount',
  config TEXT,
  product_filter TEXT,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- ==================== COMMISSIONS ====================

CREATE TABLE IF NOT EXISTS commission_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  rate REAL NOT NULL,
  min_threshold REAL DEFAULT 0,
  max_cap REAL,
  product_filter TEXT,
  effective_from TEXT,
  effective_to TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS commission_earnings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  earner_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  rule_id TEXT,
  rate REAL NOT NULL,
  base_amount REAL NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  period_start TEXT,
  period_end TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (earner_id) REFERENCES users(id),
  FOREIGN KEY (rule_id) REFERENCES commission_rules(id)
);

-- ==================== NOTIFICATIONS ====================

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  is_read INTEGER DEFAULT 0,
  related_type TEXT,
  related_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'web',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==================== AUDIT LOG ====================

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==================== CROSS-TENANT ====================

CREATE TABLE IF NOT EXISTS agent_company_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  role_override TEXT,
  granted_by TEXT,
  granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- ==================== RBAC ====================

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ==================== SETTINGS ====================

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  category TEXT DEFAULT 'general',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(tenant_id, customer_type);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_visits_tenant ON visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visits_agent ON visits(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(tenant_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant ON sales_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_agent ON sales_orders(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_date ON sales_orders(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status ON sales_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_van_loads_tenant ON van_stock_loads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_van_loads_agent ON van_stock_loads(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_tenant ON stock_levels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stock_levels_warehouse ON stock_levels(warehouse_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_earnings_tenant ON commission_earnings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_earnings_earner ON commission_earnings(tenant_id, earner_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_assignments ON agent_company_assignments(user_id, tenant_id);

-- ==================== ADDITIONAL TABLES ====================

-- Vans
CREATE TABLE IF NOT EXISTS vans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  registration_number TEXT DEFAULT '',
  driver_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Beats (Sales Routes)
CREATE TABLE IF NOT EXISTS beats (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Route Customers
CREATE TABLE IF NOT EXISTS route_customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  sequence_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Agent Locations (GPS Tracking)
CREATE TABLE IF NOT EXISTS agent_locations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  accuracy REAL,
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Surveys
CREATE TABLE IF NOT EXISTS surveys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  questions TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vans_tenant ON vans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_beats_tenant ON beats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_route_customers_route ON route_customers(route_id);
CREATE INDEX IF NOT EXISTS idx_agent_locations_agent ON agent_locations(tenant_id, agent_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_surveys_tenant ON surveys(tenant_id);

-- ==================== DOC 1: TRANSACTION SYSTEM ====================

CREATE TABLE IF NOT EXISTS price_lists (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'ZAR',
  valid_from TEXT,
  valid_to TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS price_list_items (
  id TEXT PRIMARY KEY,
  price_list_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  unit_price REAL NOT NULL,
  min_qty INTEGER DEFAULT 1,
  max_discount_pct REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (price_list_id) REFERENCES price_lists(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS serial_numbers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  sales_order_item_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  original_order_id TEXT NOT NULL,
  return_number TEXT NOT NULL,
  return_type TEXT DEFAULT 'PARTIAL',
  status TEXT DEFAULT 'PENDING',
  total_credit_amount REAL DEFAULT 0,
  restock_fee REAL DEFAULT 0,
  net_credit_amount REAL DEFAULT 0,
  reason TEXT,
  approved_by TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (original_order_id) REFERENCES sales_orders(id)
);

CREATE TABLE IF NOT EXISTS return_items (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  condition TEXT DEFAULT 'good',
  unit_price REAL NOT NULL,
  line_credit REAL NOT NULL,
  original_order_item_id TEXT,
  FOREIGN KEY (return_id) REFERENCES returns(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS credit_notes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  return_id TEXT,
  customer_id TEXT NOT NULL,
  credit_number TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'ISSUED',
  applied_to_orders TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  adjustment_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS commission_payouts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  earner_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT DEFAULT 'PENDING',
  approved_by TEXT,
  approved_at TEXT,
  paid_at TEXT,
  payment_reference TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (earner_id) REFERENCES users(id)
);

-- ==================== DOC 2: TRADE PROMOTIONS & FIELD OPS ====================

CREATE TABLE IF NOT EXISTS trade_promotions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  promotion_type TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  budget REAL DEFAULT 0,
  actual_spend REAL DEFAULT 0,
  status TEXT DEFAULT 'DRAFT',
  config TEXT,
  target_type TEXT DEFAULT 'ALL',
  target_ids TEXT,
  kpi_target TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS trade_promotion_enrollments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  promotion_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT DEFAULT 'ENROLLED',
  enrolled_by TEXT,
  enrolled_at TEXT DEFAULT CURRENT_TIMESTAMP,
  baseline_volume REAL DEFAULT 0,
  target_volume REAL DEFAULT 0,
  actual_volume REAL DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (promotion_id) REFERENCES trade_promotions(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS trade_promotion_claims (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  promotion_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  enrollment_id TEXT,
  claim_type TEXT NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'PENDING',
  evidence TEXT,
  approved_by TEXT,
  approved_at TEXT,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (promotion_id) REFERENCES trade_promotions(id)
);

CREATE TABLE IF NOT EXISTS trade_promotion_audits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  promotion_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  visit_id TEXT,
  audit_type TEXT DEFAULT 'COMPLIANCE',
  compliance_score REAL DEFAULT 0,
  findings TEXT,
  photos TEXT,
  status TEXT DEFAULT 'COMPLETED',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (promotion_id) REFERENCES trade_promotions(id)
);

CREATE TABLE IF NOT EXISTS territories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  boundary TEXT,
  manager_id TEXT,
  parent_id TEXT,
  status TEXT DEFAULT 'active',
  target_visits_per_week INTEGER DEFAULT 0,
  target_revenue_per_month REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (manager_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS territory_assignments (
  id TEXT PRIMARY KEY,
  territory_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  is_primary INTEGER DEFAULT 1,
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (territory_id) REFERENCES territories(id),
  FOREIGN KEY (agent_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS route_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  route_date TEXT NOT NULL,
  territory_id TEXT,
  status TEXT DEFAULT 'PLANNED',
  total_stops INTEGER DEFAULT 0,
  completed_stops INTEGER DEFAULT 0,
  planned_start TEXT,
  actual_start TEXT,
  planned_end TEXT,
  actual_end TEXT,
  total_distance_km REAL DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (agent_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS route_plan_stops (
  id TEXT PRIMARY KEY,
  route_plan_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  sequence_order INTEGER NOT NULL,
  planned_arrival TEXT,
  actual_arrival TEXT,
  actual_departure TEXT,
  status TEXT DEFAULT 'PENDING',
  visit_id TEXT,
  notes TEXT,
  FOREIGN KEY (route_plan_id) REFERENCES route_plans(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS visit_activities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (visit_id) REFERENCES visits(id)
);

CREATE TABLE IF NOT EXISTS competitor_sightings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT,
  customer_id TEXT,
  agent_id TEXT NOT NULL,
  competitor_brand TEXT NOT NULL,
  competitor_product TEXT,
  activity_type TEXT NOT NULL,
  observed_price REAL,
  shelf_position TEXT,
  facing_count INTEGER,
  photos TEXT,
  impact_assessment TEXT,
  notes TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  sighting_date TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS anomaly_flags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  anomaly_type TEXT NOT NULL,
  severity TEXT DEFAULT 'MEDIUM',
  description TEXT,
  reference_type TEXT,
  reference_id TEXT,
  data TEXT,
  status TEXT DEFAULT 'OPEN',
  reviewed_by TEXT,
  reviewed_at TEXT,
  resolution TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (agent_id) REFERENCES users(id)
);

-- ==================== DOC 3: INSIGHTS, RBAC & PROCESS ====================

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  feature_key TEXT NOT NULL,
  is_enabled INTEGER DEFAULT 0,
  config TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  dashboard_type TEXT NOT NULL,
  data TEXT NOT NULL,
  period TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- ==================== DOC 4: FINAL GAPS ====================

CREATE TABLE IF NOT EXISTS report_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  frequency TEXT DEFAULT 'WEEKLY',
  config TEXT,
  is_active INTEGER DEFAULT 1,
  last_sent_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS report_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  generated_by TEXT,
  recipients TEXT,
  status TEXT DEFAULT 'SENT',
  file_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  secret TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  attempts INTEGER DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT DEFAULT '["read"]',
  is_active INTEGER DEFAULT 1,
  last_used_at TEXT,
  expires_at TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  import_type TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  errors TEXT,
  file_url TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS error_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  error_type TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  request_path TEXT,
  request_method TEXT,
  user_id TEXT,
  severity TEXT DEFAULT 'ERROR',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seed_runs (
  id TEXT PRIMARY KEY,
  seed_type TEXT NOT NULL,
  status TEXT DEFAULT 'COMPLETED',
  records_created INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ==================== ADDITIONAL INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_price_lists_tenant ON price_lists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_list ON price_list_items(price_list_id, product_id);
CREATE INDEX IF NOT EXISTS idx_returns_tenant ON returns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(original_order_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant ON credit_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer ON credit_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_tenant ON serial_numbers(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_trade_promos_tenant ON trade_promotions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trade_enrollments_promo ON trade_promotion_enrollments(promotion_id);
CREATE INDEX IF NOT EXISTS idx_trade_claims_promo ON trade_promotion_claims(promotion_id);
CREATE INDEX IF NOT EXISTS idx_trade_audits_promo ON trade_promotion_audits(promotion_id);
CREATE INDEX IF NOT EXISTS idx_territories_tenant ON territories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_territory_assignments_territory ON territory_assignments(territory_id);
CREATE INDEX IF NOT EXISTS idx_route_plans_tenant ON route_plans(tenant_id, agent_id, route_date);
CREATE INDEX IF NOT EXISTS idx_visit_activities_visit ON visit_activities(visit_id);
CREATE INDEX IF NOT EXISTS idx_competitor_sightings_tenant ON competitor_sightings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_flags_tenant ON anomaly_flags(tenant_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_tenant ON feature_flags(tenant_id, feature_key);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_subs_tenant ON report_subscriptions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant ON import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant ON error_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_commission_payouts_tenant ON commission_payouts(tenant_id, earner_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_tenant ON stock_adjustments(tenant_id);
