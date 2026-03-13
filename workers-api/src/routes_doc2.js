// ==================== DOC 2: TRADE PROMOTIONS & FIELD OPS (Sections K-M) ====================

// ==================== K. TRADE PROMOTIONS ENGINE ====================

// K.1 Trade Promotion CRUD
api.get('/trade-promotions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, type, page = 1, limit = 50 } = c.req.query();
  let q = 'SELECT * FROM trade_promotions WHERE tenant_id = ?';
  const params = [tenantId];
  if (status) { q += ' AND status = ?'; params.push(status); }
  if (type) { q += ' AND promotion_type = ?'; params.push(type); }
  q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const promos = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: promos.results || [] });
});

api.get('/trade-promotions/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const promo = await db.prepare('SELECT * FROM trade_promotions WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!promo) return c.json({ success: false, message: 'Trade promotion not found' }, 404);
  const enrollments = await db.prepare("SELECT tpe.*, c.name as customer_name FROM trade_promotion_enrollments tpe LEFT JOIN customers c ON tpe.customer_id = c.id WHERE tpe.promotion_id = ?").bind(id).all();
  const claims = await db.prepare("SELECT tpc.*, c.name as customer_name FROM trade_promotion_claims tpc LEFT JOIN customers c ON tpc.customer_id = c.id WHERE tpc.promotion_id = ?").bind(id).all();
  const audits = await db.prepare("SELECT * FROM trade_promotion_audits WHERE promotion_id = ? ORDER BY audit_date DESC").bind(id).all();
  return c.json({ success: true, data: { ...promo, config: promo.config ? JSON.parse(promo.config) : {}, enrollments: enrollments.results || [], claims: claims.results || [], audits: audits.results || [] } });
});

api.post('/trade-promotions', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();

  // Validate promotion type
  const validTypes = ['VOLUME_REBATE', 'DISPLAY_ALLOWANCE', 'PERFORMANCE_BONUS', 'TRADE_DISCOUNT', 'CO_OP_ADVERTISING', 'SLOTTING_FEE', 'FREE_GOODS', 'MARKDOWN_ALLOWANCE'];
  if (!validTypes.includes(body.promotion_type)) {
    return c.json({ success: false, message: `Invalid promotion type. Must be one of: ${validTypes.join(', ')}` }, 400);
  }

  await db.prepare('INSERT INTO trade_promotions (id, tenant_id, name, promotion_type, description, start_date, end_date, budget, spent, status, config, target_products, target_customers, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.promotion_type, body.description || null, body.start_date, body.end_date, body.budget || 0, 0, 'DRAFT', JSON.stringify(body.config || {}), body.target_products ? JSON.stringify(body.target_products) : null, body.target_customers ? JSON.stringify(body.target_customers) : null, userId).run();

  return c.json({ success: true, data: { id }, message: 'Trade promotion created' }, 201);
});

api.put('/trade-promotions/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE trade_promotions SET name = COALESCE(?, name), description = COALESCE(?, description), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), budget = COALESCE(?, budget), status = COALESCE(?, status), config = COALESCE(?, config), target_products = COALESCE(?, target_products), target_customers = COALESCE(?, target_customers), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.description || null, body.start_date || null, body.end_date || null, body.budget || null, body.status || null, body.config ? JSON.stringify(body.config) : null, body.target_products ? JSON.stringify(body.target_products) : null, body.target_customers ? JSON.stringify(body.target_customers) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Trade promotion updated' });
});

api.put('/trade-promotions/:id/activate', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare("UPDATE trade_promotions SET status = 'ACTIVE', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Trade promotion activated' });
});

api.put('/trade-promotions/:id/close', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare("UPDATE trade_promotions SET status = 'CLOSED', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Trade promotion closed' });
});

// K.2 Enrollment
api.post('/trade-promotions/:id/enroll', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();

  const promo = await db.prepare("SELECT * FROM trade_promotions WHERE id = ? AND tenant_id = ? AND status = 'ACTIVE'").bind(id, tenantId).first();
  if (!promo) return c.json({ success: false, message: 'Active promotion not found' }, 404);

  // Check if already enrolled
  const existing = await db.prepare('SELECT id FROM trade_promotion_enrollments WHERE promotion_id = ? AND customer_id = ?').bind(id, body.customer_id).first();
  if (existing) return c.json({ success: false, message: 'Customer already enrolled' }, 400);

  const enrollId = uuidv4();
  await db.prepare('INSERT INTO trade_promotion_enrollments (id, promotion_id, customer_id, enrolled_by, status, target_value, achieved_value) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(enrollId, id, body.customer_id, userId, 'ACTIVE', body.target_value || 0, 0).run();

  return c.json({ success: true, data: { id: enrollId }, message: 'Customer enrolled' }, 201);
});

