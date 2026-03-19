import { z } from 'zod';

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }));
    return { valid: false, errors, data: null };
  }
  return { valid: true, data: result.data, errors: [] };
}

// ==================== P0 SCHEMAS ====================

// Auth
export const loginSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().min(7, 'Phone must be at least 7 characters').optional(),
  password: z.string().min(1, 'Password is required'),
}).refine(data => data.email || data.phone, { message: 'Email or phone is required' });

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  phone: z.string().min(7).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  tenantCode: z.string().optional(),
});

// Users
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format').optional().nullable(),
  phone: z.string().min(7).optional().nullable(),
  password: z.string().min(5).optional(),
  firstName: z.string().min(1).optional(),
  first_name: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  role: z.enum(['admin', 'manager', 'team_lead', 'agent', 'field_agent', 'sales_rep', 'viewer']).default('agent'),
  managerId: z.string().optional().nullable(),
  manager_id: z.string().optional().nullable(),
  teamLeadId: z.string().optional().nullable(),
  team_lead_id: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional().nullable(),
  phone: z.string().min(7).optional().nullable(),
  firstName: z.string().min(1).optional().nullable(),
  first_name: z.string().min(1).optional().nullable(),
  lastName: z.string().min(1).optional().nullable(),
  last_name: z.string().min(1).optional().nullable(),
  role: z.enum(['admin', 'manager', 'team_lead', 'agent', 'viewer']).optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).optional().nullable(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
  managerId: z.string().optional().nullable(),
  manager_id: z.string().optional().nullable(),
  teamLeadId: z.string().optional().nullable(),
  team_lead_id: z.string().optional().nullable(),
});

// Sales Orders
export const createSalesOrderSchema = z.object({
  customer_id: z.string().min(1, 'Customer ID is required'),
  items: z.array(z.object({
    product_id: z.string().min(1, 'Product ID is required'),
    quantity: z.number().int().positive('Quantity must be > 0'),
    unit_price: z.number().positive('Price must be > 0').optional(),
    discount: z.number().min(0).max(100).optional(),
  })).min(1, 'At least one item is required'),
  notes: z.string().optional(),
  delivery_date: z.string().optional(),
  price_list_id: z.string().optional(),
  order_type: z.string().optional(),
  payment_method: z.string().optional(),
  payment_terms: z.string().optional(),
});

// Payments
export const createPaymentSchema = z.object({
  amount: z.number().positive('Amount must be > 0'),
  method: z.enum(['cash', 'card', 'bank_transfer', 'cheque', 'mobile', 'credit']).default('cash'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// Van Sales
export const createVanLoadSchema = z.object({
  van_id: z.string().optional(),
  vehicle_id: z.string().optional(),
  agent_id: z.string().optional(),
  warehouse_id: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().min(1, 'Product ID is required'),
    quantity: z.number().int().positive('Quantity must be > 0'),
  })).min(1, 'At least one item is required'),
  notes: z.string().optional(),
}).refine(data => data.van_id || data.vehicle_id, { message: 'van_id or vehicle_id is required' });

export const vanSellSchema = z.object({
  load_id: z.string().min(1).optional(),
  van_stock_load_id: z.string().min(1).optional(),
  customer_id: z.string().min(1, 'Customer ID is required'),
  items: z.array(z.object({
    product_id: z.string().min(1, 'Product ID is required'),
    quantity: z.number().int().positive('Quantity must be > 0'),
    unit_price: z.number().positive('Price must be > 0').optional(),
  })).min(1, 'At least one item is required'),
  payment_method: z.enum(['cash', 'card', 'credit', 'mobile', 'CASH', 'CARD', 'CREDIT', 'MOBILE']).default('cash'),
  amount_paid: z.number().min(0).optional(),
  payment_reference: z.string().optional(),
  gps_latitude: z.number().optional().nullable(),
  gps_longitude: z.number().optional().nullable(),
  notes: z.string().optional(),
}).refine(data => data.load_id || data.van_stock_load_id, { message: 'load_id or van_stock_load_id is required' });

