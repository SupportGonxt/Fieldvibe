import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../lib/middleware.js';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono();

// ==================== SURVEYS / KYC ====================
app.get('/surveys', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, type, search, module: mod, target_type, company_id } = c.req.query();
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];
  if (status && status !== 'all') {
    if (status === 'active') { where += ' AND is_active = 1'; }
    else if (status === 'archived' || status === 'inactive') { where += ' AND is_active = 0'; }
  }
  if (type) { where += ' AND visit_type = ?'; params.push(type); }
  if (mod) { where += ' AND module = ?'; params.push(mod); }
  if (target_type) { where += ' AND (target_type = ? OR target_type = "both")'; params.push(target_type); }
  if (company_id) { where += ' AND (company_id = ? OR company_id IS NULL)'; params.push(company_id); }
  if (search) { where += ' AND name LIKE ?'; params.push('%' + search + '%'); }
  const surveys = await db.prepare('SELECT * FROM questionnaires ' + where + ' ORDER BY created_at DESC LIMIT 500').bind(...params).all();
  const results = (surveys.results || []).map(q => {
    try { q.questions = JSON.parse(q.questions); } catch(e) {}
    try { q.brand_ids = q.brand_ids ? JSON.parse(q.brand_ids) : (q.brand_id ? [q.brand_id] : []); } catch(e) { q.brand_ids = q.brand_id ? [q.brand_id] : []; }
    return { ...q, title: q.name, survey_type: q.visit_type || 'adhoc', response_count: 0, completion_rate: 0 };
  });
  return c.json({ success: true, data: results });
});

// Static /surveys/* routes MUST be registered before /surveys/:id so the
// param route doesn't shadow them (e.g. treating "stats" as a survey id → 404).
app.get('/surveys/metrics', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId');
  const [totalSurveys, activeSurveys, totalResponses] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM questionnaires WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM questionnaires WHERE tenant_id = ? AND is_active = 1').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM visit_responses WHERE tenant_id = ?').bind(tenantId).first()
  ]);
  return c.json({ success: true, data: { total_surveys: totalSurveys?.count || 0, active_surveys: activeSurveys?.count || 0, total_responses: totalResponses?.count || 0, avg_completion_rate: totalSurveys?.count > 0 ? Math.round((totalResponses?.count || 0) / totalSurveys.count * 10) : 0 } });
});
app.get('/surveys/reports', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId');
  const surveys = await db.prepare('SELECT q.*, (SELECT COUNT(*) FROM visit_responses vr WHERE vr.visit_type = q.id AND vr.tenant_id = q.tenant_id) as response_count FROM questionnaires q WHERE q.tenant_id = ? AND q.is_active = 1 ORDER BY q.created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: (surveys.results || []).map(s => ({ id: s.id, name: s.name, title: s.name, type: s.visit_type, response_count: s.response_count, created_at: s.created_at })) });
});
// Build the WHERE clause + binds that scope visit_responses to *actual survey
// responses submitted by agents*: a response belongs to a visit (vr.visit_id ->
// visits.id) whose questionnaire_id identifies the survey. Store-level custom
// question rows are excluded. Optionally filtered by date range and by the
// survey's brand (questionnaires.brand_ids JSON array / legacy brand_id).
function surveyResponseScope(tenantId, brandId, startDate, endDate) {
  let where = "vr.tenant_id = ? AND v.questionnaire_id IS NOT NULL AND (vr.visit_type IS NULL OR vr.visit_type != 'store_custom_questions')";
  const binds = [tenantId];
  if (startDate && endDate) { where += ' AND date(vr.created_at) BETWEEN date(?) AND date(?)'; binds.push(startDate, endDate); }
  if (brandId) { where += ' AND v.brand_id = ?'; binds.push(brandId); }
  return { where, binds };
}
// Visits that required a survey (the denominator for response rate).
function surveyVisitScope(tenantId, brandId, startDate, endDate) {
  let where = 'tenant_id = ? AND questionnaire_id IS NOT NULL';
  const binds = [tenantId];
  if (startDate && endDate) { where += ' AND date(created_at) BETWEEN date(?) AND date(?)'; binds.push(startDate, endDate); }
  if (brandId) { where += ' AND questionnaire_id IN (SELECT id FROM questionnaires WHERE tenant_id = ? AND (brand_id = ? OR brand_ids LIKE ?))'; binds.push(tenantId, brandId, `%"${brandId}"%`); }
  return { where, binds };
}