api.get('/trade-promotions/:id/enrollments', async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const enrollments = await db.prepare("SELECT tpe.*, c.name as customer_name FROM trade_promotion_enrollments tpe LEFT JOIN customers c ON tpe.customer_id = c.id WHERE tpe.promotion_id = ? ORDER BY tpe.created_at DESC").bind(id).all();
  return c.json({ success: true, data: enrollments.results || [] });
});

// K.3 Claims Processing
api.post('/trade-promotions/:id/claims', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();

  const promo = await db.prepare('SELECT * FROM trade_promotions WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!promo) return c.json({ success: false, message: 'Promotion not found' }, 404);

  // Check budget
  if (promo.budget > 0 && (promo.spent + body.claim_amount) > promo.budget) {
    return c.json({ success: false, message: `Claim exceeds budget. Budget: R${promo.budget}, Spent: R${promo.spent}, Remaining: R${promo.budget - promo.spent}` }, 400);
  }

  const claimId = uuidv4();
  const claimNumber = 'CLM-' + Date.now().toString(36).toUpperCase();
  await db.prepare('INSERT INTO trade_promotion_claims (id, promotion_id, customer_id, claim_number, claim_amount, status, supporting_data, submitted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(claimId, id, body.customer_id, claimNumber, body.claim_amount, 'PENDING', body.supporting_data ? JSON.stringify(body.supporting_data) : null, userId).run();

  return c.json({ success: true, data: { id: claimId, claim_number: claimNumber }, message: 'Claim submitted' }, 201);
});

api.put('/trade-promotion-claims/:id/approve', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const claim = await db.prepare('SELECT * FROM trade_promotion_claims WHERE id = ?').bind(id).first();
  if (!claim) return c.json({ success: false, message: 'Claim not found' }, 404);

  await db.prepare("UPDATE trade_promotion_claims SET status = 'APPROVED', approved_by = ?, approved_at = datetime('now') WHERE id = ?").bind(userId, id).run();

  // Update promotion spent
  await db.prepare('UPDATE trade_promotions SET spent = spent + ? WHERE id = ?').bind(claim.claim_amount, claim.promotion_id).run();

  // Update enrollment achieved value
  await db.prepare('UPDATE trade_promotion_enrollments SET achieved_value = achieved_value + ? WHERE promotion_id = ? AND customer_id = ?').bind(claim.claim_amount, claim.promotion_id, claim.customer_id).run();

  return c.json({ success: true, message: 'Claim approved' });
});

api.put('/trade-promotion-claims/:id/reject', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { reason } = await c.req.json();
  await db.prepare("UPDATE trade_promotion_claims SET status = 'REJECTED', approved_by = ?, approved_at = datetime('now'), notes = ? WHERE id = ?").bind(userId, reason || 'Rejected', id).run();
  return c.json({ success: true, message: 'Claim rejected' });
});

// K.4 Compliance Audits
api.post('/trade-promotions/:id/audits', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();

  const auditId = uuidv4();
  await db.prepare('INSERT INTO trade_promotion_audits (id, promotion_id, customer_id, audited_by, audit_date, compliance_score, findings, photo_urls) VALUES (?, ?, ?, ?, datetime("now"), ?, ?, ?)').bind(auditId, id, body.customer_id, userId, body.compliance_score || 0, body.findings || null, body.photo_urls ? JSON.stringify(body.photo_urls) : null).run();

  return c.json({ success: true, data: { id: auditId }, message: 'Audit recorded' }, 201);
});

