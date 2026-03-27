/**
 * Commission Service
 * Multi-tier commission calculation with dispute management
 */

import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';

export class CommissionService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create commission structure
   */
  async createStructure(structureData) {
    const {
      tenantId,
      name,
      description,
      structureType,
      rules,
      effectiveFrom,
      effectiveTo
    } = structureData;

    const validTypes = ['flat', 'tiered', 'percentage', 'hybrid'];
    if (!validTypes.includes(structureType)) {
      throw new ValidationError(`Invalid structure type. Must be one of: ${validTypes.join(', ')}`);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO commission_structures (
        id, tenant_id, name, description, structure_type, rules,
        effective_from, effective_to, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
    `);

    await stmt.run(
      id, tenantId, name, description, structureType,
      JSON.stringify(rules), effectiveFrom, effectiveTo, now, now
    );

    return {
      id,
      tenantId,
      name,
      description,
      structureType,
      rules,
      effectiveFrom,
      effectiveTo,
      active: true
    };
  }

  /**
   * Calculate commission for agent
   */
  async calculateCommission(calculationData) {
    const {
      tenantId,
      agentId,
      periodStart,
      periodEnd,
      structureId
    } = calculationData;

    // Get commission structure
    const structure = await this.getStructure(structureId, tenantId);
    
    // Get agent performance data
    const performance = await this.getAgentPerformance(agentId, tenantId, periodStart, periodEnd);

    // Calculate based on structure type
    let baseAmount = 0;
    let commissionAmount = 0;
    let bonusAmount = 0;

    switch (structure.structureType) {
      case 'flat':
        commissionAmount = this.calculateFlatCommission(performance, structure.rules);
        break;
      case 'tiered':
        commissionAmount = this.calculateTieredCommission(performance, structure.rules);
        break;
      case 'percentage':
        commissionAmount = this.calculatePercentageCommission(performance, structure.rules);
        break;
      case 'hybrid':
        const result = this.calculateHybridCommission(performance, structure.rules);
        commissionAmount = result.commission;
        bonusAmount = result.bonus;
        break;
    }

    baseAmount = performance.totalSales;
    const totalAmount = commissionAmount + bonusAmount;

    // Save calculation
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO commission_calculations (
        id, tenant_id, agent_id, period_start, period_end, structure_id,
        base_amount, commission_amount, bonus_amount, total_amount,
        status, calculated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'calculated', ?, ?, ?)
    `);

    await stmt.run(
      id, tenantId, agentId, periodStart, periodEnd, structureId,
      baseAmount, commissionAmount, bonusAmount, totalAmount,
      now, now, now
    );

    return {
      id,
      agentId,
      periodStart,
      periodEnd,
      baseAmount,
      commissionAmount,
      bonusAmount,
      totalAmount,
      status: 'calculated',
      breakdown: this.getBreakdown(performance, structure)
    };
  }

  /**
   * Get agent performance for period
   */
  async getAgentPerformance(agentId, tenantId, startDate, endDate) {
    const stats = await this.db.prepare(`
      SELECT 
        COUNT(DISTINCT v.id) as total_visits,
        COUNT(DISTINCT CASE WHEN v.status = 'completed' THEN v.id END) as completed_visits,
        COUNT(DISTINCT ir.id) as individual_registrations,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_sales
      FROM agents a
      LEFT JOIN visits v ON a.id = v.agent_id AND v.tenant_id = a.tenant_id
        AND v.completed_at >= ? AND v.completed_at <= ?
      LEFT JOIN individual_registrations ON v.id = individual_registrations.visit_id
      LEFT JOIN orders o ON v.id = o.visit_id AND o.tenant_id = a.tenant_id
      WHERE a.id = ? AND a.tenant_id = ?
    `).bind(startDate, endDate, agentId, tenantId).first();

    return {
      totalVisits: stats.total_visits || 0,
      completedVisits: stats.completed_visits || 0,
      individualRegistrations: stats.individual_registrations || 0,
      totalOrders: stats.total_orders || 0,
      totalSales: stats.total_sales || 0
    };
  }

  /**
   * Calculate flat rate commission
   */
  calculateFlatCommission(performance, rules) {
    const { ratePerVisit = 0, ratePerSale = 0 } = rules;
    return (performance.completedVisits * ratePerVisit) + 
           (performance.totalSales * ratePerSale);
  }

  /**
   * Calculate tiered commission
   */
  calculateTieredCommission(performance, rules) {
    const { tiers = [] } = rules;
    let commission = 0;
    let remaining = performance.totalSales;

    // Sort tiers by threshold
    const sortedTiers = [...tiers].sort((a, b) => a.threshold - b.threshold);

    for (const tier of sortedTiers) {
      if (remaining <= 0) break;
      
      const tierAmount = Math.min(remaining, tier.threshold);
      commission += tierAmount * tier.rate;
      remaining -= tierAmount;
    }

    return commission;
  }

  /**
   * Calculate percentage commission
   */
  calculatePercentageCommission(performance, rules) {
    const { percentage = 0 } = rules;
    return performance.totalSales * (percentage / 100);
  }

  /**
   * Calculate hybrid commission
   */
  calculateHybridCommission(performance, rules) {
    const { basePercentage = 0, bonusThresholds = [] } = rules;
    
    const commission = performance.totalSales * (basePercentage / 100);
    let bonus = 0;

    // Check bonus thresholds
    for (const threshold of bonusThresholds) {
      if (performance.totalSales >= threshold.target) {
        bonus += threshold.bonus;
      }
    }

    return { commission, bonus };
  }

  /**
   * Get calculation breakdown
   */
  getBreakdown(performance, structure) {
    return {
      performance,
      structureType: structure.structureType,
      rules: structure.rules
    };
  }

  /**
   * Get commission structure
   */
  async getStructure(id, tenantId) {
    const stmt = this.db.prepare(`
      SELECT * FROM commission_structures
      WHERE id = ? AND tenant_id = ? AND active = TRUE
    `);

    const structure = await stmt.bind(id, tenantId).first();

    if (!structure) {
      throw new NotFoundError('Commission structure');
    }

    return {
      ...structure,
      rules: JSON.parse(structure.rules)
    };
  }

  /**
   * List commission calculations
   */
  async listCalculations(filters, pagination) {
    const { tenantId, agentId, status, periodStart, periodEnd } = filters;
    const { page = 1, limit = 50 } = pagination;
    const offset = (page - 1) * limit;

    let whereClauses = ['tenant_id = ?'];
    const params = [tenantId];

    if (agentId) {
      whereClauses.push('agent_id = ?');
      params.push(agentId);
    }

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    if (periodStart) {
      whereClauses.push('period_start >= ?');
      params.push(periodStart);
    }

    if (periodEnd) {
      whereClauses.push('period_end <= ?');
      params.push(periodEnd);
    }

    const whereClause = whereClauses.join(' AND ');

    const query = `
      SELECT * FROM commission_calculations
      WHERE ${whereClause}
      ORDER BY period_end DESC
      LIMIT ? OFFSET ?
    `;

    const { results } = await this.db.prepare(query).bind(...params, limit, offset).all();

    const countQuery = `
      SELECT COUNT(*) as total FROM commission_calculations
      WHERE ${whereClause}
    `;
    const { total } = await this.db.prepare(countQuery).bind(...params).first();

    return {
      calculations: results.map(c => ({
        ...c,
        periodStart: c.period_start,
        periodEnd: c.period_end,
        calculatedAt: c.calculated_at,
        approvedAt: c.approved_at,
        paidAt: c.paid_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Approve commission calculation
   */
  async approveCalculation(id, tenantId) {
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      UPDATE commission_calculations
      SET status = 'approved', approved_at = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `);

    await stmt.run(now, now, id, tenantId);
    return { success: true, status: 'approved' };
  }

  /**
   * Mark commission as paid
   */
  async markAsPaid(id, tenantId) {
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      UPDATE commission_calculations
      SET status = 'paid', paid_at = ?, updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `);

    await stmt.run(now, now, id, tenantId);
    return { success: true, status: 'paid' };
  }

  /**
   * Create commission dispute
   */
  async createDispute(disputeData) {
    const { calculationId, tenantId, agentId, reason, amount } = disputeData;

    // Update calculation status
    const updateStmt = this.db.prepare(`
      UPDATE commission_calculations
      SET status = 'disputed', updated_at = ?
      WHERE id = ? AND tenant_id = ?
    `);

    await updateStmt.run(new Date().toISOString(), calculationId, tenantId);

    // In a real implementation, create dispute record
    return {
      calculationId,
      status: 'disputed',
      reason,
      amount,
      createdAt: new Date().toISOString()
    };
  }
}