app.get('/surveys/stats', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId');
  const { brand_id: brandId, start_date: startDate, end_date: endDate } = c.req.query();
  const sBrand = brandId ? ' AND (brand_id = ? OR brand_ids LIKE ?)' : '';
  const sBrandBinds = brandId ? [brandId, `%"${brandId}"%`] : [];
  const resp = surveyResponseScope(tenantId, brandId, startDate, endDate);
  const vis = surveyVisitScope(tenantId, brandId, startDate, endDate);
  const [totalSurveys, activeSurveys, totalResponses, respondedVisits, requiredVisits] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as count FROM questionnaires WHERE tenant_id = ?${sBrand}`).bind(tenantId, ...sBrandBinds).first(),
    db.prepare(`SELECT COUNT(*) as count FROM questionnaires WHERE tenant_id = ? AND is_active = 1${sBrand}`).bind(tenantId, ...sBrandBinds).first(),
    db.prepare(`SELECT COUNT(*) as count FROM visit_responses vr JOIN visits v ON vr.visit_id = v.id WHERE ${resp.where}`).bind(...resp.binds).first(),
    db.prepare(`SELECT COUNT(DISTINCT vr.visit_id) as count FROM visit_responses vr JOIN visits v ON vr.visit_id = v.id WHERE ${resp.where}`).bind(...resp.binds).first(),
    db.prepare(`SELECT COUNT(*) as count FROM visits WHERE ${vis.where}`).bind(...vis.binds).first()
  ]);
  const required = requiredVisits?.count || 0;
  const responseRate = required > 0 ? Math.round(((respondedVisits?.count || 0) / required) * 100) : 0;
  return c.json({ success: true, data: {
    total_surveys: totalSurveys?.count || 0,
    active_surveys: activeSurveys?.count || 0,
    completed_surveys: (totalSurveys?.count || 0) - (activeSurveys?.count || 0),
    total_responses: totalResponses?.count || 0,
    response_rate: responseRate,
    average_completion_rate: responseRate,
    surveys_growth: 0,
    response_rate_change: 0
  } });
});
app.get('/surveys/trends', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId');
  const { brand_id: brandId, start_date: startDate, end_date: endDate } = c.req.query();
  const resp = surveyResponseScope(tenantId, brandId, startDate, endDate);
  const vis = surveyVisitScope(tenantId, brandId, startDate, endDate);
  const [daily, dailyResponded, dailyRequired] = await Promise.all([
    db.prepare(`SELECT date(vr.created_at) as date, COUNT(*) as responses FROM visit_responses vr JOIN visits v ON vr.visit_id = v.id WHERE ${resp.where} GROUP BY date(vr.created_at) ORDER BY date(vr.created_at) ASC LIMIT 120`).bind(...resp.binds).all(),
    db.prepare(`SELECT date(vr.created_at) as date, COUNT(DISTINCT vr.visit_id) as responded FROM visit_responses vr JOIN visits v ON vr.visit_id = v.id WHERE ${resp.where} GROUP BY date(vr.created_at)`).bind(...resp.binds).all(),
    db.prepare(`SELECT date(created_at) as date, COUNT(*) as required FROM visits WHERE ${vis.where} GROUP BY date(created_at)`).bind(...vis.binds).all()
  ]);
  const requiredByDate = {};
  (dailyRequired.results || []).forEach(r => { requiredByDate[r.date] = r.required; });
  const responseRateTrends = (dailyResponded.results || []).map(r => ({
    date: r.date,
    response_rate: requiredByDate[r.date] > 0 ? Math.round((r.responded / requiredByDate[r.date]) * 100) : 0
  }));
  return c.json({ success: true, data: {
    daily_responses: daily.results || [],
    response_rate_trends: responseRateTrends
  } });
});

// List individual survey responses (one row per submitted response) with the
// brand + agent, plus the full questions & answers for the admin "View" detail.
// Scoped to actual survey responses, optionally filtered by brand and date range
// (same filters as the surveys dashboard).
app.get('/surveys/responses', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId');
  const { brand_id: brandId, start_date: startDate, end_date: endDate } = c.req.query();
  const scope = surveyResponseScope(tenantId, brandId, startDate, endDate);
  const rows = await db.prepare(`
    SELECT vr.id, vr.responses, vr.created_at, vr.visit_id,
      v.agent_id,
      q.id as questionnaire_id, q.name as questionnaire_name, q.questions as questions,
      q.brand_ids as q_brand_ids, q.company_id as q_company_id,
      (u.first_name || ' ' || u.last_name) as agent_name,
      COALESCE(fc.name, qb.name, vb.name) as brand_name
    FROM visit_responses vr
    JOIN visits v ON vr.visit_id = v.id
    LEFT JOIN users u ON u.id = v.agent_id
    LEFT JOIN questionnaires q ON q.id = v.questionnaire_id
    LEFT JOIN brands qb ON qb.id = q.brand_id
    LEFT JOIN brands vb ON vb.id = v.brand_id
    LEFT JOIN field_companies fc ON fc.id = v.company_id
    WHERE ${scope.where}
    ORDER BY vr.created_at DESC LIMIT 500`).bind(...scope.binds).all();

  const data = (rows.results || []).map(r => {
    let questions = [];
    try { questions = typeof r.questions === 'string' ? JSON.parse(r.questions) : (r.questions || []); } catch { questions = []; }
    let parsed = {};
    try { parsed = typeof r.responses === 'string' ? JSON.parse(r.responses) : (r.responses || {}); } catch { parsed = {}; }
    // Questions come in two shapes: the seeded Goldrush style ({ key, label, type })
    // and the survey-builder style ({ id, question_text, question_type }). Answers
    // are keyed by whichever identifier that survey uses (id / key / label), so try
    // them all when resolving each answer.
    const answers = (questions || []).map(q => {
      const label = q.label || q.question_text || q.question || q.title || q.text || q.key || q.id || '';
      const type = q.type || q.question_type || 'text';
      let val;
      for (const k of [q.id, q.key, q.label, q.question_text]) {
        if (k !== undefined && k !== null && parsed[k] !== undefined) { val = parsed[k]; break; }
      }
      if (Array.isArray(val)) val = val.join(', ');
      return {
        question_label: label,
        question_type: type,
        answer: (val === undefined || val === null) ? '' : String(val)
      };
    });
    // Include any answered keys that don't map to a known question definition.
    const knownKeys = new Set((questions || []).flatMap(q => [q.id, q.key, q.label, q.question_text].filter(Boolean)));
    for (const [k, v] of Object.entries(parsed)) {
      if (knownKeys.has(k)) continue;
      if (v === undefined || v === null || v === '') continue;
      if (typeof v === 'string' && (v.startsWith('data:image') || v.startsWith('http'))) continue;
      answers.push({ question_label: k, question_type: 'text', answer: Array.isArray(v) ? v.join(', ') : String(v) });
    }
    // If the SQL join didn't resolve a name, try the questionnaire's company_id or
    // the first entry in its brand_ids JSON array as a last resort.
    let brandName = r.brand_name;
    if (!brandName) {
      // brand_ids on questionnaires stores field_company ids — use the first one as a hint
      // (we can't JOIN inside the array in SQLite, so we leave the label as-is)
      brandName = r.q_company_id ? `Company ${r.q_company_id}` : null;
      if (!brandName && r.q_brand_ids) {
        try {
          const ids = JSON.parse(r.q_brand_ids);
          if (Array.isArray(ids) && ids.length > 0) brandName = `Company ${ids[0]}`;
        } catch {}
      }
    }
    return {
      id: r.id,
      visit_id: r.visit_id,
      brand_name: brandName || 'Unassigned',
      agent_name: (r.agent_name && r.agent_name.trim()) ? r.agent_name : 'Unknown',
      questionnaire_name: r.questionnaire_name || 'Survey',
      created_at: r.created_at,
      answers
    };
  });
  return c.json({ success: true, data });
});

app.get('/surveys/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const survey = await db.prepare('SELECT * FROM questionnaires WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!survey) return c.json({ success: false, message: 'Survey not found' }, 404);
  try { survey.questions = JSON.parse(survey.questions); } catch(e) {}
  // Expose brands as an array; fall back to the single brand_id for legacy rows.
  try { survey.brand_ids = survey.brand_ids ? JSON.parse(survey.brand_ids) : (survey.brand_id ? [survey.brand_id] : []); } catch(e) { survey.brand_ids = survey.brand_id ? [survey.brand_id] : []; }
  const responses = await db.prepare('SELECT COUNT(*) as count FROM visit_responses WHERE visit_type = ? AND tenant_id = ?').bind(id, tenantId).all();
  return c.json({ ...survey, title: survey.name, survey_type: survey.visit_type || 'adhoc', response_count: responses.results?.[0]?.count || 0 });
});

app.post('/surveys', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  const name = body.title || body.name;
  if (!name) return c.json({ success: false, message: 'Survey title/name is required' }, 400);
  const isMandatory = body.is_mandatory ? 1 : 0;
  // `brand_ids` holds the JSON list of COMPANY ids this survey is assigned to —
  // the agent visit flow matches the agent's company against it. The legacy
  // single `brand_id` column has a foreign key to brands(id), so it is left null
  // (company ids are not brand ids and would violate that constraint).
  const companyIds = Array.isArray(body.brand_ids)
    ? body.brand_ids.filter(Boolean)
    : (body.company_id ? [body.company_id] : []);
  await db.prepare('INSERT INTO questionnaires (id, tenant_id, name, module, visit_type, target_type, brand_id, brand_ids, company_id, questions, is_default, is_active, is_mandatory, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime("now"), datetime("now"))').bind(
    id, tenantId, name, body.module || 'field_ops',
    body.survey_type || body.visit_type || 'adhoc',
    body.target_type || 'both',
    null, JSON.stringify(companyIds), body.company_id || null,
    JSON.stringify(body.questions || []), body.is_default ? 1 : 0,
    isMandatory
  ).run();
  return c.json({ success: true, data: { id, name, title: name, module: body.module || 'field_ops', target_type: body.target_type || 'both', is_mandatory: !!body.is_mandatory, status: body.status || 'draft' } }, 201);
});

app.put('/surveys/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const existing = await db.prepare('SELECT id, brand_id FROM questionnaires WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!existing) return c.json({ success: false, message: 'Survey not found' }, 404);
  const name = body.title || body.name || null;
  // `brand_ids` is the source of truth for the survey's assigned COMPANY ids
  // (allows clearing all assignments too). When brand_ids isn't sent, leave the
  // existing assignment as-is so unrelated updates (status changes, archiving)
  // don't wipe it. The legacy `brand_id` column (FK → brands) is always cleared
  // since company ids are not brand ids.
  let brandIdsJson = null;
  if (Array.isArray(body.brand_ids)) {
    brandIdsJson = JSON.stringify(body.brand_ids.filter(Boolean));
  }
  await db.prepare('UPDATE questionnaires SET name = COALESCE(?, name), module = COALESCE(?, module), visit_type = COALESCE(?, visit_type), target_type = COALESCE(?, target_type), brand_id = NULL, brand_ids = COALESCE(?, brand_ids), company_id = COALESCE(?, company_id), questions = COALESCE(?, questions), is_active = COALESCE(?, is_active), is_mandatory = COALESCE(?, is_mandatory), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(
    name, body.module || null, body.survey_type || body.visit_type || null,
    body.target_type || null,
    brandIdsJson, body.company_id || null,
    body.questions ? JSON.stringify(body.questions) : null,
    body.status === 'archived' ? 0 : (body.is_active !== undefined ? (body.is_active ? 1 : 0) : null),
    body.is_mandatory !== undefined ? (body.is_mandatory ? 1 : 0) : null,
    id, tenantId
  ).run();
  return c.json({ success: true, message: 'Survey updated' });
});

app.delete('/surveys/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('UPDATE questionnaires SET is_active = 0, updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Survey deleted' });
});

app.get('/kyc', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const kyc = await db.prepare('SELECT c.id, c.name, c.status, c.updated_at, c.created_at FROM customers c WHERE c.tenant_id = ? ORDER BY c.created_at DESC LIMIT 500').bind(tenantId).all();
  return c.json({ data: (kyc.results || []).map(r => ({ ...r, kyc_status: r.status === 'active' ? 'verified' : 'pending', kyc_verified_at: r.updated_at })) });
});

// ==================== T-04: KYC CASES CRUD ====================
app.get('/kyc/cases', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, customer_id, page = 1, limit = 50 } = c.req.query();
  let where = 'WHERE kc.tenant_id = ?';
  const params = [tenantId];
  if (status) { where += ' AND kc.status = ?'; params.push(status); }
  if (customer_id) { where += ' AND kc.customer_id = ?'; params.push(customer_id); }
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = await db.prepare('SELECT COUNT(*) as count FROM kyc_cases kc ' + where).bind(...params).first();
  const cases = await db.prepare("SELECT kc.*, c.name as customer_name FROM kyc_cases kc LEFT JOIN customers c ON kc.customer_id = c.id " + where + ' ORDER BY kc.created_at DESC LIMIT ? OFFSET ?').bind(...params, parseInt(limit), offset).all();
  return c.json({ success: true, data: { cases: cases.results || [], pagination: { total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) } } });
});

app.get('/kyc/cases/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const kycCase = await db.prepare("SELECT kc.*, c.name as customer_name FROM kyc_cases kc LEFT JOIN customers c ON kc.customer_id = c.id WHERE kc.id = ? AND kc.tenant_id = ?").bind(id, tenantId).first();
  if (!kycCase) return c.json({ success: false, message: 'KYC case not found' }, 404);
  const docs = await db.prepare('SELECT * FROM kyc_documents WHERE kyc_case_id = ? AND tenant_id = ? ORDER BY created_at DESC').bind(id, tenantId).all();
  return c.json({ success: true, data: { ...kycCase, documents: docs.results || [] } });
});

app.post('/kyc/cases', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = crypto.randomUUID();
  const caseNumber = 'KYC-' + Date.now().toString(36).toUpperCase();
  await db.prepare('INSERT INTO kyc_cases (id, tenant_id, customer_id, case_number, status, risk_level, submitted_by, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))').bind(id, tenantId, body.customer_id, caseNumber, body.status || 'pending', body.risk_level || 'low', userId, body.notes || null).run();
  return c.json({ success: true, data: { id, case_number: caseNumber } }, 201);
});

app.put('/kyc/cases/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json();
  const existing = await db.prepare('SELECT id FROM kyc_cases WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!existing) return c.json({ success: false, message: 'KYC case not found' }, 404);
  await db.prepare('UPDATE kyc_cases SET status = COALESCE(?, status), risk_level = COALESCE(?, risk_level), reviewed_by = ?, notes = COALESCE(?, notes), rejection_reason = ?, updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.status || null, body.risk_level || null, userId, body.notes || null, body.rejection_reason || null, id, tenantId).run();
  return c.json({ success: true, message: 'KYC case updated' });
});

app.post('/kyc/cases/:id/approve', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const id = c.req.param('id');
  await db.prepare("UPDATE kyc_cases SET status = 'approved', reviewed_by = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(userId, id, tenantId).run();
  return c.json({ success: true, message: 'KYC case approved' });
});

app.post('/kyc/cases/:id/reject', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json();
  await db.prepare("UPDATE kyc_cases SET status = 'rejected', reviewed_by = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(userId, body.reason || '', id, tenantId).run();
  return c.json({ success: true, message: 'KYC case rejected' });
});

app.post('/kyc/documents', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO kyc_documents (id, tenant_id, kyc_case_id, document_type, file_name, r2_key, r2_url, file_size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))').bind(id, tenantId, body.kyc_case_id, body.document_type, body.file_name, body.r2_key || null, body.r2_url || null, body.file_size || 0).run();
  return c.json({ success: true, data: { id } }, 201);
});
// ==================== DYNAMIC SURVEY INSIGHTS / REPORTING ====================
// Returns aggregated analytics for survey responses, dynamically per company questionnaire
app.get('/survey-insights', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id, questionnaire_id, date_from, date_to, visit_type } = c.req.query();

  try {
    // 1. Get the questionnaire(s) for this company
    let qWhere = 'WHERE q.tenant_id = ? AND q.is_active = 1';
    const qParams = [tenantId];
    if (questionnaire_id) { qWhere += ' AND q.id = ?'; qParams.push(questionnaire_id); }
    if (company_id) { qWhere += ' AND q.company_id = ?'; qParams.push(company_id); }
    if (visit_type) { qWhere += ' AND (q.visit_type = ? OR q.target_type = ?)'; qParams.push(visit_type, visit_type); }

    const questionnaires = await db.prepare(`SELECT q.*, fc.name as company_name FROM questionnaires q LEFT JOIN field_companies fc ON q.company_id = fc.id ${qWhere} ORDER BY q.name`).bind(...qParams).all();

    if (!questionnaires.results || questionnaires.results.length === 0) {
      return c.json({ success: true, data: { questionnaires: [], total_responses: 0, insights: [] } });
    }

    const insights = [];
    let totalResponses = 0;

    for (const questionnaire of questionnaires.results) {
      let questions;
      try { questions = typeof questionnaire.questions === 'string' ? JSON.parse(questionnaire.questions) : questionnaire.questions; } catch { questions = []; }

      // 2. Get all responses for this questionnaire
      let rWhere = 'WHERE vr.visit_type = ? AND vr.tenant_id = ?';
      const rParams = [questionnaire.id, tenantId];
      if (date_from) { rWhere += " AND vr.created_at >= ?"; rParams.push(date_from); }
      if (date_to) { rWhere += " AND vr.created_at <= ?"; rParams.push(date_to); }

      const responses = await db.prepare(`SELECT vr.responses, vr.created_at FROM visit_responses vr ${rWhere} ORDER BY vr.created_at DESC`).bind(...rParams).all();
      const responseList = responses.results || [];
      totalResponses += responseList.length;

      // 3. Aggregate answers per question dynamically
      const questionInsights = questions.map(q => {
        const answers = [];
        for (const resp of responseList) {
          let parsed;
          try { parsed = typeof resp.responses === 'string' ? JSON.parse(resp.responses) : resp.responses; } catch { parsed = {}; }
          const val = parsed[q.key] || parsed[q.label];
          if (val !== undefined && val !== null && val !== '') answers.push(val);
        }

        const insight = {
          question_key: q.key,
          question_label: q.label,
          question_type: q.type,
          total_answered: answers.length,
          total_skipped: responseList.length - answers.length
        };

        // For radio/select questions: count each option
        if (q.type === 'radio' || q.type === 'select') {
          const counts = {};
          for (const a of answers) { counts[a] = (counts[a] || 0) + 1; }
          insight.option_counts = counts;
          insight.option_percentages = {};
          for (const [opt, cnt] of Object.entries(counts)) {
            insight.option_percentages[opt] = answers.length > 0 ? Math.round((cnt / answers.length) * 100) : 0;
          }
          // For Yes/No questions, provide a direct yes_rate
          if (q.options && q.options.length === 2 && q.options.includes('Yes') && q.options.includes('No')) {
            insight.yes_count = counts['Yes'] || 0;
            insight.no_count = counts['No'] || 0;
            insight.yes_rate = answers.length > 0 ? Math.round(((counts['Yes'] || 0) / answers.length) * 100) : 0;
          }
        }

        // For text/textarea: provide sample answers and word frequency
        if (q.type === 'text' || q.type === 'textarea') {
          insight.sample_answers = answers.slice(0, 10);
          // Simple word frequency for text analysis
          const wordCounts = {};
          for (const a of answers) {
            const words = String(a).toLowerCase().split(/\s+/).filter(w => w.length > 2);
            for (const w of words) { wordCounts[w] = (wordCounts[w] || 0) + 1; }
          }
          const sorted = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
          insight.top_keywords = sorted.map(([word, count]) => ({ word, count }));
        }

        // For number fields: provide avg, min, max
        if (q.type === 'number') {
          const nums = answers.map(Number).filter(n => !isNaN(n));
          if (nums.length > 0) {
            insight.average = Math.round(nums.reduce((s, n) => s + n, 0) / nums.length * 100) / 100;
            insight.min = Math.min(...nums);
            insight.max = Math.max(...nums);
          }
        }

        return insight;
      });

      insights.push({
        questionnaire_id: questionnaire.id,
        questionnaire_name: questionnaire.name,
        company_id: questionnaire.company_id,
        company_name: questionnaire.company_name,
        visit_type: questionnaire.visit_type,
        target_type: questionnaire.target_type,
        total_responses: responseList.length,
        question_count: questions.length,
        questions: questionInsights,
        // Summary metrics
        completion_rate: responseList.length > 0 ? Math.round(questionInsights.filter(q => q.total_answered > 0).length / questions.length * 100) : 0,
        last_response_at: responseList.length > 0 ? responseList[0].created_at : null
      });
    }

    return c.json({ success: true, data: { questionnaires: insights, total_responses: totalResponses } });
  } catch (e) {
    return c.json({ success: false, message: 'Failed to get survey insights: ' + (e.message || e) }, 500);
  }
});

// Get company-specific questionnaire for visit workflow (mobile use)
app.get('/survey-insights/company/:companyId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const companyId = c.req.param('companyId');
  const { visit_type } = c.req.query();

  let where = 'WHERE q.tenant_id = ? AND q.company_id = ? AND q.is_active = 1';
  const params = [tenantId, companyId];
  if (visit_type) { where += ' AND (q.visit_type = ? OR q.target_type = ?)'; params.push(visit_type, visit_type); }

  const questionnaires = await db.prepare(`SELECT q.id, q.name, q.visit_type, q.target_type, q.questions, q.is_mandatory FROM questionnaires q ${where} ORDER BY q.is_default DESC, q.name`).bind(...params).all();
  const results = (questionnaires.results || []).map(q => {
    try { q.questions = typeof q.questions === 'string' ? JSON.parse(q.questions) : q.questions; } catch { q.questions = []; }
    return q;
  });
  return c.json({ success: true, data: results });
});
// ==================== SURVEY TEMPLATES ====================

app.get('/survey-templates', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { survey_type, trigger_type, is_active } = c.req.query();
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];
  if (survey_type) { where += ' AND survey_type = ?'; params.push(survey_type); }
  if (trigger_type) { where += ' AND trigger_type = ?'; params.push(trigger_type); }
  if (is_active !== undefined) { where += ' AND is_active = ?'; params.push(parseInt(is_active)); }
  const templates = await db.prepare(`SELECT * FROM survey_templates ${where} ORDER BY created_at DESC LIMIT 200`).bind(...params).all();
  return c.json({ success: true, data: templates.results || [] });
});

app.post('/survey-templates', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare(`INSERT INTO survey_templates (id, tenant_id, name, description, survey_type, trigger_type, brand_id, customer_type_filter, questions, scoring_enabled, max_score, passing_score, photo_required, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
    id, tenantId, body.name, body.description || null, body.survey_type || 'visit', body.trigger_type || 'manual',
    body.brand_id || null, body.customer_type_filter || null, JSON.stringify(body.questions || []),
    body.scoring_enabled ? 1 : 0, body.max_score || 100, body.passing_score || 70, body.photo_required || 0, 1, userId
  ).run();
  return c.json({ success: true, data: { id }, message: 'Survey template created' }, 201);
});

