PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE tenants (
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
CREATE TABLE users (
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
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP, field_role TEXT DEFAULT 'agent', pin_hash TEXT, agent_type TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (manager_id) REFERENCES users(id),
  FOREIGN KEY (team_lead_id) REFERENCES users(id)
);
CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE areas (
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
CREATE TABLE routes (
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
CREATE TABLE brands (
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
CREATE TABLE categories (
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
CREATE TABLE products (
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
CREATE TABLE customers (
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
CREATE TABLE visits (
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
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP, company_id TEXT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);
CREATE TABLE visit_responses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  visit_type TEXT,
  responses TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (visit_id) REFERENCES visits(id)
);
CREATE TABLE questionnaires (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  visit_type TEXT DEFAULT 'customer',
  brand_id TEXT,
  questions TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP, module TEXT DEFAULT 'field_ops', target_type TEXT DEFAULT 'both', company_id TEXT, is_mandatory INTEGER DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);
CREATE TABLE goals (
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
CREATE TABLE goal_assignments (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  target_value REAL,
  current_value REAL DEFAULT 0,
  FOREIGN KEY (goal_id) REFERENCES goals(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE warehouses (
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
CREATE TABLE stock_levels (
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
CREATE TABLE stock_movements (
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
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE TABLE purchase_orders (
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
CREATE TABLE purchase_order_items (
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
CREATE TABLE sales_orders (
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
CREATE TABLE sales_order_items (
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
CREATE TABLE payments (
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
CREATE TABLE van_stock_loads (
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
CREATE TABLE van_stock_load_items (
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
CREATE TABLE van_reconciliations (
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
CREATE TABLE campaigns (
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
CREATE TABLE campaign_assignments (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  territory_notes TEXT,
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE activations (
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
CREATE TABLE activation_performances (
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
CREATE TABLE promotion_rules (
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
CREATE TABLE commission_rules (
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
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, manager_override_rate REAL DEFAULT 0,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE commission_earnings (
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
CREATE TABLE notifications (
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
CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'web',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE audit_log (
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
CREATE TABLE agent_company_assignments (
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
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_system INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id)
);
CREATE TABLE user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
CREATE TABLE settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  category TEXT DEFAULT 'general',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE vans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  registration_number TEXT DEFAULT '',
  driver_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE beats (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE route_customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  route_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  sequence_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE agent_locations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  accuracy REAL,
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE surveys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  questions TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE price_lists (
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
CREATE TABLE price_list_items (
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
CREATE TABLE serial_numbers (
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
CREATE TABLE returns (
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
CREATE TABLE return_items (
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
CREATE TABLE credit_notes (
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
CREATE TABLE stock_adjustments (
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
CREATE TABLE commission_payouts (
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
CREATE TABLE trade_promotions (
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
CREATE TABLE trade_promotion_enrollments (
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
CREATE TABLE trade_promotion_claims (
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
CREATE TABLE trade_promotion_audits (
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
CREATE TABLE territories (
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
CREATE TABLE territory_assignments (
  id TEXT PRIMARY KEY,
  territory_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  is_primary INTEGER DEFAULT 1,
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (territory_id) REFERENCES territories(id),
  FOREIGN KEY (agent_id) REFERENCES users(id)
);
CREATE TABLE route_plans (
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
CREATE TABLE route_plan_stops (
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
CREATE TABLE visit_activities (
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
CREATE TABLE competitor_sightings (
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
CREATE TABLE anomaly_flags (
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
CREATE TABLE feature_flags (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  feature_key TEXT NOT NULL,
  is_enabled INTEGER DEFAULT 0,
  config TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE dashboard_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  dashboard_type TEXT NOT NULL,
  data TEXT NOT NULL,
  period TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE report_subscriptions (
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
CREATE TABLE report_history (
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
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  secret TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE webhook_deliveries (
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
CREATE TABLE api_keys (
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
CREATE TABLE import_jobs (
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
CREATE TABLE error_logs (
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
CREATE TABLE seed_runs (
  id TEXT PRIMARY KEY,
  seed_type TEXT NOT NULL,
  status TEXT DEFAULT 'COMPLETED',
  records_created INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE email_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  recipients TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  sent_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE invite_tokens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'agent',
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE TABLE activation_tasks (
  id TEXT PRIMARY KEY,
  activation_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sequence_order INTEGER DEFAULT 0,
  requires_photo INTEGER DEFAULT 0,
  requires_quantity INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  completed_at TEXT,
  completed_by TEXT,
  photo_ids TEXT,
  quantity_value REAL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activation_id) REFERENCES activations(id)
);
CREATE TABLE idempotency_keys (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  response_body TEXT,
  response_status INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id, idempotency_key)
);
CREATE TABLE password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE posm_audits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  audited_by TEXT NOT NULL,
  visit_id TEXT,
  photo_id TEXT,
  condition TEXT NOT NULL,
  visibility_score REAL,
  ai_condition TEXT,
  ai_visibility_score REAL,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (installation_id) REFERENCES posm_installations(id)
);
CREATE TABLE posm_installations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  visit_id TEXT,
  photo_id TEXT,
  installed_by TEXT NOT NULL,
  installed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  condition TEXT DEFAULT 'good',
  gps_latitude REAL,
  gps_longitude REAL,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (material_id) REFERENCES posm_materials(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE TABLE posm_materials (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  material_type TEXT NOT NULL,
  brand_id TEXT,
  description TEXT,
  quantity_available INTEGER DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);
CREATE TABLE share_of_voice_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  visit_id TEXT,
  photo_id TEXT,
  brand_id TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  total_facings INTEGER DEFAULT 0,
  brand_facings INTEGER DEFAULT 0,
  share_percentage REAL DEFAULT 0,
  shelf_position TEXT,
  competitor_brands TEXT,
  snapshot_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);
CREATE TABLE survey_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  survey_type TEXT NOT NULL DEFAULT 'visit',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  brand_id TEXT,
  customer_type_filter TEXT,
  questions TEXT NOT NULL,
  scoring_enabled INTEGER DEFAULT 0,
  max_score INTEGER DEFAULT 100,
  passing_score INTEGER DEFAULT 70,
  photo_required INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (brand_id) REFERENCES brands(id)
);
CREATE TABLE visit_photos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  visit_id TEXT NOT NULL,
  photo_type TEXT NOT NULL DEFAULT 'general',
  r2_key TEXT NOT NULL,
  r2_url TEXT,
  thumbnail_r2_key TEXT,
  original_size_bytes INTEGER,
  compressed_size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  gps_latitude REAL,
  gps_longitude REAL,
  captured_at TEXT NOT NULL,
  ai_analysis_status TEXT DEFAULT 'pending',
  ai_brands_detected TEXT,
  ai_share_of_voice REAL,
  ai_shelf_position TEXT,
  ai_facing_count INTEGER,
  ai_competitor_facings INTEGER,
  ai_compliance_score REAL,
  ai_labels TEXT,
  ai_raw_response TEXT,
  ai_processed_at TEXT,
  uploaded_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, photo_hash TEXT, board_placement_location TEXT, board_placement_position TEXT, board_condition TEXT, sample_board_id TEXT, sample_board_match_score REAL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (visit_id) REFERENCES visits(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);
CREATE TABLE field_companies (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, code TEXT NOT NULL, logo_url TEXT, description TEXT, contact_email TEXT, contact_phone TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, revisit_radius_meters INTEGER DEFAULT 200, FOREIGN KEY (tenant_id) REFERENCES tenants(id));
CREATE TABLE agent_company_links (id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, company_id TEXT NOT NULL, tenant_id TEXT NOT NULL, is_active INTEGER DEFAULT 1, assigned_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (agent_id) REFERENCES users(id), FOREIGN KEY (company_id) REFERENCES field_companies(id), FOREIGN KEY (tenant_id) REFERENCES tenants(id));
CREATE TABLE daily_targets (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL, company_id TEXT, target_visits INTEGER DEFAULT 20, target_conversions INTEGER DEFAULT 5, target_registrations INTEGER DEFAULT 10, target_date TEXT NOT NULL, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (agent_id) REFERENCES users(id), FOREIGN KEY (company_id) REFERENCES field_companies(id));
CREATE TABLE individual_registrations (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL, company_id TEXT, visit_id TEXT, first_name TEXT NOT NULL, last_name TEXT NOT NULL, id_number TEXT, phone TEXT, email TEXT, product_app_player_id TEXT, converted INTEGER DEFAULT 0, conversion_date TEXT, notes TEXT, gps_latitude REAL, gps_longitude REAL, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (agent_id) REFERENCES users(id), FOREIGN KEY (company_id) REFERENCES field_companies(id), FOREIGN KEY (visit_id) REFERENCES visits(id));
CREATE TABLE company_logins (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, tenant_id TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT DEFAULT 'viewer', is_active INTEGER DEFAULT 1, last_login TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (company_id) REFERENCES field_companies(id), FOREIGN KEY (tenant_id) REFERENCES tenants(id));
CREATE TABLE field_ops_settings (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, setting_key TEXT NOT NULL, setting_value TEXT NOT NULL, description TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id), UNIQUE(tenant_id, setting_key));
CREATE TABLE working_days_config (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT, agent_id TEXT, monday INTEGER DEFAULT 1, tuesday INTEGER DEFAULT 1, wednesday INTEGER DEFAULT 1, thursday INTEGER DEFAULT 1, friday INTEGER DEFAULT 1, saturday INTEGER DEFAULT 0, sunday INTEGER DEFAULT 0, public_holidays TEXT DEFAULT '[]', effective_from TEXT, effective_to TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (company_id) REFERENCES field_companies(id), FOREIGN KEY (agent_id) REFERENCES users(id));
CREATE TABLE monthly_targets (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, agent_id TEXT NOT NULL, company_id TEXT, target_month TEXT NOT NULL, target_visits INTEGER DEFAULT 0, target_conversions INTEGER DEFAULT 0, target_registrations INTEGER DEFAULT 0, actual_visits INTEGER DEFAULT 0, actual_conversions INTEGER DEFAULT 0, actual_registrations INTEGER DEFAULT 0, working_days INTEGER DEFAULT 22, commission_rate REAL DEFAULT 0, commission_amount REAL DEFAULT 0, status TEXT DEFAULT 'active', created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (agent_id) REFERENCES users(id), FOREIGN KEY (company_id) REFERENCES field_companies(id));
CREATE TABLE target_commission_tiers (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT, tier_name TEXT NOT NULL, min_achievement_pct REAL NOT NULL, max_achievement_pct REAL, commission_rate REAL NOT NULL, bonus_amount REAL DEFAULT 0, metric_type TEXT DEFAULT 'visits', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (company_id) REFERENCES field_companies(id));
CREATE TABLE individuals (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, id_number TEXT, phone TEXT, email TEXT, address TEXT, gps_latitude REAL, gps_longitude REAL, company_id TEXT, notes TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (company_id) REFERENCES field_companies(id));
CREATE TABLE brand_custom_fields (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT NOT NULL, field_name TEXT NOT NULL, field_label TEXT NOT NULL, field_type TEXT DEFAULT 'text', is_required INTEGER DEFAULT 0, field_options TEXT, display_order INTEGER DEFAULT 0, applies_to TEXT DEFAULT 'individual', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (company_id) REFERENCES field_companies(id));
CREATE TABLE visit_individuals (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, visit_id TEXT NOT NULL, individual_id TEXT NOT NULL, custom_field_values TEXT DEFAULT '{}', survey_completed INTEGER DEFAULT 0, survey_responses TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (visit_id) REFERENCES visits(id), FOREIGN KEY (individual_id) REFERENCES individuals(id));
CREATE TABLE visit_survey_config (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT NOT NULL, visit_target_type TEXT DEFAULT 'store', survey_required INTEGER DEFAULT 0, questionnaire_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES tenants(id), FOREIGN KEY (company_id) REFERENCES field_companies(id));
CREATE TABLE process_flows (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
      is_default INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE process_flow_steps (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, process_flow_id TEXT NOT NULL,
      step_key TEXT NOT NULL, step_label TEXT NOT NULL, step_order INTEGER NOT NULL DEFAULT 0,
      is_required INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE company_process_flows (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT NOT NULL,
      process_flow_id TEXT NOT NULL, visit_target_type TEXT DEFAULT 'both',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE company_custom_questions (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT NOT NULL,
      question_label TEXT NOT NULL, question_key TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text', field_options TEXT,
      is_required INTEGER DEFAULT 0, display_order INTEGER DEFAULT 0,
      visit_target_type TEXT DEFAULT 'both', is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    , check_duplicate INTEGER DEFAULT 0, min_length INTEGER, max_length INTEGER, show_in_reports INTEGER DEFAULT 0, enable_ai_analysis INTEGER DEFAULT 0);
CREATE TABLE company_target_rules (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT NOT NULL,
      target_visits_per_day INTEGER DEFAULT 20, target_registrations_per_day INTEGER DEFAULT 10,
      target_conversions_per_day INTEGER DEFAULT 5,
      team_lead_own_target_visits INTEGER DEFAULT 20, team_lead_own_target_registrations INTEGER DEFAULT 10,
      team_lead_own_target_conversions INTEGER DEFAULT 5,
      created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    , store_target_per_month_tl INTEGER, store_target_per_month_agent INTEGER, individual_target_per_week_agent INTEGER, individual_target_per_month_agent INTEGER, working_days_per_week INTEGER DEFAULT 5, working_days TEXT DEFAULT 'mon,tue,wed,thu,fri', allow_weekend_catchup INTEGER DEFAULT 0, tl_target_is_agent_sum INTEGER DEFAULT 1, mgr_target_is_tl_sum INTEGER DEFAULT 1, role_type TEXT NOT NULL DEFAULT 'agent', individual_target_per_day INTEGER DEFAULT 0, individual_target_per_month INTEGER DEFAULT 0, store_target_per_day INTEGER DEFAULT 0, store_target_per_month INTEGER DEFAULT 0);
CREATE TABLE manager_company_links (
      id TEXT PRIMARY KEY, manager_id TEXT NOT NULL, company_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL, is_active INTEGER DEFAULT 1,
      assigned_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
CREATE TABLE company_sample_boards (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, tenant_id TEXT NOT NULL, name TEXT, description TEXT, image_url TEXT, r2_key TEXT, validity_start TEXT, validity_end TEXT, is_active INTEGER DEFAULT 1, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (company_id) REFERENCES field_companies(id), FOREIGN KEY (tenant_id) REFERENCES tenants(id));
CREATE TABLE events (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        event_type TEXT,
        description TEXT,
        location TEXT,
        start_date TEXT,
        end_date TEXT,
        status TEXT DEFAULT 'draft',
        budget REAL DEFAULT 0,
        organizer_id TEXT,
        max_attendees INTEGER,
        tags TEXT,
        notes TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );
CREATE TABLE quotations (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        quotation_number TEXT,
        customer_id TEXT,
        agent_id TEXT,
        status TEXT DEFAULT 'draft',
        items TEXT,
        subtotal REAL DEFAULT 0,
        tax_amount REAL DEFAULT 0,
        discount_amount REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        valid_until TEXT,
        notes TEXT,
        converted_order_id TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );
CREATE TABLE kyc_cases (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        customer_id TEXT,
        case_number TEXT,
        status TEXT DEFAULT 'pending',
        risk_level TEXT DEFAULT 'low',
        submitted_by TEXT,
        reviewed_by TEXT,
        rejection_reason TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );
CREATE TABLE kyc_documents (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        kyc_case_id TEXT,
        document_type TEXT,
        file_name TEXT,
        r2_key TEXT,
        r2_url TEXT,
        file_size INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
    );
CREATE TABLE visit_configurations (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT,
        description TEXT,
        target_type TEXT,
        brand_id TEXT,
        customer_type TEXT,
        valid_from TEXT,
        valid_to TEXT,
        survey_id TEXT,
        survey_required INTEGER DEFAULT 0,
        requires_board_placement INTEGER DEFAULT 0,
        board_id TEXT,
        board_photo_required INTEGER DEFAULT 0,
        track_coverage_analytics INTEGER DEFAULT 0,
        visit_type TEXT,
        visit_category TEXT,
        default_duration_minutes INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );
CREATE TABLE rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER DEFAULT 0,
        window_start TEXT DEFAULT (datetime('now'))
    );
CREATE TABLE boards (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT,
        description TEXT,
        board_type TEXT,
        dimensions TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    );
CREATE TABLE survey_responses (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        survey_id TEXT,
        visit_id TEXT,
        respondent_id TEXT,
        responses TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_type ON customers(tenant_id, customer_type);
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_visits_tenant ON visits(tenant_id);
CREATE INDEX idx_visits_agent ON visits(tenant_id, agent_id);
CREATE INDEX idx_visits_date ON visits(tenant_id, visit_date);
CREATE INDEX idx_sales_orders_tenant ON sales_orders(tenant_id);
CREATE INDEX idx_sales_orders_agent ON sales_orders(tenant_id, agent_id);
CREATE INDEX idx_sales_orders_date ON sales_orders(tenant_id, created_at);
CREATE INDEX idx_sales_orders_status ON sales_orders(tenant_id, status);
CREATE INDEX idx_payments_order ON payments(sales_order_id);
CREATE INDEX idx_van_loads_tenant ON van_stock_loads(tenant_id);
CREATE INDEX idx_van_loads_agent ON van_stock_loads(tenant_id, agent_id);
CREATE INDEX idx_stock_levels_tenant ON stock_levels(tenant_id);
CREATE INDEX idx_stock_levels_warehouse ON stock_levels(warehouse_id, product_id);
CREATE INDEX idx_stock_movements_tenant ON stock_movements(tenant_id);
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_commission_earnings_tenant ON commission_earnings(tenant_id);
CREATE INDEX idx_commission_earnings_earner ON commission_earnings(tenant_id, earner_id);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_audit_log_tenant ON audit_log(tenant_id);
CREATE INDEX idx_agent_assignments ON agent_company_assignments(user_id, tenant_id);
CREATE INDEX idx_vans_tenant ON vans(tenant_id);
CREATE INDEX idx_beats_tenant ON beats(tenant_id);
CREATE INDEX idx_route_customers_route ON route_customers(route_id);
CREATE INDEX idx_agent_locations_agent ON agent_locations(tenant_id, agent_id, recorded_at);
CREATE INDEX idx_surveys_tenant ON surveys(tenant_id);
CREATE INDEX idx_price_lists_tenant ON price_lists(tenant_id);
CREATE INDEX idx_price_list_items_list ON price_list_items(price_list_id, product_id);
CREATE INDEX idx_returns_tenant ON returns(tenant_id);
CREATE INDEX idx_returns_order ON returns(original_order_id);
CREATE INDEX idx_credit_notes_tenant ON credit_notes(tenant_id);
CREATE INDEX idx_credit_notes_customer ON credit_notes(customer_id);
CREATE INDEX idx_serial_numbers_tenant ON serial_numbers(tenant_id, product_id);
CREATE INDEX idx_trade_promos_tenant ON trade_promotions(tenant_id);
CREATE INDEX idx_trade_enrollments_promo ON trade_promotion_enrollments(promotion_id);
CREATE INDEX idx_trade_claims_promo ON trade_promotion_claims(promotion_id);
CREATE INDEX idx_trade_audits_promo ON trade_promotion_audits(promotion_id);
CREATE INDEX idx_territories_tenant ON territories(tenant_id);
CREATE INDEX idx_territory_assignments_territory ON territory_assignments(territory_id);
CREATE INDEX idx_route_plans_tenant ON route_plans(tenant_id, agent_id, route_date);
CREATE INDEX idx_visit_activities_visit ON visit_activities(visit_id);
CREATE INDEX idx_competitor_sightings_tenant ON competitor_sightings(tenant_id);
CREATE INDEX idx_anomaly_flags_tenant ON anomaly_flags(tenant_id, agent_id);
CREATE INDEX idx_feature_flags_tenant ON feature_flags(tenant_id, feature_key);
CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_report_subs_tenant ON report_subscriptions(tenant_id, user_id);
CREATE INDEX idx_import_jobs_tenant ON import_jobs(tenant_id);
CREATE INDEX idx_error_logs_tenant ON error_logs(tenant_id, created_at);
CREATE INDEX idx_commission_payouts_tenant ON commission_payouts(tenant_id, earner_id);
CREATE INDEX idx_stock_adjustments_tenant ON stock_adjustments(tenant_id);
CREATE INDEX idx_email_queue_status ON email_queue(status, retry_count);
CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX idx_invite_token ON invite_tokens(token);
CREATE INDEX idx_field_companies_tenant ON field_companies(tenant_id);
CREATE INDEX idx_agent_company_links_agent ON agent_company_links(agent_id);
CREATE INDEX idx_agent_company_links_company ON agent_company_links(company_id);
CREATE INDEX idx_daily_targets_agent ON daily_targets(tenant_id, agent_id, target_date);
CREATE INDEX idx_daily_targets_company ON daily_targets(company_id, target_date);
CREATE INDEX idx_individual_registrations_agent ON individual_registrations(tenant_id, agent_id);
CREATE INDEX idx_individual_registrations_company ON individual_registrations(company_id);
CREATE INDEX idx_company_logins_company ON company_logins(company_id);
CREATE INDEX idx_company_logins_email ON company_logins(email);
CREATE INDEX idx_field_ops_settings_tenant ON field_ops_settings(tenant_id, setting_key);
CREATE INDEX idx_working_days_tenant ON working_days_config(tenant_id);
CREATE INDEX idx_working_days_company ON working_days_config(company_id);
CREATE INDEX idx_working_days_agent ON working_days_config(agent_id);
CREATE INDEX idx_monthly_targets_tenant ON monthly_targets(tenant_id, agent_id, target_month);
CREATE INDEX idx_monthly_targets_company ON monthly_targets(company_id, target_month);
CREATE INDEX idx_target_commission_tiers_tenant ON target_commission_tiers(tenant_id, is_active);
CREATE INDEX idx_visit_responses_visit_id ON visit_responses(visit_id);
CREATE INDEX idx_visit_photos_visit_id ON visit_photos(visit_id, tenant_id);
CREATE INDEX idx_visit_individuals_visit_id ON visit_individuals(visit_id);
