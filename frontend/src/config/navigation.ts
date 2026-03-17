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
      { name: 'Executive', href: '/insights', permission: null, description: 'Executive overview' },
      { name: 'Sales', href: '/insights/sales', permission: null, description: 'Sales metrics & trends' },
      { name: 'Van Sales', href: '/insights/van-sales', permission: null, description: 'Van sales performance' },
      { name: 'Field Ops', href: '/insights/field-ops', permission: null, description: 'Field operations analytics' },
      { name: 'Stock', href: '/insights/stock', permission: null, description: 'Inventory insights' },
      { name: 'Trade Promos', href: '/insights/trade-promos', permission: null, description: 'Trade promotion ROI' },
      { name: 'Commissions', href: '/insights/commissions', permission: null, description: 'Commission analytics' },
      { name: 'Goals', href: '/insights/goals', permission: null, description: 'Goal tracking' },
      { name: 'Anomalies', href: '/insights/anomalies', permission: null, description: 'Anomaly detection' },
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
      { name: 'Agent Dashboard', href: '/field-operations/agent-dashboard', permission: null, description: 'Agent performance overview' },
      { name: 'Performance', href: '/field-operations/performance', permission: null, description: 'Role-based performance metrics' },
      { name: 'Daily Targets', href: '/field-operations/daily-targets', permission: null, description: 'Daily targets per agent' },
      { name: 'Individuals', href: '/field-operations/individuals', permission: null, description: 'Individual registrations' },
      { name: 'Companies', href: '/field-operations/companies', permission: null, description: 'Manage service companies' },
      { name: 'Hierarchy', href: '/field-operations/hierarchy', permission: null, description: 'Agent hierarchy management' },
      { name: 'Brand Insights', href: '/field-operations/brand-insights', permission: null, description: 'Brand analytics & reporting' },
      { name: 'Company Logins', href: '/field-operations/company-logins', permission: null, description: 'Company portal logins' },
      { name: 'Visits', href: '/field-operations/visits', permission: null, description: 'Manage customer visits' },
      { name: 'Live Map', href: '/field-operations/mapping', permission: null, description: 'Real-time agent tracking' },
      { name: 'GPS Tracking', href: '/field-operations/gps-tracking', permission: null, description: 'GPS compliance monitoring' },
      { name: 'Board Placements', href: '/field-operations/boards', permission: null, description: 'Track board placements' },
      { name: 'Product Distribution', href: '/field-operations/products', permission: null, description: 'Product distribution tracking' },
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
      { name: 'Dashboard', href: '/van-sales/dashboard', permission: null, description: 'Van sales overview' },
      { name: 'Workflow', href: '/van-sales/workflow', permission: null, description: 'Complete van sales workflow' },
      { name: 'Routes', href: '/van-sales/routes', permission: null, description: 'Route management' },
      { name: 'Van Loads', href: '/van-sales/van-loads', permission: null, description: 'Load and dispatch vans' },
      { name: 'Orders', href: '/van-sales/orders', permission: null, description: 'Van sales orders' },
      { name: 'Returns', href: '/van-sales/returns', permission: null, description: 'Van sales returns' },
      { name: 'Cash Recon', href: '/van-sales/cash-reconciliation', permission: null, description: 'Cash reconciliation' },
      { name: 'Inventory', href: '/van-sales/van-inventory', permission: null, description: 'Van inventory tracking' },
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
      { name: 'Dashboard', href: '/inventory/dashboard', permission: null, description: 'Inventory overview' },
      { name: 'Stock Levels', href: '/inventory/stock-levels', permission: null, description: 'Current stock levels' },
      { name: 'Movements', href: '/inventory/movements', permission: null, description: 'Stock movement history' },
      { name: 'Transfers', href: '/inventory/transfers', permission: null, description: 'Inter-warehouse transfers' },
      { name: 'Adjustments', href: '/inventory/adjustments', permission: null, description: 'Stock adjustments' },
      { name: 'Stock Counts', href: '/inventory/stock-count', permission: null, description: 'Physical stock counts' },
      { name: 'Receipts', href: '/inventory/receipts', permission: null, description: 'Goods received notes' },
      { name: 'Warehouses', href: '/inventory/warehouses', permission: null, description: 'Warehouse management' },
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
      { name: 'Dashboard', href: '/sales/dashboard', permission: null, description: 'Sales overview' },
      { name: 'Orders', href: '/sales/orders', permission: null, description: 'Manage orders' },
      { name: 'Invoices', href: '/sales/invoices', permission: null, description: 'Invoice management' },
      { name: 'Payments', href: '/sales/payments', permission: null, description: 'Payment tracking' },
      { name: 'Returns', href: '/sales/returns', permission: null, description: 'Handle returns' },
      { name: 'Credit Notes', href: '/sales/credit-notes', permission: null, description: 'Manage credit notes' },
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
      { name: 'Directory', href: '/customers', permission: null, description: 'Customer directory' },
      { name: 'KYC', href: '/kyc', permission: null, description: 'Know your customer' },
      { name: 'Surveys', href: '/surveys', permission: null, description: 'Customer surveys' },
      { name: 'Credit Management', href: '/customers/credit', permission: null, description: 'Credit limits & balances' },
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
      { name: 'Campaigns', href: '/campaigns', permission: null, description: 'Campaign management' },
      { name: 'Trade Marketing', href: '/trade-marketing', permission: null, description: 'Trade marketing activities' },
      { name: 'Promotions', href: '/promotions', permission: null, description: 'Active promotions' },
      { name: 'Events', href: '/events', permission: null, description: 'Marketing events' },
      { name: 'Activations', href: '/marketing/activations', permission: null, description: 'Brand activations' },
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
      { name: 'Dashboard', href: '/finance/dashboard', permission: null, description: 'Financial overview' },
      { name: 'Invoices', href: '/finance/invoices', permission: null, description: 'All invoices' },
      { name: 'Payments', href: '/finance/payments', permission: null, description: 'Payment tracking' },
      { name: 'Cash Reconciliation', href: '/finance/cash-reconciliation', permission: null, description: 'Cash recon' },
      { name: 'Commissions', href: '/commissions', permission: null, description: 'Commission management' },
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
      { name: 'Users', href: '/admin/users', permission: null, description: 'User management' },
      { name: 'Roles', href: '/admin/roles', permission: null, description: 'Roles & permissions' },
      { name: 'Brands', href: '/admin/brands', permission: null, description: 'Brand management' },
      { name: 'Products', href: '/products', permission: null, description: 'Product catalog' },
      { name: 'Price Lists', href: '/admin/price-lists', permission: null, description: 'Pricing management' },
      { name: 'Territories', href: '/admin/territories', permission: null, description: 'Territory management' },
      { name: 'Surveys', href: '/admin/surveys', permission: null, description: 'Survey builder' },
      { name: 'Settings', href: '/admin/settings', permission: null, description: 'System settings' },
      { name: 'Audit Log', href: '/admin/audit', permission: null, description: 'Activity audit trail' },
      { name: 'Import/Export', href: '/admin/data-import-export', permission: null, description: 'Data import & export' },
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
