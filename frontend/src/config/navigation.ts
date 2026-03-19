import { 
  LayoutDashboard, 
  BarChart3,
  Route,
  Truck,
  Package,
  ShoppingCart,
  Building2,
  Megaphone,
  DollarSign,
  Settings,
  ShieldCheck,
  LucideIcon
} from 'lucide-react'

export interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
  permission: string | null
  requiresRole?: string
  children?: NavigationChild[]
  category?: string
  section?: string
}

export interface NavigationChild {
  name: string
  href: string
  permission: string | null
  description?: string
  group?: string
}

// Consolidated navigation: 10 top-level items in 4 sections
export const navigation: NavigationItem[] = [
  // ═══════════════════ SECTION: CORE ═══════════════════
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: null,
    section: 'Core',
    category: 'Core',
  },
  {
    name: 'Insights',
    href: '/insights',
    icon: BarChart3,
    permission: null,
    section: 'Core',
    category: 'Core',
    children: [
      // ── Overview ──
      { name: 'Executive', href: '/insights', permission: null, description: 'Executive overview', group: 'Overview' },
      { name: 'Goals', href: '/insights/goals', permission: null, description: 'Goal tracking', group: 'Overview' },
      { name: 'Anomalies', href: '/insights/anomalies', permission: null, description: 'Anomaly detection', group: 'Overview' },

      // ── Department Analytics ──
      { name: 'Sales', href: '/insights/sales', permission: null, description: 'Sales metrics & trends', group: 'Department Analytics' },
      { name: 'Van Sales', href: '/insights/van-sales', permission: null, description: 'Van sales performance', group: 'Department Analytics' },
      { name: 'Field Ops', href: '/insights/field-ops', permission: null, description: 'Field operations analytics', group: 'Department Analytics' },
      { name: 'Stock', href: '/insights/stock', permission: null, description: 'Inventory insights', group: 'Department Analytics' },
      { name: 'Trade Promos', href: '/insights/trade-promos', permission: null, description: 'Trade promotion ROI', group: 'Department Analytics' },
      { name: 'Commissions', href: '/insights/commissions', permission: null, description: 'Commission analytics', group: 'Department Analytics' },
    ],
  },

  // ═══════════════════ SECTION: OPERATIONS ═══════════════════
  {
    name: 'Field Operations',
    href: '/field-operations',
    icon: Route,
    permission: null,
    section: 'Operations',
    category: 'Operations',
    children: [
      // ── Master Data ──
      { name: 'Companies', href: '/field-operations/companies', permission: null, description: 'Manage service companies', group: 'Master Data' },
      { name: 'Hierarchy', href: '/field-operations/hierarchy', permission: null, description: 'Agent hierarchy management', group: 'Master Data' },
      { name: 'Agent PINs', href: '/agent/pin-management', permission: null, description: 'Set/reset agent login PINs', group: 'Master Data' },
      { name: 'Working Days', href: '/field-operations/working-days', permission: null, description: 'Working days configuration', group: 'Master Data' },
      { name: 'Settings', href: '/field-operations/settings', permission: null, description: 'Field ops global settings', group: 'Master Data' },

      // ── Targets & Commissions ──
      { name: 'Daily Targets', href: '/field-operations/daily-targets', permission: null, description: 'Daily targets per agent', group: 'Targets & Commissions' },
      { name: 'Monthly Targets', href: '/field-operations/monthly-targets', permission: null, description: 'Monthly target management', group: 'Targets & Commissions' },
      { name: 'Commission Tiers', href: '/field-operations/commission-tiers', permission: null, description: 'Commission tier configuration', group: 'Targets & Commissions' },

      // ── Visits & Activity ──
      { name: 'Visits', href: '/field-operations/visits', permission: null, description: 'Manage customer visits', group: 'Visits & Activity' },
      { name: 'Individuals', href: '/field-operations/individuals', permission: null, description: 'Individual registrations', group: 'Visits & Activity' },
      { name: 'Board Placements', href: '/field-operations/boards', permission: null, description: 'Track board placements', group: 'Visits & Activity' },
      { name: 'Product Distribution', href: '/field-operations/products', permission: null, description: 'Product distribution tracking', group: 'Visits & Activity' },

      // ── Performance & Tracking ──
      { name: 'Agent Dashboard', href: '/field-operations/agent-dashboard', permission: null, description: 'Agent performance overview', group: 'Performance & Tracking' },
      { name: 'Performance', href: '/field-operations/performance', permission: null, description: 'Role-based performance metrics', group: 'Performance & Tracking' },
      { name: 'Brand Insights', href: '/field-operations/brand-insights', permission: null, description: 'Brand analytics & reporting', group: 'Performance & Tracking' },
      { name: 'Live Map', href: '/field-operations/mapping', permission: null, description: 'Real-time agent tracking', group: 'Performance & Tracking' },
      { name: 'GPS Tracking', href: '/field-operations/gps-tracking', permission: null, description: 'GPS compliance monitoring', group: 'Performance & Tracking' },
      { name: 'Company Logins', href: '/field-operations/company-logins', permission: null, description: 'Company portal logins', group: 'Performance & Tracking' },
    ],
  },
  {
    name: 'Van Sales',
    href: '/van-sales',
    icon: Truck,
    permission: null,
    section: 'Operations',
    category: 'Operations',
    children: [
      // ── Overview ──
      { name: 'Dashboard', href: '/van-sales/dashboard', permission: null, description: 'Van sales overview', group: 'Overview' },
      { name: 'Workflow', href: '/van-sales/workflow', permission: null, description: 'Complete van sales workflow', group: 'Overview' },

      // ── Operations ──
      { name: 'Routes', href: '/van-sales/routes', permission: null, description: 'Route management', group: 'Operations' },
      { name: 'Van Loads', href: '/van-sales/van-loads', permission: null, description: 'Load and dispatch vans', group: 'Operations' },
      { name: 'Inventory', href: '/van-sales/van-inventory', permission: null, description: 'Van inventory tracking', group: 'Operations' },

      // ── Transactions ──
      { name: 'Orders', href: '/van-sales/orders', permission: null, description: 'Van sales orders', group: 'Transactions' },
      { name: 'Returns', href: '/van-sales/returns', permission: null, description: 'Van sales returns', group: 'Transactions' },
      { name: 'Cash Recon', href: '/van-sales/cash-reconciliation', permission: null, description: 'Cash reconciliation', group: 'Transactions' },
    ],
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Package,
    permission: null,
    section: 'Operations',
    category: 'Operations',
    children: [
      // ── Overview ──
      { name: 'Dashboard', href: '/inventory/dashboard', permission: null, description: 'Inventory overview', group: 'Overview' },
      { name: 'Stock Levels', href: '/inventory/stock-levels', permission: null, description: 'Current stock levels', group: 'Overview' },

      // ── Stock Operations ──
      { name: 'Movements', href: '/inventory/movements', permission: null, description: 'Stock movement history', group: 'Stock Operations' },
      { name: 'Transfers', href: '/inventory/transfers', permission: null, description: 'Inter-warehouse transfers', group: 'Stock Operations' },
      { name: 'Adjustments', href: '/inventory/adjustments', permission: null, description: 'Stock adjustments', group: 'Stock Operations' },
      { name: 'Stock Counts', href: '/inventory/stock-count', permission: null, description: 'Physical stock counts', group: 'Stock Operations' },
      { name: 'Receipts', href: '/inventory/receipts', permission: null, description: 'Goods received notes', group: 'Stock Operations' },

      // ── Setup ──
      { name: 'Warehouses', href: '/inventory/warehouses', permission: null, description: 'Warehouse management', group: 'Setup' },
    ],
  },

  // ═══════════════════ SECTION: COMMERCIAL ═══════════════════
  {
    name: 'Sales',
    href: '/sales',
    icon: ShoppingCart,
    permission: null,
    section: 'Commercial',
    category: 'Sales',
    children: [
      // ── Overview ──
      { name: 'Dashboard', href: '/sales/dashboard', permission: null, description: 'Sales overview', group: 'Overview' },

      // ── Transactions ──
      { name: 'Orders', href: '/sales/orders', permission: null, description: 'Manage orders', group: 'Transactions' },
      { name: 'Invoices', href: '/sales/invoices', permission: null, description: 'Invoice management', group: 'Transactions' },
      { name: 'Payments', href: '/sales/payments', permission: null, description: 'Payment tracking', group: 'Transactions' },

      // ── Returns & Credits ──
      { name: 'Returns', href: '/sales/returns', permission: null, description: 'Handle returns', group: 'Returns & Credits' },
      { name: 'Credit Notes', href: '/sales/credit-notes', permission: null, description: 'Manage credit notes', group: 'Returns & Credits' },
    ],
  },
  {
    name: 'Customers',
    href: '/customers',
    icon: Building2,
    permission: null,
    section: 'Commercial',
    category: 'CRM',
    children: [
      // ── Management ──
      { name: 'Directory', href: '/customers', permission: null, description: 'Customer directory', group: 'Management' },
      { name: 'Credit Management', href: '/customers/credit', permission: null, description: 'Credit limits & balances', group: 'Management' },

      // ── Compliance & Feedback ──
      { name: 'KYC', href: '/kyc', permission: null, description: 'Know your customer', group: 'Compliance & Feedback' },
      { name: 'Surveys', href: '/surveys', permission: null, description: 'Customer surveys', group: 'Compliance & Feedback' },
    ],
  },
  {
    name: 'Marketing',
    href: '/marketing',
    icon: Megaphone,
    permission: null,
    section: 'Commercial',
    category: 'Marketing',
    children: [
      // ── Campaigns & Promos ──
      { name: 'Campaigns', href: '/campaigns', permission: null, description: 'Campaign management', group: 'Campaigns & Promos' },
      { name: 'Promotions', href: '/promotions', permission: null, description: 'Active promotions', group: 'Campaigns & Promos' },

      // ── Activations ──
      { name: 'Trade Marketing', href: '/trade-marketing', permission: null, description: 'Trade marketing activities', group: 'Activations' },
      { name: 'Events', href: '/events', permission: null, description: 'Marketing events', group: 'Activations' },
      { name: 'Activations', href: '/marketing/activations', permission: null, description: 'Brand activations', group: 'Activations' },
    ],
  },

  // ═══════════════════ SECTION: PLATFORM (Admin only) ═══════════════════
  {
    name: 'Finance',
    href: '/finance',
    icon: DollarSign,
    permission: null,
    section: 'Platform',
    category: 'Finance',
    children: [
      // ── Overview ──
      { name: 'Dashboard', href: '/finance/dashboard', permission: null, description: 'Financial overview', group: 'Overview' },

      // ── Billing ──
      { name: 'Invoices', href: '/finance/invoices', permission: null, description: 'All invoices', group: 'Billing' },
      { name: 'Payments', href: '/finance/payments', permission: null, description: 'Payment tracking', group: 'Billing' },

      // ── Reconciliation ──
      { name: 'Cash Reconciliation', href: '/finance/cash-reconciliation', permission: null, description: 'Cash recon', group: 'Reconciliation' },
      { name: 'Commissions', href: '/commissions', permission: null, description: 'Commission management', group: 'Reconciliation' },
    ],
  },
  {
    name: 'Admin',
    href: '/admin',
    icon: Settings,
    permission: null,
    requiresRole: 'admin',
    section: 'Platform',
    category: 'System',
    children: [
      // ── Access Control ──
      { name: 'Users', href: '/admin/users', permission: null, description: 'User management', group: 'Access Control' },
      { name: 'Roles', href: '/admin/roles', permission: null, description: 'Roles & permissions', group: 'Access Control' },

      // ── Catalog ──
      { name: 'Brands', href: '/admin/brands', permission: null, description: 'Brand management', group: 'Catalog' },
      { name: 'Products', href: '/products', permission: null, description: 'Product catalog', group: 'Catalog' },
      { name: 'Price Lists', href: '/admin/price-lists', permission: null, description: 'Pricing management', group: 'Catalog' },
      { name: 'Territories', href: '/admin/territories', permission: null, description: 'Territory management', group: 'Catalog' },

      // ── Configuration ──
      { name: 'Surveys', href: '/admin/surveys', permission: null, description: 'Survey builder', group: 'Configuration' },
      { name: 'Settings', href: '/admin/settings', permission: null, description: 'System settings', group: 'Configuration' },

      // ── Data & Audit ──
      { name: 'Audit Log', href: '/admin/audit', permission: null, description: 'Activity audit trail', group: 'Data & Audit' },
      { name: 'Import/Export', href: '/admin/data-import-export', permission: null, description: 'Data import & export', group: 'Data & Audit' },
    ],
  },
  {
    name: 'Super Admin',
    href: '/superadmin',
    icon: ShieldCheck,
    permission: null,
    requiresRole: 'super_admin',
    section: 'Platform',
    category: 'System',
    children: [
      { name: 'Tenant Management', href: '/superadmin/tenants', permission: null, description: 'Manage tenants & companies' },
    ],
  },
]

// Group navigation by section for the sidebar
export const navigationBySection: Record<string, NavigationItem[]> = {
  Core: navigation.filter(item => item.section === 'Core'),
  Operations: navigation.filter(item => item.section === 'Operations'),
  Commercial: navigation.filter(item => item.section === 'Commercial'),
  Platform: navigation.filter(item => item.section === 'Platform'),
}

// Legacy export for MegaMenu compatibility
export const navigationByCategory = navigationBySection