// K.5 ROI Calculation
api.get('/trade-promotions/:id/roi', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();

  const promo = await db.prepare('SELECT * FROM trade_promotions WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!promo) return c.json({ success: false, message: 'Promotion not found' }, 404);

  // Calculate incremental revenue from enrolled customers during promo period
  const enrolledCustomers = await db.prepare('SELECT customer_id FROM trade_promotion_enrollments WHERE promotion_id = ?').bind(id).all();
  const customerIds = (enrolledCustomers.results || []).map(e => e.customer_id);

  let incrementalRevenue = 0;
  let baselineRevenue = 0;
  if (customerIds.length > 0) {
    for (const cid of customerIds) {
      // Revenue during promo
      const duringPromo = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as rev FROM sales_orders WHERE tenant_id = ? AND customer_id = ? AND created_at >= ? AND created_at <= ? AND status != 'CANCELLED'").bind(tenantId, cid, promo.start_date, promo.end_date).first();
      // Baseline (same period before promo)
      const daysDiff = Math.ceil((new Date(promo.end_date) - new Date(promo.start_date)) / 86400000);
      const baseStart = new Date(new Date(promo.start_date).getTime() - daysDiff * 86400000).toISOString();
      const baseEnd = promo.start_date;
      const beforePromo = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as rev FROM sales_orders WHERE tenant_id = ? AND customer_id = ? AND created_at >= ? AND created_at <= ? AND status != 'CANCELLED'").bind(tenantId, cid, baseStart, baseEnd).first();
      incrementalRevenue += (duringPromo?.rev || 0);
      baselineRevenue += (beforePromo?.rev || 0);
    }
  }

  const lift = baselineRevenue > 0 ? ((incrementalRevenue - baselineRevenue) / baselineRevenue * 100) : 0;
  const roi = promo.spent > 0 ? ((incrementalRevenue - baselineRevenue - promo.spent) / promo.spent * 100) : 0;

  return c.json({ success: true, data: {
    promotion_id: id,
    budget: promo.budget,
    spent: promo.spent,
    enrolled_customers: customerIds.length,
    baseline_revenue: baselineRevenue,
    promo_revenue: incrementalRevenue,
    incremental_revenue: incrementalRevenue - baselineRevenue,
    revenue_lift_pct: Math.round(lift * 100) / 100,
    roi_pct: Math.round(roi * 100) / 100,
    cost_per_incremental_sale: (incrementalRevenue - baselineRevenue) > 0 ? Math.round(promo.spent / (incrementalRevenue - baselineRevenue) * 100) / 100 : 0
  }});
});

// ==================== L. FIELD OPERATIONS ENGINE ====================

// L.1 Territory Management
api.get('/territories', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const territories = await db.prepare("SELECT t.*, (SELECT COUNT(*) FROM territory_assignments WHERE territory_id = t.id AND is_active = 1) as assigned_agents, (SELECT COUNT(*) FROM customers WHERE territory = t.name AND tenant_id = ?) as customer_count FROM territories t WHERE t.tenant_id = ? ORDER BY t.name").bind(tenantId, tenantId).all();
  return c.json({ success: true, data: territories.results || [] });
});

api.post('/territories', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO territories (id, tenant_id, name, description, boundary_geojson, parent_territory_id) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.description || null, body.boundary_geojson ? JSON.stringify(body.boundary_geojson) : null, body.parent_territory_id || null).run();
  return c.json({ success: true, data: { id }, message: 'Territory created' }, 201);
});

api.put('/territories/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE territories SET name = COALESCE(?, name), description = COALESCE(?, description), boundary_geojson = COALESCE(?, boundary_geojson), parent_territory_id = COALESCE(?, parent_territory_id), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.description || null, body.boundary_geojson ? JSON.stringify(body.boundary_geojson) : null, body.parent_territory_id || null, id, tenantId).run();
  return c.json({ success: true, message: 'Territory updated' });
});

// Territory Assignment
api.post('/territories/:id/assign', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  const aId = uuidv4();
  await db.prepare('INSERT INTO territory_assignments (id, territory_id, agent_id, is_primary, is_active) VALUES (?, ?, ?, ?, ?)').bind(aId, id, body.agent_id, body.is_primary ? 1 : 0, 1).run();
  return c.json({ success: true, data: { id: aId }, message: 'Agent assigned to territory' }, 201);
});

api.delete('/territories/:id/unassign/:agentId', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const { id, agentId } = c.req.param();
  await db.prepare('UPDATE territory_assignments SET is_active = 0 WHERE territory_id = ? AND agent_id = ?').bind(id, agentId).run();
  return c.json({ success: true, message: 'Agent unassigned' });
});

