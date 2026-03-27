-- FieldVibe Database Schema
-- Best-in-World Enhanced Schema with Audit Logging, Security, and Performance Optimizations
-- Version: 2.0.0
-- Date: 2026-03-27

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Tenants (companies/organizations)
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    settings JSON DEFAULT '{}',
    subscription_plan TEXT DEFAULT 'free',
    subscription_expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'manager', 'admin', 'superadmin')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret TEXT,
    mfa_backup_codes TEXT, -- JSON array of hashed backup codes
    last_login_at DATETIME,
    last_login_ip TEXT,
    password_changed_at DATETIME,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    device_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    mfa_verified BOOLEAN DEFAULT FALSE,
    mfa_method TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

-- API keys for integrations
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    permissions JSON DEFAULT '[]',
    expires_at DATETIME,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ============================================================================
-- AUDIT LOGGING
-- ============================================================================

-- Comprehensive audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    user_email TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    request_id TEXT,
    changes JSON, -- {before: {}, after: {}, changed: []}
    metadata JSON DEFAULT '{}',
    status TEXT DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'FAILURE', 'DENIED')),
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ============================================================================
-- FIELD OPERATIONS
-- ============================================================================

-- Agents (field representatives)
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    employee_id TEXT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
    hire_date DATE,
    manager_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
    territory TEXT,
    target_visits_daily INTEGER DEFAULT 10,
    target_visits_monthly INTEGER DEFAULT 200,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_manager ON agents(manager_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- Customers (stores, outlets)
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    type TEXT CHECK (type IN ('store', 'individual', 'company', 'other')),
    address TEXT,
    city TEXT,
    region TEXT,
    country TEXT,
    postal_code TEXT,
    latitude REAL,
    longitude REAL,
    phone TEXT,
    email TEXT,
    contact_person TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'prospect')),
    visit_frequency INTEGER DEFAULT 7, -- days between visits
    last_visit_at DATETIME,
    next_visit_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_location ON customers(latitude, longitude);

-- Visits
CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    visit_type TEXT NOT NULL CHECK (visit_type IN ('store', 'individual')),
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled', 'no_show')),
    scheduled_at DATETIME,
    started_at DATETIME,
    completed_at DATETIME,
    duration_minutes INTEGER,
    latitude REAL,
    longitude REAL,
    notes TEXT,
    photos JSON DEFAULT '[]',
    survey_responses JSON DEFAULT '{}',
    outcome TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visits_tenant ON visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visits_agent ON visits(agent_id);
CREATE INDEX IF NOT EXISTS idx_visits_customer ON visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled ON visits(scheduled_at);

-- Individual registrations (for individual visits)
CREATE TABLE IF NOT EXISTS individual_registrations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    id_number TEXT,
    address TEXT,
    city TEXT,
    region TEXT,
    consent_given BOOLEAN DEFAULT FALSE,
    consent_timestamp DATETIME,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_individual_reg_visit ON individual_registrations(visit_id);
CREATE INDEX IF NOT EXISTS idx_individual_reg_tenant ON individual_registrations(tenant_id);

-- Visit tasks
CREATE TABLE IF NOT EXISTS visit_tasks (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    completed_at DATETIME,
    notes TEXT,
    photos JSON DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visit_tasks_visit ON visit_tasks(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_tasks_status ON visit_tasks(status);

-- ============================================================================
-- SALES & ORDERS
-- ============================================================================

-- Products
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    subcategory TEXT,
    brand TEXT,
    unit_price REAL NOT NULL,
    cost_price REAL,
    currency TEXT DEFAULT 'ZAR',
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
    visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
    order_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    total_amount REAL NOT NULL,
    tax_amount REAL DEFAULT 0,
    discount_amount REAL DEFAULT 0,
    currency TEXT DEFAULT 'ZAR',
    notes TEXT,
    delivered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- ============================================================================
-- COMMISSIONS
-- ============================================================================

-- Commission structures
CREATE TABLE IF NOT EXISTS commission_structures (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    structure_type TEXT NOT NULL CHECK (structure_type IN ('flat', 'tiered', 'percentage', 'hybrid')),
    rules JSON NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commission_structures_tenant ON commission_structures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_structures_active ON commission_structures(active);

-- Commission calculations
CREATE TABLE IF NOT EXISTS commission_calculations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    structure_id TEXT REFERENCES commission_structures(id) ON DELETE SET NULL,
    base_amount REAL NOT NULL,
    commission_amount REAL NOT NULL,
    bonus_amount REAL DEFAULT 0,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'calculated', 'approved', 'paid', 'disputed')),
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    paid_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commission_calcs_tenant ON commission_calculations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commission_calcs_agent ON commission_calculations(agent_id);
CREATE INDEX IF NOT EXISTS idx_commission_calcs_period ON commission_calculations(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_commission_calcs_status ON commission_calculations(status);

-- ============================================================================
-- ANALYTICS & REPORTING
-- ============================================================================

-- Daily metrics aggregation
CREATE TABLE IF NOT EXISTS daily_metrics (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    metric_type TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    dimensions JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, date, metric_type, metric_name, dimensions)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_tenant ON daily_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_type ON daily_metrics(metric_type, metric_name);

-- ============================================================================
-- SYSTEM & CONFIGURATION
-- ============================================================================

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSON NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, category, key)
);

CREATE INDEX IF NOT EXISTS idx_system_settings_tenant ON system_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- Database migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert current migration
INSERT OR IGNORE INTO schema_migrations (version, name) VALUES ('2.0.0', 'Initial enhanced schema');

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Agent performance summary
CREATE VIEW IF NOT EXISTS agent_performance_summary AS
SELECT 
    a.id,
    a.name,
    a.tenant_id,
    COUNT(DISTINCT v.id) as total_visits,
    COUNT(DISTINCT CASE WHEN v.status = 'completed' THEN v.id END) as completed_visits,
    COUNT(DISTINCT CASE WHEN v.visit_type = 'individual' THEN individual_registrations.id END) as individual_registrations,
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as total_sales
FROM agents a
LEFT JOIN visits v ON a.id = v.agent_id AND v.tenant_id = a.tenant_id
LEFT JOIN individual_registrations ON v.id = individual_registrations.visit_id
LEFT JOIN orders o ON v.id = o.visit_id AND o.tenant_id = a.tenant_id
WHERE a.status = 'active'
GROUP BY a.id, a.name, a.tenant_id;

-- Customer visit summary
CREATE VIEW IF NOT EXISTS customer_visit_summary AS
SELECT 
    c.id,
    c.name,
    c.tenant_id,
    COUNT(v.id) as total_visits,
    MAX(v.completed_at) as last_visit_at,
    COUNT(DISTINCT o.id) as total_orders,
    COALESCE(SUM(o.total_amount), 0) as lifetime_value
FROM customers c
LEFT JOIN visits v ON c.id = v.customer_id AND c.tenant_id = v.tenant_id
LEFT JOIN orders o ON c.id = o.customer_id AND c.tenant_id = o.tenant_id
GROUP BY c.id, c.name, c.tenant_id;