export const vanReturnSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().min(1, 'Product ID is required'),
    quantity_returned: z.number().int().min(0).default(0),
    quantity_damaged: z.number().int().min(0).default(0),
  })).min(1, 'At least one item is required'),
  notes: z.string().optional(),
});

// ==================== P1 SCHEMAS ====================

// Products
export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  sku: z.string().min(1, 'SKU is required'),
  price: z.number().min(0, 'Price must be >= 0').default(0),
  cost_price: z.number().min(0).optional(),
  category: z.string().optional(),
  category_id: z.string().optional(),
  brand: z.string().optional(),
  brand_id: z.string().optional(),
  description: z.string().optional(),
  unit_of_measure: z.string().optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  is_active: z.union([z.boolean(), z.number()]).default(true),
  min_stock_level: z.number().int().min(0).optional(),
  max_stock_level: z.number().int().min(0).optional(),
});

// Customers
export const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().optional(),
  contact_person: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  customer_type: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  credit_limit: z.number().min(0).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  gps_lat: z.number().min(-90).max(90).optional().nullable(),
  gps_lng: z.number().min(-180).max(180).optional().nullable(),
  price_list_id: z.string().optional().nullable(),
}).passthrough();

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().optional(),
  price: z.number().min(0).optional(),
  cost_price: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  category: z.string().optional().nullable(),
  category_id: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  brand_id: z.string().optional().nullable(),
  brandId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unit_of_measure: z.string().optional().nullable(),
  unitOfMeasure: z.string().optional().nullable(),
  tax_rate: z.number().min(0).max(100).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  min_stock_level: z.number().int().min(0).optional(),
  max_stock_level: z.number().int().min(0).optional(),
  code: z.string().optional(),
  barcode: z.string().optional().nullable(),
}).passthrough();

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  code: z.string().optional(),
  contact_person: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  customer_type: z.string().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  credit_limit: z.number().min(0, 'Credit limit must be >= 0').default(0),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  gps_lat: z.number().min(-90).max(90).optional().nullable(),
  gps_lng: z.number().min(-180).max(180).optional().nullable(),
  price_list_id: z.string().optional().nullable(),
});

// Inventory movements
export const stockMovementSchema = z.object({
  product_id: z.string().min(1, 'Product ID is required'),
  warehouse_id: z.string().min(1, 'Warehouse ID is required'),
  quantity: z.number().int().positive('Quantity must be > 0'),
  movement_type: z.enum(['in', 'out', 'adjustment', 'transfer', 'return']),
  reference_type: z.string().optional(),
  reference_id: z.string().optional(),
  notes: z.string().optional(),
});

// Commission rules
export const commissionRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  source_type: z.enum(['board_placement', 'product_distribution', 'new_customer', 'visit', 'sale', 'custom']),
  calculation_type: z.enum(['flat', 'per_unit', 'percentage', 'tiered']),
  rate: z.number().min(0).max(100, 'Rate must be between 0 and 100'),
  threshold: z.number().min(0).default(0),
  is_active: z.union([z.boolean(), z.number()]).default(true),
  description: z.string().optional(),
});

// ==================== P2 SCHEMAS ====================

// Territories
export const territorySchema = z.object({
  name: z.string().min(1, 'Territory name is required'),
  description: z.string().optional(),
  boundary_geojson: z.string().optional(),
  parent_id: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive']).default('active'),
});

// Campaigns
export const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  budget: z.number().min(0, 'Budget must be >= 0').default(0),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).default('draft'),
  campaign_type: z.string().optional(),
});

// Trade Promotions
export const tradePromotionSchema = z.object({
  name: z.string().min(1, 'Promotion name is required'),
  description: z.string().optional(),
  promotion_type: z.enum(['volume_discount', 'buy_x_get_y', 'percentage_off', 'flat_discount', 'rebate', 'display_allowance', 'custom']),
  start_date: z.string(),
  end_date: z.string(),
  budget: z.number().positive('Budget must be > 0'),
  rules: z.any().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']).default('draft'),
});

// Webhooks
export const webhookSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  secret: z.string().optional(),
  is_active: z.union([z.boolean(), z.number()]).default(true),
});

// Generic update schema (allows partial updates)
export const genericUpdateSchema = z.object({}).passthrough();
