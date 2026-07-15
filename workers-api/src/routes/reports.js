import { Hono } from 'hono';
import { authMiddleware } from '../lib/middleware.js';
import { resolveReportCompanyId } from '../lib/aggregates.js';
import { rewriteR2Url } from '../lib/photoAi.js';
import { ensureCaptureFailures } from '../lib/goldrush.js';
import { parseStoreInsights } from '../services/goldrushVision.js';

const app = new Hono();

function emptyIndividualInsights() {
  return { totals: { individuals: 0, converted: 0, with_id: 0, with_suggestion: 0, conversion_rate: 0 }, visitsOverTime: [], topAgents: [], satisfaction: {}, competitors: [], productInterest: [], suggestionsTop: [], geo: { with_gps: 0 } };
}
function emptyStoreInsights() {
  return { totals: { stores_visited: 0, unique_stores: 0, with_photos: 0, with_ai_completed: 0, with_ai_failed: 0, with_stock: 0, with_advertising: 0, board_installed: 0, with_competitors: 0 }, visitsOverTime: [], stocksProduct: {}, hasAdvertising: {}, competitorsInStore: {}, boardInstalled: {}, competitors: [], stockSources: [], adBrands: [], aiBrandsDetected: [], shareOfVoice: [], compliance: [], topStores: [] };
}

