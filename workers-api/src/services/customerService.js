/**
 * Customer Service
 * Comprehensive customer management with segmentation and analytics
 */

import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';

export class CustomerService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new customer
   */
  async createCustomer(customerData) {
    const {
      tenantId,
      name,
      code,
      type = 'store',
      address,
      city,
      region,
      country,
      postalCode,
      latitude,
      longitude,
      phone,
      email,
      contactPerson,
      visitFrequency = 7
    } = customerData;

    // Validate required fields
    if (!name || !tenantId) {
      throw new ValidationError('Name and tenantId are required');
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO customers (
        id, tenant_id, name, code, type, address, city, region, country,
        postal_code, latitude, longitude, phone, email, contact_person,
        visit_frequency, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `);

    await stmt.run(
      id, tenantId, name, code, type, address, city, region, country,
      postalCode, latitude, longitude, phone, email, contactPerson,
      visitFrequency, now, now
    );

    return {
      id,
      tenantId,
      name,
      code,
      type,
      status: 'active',
      createdAt: now
    };
  }

  /**
   * Get customer by ID
   */
  async getCustomer(id, tenantId) {
    const stmt = this.db.prepare(`
      SELECT * FROM customers WHERE id = ? AND tenant_id = ?
    `);

    const customer = await stmt.bind(id, tenantId).first();

    if (!customer) {
      throw new NotFoundError('Customer');
    }

    return this.mapCustomer(customer);
  }

  /**
   * List customers with filtering and pagination
   */
  async listCustomers(filters, pagination) {
    const {
      tenantId,
      type,
      status,
      city,
      search
    } = filters;

    const { page = 1, limit = 50 } = pagination;
    const offset = (page - 1) * limit;

    let whereClauses = ['tenant_id = ?'];
    const params = [tenantId];

    if (type) {
      whereClauses.push('type = ?');
      params.push(type);
    }

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    if (city) {
      whereClauses.push('city = ?');
      params.push(city);
    }

    if (search) {
      whereClauses.push('(name LIKE ? OR code LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = whereClauses.join(' AND ');

    const query = `
      SELECT * FROM customers
      WHERE ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;

    const { results } = await this.db.prepare(query).bind(...params, limit, offset).all();

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM customers WHERE ${whereClause}
    `;
    const { total } = await this.db.prepare(countQuery).bind(...params).first();

    return {
      customers: results.map(c => this.mapCustomer(c)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Update customer
   */
  async updateCustomer(id, tenantId, updates) {
    const allowedFields = [
      'name', 'code', 'type', 'address', 'city', 'region', 'country',
      'postal_code', 'latitude', 'longitude', 'phone', 'email',
      'contact_person', 'visit_frequency', 'status'
    ];

    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        fields.push(`${snakeKey} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);
    values.push(tenantId);

    const stmt = this.db.prepare(`
      UPDATE customers SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?
    `);

    await stmt.run(...values);

    return this.getCustomer(id, tenantId);
  }

  /**
   * Delete customer (soft delete)
   */
  async deleteCustomer(id, tenantId) {
    const stmt = this.db.prepare(`
      UPDATE customers SET status = 'deleted', updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `);

    await stmt.run(new Date().toISOString(), id, tenantId);
    return { success: true };
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(customerId, tenantId) {
    // Verify customer exists
    await this.getCustomer(customerId, tenantId);

    // Get visit statistics
    const visitStats = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_visits,
        MAX(completed_at) as last_visit_at,
        AVG(duration_minutes) as avg_duration
      FROM visits
      WHERE customer_id = ? AND tenant_id = ?
    `).bind(customerId, tenantId).first();

    // Get order statistics
    const orderStats = await this.db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        AVG(total_amount) as avg_order_value
      FROM orders
      WHERE customer_id = ? AND tenant_id = ?
    `).bind(customerId, tenantId).first();

    // Get lifetime value from view
    const ltv = await this.db.prepare(`
      SELECT lifetime_value FROM customer_visit_summary
      WHERE id = ?
    `).bind(customerId).first();

    return {
      customerId,
      visits: visitStats,
      orders: orderStats,
      lifetimeValue: ltv?.lifetime_value || 0
    };
  }

  /**
   * Segment customers
   */
  async segmentCustomers(tenantId) {
    const segments = await this.db.prepare(`
      SELECT 
        CASE
          WHEN lifetime_value >= 100000 THEN 'Premium'
          WHEN lifetime_value >= 50000 THEN 'Gold'
          WHEN lifetime_value >= 10000 THEN 'Silver'
          ELSE 'Standard'
        END as segment,
        COUNT(*) as count,
        AVG(lifetime_value) as avg_value
      FROM customer_visit_summary
      WHERE tenant_id = ?
      GROUP BY segment
      ORDER BY avg_value DESC
    `).bind(tenantId).all();

    return segments.results;
  }

  /**
   * Map database row to customer object
   */
  mapCustomer(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      name: row.name,
      code: row.code,
      type: row.type,
      address: row.address,
      city: row.city,
      region: row.region,
      country: row.country,
      postalCode: row.postal_code,
      latitude: row.latitude,
      longitude: row.longitude,
      phone: row.phone,
      email: row.email,
      contactPerson: row.contact_person,
      status: row.status,
      visitFrequency: row.visit_frequency,
      lastVisitAt: row.last_visit_at,
      nextVisitAt: row.next_visit_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