app.get('/survey-templates/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const template = await db.prepare('SELECT * FROM survey_templates WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!template) return c.json({ success: false, message: 'Template not found' }, 404);
  return c.json({ success: true, data: template });
});

app.put('/survey-templates/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare(`UPDATE survey_templates SET name = COALESCE(?, name), description = COALESCE(?, description),
    survey_type = COALESCE(?, survey_type), trigger_type = COALESCE(?, trigger_type), brand_id = ?,
    questions = COALESCE(?, questions), scoring_enabled = COALESCE(?, scoring_enabled),
    max_score = COALESCE(?, max_score), passing_score = COALESCE(?, passing_score),
    photo_required = COALESCE(?, photo_required), is_active = COALESCE(?, is_active),
    updated_at = datetime('now') WHERE id = ? AND tenant_id = ?`).bind(
    body.name || null, body.description || null, body.survey_type || null, body.trigger_type || null,
    body.brand_id || null, body.questions ? JSON.stringify(body.questions) : null,
    body.scoring_enabled !== undefined ? (body.scoring_enabled ? 1 : 0) : null,
    body.max_score || null, body.passing_score || null, body.photo_required || null,
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id, tenantId
  ).run();
  return c.json({ success: true, message: 'Template updated' });
});
app.get('/kyc/dashboard', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [total, active, inactive] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM customers WHERE tenant_id = ? AND status = 'active'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM customers WHERE tenant_id = ? AND status != 'active'").bind(tenantId).first(),
  ]);
  return c.json({ success: true, data: { total: total?.count || 0, verified: active?.count || 0, pending: inactive?.count || 0 } });
});

app.get('/kyc/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const byType = await db.prepare('SELECT customer_type, status, COUNT(*) as count FROM customers WHERE tenant_id = ? GROUP BY customer_type, status').bind(tenantId).all();
  return c.json({ success: true, data: byType.results || [] });
});
app.post('/kyc/:id/approve', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/kyc/:id/credit-check', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/kyc/:id/documents/:documentId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/kyc/:id/documents/:documentId/verify', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/kyc/:id/reject', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/kyc/:id/request-update', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/kyc/:id/verify-references', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/kyc/agent/:id', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/kyc/agents', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/kyc/analytics', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/kyc/bulk-approve', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/kyc/bulk-reject', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/kyc/customer/:id/history', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/kyc/export', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/kyc/reports', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/kyc/templates', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/kyc/templates/:templateId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/kyc/templates/:templateId/set-default', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.get('/kyc/trends', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
app.post('/surveys/:surveyId/activate', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId'); const surveyId = c.req.param('surveyId');
  await db.prepare('UPDATE questionnaires SET is_active = 1, updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(surveyId, tenantId).run();
  return c.json({ success: true, message: 'Survey activated' });
});
app.get('/surveys/:surveyId/analytics', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId'); const surveyId = c.req.param('surveyId');

  // Dashboard-wide analytics: aggregate real survey responses submitted by agents
  // across all surveys (optionally scoped by brand + date range).
  if (surveyId === 'all') {
    const { brand_id: brandId, start_date: startDate, end_date: endDate } = c.req.query();
    const sBrand = brandId ? ' AND (q.brand_id = ? OR q.brand_ids LIKE ?)' : '';
    const sBrandBinds = brandId ? [brandId, `%"${brandId}"%`] : [];
    const resp = surveyResponseScope(tenantId, brandId, startDate, endDate);
    const [types, recent, top, categories, byAgent] = await Promise.all([
      // Survey types distribution (by visit type of the questionnaire)
      db.prepare(`SELECT COALESCE(NULLIF(q.visit_type, ''), 'general') as name, COUNT(*) as count FROM questionnaires q WHERE q.tenant_id = ?${sBrand} GROUP BY name ORDER BY count DESC`).bind(tenantId, ...sBrandBinds).all(),
      // Recent surveys with their real lifetime response counts
      db.prepare(`SELECT q.id, q.name, q.visit_type, q.is_active, q.created_at,
          (SELECT COUNT(DISTINCT vr.visit_id) FROM visit_responses vr JOIN visits v ON vr.visit_id = v.id WHERE v.questionnaire_id = q.id AND (vr.visit_type IS NULL OR vr.visit_type != 'store_custom_questions')) as response_count
        FROM questionnaires q WHERE q.tenant_id = ?${sBrand} ORDER BY q.created_at DESC LIMIT 5`).bind(tenantId, ...sBrandBinds).all(),
      // Top surveys by number of responses
      db.prepare(`SELECT q.id, q.name,
          (SELECT COUNT(DISTINCT vr.visit_id) FROM visit_responses vr JOIN visits v ON vr.visit_id = v.id WHERE v.questionnaire_id = q.id AND (vr.visit_type IS NULL OR vr.visit_type != 'store_custom_questions')) as response_count,
          (SELECT COUNT(*) FROM visits v2 WHERE v2.questionnaire_id = q.id) as visit_count
        FROM questionnaires q WHERE q.tenant_id = ?${sBrand} ORDER BY response_count DESC LIMIT 5`).bind(tenantId, ...sBrandBinds).all(),
      // Performance grouped by survey category (visit type)
      db.prepare(`SELECT COALESCE(NULLIF(q.visit_type, ''), 'general') as category,
          COUNT(DISTINCT q.id) as survey_count,
          COUNT(DISTINCT CASE WHEN (vr.visit_type IS NULL OR vr.visit_type != 'store_custom_questions') THEN vr.visit_id END) as total_responses,
          COUNT(DISTINCT v.id) as visit_count
        FROM questionnaires q
        LEFT JOIN visits v ON v.questionnaire_id = q.id
        LEFT JOIN visit_responses vr ON vr.visit_id = v.id
        WHERE q.tenant_id = ?${sBrand} GROUP BY category`).bind(tenantId, ...sBrandBinds).all(),
      // Responses submitted per agent (the people who actually completed surveys)
      db.prepare(`SELECT COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), 'Unknown') as agent, COUNT(*) as responses
        FROM visit_responses vr JOIN visits v ON vr.visit_id = v.id LEFT JOIN users u ON v.agent_id = u.id
        WHERE ${resp.where} GROUP BY v.agent_id ORDER BY responses DESC LIMIT 10`).bind(...resp.binds).all()
    ]);
    return c.json({ success: true, data: {
      survey_types_distribution: types.results || [],
      recent_surveys: (recent.results || []).map(s => ({ id: s.id, title: s.name, type: s.visit_type || 'general', status: s.is_active ? 'active' : 'draft', response_count: s.response_count || 0 })),
      top_surveys: (top.results || []).map(s => ({ id: s.id, title: s.name, response_count: s.response_count || 0, response_rate: s.visit_count > 0 ? Math.round((s.response_count / s.visit_count) * 100) : 0 })),
      category_performance: (categories.results || []).map(cat => ({ category: cat.category, survey_count: cat.survey_count || 0, total_responses: cat.total_responses || 0, avg_response_rate: cat.visit_count > 0 ? Math.round((cat.total_responses / cat.visit_count) * 100) : 0 })),
      responses_by_agent: (byAgent.results || []).map(a => ({ agent: a.agent, responses: a.responses || 0 }))
    } });
  }

  const [totalResponses, survey] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM visit_responses WHERE visit_type = ? AND tenant_id = ?').bind(surveyId, tenantId).first(),
    db.prepare('SELECT * FROM questionnaires WHERE id = ? AND tenant_id = ?').bind(surveyId, tenantId).first()
  ]);
  const responses = await db.prepare('SELECT * FROM visit_responses WHERE visit_type = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 100').bind(surveyId, tenantId).all();
  let questionStats = [];
  if (survey) {
    try {
      const questions = JSON.parse(survey.questions || '[]');
      questionStats = questions.map(q => ({ question_id: q.id, question_text: q.text || q.question_text, question_type: q.type || q.question_type, response_count: totalResponses?.count || 0 }));
    } catch(e) {}
  }
  return c.json({ success: true, data: { total_responses: totalResponses?.count || 0, responses: (responses.results || []).map(r => { try { r.responses = JSON.parse(r.responses); } catch(e) {} return r; }), question_stats: questionStats } });
});
app.post('/surveys/:surveyId/archive', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId'); const surveyId = c.req.param('surveyId');
  await db.prepare('UPDATE questionnaires SET is_active = 0, updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(surveyId, tenantId).run();
  return c.json({ success: true, message: 'Survey archived' });
});
app.post('/surveys/:surveyId/deactivate', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId'); const surveyId = c.req.param('surveyId');
  await db.prepare('UPDATE questionnaires SET is_active = 0, updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(surveyId, tenantId).run();
  return c.json({ success: true, message: 'Survey deactivated' });
});
app.post('/surveys/:surveyId/duplicate', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId'); const surveyId = c.req.param('surveyId');
  const original = await db.prepare('SELECT * FROM questionnaires WHERE id = ? AND tenant_id = ?').bind(surveyId, tenantId).first();
  if (!original) return c.json({ success: false, message: 'Survey not found' }, 404);
  const newId = uuidv4();
  await db.prepare('INSERT INTO questionnaires (id, tenant_id, name, visit_type, brand_id, questions, is_default, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 1, datetime("now"), datetime("now"))').bind(newId, tenantId, original.name + ' (Copy)', original.visit_type, original.brand_id, original.questions).run();
  return c.json({ success: true, data: { id: newId }, message: 'Survey duplicated' });
});
app.get('/surveys/:surveyId/export', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId'); const surveyId = c.req.param('surveyId');
  const responses = await db.prepare('SELECT vr.*, v.customer_id, c.name as customer_name FROM visit_responses vr LEFT JOIN visits v ON vr.visit_id = v.id LEFT JOIN customers c ON v.customer_id = c.id WHERE vr.visit_type = ? AND vr.tenant_id = ? ORDER BY vr.created_at DESC').bind(surveyId, tenantId).all();
  return c.json({ success: true, data: (responses.results || []).map(r => { try { r.responses = JSON.parse(r.responses); } catch(e) {} return r; }) });
});
app.get('/surveys/:surveyId/insights', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId'); const surveyId = c.req.param('surveyId');
  const [totalResponses, survey, recentResponses] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM visit_responses WHERE visit_type = ? AND tenant_id = ?').bind(surveyId, tenantId).first(),
    db.prepare('SELECT * FROM questionnaires WHERE id = ? AND tenant_id = ?').bind(surveyId, tenantId).first(),
    db.prepare('SELECT * FROM visit_responses WHERE visit_type = ? AND tenant_id = ? ORDER BY created_at DESC LIMIT 50').bind(surveyId, tenantId).all()
  ]);
  let questionInsights = [];
  if (survey) {
    try {
      const questions = JSON.parse(survey.questions || '[]');
      questionInsights = questions.map(q => ({ question: q.text || q.question_text, type: q.type || q.question_type, total_answers: totalResponses?.count || 0 }));
    } catch(e) {}
  }
  return c.json({ success: true, data: { total_responses: totalResponses?.count || 0, survey_name: survey?.name, question_insights: questionInsights, recent_responses: (recentResponses.results || []).map(r => { try { r.responses = JSON.parse(r.responses); } catch(e) {} return r; }) } });
});
app.post('/surveys/:surveyId/publish', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId'); const surveyId = c.req.param('surveyId');
  await db.prepare('UPDATE questionnaires SET is_active = 1, updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(surveyId, tenantId).run();
  return c.json({ success: true, message: 'Survey published' });
});
app.get('/surveys/:surveyId/report', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId'); const surveyId = c.req.param('surveyId');
  const [survey, totalResponses, responses] = await Promise.all([
    db.prepare('SELECT * FROM questionnaires WHERE id = ? AND tenant_id = ?').bind(surveyId, tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM visit_responses WHERE visit_type = ? AND tenant_id = ?').bind(surveyId, tenantId).first(),
    db.prepare('SELECT vr.*, v.customer_id, c.name as customer_name FROM visit_responses vr LEFT JOIN visits v ON vr.visit_id = v.id LEFT JOIN customers c ON v.customer_id = c.id WHERE vr.visit_type = ? AND vr.tenant_id = ? ORDER BY vr.created_at DESC LIMIT 200').bind(surveyId, tenantId).all()
  ]);
  return c.json({ success: true, data: { survey_name: survey?.name, total_responses: totalResponses?.count || 0, responses: (responses.results || []).map(r => { try { r.responses = JSON.parse(r.responses); } catch(e) {} return r; }) } });
});
app.get('/surveys/:surveyId/responses', authMiddleware, async (c) => {
  const db = c.env.DB; const tenantId = c.get('tenantId'); const surveyId = c.req.param('surveyId');
  const responses = await db.prepare('SELECT vr.*, v.customer_id, c.name as customer_name, u.first_name || " " || u.last_name as agent_name FROM visit_responses vr LEFT JOIN visits v ON vr.visit_id = v.id LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id WHERE vr.visit_type = ? AND vr.tenant_id = ? ORDER BY vr.created_at DESC LIMIT 500').bind(surveyId, tenantId).all();
  return c.json({ success: true, data: (responses.results || []).map(r => { try { r.responses = JSON.parse(r.responses); } catch(e) {} return r; }) });
});
app.get('/kyc/:id', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
// ==================== KYC DOCUMENTS (R2-backed) ====================
// The kyc_documents table stores metadata only; binaries live in R2 under
//   kyc/{tenant_id}/{kyc_case_id}/{document_type}-{uuid}.{ext}
// The bucket is private; reads always go through the Worker so we can authenticate
// and audit access to PII.

const KYC_ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const KYC_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

app.get('/kyc/:id/documents', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const id = c.req.param('id');
    const docs = await db.prepare(
      'SELECT id, kyc_case_id, document_type, file_name, content_type, file_size, r2_key, sha256, uploaded_by, created_at ' +
      'FROM kyc_documents WHERE tenant_id = ? AND kyc_case_id = ? ORDER BY created_at DESC'
    ).bind(tenantId, id).all();
    return c.json({ success: true, data: docs.results || [] });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

app.post('/kyc/:id/documents', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const caseId = c.req.param('id');
    const bucket = c.env.UPLOADS;
    if (!bucket) return c.json({ success: false, message: 'Storage not configured' }, 500);

    // Multi-tenant guard: confirm the case exists in this tenant before letting anyone
    // upload PII tagged with its id.
    const kycCase = await db.prepare('SELECT id FROM kyc_cases WHERE id = ? AND tenant_id = ?').bind(caseId, tenantId).first();
    if (!kycCase) return c.json({ success: false, message: 'KYC case not found' }, 404);

    const form = await c.req.parseBody();
    const file = form['file'];
    if (!file || typeof file === 'string') return c.json({ success: false, message: 'file field is required' }, 400);

    const documentType = String(form['document_type'] || 'other').slice(0, 32);
    const contentType = file.type || 'application/octet-stream';
    if (!KYC_ALLOWED_MIME.includes(contentType)) {
      return c.json({ success: false, message: `Unsupported content_type: ${contentType}. Allowed: ${KYC_ALLOWED_MIME.join(', ')}` }, 415);
    }
    if (file.size > KYC_MAX_BYTES) {
      return c.json({ success: false, message: `File too large (${file.size} bytes > ${KYC_MAX_BYTES})` }, 413);
    }

    const ext = contentType === 'application/pdf' ? 'pdf'
      : contentType === 'image/png' ? 'png'
      : contentType === 'image/webp' ? 'webp'
      : 'jpg';
    const docId = uuidv4();
    const r2Key = `kyc/${tenantId}/${caseId}/${documentType}-${docId}.${ext}`;

    const buf = await file.arrayBuffer();
    // Compute sha256 for tamper-evidence; cheap on Workers.
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const sha256 = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    await bucket.put(r2Key, buf, { httpMetadata: { contentType } });

    await db.prepare(
      'INSERT INTO kyc_documents (id, tenant_id, kyc_case_id, document_type, file_name, content_type, file_size, sha256, r2_key, uploaded_by, created_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))'
    ).bind(docId, tenantId, caseId, documentType, file.name || `${documentType}.${ext}`, contentType, file.size, sha256, r2Key, userId).run();

    return c.json({
      success: true,
      data: {
        id: docId,
        kyc_case_id: caseId,
        document_type: documentType,
        file_name: file.name || null,
        content_type: contentType,
        file_size: file.size,
        sha256,
        download_url: `/api/kyc/documents/${docId}/download`,
      },
    }, 201);
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

app.delete('/kyc/:id/documents/:documentId', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const docId = c.req.param('documentId');
    const bucket = c.env.UPLOADS;
    const doc = await db.prepare('SELECT r2_key FROM kyc_documents WHERE id = ? AND tenant_id = ?').bind(docId, tenantId).first();
    if (!doc) return c.json({ success: false, message: 'Document not found' }, 404);
    if (doc.r2_key && bucket) {
      try { await bucket.delete(doc.r2_key); } catch (e) { /* keep going; orphan is recoverable */ }
    }
    await db.prepare('DELETE FROM kyc_documents WHERE id = ? AND tenant_id = ?').bind(docId, tenantId).run();
    return c.json({ success: true, message: 'Document deleted' });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

app.get('/kyc/documents/:documentId/download', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const role = c.get('role');
    if (!['admin', 'manager', 'super_admin', 'compliance', 'kyc_reviewer'].includes(role)) {
      return c.json({ success: false, message: 'KYC review permission required' }, 403);
    }
    const docId = c.req.param('documentId');
    const doc = await db.prepare('SELECT r2_key, content_type, file_name FROM kyc_documents WHERE id = ? AND tenant_id = ?').bind(docId, tenantId).first();
    if (!doc || !doc.r2_key) return c.json({ success: false, message: 'Document not found' }, 404);
    const bucket = c.env.UPLOADS;
    if (!bucket) return c.json({ success: false, message: 'Storage not configured' }, 500);
    const obj = await bucket.get(doc.r2_key);
    if (!obj) return c.json({ success: false, message: 'Object not found in storage' }, 404);

    // Best-effort access audit log; failures here must not block the read.
    try {
      await db.prepare(
        'INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(uuidv4(), tenantId, userId, 'KYC_DOC_VIEW', 'KYC_DOCUMENT', docId, JSON.stringify({ r2_key: doc.r2_key })).run();
    } catch { /* audit_log may be missing on older tenants */ }

    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('Content-Type', doc.content_type || obj.httpMetadata?.contentType || 'application/octet-stream');
    if (doc.file_name) headers.set('Content-Disposition', `inline; filename="${String(doc.file_name).replace(/"/g, '')}"`);
    headers.set('Cache-Control', 'private, max-age=300');
    return new Response(obj.body, { headers });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

export default app;
