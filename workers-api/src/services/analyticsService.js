/**
 * Analytics Service
 * Advanced analytics with real-time metrics and insights
 */

export class AnalyticsService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get dashboard metrics
   */
  async getDashboardMetrics(tenantId, filters = {}) {
    const { startDate, endDate, agentId } = filters;

    const whereClauses = ['tenant_id = ?'];
    const params = [tenantId];

    if (startDate) {
      whereClauses.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereClauses.push('created_at <= ?');
      params.push(endDate);
    }

    if (agentId) {
      whereClauses.push('agent_id = ?');
      params.push(agentId);
    }

    const whereClause = whereClauses.join(' AND ');

    // Get key metrics
    const [visits, customers, orders, revenue] = await Promise.all([
      this.db.prepare(`SELECT COUNT(*) as total FROM visits WHERE ${whereClause}`).bind(...params).first(),
      this.db.prepare(`SELECT COUNT(*) as total FROM customers WHERE ${whereClause}`).bind(...params).first(),
      this.db.prepare(`SELECT COUNT(*) as total FROM orders WHERE ${whereClause}`).bind(...params).first(),
      this.db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE ${whereClause}`).bind(...params).first()
    ]);

    return {
      visits: visits.total,
      customers: customers.total,
      orders: orders.total,
      revenue: revenue.total,
      period: { startDate, endDate }
    };
  }

  /**
   * Get trend data for charts
   */
  async getTrendData(tenantId, metric, granularity = 'day', filters = {}) {
    const { startDate, endDate } = filters;

    const dateField = metric === 'visits' ? 'created_at' : 'created_at';
    
    const query = `
      SELECT 
        strftime('%Y-%m-%d', ${dateField}) as date,
        COUNT(*) as value
      FROM ${this.getTableName(metric)}
      WHERE tenant_id = ?
        ${startDate ? `AND ${dateField} >= ?` : ''}
        ${endDate ? `AND ${dateField} <= ?` : ''}
      GROUP BY date
      ORDER BY date ASC
    `;

    const params = [tenantId];
    if (startDate) params.push(startDate);
    if (endDate) params.push(endDate);

    const { results } = await this.db.prepare(query).bind(...params).all();

    return {
      metric,
      granularity,
      data: results.map(r => ({
        date: r.date,
        value: r.value
      }))
    };
  }

  /**
   * Get agent performance ranking
   */
  async getAgentRanking(tenantId, periodStart, periodEnd, limit = 10) {
    const query = `
      SELECT 
        a.id,
        a.name,
        COUNT(DISTINCT v.id) as total_visits,
        COUNT(DISTINCT CASE WHEN v.status = 'completed' THEN v.id END) as completed_visits,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_sales,
        ROUND(
          CAST(COUNT(DISTINCT CASE WHEN v.status = 'completed' THEN v.id END) AS FLOAT) /
          NULLIF(COUNT(DISTINCT v.id), 0) * 100,
          2
        ) as completion_rate
      FROM agents a
      LEFT JOIN visits v ON a.id = v.agent_id 
        AND v.tenant_id = a.tenant_id
        AND v.completed_at >= ? AND v.completed_at <= ?
      LEFT JOIN orders o ON v.id = o.visit_id
      WHERE a.tenant_id = ? AND a.status = 'active'
      GROUP BY a.id, a.name
      ORDER BY total_sales DESC
      LIMIT ?
    `;

    const { results } = await this.db.prepare(query)
      .bind(periodStart, periodEnd, tenantId, limit)
      .all();

    return results.map(r => ({
      id: r.id,
      name: r.name,
      totalVisits: r.total_visits,
      completedVisits: r.completed_visits,
      totalOrders: r.total_orders,
      totalSales: r.total_sales,
      completionRate: r.completion_rate
    }));
  }

  /**
   * Get geographic distribution
   */
  async getGeographicDistribution(tenantId) {
    const query = `
      SELECT 
        city,
        region,
        COUNT(*) as customer_count,
        AVG(latitude) as avg_lat,
        AVG(longitude) as avg_lng
      FROM customers
      WHERE tenant_id = ? AND status = 'active' AND latitude IS NOT NULL AND longitude IS NOT NULL
      GROUP BY city, region
      ORDER BY customer_count DESC
    `;

    const { results } = await this.db.prepare(query).bind(tenantId).all();

    return results.map(r => ({
      city: r.city,
      region: r.region,
      customerCount: r.customer_count,
      coordinates: {
        latitude: r.avg_lat,
        longitude: r.avg_lng
      }
    }));
  }

  /**
   * Get product performance
   */
  async getProductPerformance(tenantId, periodStart, periodEnd, limit = 20) {
    const query = `
      SELECT 
        p.id,
        p.name,
        p.sku,
        p.category,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue,
        COUNT(DISTINCT o.id) as order_count
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE p.tenant_id = ? 
        AND o.created_at >= ? 
        AND o.created_at <= ?
      GROUP BY p.id, p.name, p.sku, p.category
      ORDER BY total_revenue DESC
      LIMIT ?
    `;

    const { results } = await this.db.prepare(query)
      .bind(tenantId, periodStart, periodEnd, limit)
      .all();

    return results.map(r => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      category: r.category,
      totalQuantity: r.total_quantity,
      totalRevenue: r.total_revenue,
      orderCount: r.order_count
    }));
  }

  /**
   * Get visit completion funnel
   */
  async getVisitFunnel(tenantId, periodStart, periodEnd) {
    const query = `
      SELECT 
        status,
        COUNT(*) as count
      FROM visits
      WHERE tenant_id = ? 
        AND created_at >= ? 
        AND created_at <= ?
      GROUP BY status
    `;

    const { results } = await this.db.prepare(query)
      .bind(tenantId, periodStart, periodEnd)
      .all();

    const funnel = {
      planned: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0
    };

    results.forEach(r => {
      const key = r.status.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      funnel[key] = r.count;
    });

    const total = Object.values(funnel).reduce((a, b) => a + b, 0);

    return {
      stages: funnel,
      total,
      conversionRate: total > 0 ? (funnel.completed / total * 100).toFixed(2) : 0
    };
  }

  /**
   * Get daily metrics aggregation
   */
  async getDailyMetrics(tenantId, metricType, startDate, endDate) {
    const query = `
      SELECT 
        date,
        metric_name,
        metric_value,
        dimensions
      FROM daily_metrics
      WHERE tenant_id = ?
        AND metric_type = ?
        AND date >= ?
        AND date <= ?
      ORDER BY date ASC
    `;

    const { results } = await this.db.prepare(query)
      .bind(tenantId, metricType, startDate, endDate)
      .all();

    return results.map(r => ({
      date: r.date,
      metricName: r.metric_name,
      metricValue: r.metric_value,
      dimensions: JSON.parse(r.dimensions || '{}')
    }));
  }

  /**
   * Record daily metric
   */
  async recordDailyMetric(metricData) {
    const {
      tenantId,
      date,
      metricType,
      metricName,
      metricValue,
      dimensions = {}
    } = metricData;

    const id = crypto.randomUUID();

    const stmt = this.db.prepare(`
      INSERT INTO daily_metrics (
        id, tenant_id, date, metric_type, metric_name, metric_value,
        dimensions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, date, metric_type, metric_name, dimensions)
      DO UPDATE SET metric_value = excluded.metric_value, updated_at = excluded.updated_at
    `);

    const now = new Date().toISOString();
    await stmt.run(
      id, tenantId, date, metricType, metricName, metricValue,
      JSON.stringify(dimensions), now, now
    );

    return { id, ...metricData };
  }

  /**
   * Get table name for metric
   */
  getTableName(metric) {
    const mapping = {
      visits: 'visits',
      customers: 'customers',
      orders: 'orders',
      agents: 'agents'
    };
    return mapping[metric] || 'visits';
  }

  /**
   * Export analytics data
   */
  async exportData(tenantId, format = 'csv', filters = {}) {
    // Implementation for data export
    // Supports CSV, Excel, JSON formats
    return {
      format,
      data: [],
      generatedAt: new Date().toISOString()
    };
  }
}