// L.2 Route Planning
api.get('/route-plans', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { agent_id, date, status } = c.req.query();
  let q = "SELECT rp.*, u.first_name || ' ' || u.last_name as agent_name, t.name as territory_name, (SELECT COUNT(*) FROM route_plan_stops WHERE route_plan_id = rp.id) as stop_count FROM route_plans rp LEFT JOIN users u ON rp.agent_id = u.id LEFT JOIN territories t ON rp.territory_id = t.id WHERE rp.tenant_id = ?";
  const params = [tenantId];
  if (role === 'agent') { q += ' AND rp.agent_id = ?'; params.push(userId); }
  else if (agent_id) { q += ' AND rp.agent_id = ?'; params.push(agent_id); }
  if (date) { q += ' AND rp.plan_date = ?'; params.push(date); }
  if (status) { q += ' AND rp.status = ?'; params.push(status); }
  q += ' ORDER BY rp.plan_date DESC';
  const plans = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: plans.results || [] });
});

api.get('/route-plans/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const plan = await db.prepare('SELECT * FROM route_plans WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!plan) return c.json({ success: false, message: 'Route plan not found' }, 404);
  const stops = await db.prepare('SELECT rps.*, c.name as customer_name, c.address, c.gps_latitude, c.gps_longitude FROM route_plan_stops rps LEFT JOIN customers c ON rps.customer_id = c.id WHERE rps.route_plan_id = ? ORDER BY rps.sequence_order').bind(id).all();
  return c.json({ success: true, data: { ...plan, stops: stops.results || [] } });
});

api.post('/route-plans', requireRole('admin', 'manager', 'team_lead'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const planId = uuidv4();
  await db.prepare('INSERT INTO route_plans (id, tenant_id, agent_id, territory_id, plan_date, status, estimated_distance_km, estimated_duration_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(planId, tenantId, body.agent_id, body.territory_id || null, body.plan_date, 'PLANNED', body.estimated_distance_km || null, body.estimated_duration_min || null).run();

  // Create stops
  for (let i = 0; i < (body.stops || []).length; i++) {
    const stop = body.stops[i];
    const stopId = uuidv4();
    await db.prepare('INSERT INTO route_plan_stops (id, route_plan_id, customer_id, sequence_order, planned_arrival, planned_duration_min, visit_purpose) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(stopId, planId, stop.customer_id, i + 1, stop.planned_arrival || null, stop.planned_duration_min || 30, stop.visit_purpose || 'SALES').run();
  }

  return c.json({ success: true, data: { id: planId }, message: 'Route plan created' }, 201);
});

api.put('/route-plans/:id', requireRole('admin', 'manager', 'team_lead'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE route_plans SET status = COALESCE(?, status), estimated_distance_km = COALESCE(?, estimated_distance_km), actual_distance_km = COALESCE(?, actual_distance_km), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.status || null, body.estimated_distance_km || null, body.actual_distance_km || null, id, tenantId).run();
  return c.json({ success: true, message: 'Route plan updated' });
});

api.put('/route-plans/:id/start', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare("UPDATE route_plans SET status = 'IN_PROGRESS', actual_start_time = datetime('now'), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Route started' });
});

api.put('/route-plans/:id/complete', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const { actual_distance_km } = await c.req.json();
  await db.prepare("UPDATE route_plans SET status = 'COMPLETED', actual_end_time = datetime('now'), actual_distance_km = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(actual_distance_km || null, id, tenantId).run();
  return c.json({ success: true, message: 'Route completed' });
});

// Route Plan Stop Check-in/out
api.put('/route-plan-stops/:id/checkin', async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const { gps_latitude, gps_longitude } = await c.req.json();
  await db.prepare("UPDATE route_plan_stops SET status = 'IN_PROGRESS', actual_arrival = datetime('now'), gps_checkin_lat = ?, gps_checkin_lng = ? WHERE id = ?").bind(gps_latitude || null, gps_longitude || null, id).run();
  return c.json({ success: true, message: 'Checked in' });
});

api.put('/route-plan-stops/:id/checkout', async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const { gps_latitude, gps_longitude, notes, outcome } = await c.req.json();
  await db.prepare("UPDATE route_plan_stops SET status = 'COMPLETED', actual_departure = datetime('now'), gps_checkout_lat = ?, gps_checkout_lng = ?, notes = ?, outcome = ? WHERE id = ?").bind(gps_latitude || null, gps_longitude || null, notes || null, outcome || null, id).run();
  return c.json({ success: true, message: 'Checked out' });
});

// L.3 Visit Activities
api.post('/visit-activities', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const id = uuidv4();
  await db.prepare('INSERT INTO visit_activities (id, tenant_id, visit_id, activity_type, description, data, photo_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.visit_id, body.activity_type, body.description || null, body.data ? JSON.stringify(body.data) : null, body.photo_url || null, userId).run();

  return c.json({ success: true, data: { id }, message: 'Activity recorded' }, 201);
});