app.get('/field-ops/reports/kpis', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();
    let dateFilter = '';
    let regDateFilter = '';
    const binds = [tenantId];
    const regBinds = [tenantId];
    if (company_id) { dateFilter += " AND v.company_id = ?"; binds.push(company_id); }
    if (startDate) { 
      dateFilter += " AND v.visit_date >= ?"; 
      binds.push(startDate);
      regDateFilter += " AND DATE(ir.created_at) >= ?";
      regBinds.push(startDate);
    }
    if (endDate) { 
      dateFilter += " AND v.visit_date <= ?"; 
      binds.push(endDate);
      regDateFilter += " AND DATE(ir.created_at) <= ?";
      regBinds.push(endDate);
    }

    const totalVisits = await db.prepare(`SELECT COUNT(*) as count FROM visits v WHERE v.tenant_id = ?${dateFilter}`).bind(...binds).first();
    const completedVisits = await db.prepare(`SELECT COUNT(*) as count FROM visits v WHERE v.tenant_id = ? AND v.status = 'completed'${dateFilter}`).bind(...binds).first();
    const activeAgents = await db.prepare(`SELECT COUNT(DISTINCT v.agent_id) as count FROM visits v WHERE v.tenant_id = ?${dateFilter}`).bind(...binds).first();
    const totalCustomers = await db.prepare(`SELECT COUNT(DISTINCT v.customer_id) as count FROM visits v WHERE v.tenant_id = ? AND v.customer_id IS NOT NULL${dateFilter}`).bind(...binds).first();
    const totalIndividuals = await db.prepare(`SELECT COUNT(*) as count FROM visits v WHERE v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${dateFilter}`).bind(...binds).first();
    const conversions = await db.prepare(`SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.tenant_id = ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) AND (((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR LOWER(COALESCE(JSON_EXTRACT(vi.custom_field_values, '$.consumer_converted'), '')) = 'yes')${dateFilter}`).bind(...binds).first();

    return c.json({ success: true, kpis: {
      total_checkins: totalVisits?.count || 0,
      approved_checkins: completedVisits?.count || 0,
      active_agents: activeAgents?.count || 0,
      total_shops: totalCustomers?.count || 0,
      conversions: conversions?.count || 0,
      total_visits: totalVisits?.count || 0,
      total_individuals: totalIndividuals?.count || 0,
    }});
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Agent performance
app.get('/field-ops/reports/agent-performance', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();

    // agentFilter is applied only to the outer WHERE (not the correlated subquery which already scopes per-agent)
    let agentFilter = '';
    const agentBinds = [];
    // dateFilter is applied to both outer WHERE and correlated subquery
    let dateFilter = '';
    const dateBinds = [];
    const regBinds = [tenantId];

    // Scope by company via agent_company_links (handles companies with NULL visits.company_id, e.g. Goldrush)
    if (company_id) {
      const companyLinks = await db.prepare(
        "SELECT agent_id FROM agent_company_links WHERE tenant_id = ? AND company_id = ? AND is_active = 1"
      ).bind(tenantId, company_id).all();
      const agentIds = (companyLinks.results || []).map(r => r.agent_id);
      if (agentIds.length === 0) {
        return c.json({ success: true, data: [] });
      }
      const placeholders = agentIds.map(() => '?').join(',');
      agentFilter = ` AND v.agent_id IN (${placeholders})`;
      agentBinds.push(...agentIds);
    }
    if (startDate) {
      dateFilter += " AND v.visit_date >= ?";
      dateBinds.push(startDate);
    }
    if (endDate) {
      dateFilter += " AND v.visit_date <= ?";
      dateBinds.push(endDate);
    }

    // subqueryDateFilter: date-only (no agent IN clause — correlated via v2.agent_id = v.agent_id)
    const subqueryDateFilter = dateFilter.replace(/v\./g, 'v2.');
    const agents = await db.prepare(`
      SELECT v.agent_id, u.first_name || ' ' || u.last_name as agent_name,
        COUNT(*) as checkin_count,
        (SELECT COUNT(*) FROM visit_individuals vi2 JOIN visits v2 ON vi2.visit_id = v2.id WHERE v2.agent_id = v.agent_id AND v2.tenant_id = v.tenant_id AND (((JSON_EXTRACT(vi2.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi2.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi2.custom_field_values,'$.consumer_converted')='Yes') OR LOWER(COALESCE(JSON_EXTRACT(vi2.custom_field_values, '$.consumer_converted'), '')) = 'yes')${subqueryDateFilter}) as conversions
      FROM visits v
      LEFT JOIN users u ON v.agent_id = u.id
      WHERE v.tenant_id = ?${agentFilter}${dateFilter}
        AND (u.email IS NULL OR u.email != 'luke.templeman@gonxt.tech')
      GROUP BY v.agent_id
      ORDER BY checkin_count DESC
      LIMIT 50
    `).bind(...dateBinds, tenantId, ...agentBinds, ...dateBinds).all();

    const data = (agents.results || []).map(a => ({
      ...a,
      conversion_rate: a.checkin_count > 0 ? parseFloat(((a.conversions / a.checkin_count) * 100).toFixed(1)) : 0,
    }));

    return c.json({ success: true, data });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Checkins by hour
app.get('/field-ops/reports/checkins-by-hour', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();
    let dateFilter = '';
    const binds = [tenantId];
    if (company_id) { dateFilter += " AND company_id = ?"; binds.push(company_id); }
    if (startDate) { dateFilter += " AND visit_date >= ?"; binds.push(startDate); }
    if (endDate) { dateFilter += " AND visit_date <= ?"; binds.push(endDate); }

    const result = await db.prepare(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
      FROM visits
      WHERE tenant_id = ?${dateFilter}
      GROUP BY hour
      ORDER BY hour
    `).bind(...binds).all();

    // Fill in missing hours
    const hourMap = {};
    for (const r of (result.results || [])) hourMap[r.hour] = r.count;
    const data = [];
    for (let h = 0; h < 24; h++) data.push({ hour: h, count: hourMap[h] || 0 });

    return c.json({ success: true, data });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Checkins by day of week
app.get('/field-ops/reports/checkins-by-day', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();
    let dateFilter = '';
    const binds = [tenantId];
    if (company_id) { dateFilter += " AND company_id = ?"; binds.push(company_id); }
    if (startDate) { dateFilter += " AND visit_date >= ?"; binds.push(startDate); }
    if (endDate) { dateFilter += " AND visit_date <= ?"; binds.push(endDate); }

    const result = await db.prepare(`
      SELECT CAST(strftime('%w', visit_date) AS INTEGER) as day_num, COUNT(*) as count
      FROM visits
      WHERE tenant_id = ?${dateFilter}
      GROUP BY day_num
      ORDER BY day_num
    `).bind(...binds).all();

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayMap = {};
    for (const r of (result.results || [])) dayMap[r.day_num] = r.count;
    const data = dayNames.map((name, i) => ({ day_name: name, day_num: i, count: dayMap[i] || 0 }));

    return c.json({ success: true, data });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Conversion stats
app.get('/field-ops/reports/conversion-stats', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();
    let dateFilter = '';
    let regDateFilter = '';
    const binds = [tenantId];
    const regBinds = [tenantId];
    // Scope by company via agent_company_links (handles companies with NULL visits.company_id, e.g. Goldrush)
    if (company_id) {
      const companyLinks = await db.prepare(
        "SELECT agent_id FROM agent_company_links WHERE tenant_id = ? AND company_id = ? AND is_active = 1"
      ).bind(tenantId, company_id).all();
      const agentIds = (companyLinks.results || []).map(r => r.agent_id);
      if (agentIds.length === 0) {
        return c.json({ success: true, data: { converted_yes: 0, converted_no: 0, betting_yes: 0, betting_no: 0 } });
      }
      const placeholders = agentIds.map(() => '?').join(',');
      dateFilter += ` AND agent_id IN (${placeholders})`;
      binds.push(...agentIds);
    }
    if (startDate) { 
      dateFilter += " AND visit_date >= ?"; 
      binds.push(startDate);
      regDateFilter += " AND DATE(created_at) >= ?";
      regBinds.push(startDate);
    }
    if (endDate) { 
      dateFilter += " AND visit_date <= ?"; 
      binds.push(endDate);
      regDateFilter += " AND DATE(created_at) <= ?";
      regBinds.push(endDate);
    }

    const total = await db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ?${dateFilter}`).bind(...binds).first();
    const converted = await db.prepare(`SELECT COUNT(*) as count FROM visit_individuals vi JOIN visits v ON vi.visit_id = v.id WHERE v.tenant_id = ? AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id) AND (((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR LOWER(COALESCE(JSON_EXTRACT(vi.custom_field_values, '$.consumer_converted'), '')) = 'yes')${dateFilter}`).bind(...binds).first();
    const totalRegs = await db.prepare(`SELECT COUNT(*) as count FROM visits v WHERE v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${dateFilter}`).bind(...binds).first();
    const storeVisits = await db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_type = 'store'${dateFilter}`).bind(...binds).first();

    return c.json({ success: true, data: {
      converted_yes: converted?.count || 0,
      converted_no: (totalRegs?.count || 0) - (converted?.count || 0),
      betting_yes: storeVisits?.count || 0,
      betting_no: (total?.count || 0) - (storeVisits?.count || 0),
    }});
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Goldrush Individual Report - all individual registrations for Goldrush with questionnaire data
app.get('/field-ops/reports/goldrush-individuals', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();

    // Find the report's company (explicit company_id, else goldrush default)
    const goldrushId = await resolveReportCompanyId(db, tenantId, company_id || null);
    if (!goldrushId) {
      return c.json({ success: true, data: [], total: 0, message: 'Company not found' });
    }

    let dateFilter = '';
    const binds = [tenantId, goldrushId];
    // IMPORTANT: Only apply date filter if BOTH startDate AND endDate are provided
    // If either is missing or empty, return ALL data (all-time behavior)
    
    // Handle both null and empty strings from query parameters
    const hasStartDate = startDate && startDate.trim() !== '';
    const hasEndDate = endDate && endDate.trim() !== '';
    
    if (hasStartDate && hasEndDate) {
      dateFilter = " AND v.visit_date BETWEEN ? AND ?";
      binds.push(startDate, endDate);
    } else if (hasStartDate && !hasEndDate) {
      // If only start date provided, use it as start with today as end
      const today = new Date().toISOString().split('T')[0];
      dateFilter = " AND v.visit_date BETWEEN ? AND ?";
      binds.push(startDate, today);
    } else if (!hasStartDate && hasEndDate) {
      // If only end date provided, use it as end with start of time as start (Jan 1, 2000)
      dateFilter = " AND v.visit_date BETWEEN ? AND ?";
      binds.push('2000-01-01', endDate);
    }
    // If NEITHER startDate nor endDate provided, no date filter is applied (all-time)

    // Row cap: all-time spans 23k+ rows with large JSON blobs and times the worker out.
    // Callers can raise via ?limit= up to 10000; response sets truncated=true when hit.
    const limitRaw = parseInt(c.req.query('limit') || '5000', 10);
    const rowCap = Math.min(Math.max(Number.isNaN(limitRaw) ? 5000 : limitRaw, 1), 10000);

    // DEBUG: Log what we received and what filter we're applying
    console.log(`[GoldrushIndividuals] Query params - startDate: "${startDate}", endDate: "${endDate}"`);
    console.log(`[GoldrushIndividuals] Applying dateFilter: "${dateFilter}"`);
    console.log(`[GoldrushIndividuals] Total binds: ${binds.length}, values: [${binds.map(b => typeof b === 'string' ? `"${b}"` : b).join(', ')}]`);

    // Get all individual registrations for Goldrush with agent name, custom field values, and survey responses
    // Custom questions (like goldrush_id) are stored in visit_individuals.custom_field_values
    // Survey/questionnaire responses are stored in visit_responses.responses
    // Use correlated subqueries to avoid duplicate rows (same pattern as line 2762)
    // Exclude test users (agent-test-*, demo accounts, and @fieldvibe.test emails)
    const result = await db.prepare(`
      SELECT v.id, i.first_name, i.last_name, i.id_number, i.phone, i.email,
        (SELECT vp.r2_url FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.r2_url IS NOT NULL LIMIT 1) as thumbnail_url,
        JSON_EXTRACT(vi.custom_field_values, '$.product_app_player_id') as product_app_player_id,
        (CASE WHEN (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') THEN 1 ELSE 0 END) as converted,
        JSON_EXTRACT(vi.custom_field_values, '$.conversion_date') as conversion_date,
        v.notes, v.latitude as gps_latitude, v.longitude as gps_longitude,
        v.created_at, v.id as visit_id,
        u.first_name || ' ' || u.last_name as agent_name,
        vi.custom_field_values,
        (SELECT vr.responses FROM visit_responses vr WHERE vr.visit_id = v.id AND (vr.visit_type IS NULL OR vr.visit_type != 'store_custom_questions') LIMIT 1) as questionnaire_responses
      FROM visits v
      LEFT JOIN visit_individuals vi ON v.id = vi.visit_id
      LEFT JOIN individuals i ON vi.individual_id = i.id
      LEFT JOIN users u ON v.agent_id = u.id
      WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type) = 'individual'
        AND v.agent_id NOT LIKE 'agent-test-%'
        AND v.agent_id NOT IN ('admin-user-001', 'agent-user-001', 'manager-user-001', 'e6c2898a-6420-4327-8000-e7857021a306')
        AND (u.id IS NULL OR (u.email NOT LIKE '%@fieldvibe.test' AND u.email NOT LIKE '%@demo.com' AND u.email != 'luke@templeman.co.za' AND u.email != 'luke.templeman@gonxt.tech'))
        AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${dateFilter}
      ORDER BY v.created_at DESC
      LIMIT ?
    `).bind(...binds, rowCap).all();
    const truncated = (result.results || []).length === rowCap;

    // Look up custom company questions with field_type='image' to extract photos from custom question responses
    let customImageKeys = [];
    try {
      const imgQs = await db.prepare("SELECT question_key FROM company_custom_questions WHERE tenant_id = ? AND company_id = ? AND field_type = 'image' AND is_active = 1").bind(tenantId, goldrushId).all();
      customImageKeys = (imgQs.results || []).map(q => q.question_key);
    } catch (e) { /* ignore */ }

    // Parse both custom field values and questionnaire responses to extract goldrush_id and other fields
    // Custom questions (goldrush_id, etc.) are keyed by question_key in custom_field_values
    // Survey responses may also contain relevant data keyed by question UUID or key
    const data = (result.results || []).map(row => {
      let goldrush_id = '';
      let consumer_converted = '';
      let betting_elsewhere = '';
      let competitor_company = '';
      let used_goldrush_before = '';
      let goldrush_comparison = '';
      let likes_goldrush = '';
      let platform_suggestions = '';
      let gave_brand_info = '';
      let goldrush_id_rejected = false;
      let goldrush_id_rejection_reason = '';
      let id_passport_photo = '';
      let shop_exterior_photo = '';
      let ad_board_photo = '';
      let competitor_photo = '';
      let custom_question_photo = '';
      try {
        // Parse custom field values (from visit_individuals - where custom questions like goldrush_id are stored)
        let customFields = {};
        if (row.custom_field_values) {
          customFields = typeof row.custom_field_values === 'string'
            ? JSON.parse(row.custom_field_values)
            : row.custom_field_values;
        }
        // Parse survey/questionnaire responses (from visit_responses)
        let surveyResponses = {};
        if (row.questionnaire_responses) {
          surveyResponses = typeof row.questionnaire_responses === 'string'
            ? JSON.parse(row.questionnaire_responses)
            : row.questionnaire_responses;
        }
        // Merge both sources - custom fields take priority (they contain the question_key-based values)
        const responses = { ...surveyResponses, ...customFields };
        goldrush_id = responses.goldrush_id || responses.goldrush_id_entry || '';
        consumer_converted = responses.consumer_converted || '';
        betting_elsewhere = responses.betting_elsewhere || '';
        competitor_company = responses.competitor_company || '';
        used_goldrush_before = responses.used_goldrush_before || '';
        goldrush_comparison = responses.goldrush_comparison || '';
        likes_goldrush = responses.likes_goldrush || '';
        platform_suggestions = responses.platform_suggestions || '';
        gave_brand_info = responses.gave_brand_info || '';
        goldrush_id_rejected = customFields.goldrush_id_rejected === true || customFields.goldrush_id_rejected === 'true';
        goldrush_id_rejection_reason = customFields.goldrush_id_rejection_reason || '';
        // Extract questionnaire image URLs from Goldrush Individual Visit process steps
        id_passport_photo = responses.id_passport_photo || '';
        shop_exterior_photo = responses.shop_exterior_photo || '';
        ad_board_photo = responses.ad_board_photo || '';
        competitor_photo = responses.competitor_photo || '';
        // Also check custom company question image fields (field_type='image')
        for (const key of customImageKeys) {
          const val = responses[key];
          if (val && typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('http'))) {
            custom_question_photo = val;
            break;
          }
        }
      } catch (e) { /* ignore parse errors */ }

      // Use visit_photos (R2 URLs) first; for base64 photos from custom questions, only flag their existence
      const isUrl = (v) => v && typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'));
      const reqUrl = c.req.url;
      const photo_url = rewriteR2Url(row.thumbnail_url, reqUrl) || (isUrl(id_passport_photo) ? rewriteR2Url(id_passport_photo, reqUrl) : null) || (isUrl(shop_exterior_photo) ? rewriteR2Url(shop_exterior_photo, reqUrl) : null) || (isUrl(ad_board_photo) ? rewriteR2Url(ad_board_photo, reqUrl) : null) || (isUrl(competitor_photo) ? rewriteR2Url(competitor_photo, reqUrl) : null) || (isUrl(custom_question_photo) ? rewriteR2Url(custom_question_photo, reqUrl) : null) || null;
      const has_photos = !!(id_passport_photo || shop_exterior_photo || ad_board_photo || competitor_photo || custom_question_photo);

      return {
        id: row.id,
        visit_id: row.visit_id,
        first_name: row.first_name,
        last_name: row.last_name,
        id_number: row.id_number,
        phone: row.phone,
        email: row.email,
        product_app_player_id: row.product_app_player_id,
        goldrush_id,
        goldrush_id_rejected,
        goldrush_id_rejection_reason,
        converted: row.converted === 1 ? 1 : (consumer_converted === 'Yes' ? 1 : 0),
        conversion_date: row.conversion_date,
        agent_name: row.agent_name,
        gps_latitude: row.gps_latitude,
        gps_longitude: row.gps_longitude,
        created_at: row.created_at,
        notes: row.notes,
        gave_brand_info,
        thumbnail_url: photo_url,
        has_photos,
        consumer_converted,
        betting_elsewhere,
        competitor_company,
        used_goldrush_before,
        goldrush_comparison,
        likes_goldrush,
        platform_suggestions,
      };
    });

    console.log(`[GoldrushIndividuals] Returning ${data.length} records${truncated ? ' (truncated at cap)' : ''}`);
    return c.json({ success: true, data, total: data.length, truncated });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Goldrush Tracking Report - daily individual sign-up counts per agent / team lead
app.get('/field-ops/reports/goldrush-tracking', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();

    const goldrushId = await resolveReportCompanyId(db, tenantId, company_id || null);
    if (!goldrushId) {
      return c.json({ success: true, dates: [], rows: [], message: 'Company not found' });
    }

    const hasStart = startDate && startDate.trim() !== '';
    const hasEnd   = endDate   && endDate.trim()   !== '';

    // Resolve effective date range
    const effectiveStart = hasStart ? startDate : (hasEnd ? '2000-01-01' : null);
    const effectiveEnd   = hasEnd   ? endDate   : (hasStart ? new Date().toISOString().split('T')[0] : null);

    // ── Query 1: all active agents/TLs linked to Goldrush ──────────────────
    const agentsResult = await db.prepare(`
      SELECT DISTINCT
        u.id            AS agent_id,
        u.first_name || ' ' || u.last_name AS agent_name,
        u.role,
        u.team_lead_id,
        tl.first_name || ' ' || tl.last_name AS team_lead_name
      FROM users u
      JOIN agent_company_links acl
        ON acl.agent_id = u.id AND acl.company_id = ? AND acl.tenant_id = ? AND acl.is_active = 1
      LEFT JOIN users tl ON u.team_lead_id = tl.id AND tl.tenant_id = ?
      WHERE u.tenant_id = ?
        AND u.is_active = 1
        AND u.id NOT LIKE 'agent-test-%'
        AND u.id NOT IN ('admin-user-001','agent-user-001','manager-user-001','e6c2898a-6420-4327-8000-e7857021a306')
        AND u.email NOT LIKE '%@fieldvibe.test'
        AND u.email NOT LIKE '%@demo.com'
        AND u.email != 'luke@templeman.co.za'
        AND u.email != 'luke.templeman@gonxt.tech'
        AND u.role IN ('agent','team_lead','field_agent','sales_rep')
    `).bind(goldrushId, tenantId, tenantId, tenantId).all();

    // ── Query 2: visit counts grouped by agent + date ───────────────────────
    let dateFilter = '';
    const visitBinds = [tenantId, goldrushId];
    if (effectiveStart && effectiveEnd) {
      dateFilter = ' AND v.visit_date BETWEEN ? AND ?';
      visitBinds.push(effectiveStart, effectiveEnd);
    }

    const visitsResult = await db.prepare(`
      SELECT v.agent_id, DATE(v.visit_date) AS visit_date, COUNT(*) AS count
      FROM visits v
      JOIN users u ON v.agent_id = u.id
      WHERE v.tenant_id = ? AND v.company_id = ?
        AND LOWER(v.visit_type) = 'individual'
        AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)
        AND v.agent_id NOT LIKE 'agent-test-%'
        AND v.agent_id NOT IN ('admin-user-001','agent-user-001','manager-user-001','e6c2898a-6420-4327-8000-e7857021a306')
        AND u.email NOT LIKE '%@fieldvibe.test'
        AND u.email NOT LIKE '%@demo.com'
        AND u.email != 'luke@templeman.co.za'
        AND u.email != 'luke.templeman@gonxt.tech'
        ${dateFilter}
      GROUP BY v.agent_id, DATE(v.visit_date)
    `).bind(...visitBinds).all();

    // Build lookup: agent_id -> { date -> count }
    const countMap = new Map();
    for (const r of (visitsResult.results || [])) {
      if (!countMap.has(r.agent_id)) countMap.set(r.agent_id, {});
      countMap.get(r.agent_id)[r.visit_date] = r.count || 0;
    }

    // Build sorted unique dates list (from actual visits only)
    const dateSet = new Set();
    for (const r of (visitsResult.results || [])) {
      if (r.visit_date) dateSet.add(r.visit_date);
    }
    const dates = Array.from(dateSet).sort();

    // Merge: every agent gets a row, with by_date filled from countMap
    const rows = (agentsResult.results || []).map(a => {
      const by_date = countMap.get(a.agent_id) || {};
      const total   = Object.values(by_date).reduce((s, v) => s + v, 0);
      return {
        agent_id:       a.agent_id,
        agent_name:     a.agent_name || 'Unknown',
        role:           a.role       || 'agent',
        team_lead_id:   a.team_lead_id   || null,
        team_lead_name: a.team_lead_name || null,
        total,
        by_date,
      };
    }).sort((a, b) => {
      const aIsTL = a.role === 'team_lead' ? 0 : 1;
      const bIsTL = b.role === 'team_lead' ? 0 : 1;
      if (aIsTL !== bIsTL) return aIsTL - bIsTL;
      return a.agent_name.localeCompare(b.agent_name);
    });

    return c.json({ success: true, dates, rows });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/field-ops/reports/goldrush-upload-failures', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate } = c.req.query();
    const hasStart = startDate && startDate.trim() !== '';
    const hasEnd = endDate && endDate.trim() !== '';
    let dateFilter = '';
    const binds = [tenantId];
    if (hasStart && hasEnd) { dateFilter = ' AND visit_date BETWEEN ? AND ?'; binds.push(startDate, endDate); }
    else if (hasStart) { dateFilter = ' AND visit_date >= ?'; binds.push(startDate); }
    else if (hasEnd) { dateFilter = ' AND visit_date <= ?'; binds.push(endDate); }

    // Ensure table exists with all columns (in case migration hasn't run yet)
    await ensureCaptureFailures(db);

    const result = await db.prepare(`
      SELECT guf.id, guf.visit_id, guf.visit_date, guf.first_name, guf.last_name, guf.id_number, guf.goldrush_id, guf.phone,
        guf.agent_id, guf.agent_name, guf.team_lead_id, guf.team_lead_name,
        guf.error_id_number, guf.error_goldrush_id, guf.error_photo_mismatch, guf.error_no_btag, guf.created_at,
        vp.r2_url as photo_url, v.customer_id
      FROM goldrush_upload_failures guf
      LEFT JOIN visits v ON v.id = guf.visit_id AND v.tenant_id = guf.tenant_id
      LEFT JOIN visit_photos vp ON vp.id = (
        SELECT vp2.id FROM visit_photos vp2
        WHERE vp2.visit_id = guf.visit_id
          AND vp2.tenant_id = guf.tenant_id
          AND vp2.photo_type = 'goldrush_individual'
          AND vp2.r2_url IS NOT NULL
        LIMIT 1
      )
      WHERE guf.tenant_id = ? ${dateFilter.replace(/visit_date/g, 'guf.visit_date')}
      ORDER BY guf.visit_date DESC, guf.agent_name
    `).bind(...binds).all();

    const data = (result.results || []).map(row => ({
      id: row.id,
      visit_id: row.visit_id || null,
      visit_date: row.visit_date,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      id_number: row.id_number || '',
      goldrush_id: row.goldrush_id || '',
      phone: row.phone || '',
      agent_id: row.agent_id,
      agent_name: row.agent_name || 'Unknown',
      team_lead_id: row.team_lead_id || null,
      team_lead_name: row.team_lead_name || null,
      photo_url: row.photo_url || null,
      customer_id: row.customer_id || null, // corrective-edit loop: PWA links to /agent/customer-edit/:id
      errors: {
        ...(row.error_id_number ? { id_number: row.error_id_number } : {}),
        ...(row.error_goldrush_id ? { goldrush_id: row.error_goldrush_id } : {}),
        ...(row.error_photo_mismatch ? { photo_mismatch: row.error_photo_mismatch } : {}),
        ...(row.error_no_btag ? { no_btag: row.error_no_btag } : {}),
      },
      error_summary: [row.error_id_number, row.error_goldrush_id, row.error_photo_mismatch, row.error_no_btag].filter(Boolean).join('; '),
    }));
    return c.json({ success: true, data, total: data.length });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Goldrush No B-Tag Report — valid captures missing a product_app_player_id (B-tag)
app.get('/field-ops/reports/goldrush-no-btag', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();

    const goldrushCompanyId = await resolveReportCompanyId(db, tenantId, company_id || null);
    if (!goldrushCompanyId) return c.json({ success: true, data: [] });

    const hasStart = startDate && startDate.trim() !== '';
    const hasEnd = endDate && endDate.trim() !== '';
    let dateFilter = '';
    const binds = [tenantId, goldrushCompanyId];
    if (hasStart && hasEnd) { dateFilter = ' AND v.visit_date BETWEEN ? AND ?'; binds.push(startDate, endDate); }
    else if (hasStart) { dateFilter = ' AND v.visit_date >= ?'; binds.push(startDate); }
    else if (hasEnd) { dateFilter = ' AND v.visit_date <= ?'; binds.push(endDate); }

    const result = await db.prepare(`
      SELECT
        v.id AS visit_id,
        v.visit_date,
        v.individual_name,
        v.individual_surname,
        v.individual_id_number,
        vi.custom_field_values,
        u.first_name || ' ' || u.last_name AS agent_name,
        tl.first_name || ' ' || tl.last_name AS team_lead_name
      FROM visits v
      LEFT JOIN visit_individuals vi ON vi.visit_id = v.id AND vi.tenant_id = v.tenant_id
      LEFT JOIN users u ON v.agent_id = u.id AND u.tenant_id = v.tenant_id
      LEFT JOIN users tl ON u.team_lead_id = tl.id AND tl.tenant_id = v.tenant_id
      WHERE v.tenant_id = ? AND v.company_id = ?
        AND LOWER(v.visit_type) = 'individual'
        AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)
        AND (JSON_EXTRACT(vi.custom_field_values, '$.validation_failed') IS NULL
          OR JSON_EXTRACT(vi.custom_field_values, '$.validation_failed') = 0)
        AND JSON_EXTRACT(vi.custom_field_values, '$.goldrush_id') IS NOT NULL
        AND JSON_EXTRACT(vi.custom_field_values, '$.goldrush_id') != ''
        AND v.individual_id_number IS NOT NULL AND v.individual_id_number != ''
        AND (JSON_EXTRACT(vi.custom_field_values, '$.product_app_player_id') IS NULL
          OR JSON_EXTRACT(vi.custom_field_values, '$.product_app_player_id') = '')
        AND v.agent_id NOT LIKE 'agent-test-%'
        AND v.agent_id NOT IN ('admin-user-001','agent-user-001','manager-user-001','e6c2898a-6420-4327-8000-e7857021a306')
        AND (u.email NOT LIKE '%@fieldvibe.test' AND u.email NOT LIKE '%@demo.com')
        ${dateFilter}
      ORDER BY v.visit_date DESC
    `).bind(...binds).all();

    const data = (result.results || []).map(row => {
      let goldrushId = '';
      try {
        const cf = typeof row.custom_field_values === 'string' ? JSON.parse(row.custom_field_values) : (row.custom_field_values || {});
        goldrushId = cf.goldrush_id || '';
      } catch { /* ignore */ }
      return {
        visit_id: row.visit_id,
        visit_date: row.visit_date,
        first_name: row.individual_name || '',
        last_name: row.individual_surname || '',
        id_number: row.individual_id_number || '',
        goldrush_id: goldrushId,
        agent_name: row.agent_name || 'Unknown',
        team_lead_name: row.team_lead_name || null,
      };
    });
    return c.json({ success: true, data, total: data.length });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Goldrush Store Report - all store visits for Goldrush with questionnaire data
app.get('/field-ops/reports/goldrush-stores', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();

    // Find the report's company (explicit company_id, else goldrush default)
    const goldrushId = await resolveReportCompanyId(db, tenantId, company_id || null);
    if (!goldrushId) {
      return c.json({ success: true, data: [], total: 0, message: 'Company not found' });
    }

    let dateFilter = '';
    const binds = [tenantId, goldrushId];
    if (startDate || endDate) {
      const startD = startDate || new Date().toISOString().split('T')[0];
      const endD = endDate || new Date().toISOString().split('T')[0];
      dateFilter = " AND v.visit_date BETWEEN ? AND ?";
      binds.push(startD, endD);
    }

    // Get all store visits for Goldrush with agent name, customer info, and photos
    // Exclude test users (agent-test-*, demo accounts, and @fieldvibe.test emails)
    const result = await db.prepare(`
      SELECT v.id, v.visit_date, v.status, v.notes, v.latitude as gps_latitude, v.longitude as gps_longitude,
        v.created_at, v.customer_id,
        c.name as store_name, c.address as store_address,
        u.first_name || ' ' || u.last_name as agent_name,
        (SELECT vp.r2_url FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.r2_url IS NOT NULL LIMIT 1) as thumbnail_url,
        (SELECT vr.responses FROM visit_responses vr WHERE vr.visit_id = v.id AND vr.visit_type = 'store_custom_questions' LIMIT 1) as store_custom_responses,
        (SELECT vr.responses FROM visit_responses vr WHERE vr.visit_id = v.id AND (vr.visit_type IS NULL OR vr.visit_type = 'customer' OR vr.visit_type = 'store') LIMIT 1) as questionnaire_responses,
        (SELECT GROUP_CONCAT(vr.responses, '|||') FROM visit_responses vr WHERE vr.visit_id = v.id) as all_responses,
        (SELECT vp2.ai_analysis_status FROM visit_photos vp2 WHERE vp2.visit_id = v.id AND vp2.tenant_id = v.tenant_id AND vp2.ai_analysis_status IS NOT NULL ORDER BY vp2.ai_analysis_status = 'completed' DESC LIMIT 1) as ai_status,
        (SELECT vp3.ai_raw_response FROM visit_photos vp3 WHERE vp3.visit_id = v.id AND vp3.tenant_id = v.tenant_id AND vp3.ai_analysis_status = 'completed' AND (vp3.ai_raw_response LIKE '%board_detected%true%' OR vp3.ai_raw_response LIKE '%"board_detected": true%') LIMIT 1) as ai_board_response,
        (SELECT COUNT(*) FROM visit_photos vp4 WHERE vp4.visit_id = v.id AND vp4.tenant_id = v.tenant_id AND vp4.ai_analysis_status = 'completed') as ai_photos_analyzed,
        (SELECT COALESCE(MAX(vp5.ai_share_of_voice), 0) FROM visit_photos vp5 WHERE vp5.visit_id = v.id AND vp5.tenant_id = v.tenant_id AND vp5.ai_analysis_status = 'completed') as ai_share_of_voice,
        (SELECT vp6.ai_raw_response FROM visit_photos vp6 WHERE vp6.visit_id = v.id AND vp6.tenant_id = v.tenant_id AND vp6.ai_analysis_status = 'completed' ORDER BY vp6.ai_processed_at DESC LIMIT 1) as ai_raw_response
      FROM visits v
      LEFT JOIN customers c ON v.customer_id = c.id
      LEFT JOIN users u ON v.agent_id = u.id
      WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type) = 'store'
        AND v.agent_id NOT LIKE 'agent-test-%'
        AND v.agent_id NOT IN ('admin-user-001', 'agent-user-001', 'manager-user-001', 'e6c2898a-6420-4327-8000-e7857021a306')
        AND (u.id IS NULL OR (u.email NOT LIKE '%@fieldvibe.test' AND u.email NOT LIKE '%@demo.com' AND u.email != 'luke@templeman.co.za' AND u.email != 'luke.templeman@gonxt.tech'))${dateFilter}
      ORDER BY v.created_at DESC
    `).bind(...binds).all();

    // Look up custom company questions with field_type='image' to extract photos
    let customImageKeys = [];
    try {
      const imgQs = await db.prepare("SELECT question_key FROM company_custom_questions WHERE tenant_id = ? AND company_id = ? AND field_type = 'image' AND is_active = 1").bind(tenantId, goldrushId).all();
      customImageKeys = (imgQs.results || []).map(q => q.question_key);
    } catch (e) { /* ignore */ }

    // Parse store custom questions and questionnaire responses
    const data = (result.results || []).map(row => {
      let goldrush_id = '';
      let stock_source = '';
      let competitors_in_store = '';
      let competitor_stock_source = '';
      let competitor_products = '';
      let competitor_prices = '';
      let has_advertising = '';
      let other_ad_brands = '';
      let board_installed = '';
      let additional_notes = '';
      let shop_exterior_photo = '';
      let competitor_photo = '';
      let ad_board_photo = '';
      let custom_question_photo = '';

      try {
        // Parse store custom questions (from visit_responses with visit_type='store_custom_questions')
        let storeCustom = {};
        if (row.store_custom_responses) {
          storeCustom = typeof row.store_custom_responses === 'string'
            ? JSON.parse(row.store_custom_responses)
            : row.store_custom_responses;
        }
        // Parse questionnaire responses
        let surveyResponses = {};
        if (row.questionnaire_responses) {
          surveyResponses = typeof row.questionnaire_responses === 'string'
            ? JSON.parse(row.questionnaire_responses)
            : row.questionnaire_responses;
        }
        // Also parse ALL visit_responses to catch board_installed from any source
        let allParsedResponses = {};
        if (row.all_responses) {
          for (const chunk of row.all_responses.split('|||')) {
            try {
              const parsed = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
              if (parsed && typeof parsed === 'object') Object.assign(allParsedResponses, parsed);
            } catch {}
          }
        }
        // Merge all sources - store custom questions take priority, then questionnaire, then all responses
        const responses = { ...allParsedResponses, ...surveyResponses, ...storeCustom };
        goldrush_id = responses.goldrush_id || responses.goldrush_id_entry || '';
        stock_source = responses.stock_source || '';
        competitors_in_store = responses.competitors_in_store || '';
        competitor_stock_source = responses.competitor_stock_source || '';
        competitor_products = responses.competitor_products || '';
        competitor_prices = responses.competitor_prices || '';
        has_advertising = responses.has_advertising || '';
        other_ad_brands = responses.other_ad_brands || '';
        // Check for board_installed with partial key matching (key could be 'board_installed', 'board_placement', etc.)
        board_installed = responses.board_installed || '';
        if (!board_installed) {
          const boardKeys = ['board_installed', 'board_placement', 'board_present', 'board_status', 'ad_board'];
          for (const [k, v] of Object.entries(responses)) {
            if (boardKeys.some(bk => k.toLowerCase().startsWith(bk)) && (v === 'Yes' || v === 'No')) {
              board_installed = v;
              break;
            }
          }
        }
        additional_notes = responses.additional_notes || row.notes || '';
        // Extract photo URLs from process step fields
        shop_exterior_photo = responses.shop_exterior_photo || '';
        competitor_photo = responses.competitor_photo || '';
        ad_board_photo = responses.ad_board_photo || '';
        // Also check custom company question image fields
        for (const key of customImageKeys) {
          const val = responses[key];
          if (val && typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('http'))) {
            custom_question_photo = val;
            break;
          }
        }
      } catch (e) { /* ignore parse errors */ }

      // Use visit_photos (R2 URLs) first; for base64 photos from custom questions, only flag their existence
      // Don't include full base64 data in listing response (can be 100KB+ per photo, making response huge)
      const isUrl = (v) => v && typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'));
      const reqUrl = c.req.url;
      const photo_url = rewriteR2Url(row.thumbnail_url, reqUrl) || (isUrl(shop_exterior_photo) ? rewriteR2Url(shop_exterior_photo, reqUrl) : null) || (isUrl(ad_board_photo) ? rewriteR2Url(ad_board_photo, reqUrl) : null) || (isUrl(competitor_photo) ? rewriteR2Url(competitor_photo, reqUrl) : null) || (isUrl(custom_question_photo) ? rewriteR2Url(custom_question_photo, reqUrl) : null) || null;
      const has_photos = !!(shop_exterior_photo || ad_board_photo || competitor_photo || custom_question_photo);

      // Parse AI data before building return object so board_installed can be updated
      let ai_board_detected = false, ai_brand = '', ai_condition = '', ai_visibility = '', ai_board_type = '', ai_description = '';
      let ai_insights = [];
      if (row.ai_board_response) {
        try {
          const r = JSON.parse(row.ai_board_response.match(/\{[\s\S]*\}/)?.[0] || '{}');
          if (r.board_detected === true) ai_board_detected = true;
          if (r.brand) ai_brand = r.brand;
          if (r.condition) ai_condition = r.condition;
          if (r.visibility) ai_visibility = r.visibility;
          if (r.board_type) ai_board_type = r.board_type;
        } catch {}
      }
      if (row.ai_raw_response) {
        try {
          const r = JSON.parse(row.ai_raw_response.match(/\{[\s\S]*\}/)?.[0] || '{}');
          if (r.board_detected === true) ai_board_detected = true;
          if (!ai_brand && r.brand) ai_brand = r.brand;
          if (!ai_condition && r.condition) ai_condition = r.condition;
          if (!ai_visibility && r.visibility) ai_visibility = r.visibility;
          if (!ai_board_type && r.board_type) ai_board_type = r.board_type;
          if (r.description) ai_description = r.description;
          ai_insights = parseStoreInsights(row.ai_raw_response);
          if (r.brands && Array.isArray(r.brands) && r.brands.length > 0 && !ai_brand) {
            ai_brand = r.brands.map(b => b.name || b).filter(Boolean).join(', ');
          }
        } catch {}
      }
      // Manual board_installed entry also counts as AI board detected
      if (board_installed === 'Yes') ai_board_detected = true;
      // If board_installed is still empty but photos/data exist, count as board installed
      if (!board_installed && (row.ai_photos_analyzed > 0 || row.ai_status === 'completed' || has_photos)) {
        board_installed = 'Yes';
      }

      return {
        id: row.id,
        visit_date: row.visit_date,
        status: row.status,
        store_name: row.store_name || 'Unknown Store',
        store_address: row.store_address || '',
        agent_name: row.agent_name,
        gps_latitude: row.gps_latitude,
        gps_longitude: row.gps_longitude,
        created_at: row.created_at,
        notes: additional_notes,
        goldrush_id,
        thumbnail_url: photo_url,
        has_photos,
        shop_exterior_photo: isUrl(shop_exterior_photo) ? rewriteR2Url(shop_exterior_photo, reqUrl) : (shop_exterior_photo ? 'has_photo' : null),
        competitor_photo: isUrl(competitor_photo) ? rewriteR2Url(competitor_photo, reqUrl) : (competitor_photo ? 'has_photo' : null),
        ad_board_photo: isUrl(ad_board_photo) ? rewriteR2Url(ad_board_photo, reqUrl) : (ad_board_photo ? 'has_photo' : null),
        stock_source,
        competitors_in_store,
        competitor_stock_source,
        competitor_products,
        competitor_prices,
        has_advertising,
        other_ad_brands,
        board_installed,
        ai_status: row.ai_status || null,
        ai_photos_analyzed: row.ai_photos_analyzed || 0,
        ai_share_of_voice: row.ai_share_of_voice || 0,
        ai_board_detected,
        ai_brand,
        ai_condition,
        ai_visibility,
        ai_board_type,
        ai_description,
        ai_insights,
      };
    });

    return c.json({ success: true, data, total: data.length });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// ==================== STELLR REPORT ====================

app.get('/field-ops/reports/stellr', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();

    // Find Stellr company — allow explicit company_id override, else look up by name
    let stellrId = company_id || null;
    if (!stellrId) {
      const stellrCompany = await db.prepare(
        "SELECT id FROM field_companies WHERE LOWER(name) LIKE '%stellr%' AND tenant_id = ? LIMIT 1"
      ).bind(tenantId).first();
      if (!stellrCompany) {
        return c.json({ success: true, data: [], total: 0, message: 'Stellr company not found' });
      }
      stellrId = stellrCompany.id;
    }

    let dateFilter = '';
    const binds = [tenantId, stellrId];
    if (startDate || endDate) {
      const startD = startDate || new Date().toISOString().split('T')[0];
      const endD = endDate || new Date().toISOString().split('T')[0];
      dateFilter = " AND v.visit_date BETWEEN ? AND ?";
      binds.push(startD, endD);
    }

    const result = await db.prepare(`
      SELECT v.id, v.visit_date, v.status, v.notes, v.latitude as gps_latitude, v.longitude as gps_longitude,
        v.created_at, v.customer_id,
        c.name as store_name, c.address as store_address,
        u.first_name || ' ' || u.last_name as agent_name,
        (SELECT vp.r2_url FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.r2_url IS NOT NULL LIMIT 1) as thumbnail_url,
        CASE WHEN EXISTS (SELECT 1 FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id) THEN 1 ELSE 0 END as has_photos,
        (SELECT GROUP_CONCAT(vr.responses, '|||') FROM visit_responses vr WHERE vr.visit_id = v.id) as all_responses
      FROM visits v
      LEFT JOIN customers c ON v.customer_id = c.id
      LEFT JOIN users u ON v.agent_id = u.id
      WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type) = 'store'
        AND v.agent_id NOT LIKE 'agent-test-%'
        AND v.agent_id NOT IN ('admin-user-001', 'agent-user-001', 'manager-user-001', 'e6c2898a-6420-4327-8000-e7857021a306')
        AND (u.id IS NULL OR (u.email NOT LIKE '%@fieldvibe.test' AND u.email NOT LIKE '%@demo.com' AND u.email != 'luke@templeman.co.za' AND u.email != 'luke.templeman@gonxt.tech'))${dateFilter}
      ORDER BY v.created_at DESC
    `).bind(...binds).all();

    const reqUrl = c.req.url;
    const isUrl = (v) => v && typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'));

    const data = (result.results || []).map(row => {
      let product_range = '';
      let stock_availability = '';
      let shelf_position = '';
      let pos_material = '';
      let competitor_brands = '';
      let pricing_compliance = '';
      let brand_visibility = '';
      let cooler_installed = '';
      let outlet_type = '';

      let merged = {};
      try {
        if (row.all_responses) {
          for (const chunk of row.all_responses.split('|||')) {
            try {
              const parsed = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
              if (parsed && typeof parsed === 'object') Object.assign(merged, parsed);
            } catch {}
          }
        }
        product_range       = merged.product_range || merged.products || '';
        stock_availability  = merged.stock_availability || merged.stock_available || '';
        shelf_position      = merged.shelf_position || merged.shelf_placement || '';
        pos_material        = merged.pos_material || merged.pos || merged.point_of_sale || '';
        competitor_brands   = merged.competitor_brands || merged.competitors || merged.competitors_in_store || '';
        pricing_compliance  = merged.pricing_compliance || merged.pricing || '';
        brand_visibility    = merged.brand_visibility || merged.visibility || '';
        cooler_installed    = merged.cooler_installed || merged.cooler || '';
        outlet_type         = merged.outlet_type || merged.store_type || merged.shop_type || '';
      } catch {}

      return {
        id: row.id,
        visit_date: row.visit_date,
        status: row.status,
        store_name: row.store_name || 'Unknown Store',
        store_address: row.store_address || '',
        agent_name: row.agent_name,
        thumbnail_url: rewriteR2Url(row.thumbnail_url, reqUrl) || null,
        has_photos: !!row.has_photos,
        gps_latitude: row.gps_latitude,
        gps_longitude: row.gps_longitude,
        created_at: row.created_at,
        notes: row.notes || '',
        product_range,
        stock_availability,
        shelf_position,
        pos_material,
        competitor_brands,
        pricing_compliance,
        brand_visibility,
        cooler_installed,
        outlet_type,
        raw_responses: merged,
      };
    });

    return c.json({ success: true, data, total: data.length });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// ==================== GOLDRUSH INSIGHTS (aggregated for client-grade reports) ====================
// Two endpoints: one for individuals (consumers), one for stores. Both run on top
// of the same data the existing /goldrush-individuals and /goldrush-stores pages
// fetch row-by-row, but compute aggregations server-side so the frontend can
// render charts / KPIs without shipping every row to the browser.

app.get('/field-ops/reports/goldrush-individuals/insights', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();

    const goldrushId = await resolveReportCompanyId(db, tenantId, company_id || null);
    if (!goldrushId) return c.json({ success: true, data: emptyIndividualInsights() });

    let dateFilter = '';
    const binds = [tenantId, goldrushId];
    if (startDate) { dateFilter += ' AND v.visit_date >= ?'; binds.push(startDate); }
    if (endDate)   { dateFilter += ' AND v.visit_date <= ?'; binds.push(endDate); }

    // Single read, walk results in JS for the various aggregations. The dataset
    // (Goldrush individuals over a date range) is bounded — typically a few
    // hundred rows per month.
    const rows = await db.prepare(
      `SELECT v.id, v.visit_date, v.created_at, v.latitude as lat, v.longitude as lng,
              u.first_name || ' ' || u.last_name as agent_name,
              vi.custom_field_values,
              (SELECT vr.responses FROM visit_responses vr
                 WHERE vr.visit_id = v.id
                   AND (vr.visit_type IS NULL OR vr.visit_type != 'store_custom_questions')
                 LIMIT 1) as questionnaire_responses
         FROM visits v
         LEFT JOIN visit_individuals vi ON v.id = vi.visit_id
         LEFT JOIN users u ON v.agent_id = u.id
         WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type) = 'individual'
           AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${dateFilter}
         ORDER BY v.visit_date ASC LIMIT 20000`
    ).bind(...binds).all();

    const list = rows.results || [];
    const totals = { individuals: list.length, converted: 0, with_id: 0, with_suggestion: 0 };
    const byDate = new Map();
    const byAgent = new Map();
    const radio = (k) => ({ key: k, yes: 0, no: 0, other: 0 });
    const likesGoldrush = radio('likes_goldrush');
    const usedBefore = radio('used_goldrush_before');
    const bettingElsewhere = radio('betting_elsewhere');
    const goldrushComparison = radio('goldrush_comparison');
    const giveBrandInfo = radio('gave_brand_info');
    const isInterested = radio('is_the_customer_interested');
    const competitorCounts = new Map();
    const productInterestCounts = new Map();
    const suggestionsTop = []; // first ~50 non-empty suggestions
    let geo = { lat_min: null, lat_max: null, lng_min: null, lng_max: null, with_gps: 0 };

    function bumpRadio(target, val) {
      if (val == null || val === '') return;
      const s = String(val).toLowerCase().trim();
      if (s === 'yes' || s === 'true' || s === '1') target.yes += 1;
      else if (s === 'no' || s === 'false' || s === '0') target.no += 1;
      else target.other += 1;
    }
    function bumpMap(map, key) {
      if (!key) return;
      const k = String(key).trim();
      if (!k) return;
      map.set(k, (map.get(k) || 0) + 1);
    }
    function mergeJson(a, b) {
      const out = {};
      try { if (a) Object.assign(out, typeof a === 'string' ? JSON.parse(a) : a); } catch {}
      try { if (b) Object.assign(out, typeof b === 'string' ? JSON.parse(b) : b); } catch {}
      return out;
    }

    for (const r of list) {
      const f = mergeJson(r.custom_field_values, r.questionnaire_responses);
      const day = (r.visit_date || (r.created_at || '').slice(0, 10)) || '';
      if (day) {
        const d = byDate.get(day) || { date: day, visits: 0, conversions: 0 };
        d.visits += 1;
        if (Number(f.converted) === 1 || String(f.converted).toLowerCase() === 'true' || String(f.consumer_converted).toLowerCase() === 'yes') d.conversions += 1;
        byDate.set(day, d);
      }
      if (r.agent_name) {
        const a = byAgent.get(r.agent_name) || { agent: r.agent_name, visits: 0, conversions: 0 };
        a.visits += 1;
        if (Number(f.converted) === 1 || String(f.consumer_converted).toLowerCase() === 'yes') a.conversions += 1;
        byAgent.set(r.agent_name, a);
      }
      if (Number(f.converted) === 1 || String(f.consumer_converted).toLowerCase() === 'yes') totals.converted += 1;
      if (f.goldrush_id && String(f.goldrush_id).trim()) totals.with_id += 1;
      if (f.platform_suggestions && String(f.platform_suggestions).trim()) {
        totals.with_suggestion += 1;
        if (suggestionsTop.length < 50) suggestionsTop.push({ visit_id: r.id, agent: r.agent_name, suggestion: String(f.platform_suggestions).slice(0, 280) });
      }
      bumpRadio(likesGoldrush, f.likes_goldrush);
      bumpRadio(usedBefore, f.used_goldrush_before);
      bumpRadio(bettingElsewhere, f.betting_elsewhere);
      bumpRadio(goldrushComparison, f.goldrush_comparison);
      bumpRadio(giveBrandInfo, f.gave_brand_info);
      bumpRadio(isInterested, f.is_the_customer_interested);
      // Competitor company is sometimes a string, sometimes comma-joined.
      const comp = f.competitor_company || f.who_is_competitor;
      if (comp) {
        if (Array.isArray(comp)) comp.forEach(c => bumpMap(competitorCounts, c));
        else if (typeof comp === 'string') {
          comp.split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(c => bumpMap(competitorCounts, c));
        }
      }
      const prod = f.which_products_interest_you;
      if (prod) {
        if (Array.isArray(prod)) prod.forEach(p => bumpMap(productInterestCounts, p));
        else if (typeof prod === 'string') prod.split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(p => bumpMap(productInterestCounts, p));
      }
      if (r.lat != null && r.lng != null) {
        geo.with_gps += 1;
        geo.lat_min = geo.lat_min == null ? r.lat : Math.min(geo.lat_min, r.lat);
        geo.lat_max = geo.lat_max == null ? r.lat : Math.max(geo.lat_max, r.lat);
        geo.lng_min = geo.lng_min == null ? r.lng : Math.min(geo.lng_min, r.lng);
        geo.lng_max = geo.lng_max == null ? r.lng : Math.max(geo.lng_max, r.lng);
      }
    }

    const visitsOverTime = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    const topAgents = Array.from(byAgent.values()).map(a => ({ ...a, conversion_rate: a.visits ? Math.round((a.conversions / a.visits) * 1000) / 10 : 0 })).sort((a, b) => b.visits - a.visits).slice(0, 15);
    const conversion_rate = totals.individuals ? Math.round((totals.converted / totals.individuals) * 1000) / 10 : 0;

    return c.json({ success: true, data: {
      filters: { startDate: startDate || null, endDate: endDate || null },
      totals: { ...totals, conversion_rate },
      visitsOverTime,
      topAgents,
      satisfaction: { likes_goldrush: likesGoldrush, used_goldrush_before: usedBefore, betting_elsewhere: bettingElsewhere, goldrush_comparison: goldrushComparison, gave_brand_info: giveBrandInfo, is_the_customer_interested: isInterested },
      competitors: Array.from(competitorCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 20),
      productInterest: Array.from(productInterestCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 20),
      suggestionsTop,
      geo,
    } });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

app.get('/field-ops/reports/goldrush-stores/insights', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();

    const goldrushId = await resolveReportCompanyId(db, tenantId, company_id || null);
    if (!goldrushId) return c.json({ success: true, data: emptyStoreInsights() });

    let dateFilter = '';
    const binds = [tenantId, goldrushId];
    if (startDate) { dateFilter += ' AND v.visit_date >= ?'; binds.push(startDate); }
    if (endDate)   { dateFilter += ' AND v.visit_date <= ?'; binds.push(endDate); }

    // Pull store visits + linked store_custom_questions responses + AI photo
    // aggregates per visit. AI rollup is computed via correlated subqueries so
    // this stays O(1) round-trips.
    const rows = await db.prepare(
      `SELECT v.id, v.visit_date, v.created_at, v.customer_id,
              c.name as store_name,
              u.first_name || ' ' || u.last_name as agent_name,
              (SELECT vr.responses FROM visit_responses vr
                 WHERE vr.visit_id = v.id AND vr.tenant_id = v.tenant_id
                   AND vr.visit_type = 'store_custom_questions' LIMIT 1) as store_responses,
              (SELECT vr.responses FROM visit_responses vr
                 WHERE vr.visit_id = v.id AND vr.tenant_id = v.tenant_id
                   AND (vr.visit_type IS NULL OR vr.visit_type != 'store_custom_questions') LIMIT 1) as questionnaire_responses,
              (SELECT COUNT(*) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id) as photo_count,
              (SELECT COUNT(*) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.ai_analysis_status = 'completed') as ai_done,
              (SELECT COUNT(*) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.ai_analysis_status = 'failed') as ai_failed,
              (SELECT MAX(vp.ai_share_of_voice) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.ai_share_of_voice IS NOT NULL) as ai_max_sov,
              (SELECT AVG(vp.ai_compliance_score) FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.ai_compliance_score IS NOT NULL) as ai_avg_compliance,
              (SELECT GROUP_CONCAT(vp.ai_brands_detected, '|') FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.ai_brands_detected IS NOT NULL) as ai_brands_concat
         FROM visits v
         LEFT JOIN customers c ON v.customer_id = c.id
         LEFT JOIN users u ON v.agent_id = u.id
         WHERE v.tenant_id = ? AND v.company_id = ? AND LOWER(v.visit_type) = 'store'${dateFilter}
         ORDER BY v.visit_date ASC LIMIT 20000`
    ).bind(...binds).all();

    const list = rows.results || [];
    const totals = {
      stores_visited: list.length,
      unique_stores: new Set(list.map(r => r.customer_id).filter(Boolean)).size,
      with_photos: 0, with_ai_completed: 0, with_ai_failed: 0,
      with_stock: 0, with_advertising: 0, board_installed: 0,
      with_competitors: 0,
    };
    const byDate = new Map();
    const radio = (k) => ({ key: k, yes: 0, no: 0, other: 0 });
    const stocksProduct = radio('stocks_product');
    const hasAdvertising = radio('has_advertising');
    const competitorsInStore = radio('competitors_in_store');
    const boardInstalled = radio('board_installed');
    const competitorBrandCounts = new Map();
    const stockSourceCounts = new Map();
    const adBrandCounts = new Map();
    const aiBrandCounts = new Map();
    const sovOverTime = new Map(); // date -> {date, samples, sum, avg, max}
    const complianceOverTime = new Map();
    const topStores = new Map(); // store_name -> {name, visits}

    function bumpRadio(target, val) {
      if (val == null || val === '') return;
      const s = String(val).toLowerCase().trim();
      if (s === 'yes' || s === 'true' || s === '1') target.yes += 1;
      else if (s === 'no' || s === 'false' || s === '0') target.no += 1;
      else target.other += 1;
    }
    function bumpMap(map, key) {
      if (!key) return;
      const k = String(key).trim();
      if (!k) return;
      map.set(k, (map.get(k) || 0) + 1);
    }
    function mergeJson(a, b) {
      const out = {};
      try { if (a) Object.assign(out, typeof a === 'string' ? JSON.parse(a) : a); } catch {}
      try { if (b) Object.assign(out, typeof b === 'string' ? JSON.parse(b) : b); } catch {}
      return out;
    }

    for (const r of list) {
      const f = mergeJson(r.store_responses, r.questionnaire_responses);
      const day = (r.visit_date || (r.created_at || '').slice(0, 10)) || '';

      if (day) {
        const d = byDate.get(day) || { date: day, visits: 0 };
        d.visits += 1;
        byDate.set(day, d);
      }
      if (r.photo_count > 0) totals.with_photos += 1;
      if (r.ai_done > 0) totals.with_ai_completed += 1;
      if (r.ai_failed > 0) totals.with_ai_failed += 1;
      bumpRadio(stocksProduct, f.stocks_product);
      bumpRadio(hasAdvertising, f.has_advertising);
      bumpRadio(competitorsInStore, f.competitors_in_store);
      bumpRadio(boardInstalled, f.board_installed);
      if (String(f.stocks_product).toLowerCase() === 'yes') totals.with_stock += 1;
      if (String(f.has_advertising).toLowerCase() === 'yes') totals.with_advertising += 1;
      if (String(f.board_installed).toLowerCase() === 'yes') totals.board_installed += 1;
      if (String(f.competitors_in_store).toLowerCase() === 'yes') totals.with_competitors += 1;
      const comp = f.who_is_competitor;
      if (comp) {
        if (Array.isArray(comp)) comp.forEach(x => bumpMap(competitorBrandCounts, x));
        else String(comp).split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(x => bumpMap(competitorBrandCounts, x));
      }
      if (f.stock_source) bumpMap(stockSourceCounts, f.stock_source);
      if (f.other_ad_brands) {
        const ab = f.other_ad_brands;
        if (Array.isArray(ab)) ab.forEach(x => bumpMap(adBrandCounts, x));
        else String(ab).split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(x => bumpMap(adBrandCounts, x));
      }
      if (r.ai_brands_concat) {
        const all = String(r.ai_brands_concat).split('|').filter(Boolean);
        for (const seg of all) {
          try {
            const arr = JSON.parse(seg);
            if (Array.isArray(arr)) arr.forEach(b => { if (b && b.name) bumpMap(aiBrandCounts, b.name); });
          } catch {}
        }
      }
      if (r.ai_max_sov != null && day) {
        const s = sovOverTime.get(day) || { date: day, samples: 0, sum: 0, max: 0 };
        s.samples += 1; s.sum += Number(r.ai_max_sov || 0); s.max = Math.max(s.max, Number(r.ai_max_sov || 0));
        sovOverTime.set(day, s);
      }
      if (r.ai_avg_compliance != null && day) {
        const s = complianceOverTime.get(day) || { date: day, samples: 0, sum: 0 };
        s.samples += 1; s.sum += Number(r.ai_avg_compliance || 0);
        complianceOverTime.set(day, s);
      }
      if (r.store_name) {
        const t = topStores.get(r.store_name) || { name: r.store_name, visits: 0 };
        t.visits += 1; topStores.set(r.store_name, t);
      }
    }

    const sov = Array.from(sovOverTime.values()).map(s => ({ date: s.date, avg_share_of_voice: s.samples ? Math.round((s.sum / s.samples) * 10) / 10 : 0, max_share_of_voice: s.max })).sort((a, b) => a.date.localeCompare(b.date));
    const compliance = Array.from(complianceOverTime.values()).map(s => ({ date: s.date, avg_compliance: s.samples ? Math.round((s.sum / s.samples) * 10) / 10 : 0 })).sort((a, b) => a.date.localeCompare(b.date));

    return c.json({ success: true, data: {
      filters: { startDate: startDate || null, endDate: endDate || null },
      totals,
      visitsOverTime: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
      stocksProduct, hasAdvertising, competitorsInStore, boardInstalled,
      competitors: Array.from(competitorBrandCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 20),
      stockSources: Array.from(stockSourceCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 20),
      adBrands: Array.from(adBrandCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 20),
      aiBrandsDetected: Array.from(aiBrandCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 20),
      shareOfVoice: sov,
      compliance,
      topStores: Array.from(topStores.values()).sort((a, b) => b.visits - a.visits).slice(0, 20),
    } });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/field-ops/reports/shops-analytics', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { page = '1', limit = '15', startDate, endDate, company_id } = c.req.query();
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let dateFilter = '';
    const dateBinds = [];
    if (company_id) { dateFilter += " AND v.company_id = ?"; dateBinds.push(company_id); }
    if (startDate) { dateFilter += " AND v.visit_date >= ?"; dateBinds.push(startDate); }
    if (endDate) { dateFilter += " AND v.visit_date <= ?"; dateBinds.push(endDate); }

    const totalResult = dateBinds.length > 0
      ? await db.prepare(`SELECT COUNT(DISTINCT c.id) as count FROM customers c JOIN visits v ON v.customer_id = c.id AND v.tenant_id = c.tenant_id WHERE c.tenant_id = ?${dateFilter}`).bind(tenantId, ...dateBinds).first()
      : await db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first();

    const havingClause = dateBinds.length > 0 ? 'HAVING total_checkins > 0' : '';
    // Conversions as a grouped derived table, not a per-customer correlated subquery —
    // 2.5k customers x correlated scan over 40k visit_individuals blows the D1 CPU
    // budget. Also joins v2.customer_id (was wrongly v2.company_id = c.id).
    const shops = await db.prepare(`
      SELECT c.id, c.name, c.address, c.latitude, c.longitude,
        COUNT(v.id) as total_checkins,
        SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END) as approved_checkins,
        COALESCE(MAX(conv.cnt), 0) as conversions,
        MAX(v.visit_date) as last_visit
      FROM customers c
      LEFT JOIN visits v ON v.customer_id = c.id AND v.tenant_id = c.tenant_id${dateFilter}
      LEFT JOIN (
        SELECT v2.customer_id, COUNT(*) as cnt
        FROM visit_individuals vi2 JOIN visits v2 ON vi2.visit_id = v2.id
        WHERE v2.tenant_id = ? AND ((JSON_EXTRACT(vi2.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi2.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi2.custom_field_values,'$.consumer_converted')='Yes')${dateFilter.replace(/v\./g, 'v2.')}
        GROUP BY v2.customer_id
      ) conv ON conv.customer_id = c.id
      WHERE c.tenant_id = ?
      GROUP BY c.id
      ${havingClause}
      ORDER BY total_checkins DESC
      LIMIT ? OFFSET ?
    `).bind(...dateBinds, tenantId, ...dateBinds, tenantId, parseInt(limit), offset).all();

    return c.json({ success: true, shops: shops.results || [], total: totalResult?.count || 0 });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Shop detail
app.get('/field-ops/reports/shops/:shopId', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const shopId = c.req.param('shopId');
    const shop = await db.prepare('SELECT * FROM customers WHERE id = ? AND tenant_id = ?').bind(shopId, tenantId).first();
    const checkins = await db.prepare(`
      SELECT v.id, v.visit_date as timestamp, v.status, v.agent_id,
        u.first_name || ' ' || u.last_name as agent_name,
        (SELECT vp.r2_url FROM visit_photos vp WHERE vp.visit_id = v.id AND vp.tenant_id = v.tenant_id AND vp.r2_url IS NOT NULL LIMIT 1) as thumbnail_url,
        (SELECT vi2.custom_field_values FROM visit_individuals vi2 WHERE vi2.visit_id = v.id LIMIT 1) as custom_field_values,
        (SELECT vr.responses FROM visit_responses vr WHERE vr.visit_id = v.id AND (vr.visit_type IS NULL OR vr.visit_type != 'store_custom_questions') LIMIT 1) as questionnaire_responses,
        (SELECT CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END FROM visit_individuals vi WHERE vi.visit_id = v.id AND vi.tenant_id = v.tenant_id AND ((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes')) as converted,
        v.notes as responses
      FROM visits v
      LEFT JOIN users u ON v.agent_id = u.id
      WHERE v.customer_id = ? AND v.tenant_id = ?
      ORDER BY v.visit_date DESC
      LIMIT 50
    `).bind(shopId, tenantId).all();

    // Look up custom company question image fields for photo extraction
    let shopImageKeys = {};
    try {
      const visitCompanyIds = await db.prepare('SELECT DISTINCT company_id FROM visits WHERE customer_id = ? AND tenant_id = ? AND company_id IS NOT NULL LIMIT 50').bind(shopId, tenantId).all();
      const compIds = (visitCompanyIds.results || []).map(r => r.company_id);
      if (compIds.length > 0) {
        const ph = compIds.map(() => '?').join(',');
        const imgQs = await db.prepare("SELECT company_id, question_key FROM company_custom_questions WHERE tenant_id = ? AND company_id IN (" + ph + ") AND field_type = 'image' AND is_active = 1").bind(tenantId, ...compIds).all();
        for (const q of (imgQs.results || [])) {
          if (!shopImageKeys[q.company_id]) shopImageKeys[q.company_id] = [];
          shopImageKeys[q.company_id].push(q.question_key);
        }
      }
    } catch (e) { /* ignore */ }

    // Process checkins to extract photos from process steps and custom company questions
    const processedCheckins = (checkins.results || []).map(c => {
      let photo = c.thumbnail_url || null;
      let shop_exterior_photo = null;
      let ad_board_photo = null;
      let competitor_photo = null;
      try {
        const cfv = c.custom_field_values ? (typeof c.custom_field_values === 'string' ? JSON.parse(c.custom_field_values) : c.custom_field_values) : {};
        const qr = c.questionnaire_responses ? (typeof c.questionnaire_responses === 'string' ? JSON.parse(c.questionnaire_responses) : c.questionnaire_responses) : {};
        const merged = { ...qr, ...cfv };
        shop_exterior_photo = merged.shop_exterior_photo || null;
        ad_board_photo = merged.ad_board_photo || null;
        competitor_photo = merged.competitor_photo || null;
        if (!photo) photo = shop_exterior_photo || ad_board_photo || competitor_photo;
        // Also check custom company question image fields (field_type='image')
        if (!photo) {
          const allCompanyIds = Object.keys(shopImageKeys);
          for (const cid of allCompanyIds) {
            for (const key of shopImageKeys[cid]) {
              const val = merged[key];
              if (val && typeof val === 'string' && (val.startsWith('data:image') || val.startsWith('http'))) {
                photo = val;
                break;
              }
            }
            if (photo) break;
          }
        }
      } catch (e) { /* ignore */ }
      return {
        id: c.id, timestamp: c.timestamp, status: c.status, agent_name: c.agent_name || null,
        thumbnail_url: photo, shop_exterior_photo, ad_board_photo, competitor_photo,
        converted: c.converted, responses: c.responses
      };
    });
    const stats = await db.prepare(`
      SELECT COUNT(*) as total_checkins,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as approved,
        (SELECT COUNT(*) FROM visit_individuals vi2 JOIN visits v2 ON vi2.visit_id = v2.id WHERE v2.customer_id = ? AND v2.tenant_id = ? AND ((JSON_EXTRACT(vi2.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi2.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi2.custom_field_values,'$.consumer_converted')='Yes')) as conversions
      FROM visits WHERE customer_id = ? AND tenant_id = ?
    `).bind(shopId, tenantId, shopId, tenantId).first();

    return c.json({ success: true, shop, checkins: processedCheckins, stats });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Customers analytics (individual registrations)
app.get('/field-ops/reports/customers-analytics', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { page = '1', limit = '20', startDate, endDate, company_id } = c.req.query();
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let dateFilter = '';
    const binds = [tenantId];
    if (company_id) { dateFilter += " AND v.company_id = ?"; binds.push(company_id); }
    if (startDate) { dateFilter += " AND v.visit_date >= ?"; binds.push(startDate); }
    if (endDate) { dateFilter += " AND v.visit_date <= ?"; binds.push(endDate); }

    const totalResult = await db.prepare(`SELECT COUNT(*) as count FROM visits v WHERE v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${dateFilter}`).bind(...binds).first();

    const customers = await db.prepare(`
      SELECT v.id as checkin_id, v.created_at as timestamp,
        v.latitude, v.longitude,
        v.agent_id, u.first_name || ' ' || u.last_name as agent_name,
        fc.name as shop_name, v.company_id as shop_id,
        v.notes as responses,
        (CASE WHEN (JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') THEN 1 ELSE 0 END) as converted,
        0 as already_betting
      FROM visits v
      LEFT JOIN visit_individuals vi ON v.id = vi.visit_id
      LEFT JOIN users u ON v.agent_id = u.id
      LEFT JOIN field_companies fc ON v.company_id = fc.id
      WHERE v.tenant_id = ? AND LOWER(v.visit_type) = 'individual'
        AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${dateFilter}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...binds, parseInt(limit), offset).all();

    const statsResult = await db.prepare(`
      SELECT COUNT(*) as total_customers,
        SUM(CASE WHEN ((JSON_EXTRACT(vi.custom_field_values,'$.converted')=1 OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR JSON_EXTRACT(vi.custom_field_values,'$.consumer_converted')='Yes') OR LOWER(COALESCE(JSON_EXTRACT(vi.custom_field_values, '$.consumer_converted'), '')) = 'yes' THEN 1 ELSE 0 END) as converted,
        0 as already_betting
      FROM visits v LEFT JOIN visit_individuals vi ON v.id = vi.visit_id WHERE v.tenant_id = ? AND LOWER(v.visit_type) = 'individual' AND NOT EXISTS (SELECT 1 FROM goldrush_upload_failures guf WHERE guf.visit_id = v.id)${dateFilter}
    `).bind(...binds).first();

    return c.json({ success: true, customers: customers.results || [], total: totalResult?.count || 0, stats: statsResult });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Checkins list with filters
app.get('/field-ops/reports/checkins', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { page = '1', limit = '20', startDate, endDate, status, agentId, company_id } = c.req.query();
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE v.tenant_id = ?';
    const binds = [tenantId];
    if (company_id) { where += ' AND v.company_id = ?'; binds.push(company_id); }
    if (startDate) { where += ' AND v.visit_date >= ?'; binds.push(startDate); }
    if (endDate) { where += ' AND v.visit_date <= ?'; binds.push(endDate); }
    if (status) { where += ' AND v.status = ?'; binds.push(status); }
    if (agentId) { where += ' AND v.agent_id = ?'; binds.push(agentId); }

    const totalResult = await db.prepare(`SELECT COUNT(*) as count FROM visits v ${where}`).bind(...binds).first();

    const checkins = await db.prepare(`
      SELECT v.id, v.agent_id, v.customer_id as shop_id, v.visit_date as timestamp,
        v.latitude, v.longitude,
        v.status, v.notes, v.visit_type, v.visit_type as visit_target_type,
        u.first_name || ' ' || u.last_name as agent_name
      FROM visits v
      LEFT JOIN users u ON v.agent_id = u.id
      ${where}
      ORDER BY v.visit_date DESC
      LIMIT ? OFFSET ?
    `).bind(...binds, parseInt(limit), offset).all();

    return c.json({ success: true, checkins: checkins.results || [], total: totalResult?.count || 0 });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Checkin detail
app.get('/field-ops/reports/checkins/:checkinId', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const checkinId = c.req.param('checkinId');
    const checkin = await db.prepare('SELECT * FROM visits WHERE id = ? AND tenant_id = ?').bind(checkinId, tenantId).first();
    if (!checkin) return c.json({ success: false, message: 'Not found' }, 404);
    // Get survey response if any
    const response = await db.prepare('SELECT * FROM survey_responses WHERE visit_id = ? LIMIT 1').bind(checkinId).first();
    return c.json({ success: true, checkin, response: response || null });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Agents list for filters
app.get('/field-ops/reports/agents', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const agents = await db.prepare("SELECT id as agent_id, first_name || ' ' || last_name as agent_name FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent') ORDER BY first_name LIMIT 500").bind(tenantId).all();
    return c.json({ success: true, agents: agents.results || [] });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// Export checkins data
app.get('/field-ops/reports/export/checkins', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { startDate, endDate, company_id } = c.req.query();
    let where = 'WHERE v.tenant_id = ?';
    const binds = [tenantId];
    // Scope by company via agent_company_links (handles companies with NULL visits.company_id, e.g. Goldrush)
    if (company_id) {
      const companyLinks = await db.prepare(
        "SELECT agent_id FROM agent_company_links WHERE tenant_id = ? AND company_id = ? AND is_active = 1"
      ).bind(tenantId, company_id).all();
      const agentIds = (companyLinks.results || []).map(r => r.agent_id);
      if (agentIds.length === 0) {
        return c.json({ success: true, data: [] });
      }
      const placeholders = agentIds.map(() => '?').join(',');
      where += ` AND v.agent_id IN (${placeholders})`;
      binds.push(...agentIds);
    }
    if (startDate) { where += ' AND v.visit_date >= ?'; binds.push(startDate); }
    if (endDate) { where += ' AND v.visit_date <= ?'; binds.push(endDate); }

    const data = await db.prepare(`
      SELECT v.id, v.agent_id, v.customer_id as shop_id, v.visit_date as timestamp,
        v.latitude, v.longitude,
        v.status, v.notes, v.visit_type,
        CASE WHEN v.status = 'completed' AND v.visit_type = 'individual' THEN 1 ELSE 0 END as converted,
        CASE WHEN v.visit_type = 'store' THEN 1 ELSE 0 END as already_betting
      FROM visits v
      ${where}
      ORDER BY v.visit_date DESC
      LIMIT 10000
    `).bind(...binds).all();

    return c.json({ success: true, data: data.results || [] });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

export default app;