api.get('/visit-activities', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { visit_id } = c.req.query();
  let q = 'SELECT * FROM visit_activities WHERE tenant_id = ?';
  const params = [tenantId];
  if (visit_id) { q += ' AND visit_id = ?'; params.push(visit_id); }
  q += ' ORDER BY created_at DESC';
  const activities = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: activities.results || [] });
});

// L.4 Competitor Sightings
api.post('/competitor-sightings', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const id = uuidv4();
  await db.prepare('INSERT INTO competitor_sightings (id, tenant_id, visit_id, customer_id, competitor_name, competitor_product, competitor_price, shelf_position, notes, photo_url, reported_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.visit_id || null, body.customer_id || null, body.competitor_name, body.competitor_product || null, body.competitor_price || null, body.shelf_position || null, body.notes || null, body.photo_url || null, userId).run();

  return c.json({ success: true, data: { id }, message: 'Competitor sighting recorded' }, 201);
});

api.get('/competitor-sightings', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const sightings = await db.prepare("SELECT cs.*, c.name as customer_name FROM competitor_sightings cs LEFT JOIN customers c ON cs.customer_id = c.id WHERE cs.tenant_id = ? ORDER BY cs.created_at DESC").bind(tenantId).all();
  return c.json({ success: true, data: sightings.results || [] });
});

// L.5 GPS Compliance
api.post('/gps/validate', async (c) => {
  const body = await c.req.json();
  const { agent_lat, agent_lng, customer_lat, customer_lng, max_distance_meters = 200 } = body;

  // Haversine formula
  const R = 6371e3; // Earth radius in meters
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(customer_lat - agent_lat);
  const dLng = toRad(customer_lng - agent_lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(agent_lat)) * Math.cos(toRad(customer_lat)) * Math.sin(dLng / 2) ** 2;
  const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return c.json({ success: true, data: { distance_meters: Math.round(distance), within_range: distance <= max_distance_meters, max_allowed: max_distance_meters } });
});

// ==================== M. ANOMALY DETECTION ====================

// M.1 Anomaly Flags
api.get('/anomaly-flags', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, type, severity } = c.req.query();
  let q = "SELECT af.*, u.first_name || ' ' || u.last_name as user_name FROM anomaly_flags af LEFT JOIN users u ON af.user_id = u.id WHERE af.tenant_id = ?";
  const params = [tenantId];
  if (status) { q += ' AND af.status = ?'; params.push(status); }
  if (type) { q += ' AND af.anomaly_type = ?'; params.push(type); }
  if (severity) { q += ' AND af.severity = ?'; params.push(severity); }
  q += ' ORDER BY af.detected_at DESC';
  const flags = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: flags.results || [] });
});

api.put('/anomaly-flags/:id/acknowledge', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { notes } = await c.req.json();
  await db.prepare("UPDATE anomaly_flags SET status = 'ACKNOWLEDGED', resolved_by = ?, resolved_at = datetime('now'), resolution_notes = ? WHERE id = ? AND tenant_id = ?").bind(userId, notes || null, id, tenantId).run();
  return c.json({ success: true, message: 'Anomaly acknowledged' });
});

api.put('/anomaly-flags/:id/dismiss', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { notes } = await c.req.json();
  await db.prepare("UPDATE anomaly_flags SET status = 'DISMISSED', resolved_by = ?, resolved_at = datetime('now'), resolution_notes = ? WHERE id = ? AND tenant_id = ?").bind(userId, notes || null, id, tenantId).run();
  return c.json({ success: true, message: 'Anomaly dismissed' });
});

// M.2 Run Anomaly Detection (on-demand)
api.post('/anomaly-detection/run', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const detected = [];

  // 1. GPS Anomalies - visits where agent GPS is far from customer
  const recentVisits = await db.prepare("SELECT v.*, c.gps_latitude as cust_lat, c.gps_longitude as cust_lng FROM visits v JOIN customers c ON v.customer_id = c.id WHERE v.tenant_id = ? AND v.created_at >= datetime('now', '-7 days') AND c.gps_latitude IS NOT NULL AND v.gps_latitude IS NOT NULL").bind(tenantId).all();

  for (const visit of (recentVisits.results || [])) {
    const R = 6371e3;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(visit.cust_lat - visit.gps_latitude);
    const dLng = toRad(visit.cust_lng - visit.gps_longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(visit.gps_latitude)) * Math.cos(toRad(visit.cust_lat)) * Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (distance > 500) { // >500m from customer
      const flagId = uuidv4();
      await db.prepare("INSERT OR IGNORE INTO anomaly_flags (id, tenant_id, user_id, anomaly_type, severity, description, reference_type, reference_id, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(flagId, tenantId, visit.agent_id, 'GPS_MISMATCH', distance > 2000 ? 'HIGH' : 'MEDIUM', `Visit GPS ${Math.round(distance)}m from customer location`, 'VISIT', visit.id, JSON.stringify({ distance_meters: Math.round(distance), visit_lat: visit.gps_latitude, visit_lng: visit.gps_longitude, customer_lat: visit.cust_lat, customer_lng: visit.cust_lng })).run();
      detected.push({ type: 'GPS_MISMATCH', visit_id: visit.id, distance: Math.round(distance) });
    }
  }

  // 2. Ghost Visits - very short visits (<2 min)
  const shortVisits = await db.prepare("SELECT * FROM visits WHERE tenant_id = ? AND created_at >= datetime('now', '-7 days') AND check_out_time IS NOT NULL AND (julianday(check_out_time) - julianday(check_in_time)) * 86400 < 120").bind(tenantId).all();
  for (const visit of (shortVisits.results || [])) {
    const flagId = uuidv4();
    await db.prepare("INSERT OR IGNORE INTO anomaly_flags (id, tenant_id, user_id, anomaly_type, severity, description, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(flagId, tenantId, visit.agent_id, 'GHOST_VISIT', 'MEDIUM', 'Visit duration under 2 minutes - possible ghost visit', 'VISIT', visit.id).run();
    detected.push({ type: 'GHOST_VISIT', visit_id: visit.id });
  }

  // 3. Cash Variance Detection
  const flaggedReconciliations = await db.prepare("SELECT vr.*, vsl.agent_id FROM van_reconciliations vr JOIN van_stock_loads vsl ON vr.van_stock_load_id = vsl.id WHERE vr.tenant_id = ? AND vr.status = 'flagged' AND vr.created_at >= datetime('now', '-7 days')").bind(tenantId).all();
  for (const recon of (flaggedReconciliations.results || [])) {
    const flagId = uuidv4();
    await db.prepare("INSERT OR IGNORE INTO anomaly_flags (id, tenant_id, user_id, anomaly_type, severity, description, reference_type, reference_id, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(flagId, tenantId, recon.agent_id, 'CASH_VARIANCE', Math.abs(recon.variance) > 1000 ? 'HIGH' : 'MEDIUM', `Cash variance of R${recon.variance.toFixed(2)} detected`, 'VAN_RECONCILIATION', recon.id, JSON.stringify({ expected: recon.cash_expected, actual: recon.cash_actual, variance: recon.variance })).run();
    detected.push({ type: 'CASH_VARIANCE', recon_id: recon.id, variance: recon.variance });
  }

  // 4. Pattern Break Detection - agents with sudden drops in activity
  const agents = await db.prepare("SELECT id, first_name, last_name FROM users WHERE tenant_id = ? AND role = 'agent' AND is_active = 1").bind(tenantId).all();
  for (const agent of (agents.results || [])) {
    const thisWeek = await db.prepare("SELECT COUNT(*) as cnt FROM visits WHERE agent_id = ? AND tenant_id = ? AND created_at >= datetime('now', '-7 days')").bind(agent.id, tenantId).first();
    const lastWeek = await db.prepare("SELECT COUNT(*) as cnt FROM visits WHERE agent_id = ? AND tenant_id = ? AND created_at >= datetime('now', '-14 days') AND created_at < datetime('now', '-7 days')").bind(agent.id, tenantId).first();
    if (lastWeek && lastWeek.cnt > 5 && thisWeek && thisWeek.cnt < lastWeek.cnt * 0.5) {
      const flagId = uuidv4();
      await db.prepare("INSERT OR IGNORE INTO anomaly_flags (id, tenant_id, user_id, anomaly_type, severity, description, data) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(flagId, tenantId, agent.id, 'ACTIVITY_DROP', 'LOW', `${agent.first_name} ${agent.last_name}: visits dropped from ${lastWeek.cnt} to ${thisWeek.cnt}`, JSON.stringify({ last_week: lastWeek.cnt, this_week: thisWeek.cnt })).run();
      detected.push({ type: 'ACTIVITY_DROP', agent: agent.first_name + ' ' + agent.last_name });
    }
  }

  return c.json({ success: true, data: { anomalies_detected: detected.length, details: detected } });
});
