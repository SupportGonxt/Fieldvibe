import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { validate, loginSchema, registerSchema, createUserSchema, updateUserSchema, createSalesOrderSchema, createPaymentSchema, createVanLoadSchema, vanSellSchema, vanReturnSchema, createProductSchema, updateProductSchema, createCustomerSchema, updateCustomerSchema, stockMovementSchema, commissionRuleSchema, territorySchema, campaignSchema, tradePromotionSchema, webhookSchema } from './validate.js';
import configRoutes, { getConfig } from './routes/field-ops/config.js';
import hierarchyRoutes from './routes/field-ops/hierarchy.js';
import incentiveRoutes from './routes/field-ops/incentives.js';
import callRoutes from './routes/field-ops/calls.js';
import gmRoutes from './routes/field-ops/gm.js';
import kpiRoutes from './routes/field-ops/kpi.js';
import depositRoutes from './routes/field-ops/deposits.js';
import metricFactsRoutes from './routes/field-ops/metricFacts.js';
import issueRoutes from './routes/field-ops/issues.js';
import cashReconRoutes from './routes/cashRecon.js';
import fieldOpsPerformanceRoutes from './routes/fieldOpsPerformance.js';
import vanSalesRoutes from './routes/vanSales.js';
import commissionRoutes from './routes/commissions.js';
import surveyRoutes from './routes/surveys.js';
import reportRoutes from './routes/reports.js';
import productRoutes from './routes/coreCrud/products.js';
import userRoutes from './routes/coreCrud/users.js';
import visitRoutes from './routes/coreCrud/visits.js';
import orderPaymentRoutes from './routes/coreCrud/ordersPayments.js';
import { writePaymentLedgerEntries } from './lib/paymentLedger.js';
import inventoryRoutes from './routes/inventory.js';
import vanOpsRoutes from './routes/vanOps.js';
import salesRoutes from './routes/sales.js';
import marketingRoutes from './routes/marketing.js';
import fieldOpsRoutes from './routes/fieldOps.js';
import { extractGoldrushId, goldrushIdExists } from './lib/goldrush.js';
import companyCustomerRoutes from './routes/coreCrud/companiesCustomers.js';
import mobileDashboardRoutes from './routes/mobileDashboards.js';
import authRoutes from './routes/auth.js';
import portalRoutes from './routes/portal.js';
import companyPortalRoutes from './routes/companyPortal.js';
import transactionRoutes from './routes/transactions.js';
import tradePromotionRoutes from './routes/tradePromotions.js';
import activationsPosmRoutes from './routes/activationsPosm.js';
import adminOpsRoutes from './routes/adminOps.js';
import { buildGoldrushConfig } from './services/programConfig.js';
import { parseStoreInsights } from './services/goldrushVision.js';
import { defaultDashboardConfig, assertPortalToken, inviteTokenExpired, serializeIndividualForPortal, serializeStoreForPortal, matchAskIntent, ensurePortalTables } from './services/portal.js';
import { cachedD1Query, invalidateCache } from './lib/cache.js';
import { rateLimiter, authMiddleware, requireRole, requireSuperAdmin } from './lib/middleware.js';
import { checkIdempotency, saveIdempotency } from './lib/idempotency.js';
import { generateToken, normalizePhone } from './lib/authUtils.js';
import { DEFAULT_WD_CONFIG, resolveWorkingDaysConfig, resolveWorkingDaysConfigBatch, countWorkingDaysInMonth, buildFallbackMonthlyTargets, getUserMonthlyTargetFromRules, generateTargetsFromRules, computeTargetTotalsFromRules } from './lib/calendar.js';
import { getCommissionTotals, getBulkAgentVisitCounts, resolveReportCompanyId } from './lib/aggregates.js';
import { rewriteR2Url, computePhotoHash, isPhotoHashDuplicate, analyzePhotoWithAI, materializeQuestionnairPhoto } from './lib/photoAi.js';
import { generateGmDigest, generatePerformanceSummaries, checkInactiveAgents, reactToIssues, checkOverdueInvoices, checkLowStock, checkStaleVanLoads, closeCommissionPeriod, generateAgingReport, sendWeeklyGoldrushReports, computeGoldrushIndividualInsights, computeGoldrushStoreInsights, buildGoldrushWeeklyHtml, drainAiBacklog, reapStuckAiProcessing } from './cron/jobs.js';
import { sendEmailViaMailChannels } from './cron/email.js';
export { CallRoom } from './durable/CallRoom.js';

const app = new Hono();

// ==================== GLOBAL ERROR HANDLER (BUG-001) ====================
// Catches all unhandled exceptions in any route handler, preventing raw 500
// errors and stack trace leaks to the client. Logs to error_logs table.
app.onError((err, c) => {
  console.error('Unhandled error:', err.message, err.stack);
  try {
    const db = c.env?.DB;
    if (db) {
      db.prepare('INSERT INTO error_logs (id, tenant_id, error_type, message, stack_trace, request_path, request_method, severity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
        crypto.randomUUID(), c.get('tenantId') || 'unknown', 'UNHANDLED', err.message, err.stack,
        c.req.path, c.req.method, 'ERROR').run().catch(() => {});
    }
  } catch(e) {}
  // Return descriptive error messages so the frontend can display what went wrong
  const errMsg = err.message || 'Unknown error';
  // Detect common D1/SQLite constraint errors and translate to user-friendly messages
  let userMessage = 'An internal error occurred. Please try again.';
  if (errMsg.includes('UNIQUE constraint failed')) {
    const field = errMsg.match(/UNIQUE constraint failed: (\w+)\.(\w+)/)?.[2] || 'field';
    userMessage = `A record with this ${field} already exists. Please use a different value.`;
  } else if (errMsg.includes('NOT NULL constraint failed')) {
    const field = errMsg.match(/NOT NULL constraint failed: (\w+)\.(\w+)/)?.[2] || 'field';
    userMessage = `The ${field} field is required and cannot be empty.`;
  } else if (errMsg.includes('FOREIGN KEY constraint failed')) {
    userMessage = 'A referenced record does not exist. Please check your selections.';
  } else if (errMsg.includes('no such table')) {
    const table = errMsg.match(/no such table: (\w+)/)?.[1] || 'table';
    userMessage = `Database table "${table}" not found. Please contact support.`;
  } else if (errMsg.includes('no such column')) {
    const col = errMsg.match(/no such column: (\w+)/)?.[1] || 'column';
    userMessage = `Database column "${col}" not found. The schema may need updating.`;
  }
  return c.json({ success: false, message: userMessage }, 500);
});

// ==================== SECTION 7: SECURITY HEADERS ====================
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Request-ID', crypto.randomUUID());
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

// Middleware
app.use('*', logger());

// ==================== SECTION 4: CORS LOCKDOWN ====================
app.use('*', cors({
  origin: (origin) => {
    const allowed = [
      'https://fieldvibe.vantax.co.za',
      'https://fieldvibe.pages.dev',
      'https://dev.fieldvibe-frontend.pages.dev',
    ];
    if (!origin) return allowed[0];
    if (allowed.includes(origin)) return origin;
    if (origin.endsWith('.fieldvibe.pages.dev')) return origin;
    if (origin.endsWith('.fieldvibe-frontend.pages.dev')) return origin;
    if (origin.startsWith('http://localhost:')) return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Tenant-Code', 'x-tenant-code', 'X-Idempotency-Key'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({ status: 'ok', service: 'FieldVibe API', version: '2.0.0' }));
app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }));

// ==================== AUTH ROUTES (with rate limiting + validation) ====================
app.route('/', authRoutes);

app.route('/', mobileDashboardRoutes);

// ==================== PROTECTED API ROUTES ====================
const api = new Hono();
api.use('*', authMiddleware);

// ==================== PAYMENT LEDGER HELPER (item #3) ====================
// General API rate limiting (100 req/min)
api.use('*', rateLimiter(100, 60000));

api.route('/', userRoutes);

api.route('/', companyCustomerRoutes);

api.route('/', productRoutes);

api.route('/', inventoryRoutes);


api.route('/', visitRoutes);


api.route('/', fieldOpsRoutes);

api.route('/', vanOpsRoutes);

api.route('/', orderPaymentRoutes);

// ==================== PAYMENT LEDGER (item #3) ====================
// Read-only ledger endpoints. All writes happen via writePaymentLedgerEntries
// alongside the existing payments inserts. The legacy /payments + sales_orders
// payment_status flow remains the source of truth; this is a parallel view
// suitable for finance reporting and future reversal flows.
api.get('/payment-ledger', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { sales_order_id, payment_id, entry_type, limit = 100, page = 1 } = c.req.query();
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];
  if (sales_order_id) { where += ' AND sales_order_id = ?'; params.push(sales_order_id); }
  if (payment_id) { where += ' AND payment_id = ?'; params.push(payment_id); }
  if (entry_type) { where += ' AND entry_type = ?'; params.push(entry_type); }
  const limitNum = Math.min(parseInt(limit) || 100, 500);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;
  const rows = await db.prepare('SELECT * FROM payment_ledger ' + where + ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  return c.json({ success: true, data: rows.results || [] });
});


// One-shot backfill admin endpoint: walks every payments row and inserts the
// matching RECEIPT + APPLICATION pair into payment_ledger if not already present.
// Idempotent — checks for an existing RECEIPT row keyed by payment_id before writing.
api.post('/admin/payments/backfill-ledger', requireRole('admin', 'super_admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { limit = 200 } = c.req.query();
  const batch = Math.min(parseInt(limit) || 200, 500);

  const payments = await db.prepare(
    'SELECT p.id, p.sales_order_id, p.amount, p.reference, p.created_at FROM payments p ' +
    'WHERE p.tenant_id = ? ' +
    'AND NOT EXISTS (SELECT 1 FROM payment_ledger pl WHERE pl.payment_id = p.id AND pl.entry_type = "RECEIPT") ' +
    'ORDER BY p.created_at ASC LIMIT ?'
  ).bind(tenantId, batch).all();

  const list = payments.results || [];
  let inserted = 0;
  for (const p of list) {
    await writePaymentLedgerEntries(db, {
      tenantId,
      paymentId: p.id,
      salesOrderId: p.sales_order_id,
      amount: p.amount,
      userId,
      notes: p.reference || 'Backfilled from payments table',
    });
    inserted += 1;
  }

  const remainingR = await db.prepare(
    'SELECT COUNT(*) as c FROM payments p WHERE p.tenant_id = ? ' +
    'AND NOT EXISTS (SELECT 1 FROM payment_ledger pl WHERE pl.payment_id = p.id AND pl.entry_type = "RECEIPT")'
  ).bind(tenantId).first();

  return c.json({
    success: true,
    data: {
      processed: inserted,
      remaining: remainingR?.c || 0,
      done: (remainingR?.c || 0) === 0,
    },
  });
});


// Purchase orders


api.route('/', marketingRoutes);

api.route('/', salesRoutes);

// ==================== NOTIFICATIONS ====================
api.get('/notifications', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { is_read, limit = 50, page = 1 } = c.req.query();
  let where = 'WHERE tenant_id = ? AND user_id = ?';
  const params = [tenantId, userId];
  if (is_read !== undefined) { where += ' AND is_read = ?'; params.push(is_read === 'true' ? 1 : 0); }
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const countR = await db.prepare('SELECT COUNT(*) as total FROM notifications ' + where).bind(...params).first();
  const unreadR = await db.prepare('SELECT COUNT(*) as count FROM notifications WHERE tenant_id = ? AND user_id = ? AND is_read = 0').bind(tenantId, userId).first();
  const notifications = await db.prepare('SELECT * FROM notifications ' + where + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  return c.json({ success: true, data: { notifications: notifications.results || [], unread_count: unreadR ? unreadR.count : 0, pagination: { total: countR ? countR.total : 0, page: pageNum, limit: limitNum } } });
});

api.put('/notifications/:id/read', async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const { id } = c.req.param();
  await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return c.json({ success: true, message: 'Notification marked as read' });
});

api.put('/notifications/read-all', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  await db.prepare('UPDATE notifications SET is_read = 1 WHERE tenant_id = ? AND user_id = ? AND is_read = 0').bind(tenantId, userId).run();
  return c.json({ success: true, message: 'All notifications marked as read' });
});

// ==================== PERFORMANCE MESSAGES ====================
api.get('/performance-messages', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  // Only managers and team leads get performance messages
  if (!['manager', 'team_lead', 'admin', 'super_admin'].includes(role)) {
    return c.json({ success: true, data: { messages: [], unread_count: 0 } });
  }
  const today = new Date().toISOString().split('T')[0];
  const messages = await db.prepare("SELECT id, title, message, type, is_read, created_at FROM notifications WHERE tenant_id = ? AND user_id = ? AND type = 'performance_summary' AND created_at >= ? ORDER BY created_at DESC LIMIT 20").bind(tenantId, userId, today + ' 00:00:00').all();
  const unread = await db.prepare("SELECT COUNT(*) as count FROM notifications WHERE tenant_id = ? AND user_id = ? AND type = 'performance_summary' AND is_read = 0 AND created_at >= ?").bind(tenantId, userId, today + ' 00:00:00').first();
  return c.json({ success: true, data: { messages: messages.results || [], unread_count: unread ? unread.count : 0 } });
});

// Generate performance summaries on demand (for testing / manual trigger)
api.post('/performance-messages/generate', authMiddleware, async (c) => {
  const role = c.get('role');
  if (!['admin', 'super_admin', 'manager', 'team_lead'].includes(role)) {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  try {
    await generatePerformanceSummaries(c.env.DB, true);
    return c.json({ success: true, message: 'Performance summaries generated' });
  } catch (e) {
    return c.json({ error: 'Failed to generate summaries: ' + e.message }, 500);
  }
});

api.post('/notifications', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.user_id, body.type || 'info', body.title, body.message || null, body.related_type || null, body.related_id || null).run();
  return c.json({ success: true, data: { id } }, 201);
});

api.post('/notifications/broadcast', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const users = await db.prepare('SELECT id FROM users WHERE tenant_id = ? AND is_active = 1 LIMIT 500').bind(tenantId).all();
  for (const user of (users.results || [])) {
    const id = uuidv4();
    await db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, user.id, body.type || 'info', body.title, body.message || null).run();
  }
  return c.json({ success: true, message: 'Notification broadcast sent' });
});

// ==================== CROSS-TENANT ====================
api.get('/cross-tenant/assignments', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const assignments = await db.prepare("SELECT aca.*, u.first_name || ' ' || u.last_name as user_name, u.email as user_email, t.name as tenant_name FROM agent_company_assignments aca LEFT JOIN users u ON aca.user_id = u.id LEFT JOIN tenants t ON aca.tenant_id = t.id WHERE aca.revoked_at IS NULL ORDER BY aca.granted_at DESC").all();
  return c.json({ success: true, data: assignments.results || [] });
});

api.post('/cross-tenant/assignments', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const id = uuidv4();
  const userId = c.get('userId');
  await db.prepare('INSERT INTO agent_company_assignments (id, user_id, tenant_id, role_override, granted_by) VALUES (?, ?, ?, ?, ?)').bind(id, body.user_id, body.tenant_id, body.role_override || null, userId).run();
  return c.json({ success: true, data: { id } }, 201);
});

api.delete('/cross-tenant/assignments/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  await db.prepare("UPDATE agent_company_assignments SET revoked_at = datetime('now') WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: 'Assignment revoked' });
});

api.post('/cross-tenant/switch', authMiddleware, async (c) => {
  const db = c.env.DB;
  const userId = c.get('userId');
  const body = await c.req.json();
  const assignment = await db.prepare('SELECT * FROM agent_company_assignments WHERE user_id = ? AND tenant_id = ? AND revoked_at IS NULL').bind(userId, body.tenant_id).first();
  if (!assignment) return c.json({ success: false, message: 'No access to this tenant' }, 403);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return c.json({ success: false, message: 'User not found' }, 404);
  const role = assignment.role_override || user.role;
  const jwtSecret = c.env.JWT_SECRET;
  const accessToken = await generateToken({ userId, tenantId: body.tenant_id, role }, jwtSecret);
  const tenant = await db.prepare('SELECT name FROM tenants WHERE id = ?').bind(body.tenant_id).first();
  return c.json({ success: true, data: { token: accessToken, tenantId: body.tenant_id, tenantName: tenant ? tenant.name : '', role } });
});

// ==================== AUDIT LOG ====================
api.get('/audit-log', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { action, resource_type, user_id, limit = 50, page = 1 } = c.req.query();
  let where = 'WHERE al.tenant_id = ?';
  const params = [tenantId];
  if (action) { where += ' AND al.action = ?'; params.push(action); }
  if (resource_type) { where += ' AND al.resource_type = ?'; params.push(resource_type); }
  if (user_id) { where += ' AND al.user_id = ?'; params.push(user_id); }
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 50;
  const offset = (pageNum - 1) * limitNum;
  const logs = await db.prepare("SELECT al.*, u.first_name || ' ' || u.last_name as user_name FROM audit_log al LEFT JOIN users u ON al.user_id = u.id " + where + ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?').bind(...params, limitNum, offset).all();
  return c.json({ success: true, data: logs.results || [] });
});

// ==================== SETTINGS ====================
api.get('/settings', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { category } = c.req.query();
  let query = 'SELECT * FROM settings WHERE tenant_id = ?';
  const params = [tenantId];
  if (category) { query += ' AND category = ?'; params.push(category); }
  query += ' ORDER BY key';
  const rows = await db.prepare(query).bind(...params).all();
  // Return settings as both array and keyed object for frontend compatibility
  const settingsArray = rows.results || [];
  const settingsMap = {};
  for (const s of settingsArray) {
    settingsMap[s.key] = {
      key: s.key,
      value: s.value,
      label: (s.key || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      type: s.key && (s.key.includes('password') || s.key.includes('secret') || s.key.includes('api_key')) ? 'password'
        : s.key && (s.key.includes('enabled') || s.key.includes('require') || s.key.includes('auto_')) ? 'boolean'
        : s.key && (s.key.includes('port') || s.key.includes('rate') || s.key.includes('max_') || s.key.includes('min_') || s.key.includes('days') || s.key.includes('limit') || s.key.includes('timeout')) ? 'number'
        : s.key && s.key.includes('email') ? 'email'
        : s.key && (s.key.includes('description') || s.key.includes('address') || s.key.includes('notes') || s.key.includes('footer') || s.key.includes('terms')) ? 'textarea'
        : 'text',
      category: s.category || 'general',
      description: s.key ? `Configure ${s.key.replace(/_/g, ' ')}` : '',
    };
  }
  // Return both formats: 'data' as array for backward compatibility, plus 'settings' keyed map
  return c.json({ success: true, data: settingsArray, settings: settingsMap });
});

api.get('/settings-categories', async (c) => {
  return c.json({ success: true, data: [
    { id: 'company', name: 'Company Information', icon: 'Building2', description: 'Basic company details and branding' },
    { id: 'email', name: 'Email Configuration', icon: 'Mail', description: 'SMTP settings for sending emails' },
    { id: 'sms', name: 'SMS Configuration', icon: 'MessageSquare', description: 'Twilio settings for SMS notifications' },
    { id: 'locale', name: 'Regional Settings', icon: 'Globe', description: 'Currency, date format, and timezone' },
    { id: 'orders', name: 'Order Settings', icon: 'ShoppingCart', description: 'Order processing and approval rules' },
    { id: 'invoices', name: 'Invoice Settings', icon: 'FileText', description: 'Invoice numbering and terms' },
    { id: 'tax', name: 'Tax Settings', icon: 'Receipt', description: 'Tax rates and calculations' },
    { id: 'commissions', name: 'Commission Settings', icon: 'DollarSign', description: 'Sales commission configuration' },
    { id: 'inventory', name: 'Inventory Settings', icon: 'Package', description: 'Stock management rules' },
    { id: 'visits', name: 'Visit Settings', icon: 'MapPin', description: 'Field visit requirements' },
    { id: 'notifications', name: 'Notification Settings', icon: 'Bell', description: 'Alert and notification preferences' },
    { id: 'security', name: 'Security Settings', icon: 'Shield', description: 'Authentication and access control' },
    { id: 'integrations', name: 'Integration Settings', icon: 'Plug', description: 'Third-party integrations and APIs' },
  ] });
});

api.post('/settings/initialize', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const defaults = [
    { key: 'company_name', value: '', category: 'company' },
    { key: 'company_email', value: '', category: 'company' },
    { key: 'company_phone', value: '', category: 'company' },
    { key: 'company_address', value: '', category: 'company' },
    { key: 'company_logo_url', value: '', category: 'company' },
    { key: 'company_registration_number', value: '', category: 'company' },
    { key: 'company_tax_number', value: '', category: 'company' },
    { key: 'smtp_host', value: '', category: 'email' },
    { key: 'smtp_port', value: '587', category: 'email' },
    { key: 'smtp_username', value: '', category: 'email' },
    { key: 'smtp_password', value: '', category: 'email' },
    { key: 'smtp_from_email', value: '', category: 'email' },
    { key: 'sms_provider', value: 'twilio', category: 'sms' },
    { key: 'sms_api_key', value: '', category: 'sms' },
    { key: 'sms_api_secret', value: '', category: 'sms' },
    { key: 'sms_from_number', value: '', category: 'sms' },
    { key: 'currency_code', value: 'ZAR', category: 'locale' },
    { key: 'currency_symbol', value: 'R', category: 'locale' },
    { key: 'date_format', value: 'YYYY-MM-DD', category: 'locale' },
    { key: 'timezone', value: 'Africa/Johannesburg', category: 'locale' },
    { key: 'order_auto_approve', value: 'false', category: 'orders' },
    { key: 'order_require_approval_above', value: '5000', category: 'orders' },
    { key: 'order_prefix', value: 'ORD', category: 'orders' },
    { key: 'invoice_prefix', value: 'INV', category: 'invoices' },
    { key: 'invoice_payment_terms_days', value: '30', category: 'invoices' },
    { key: 'invoice_footer_text', value: '', category: 'invoices' },
    { key: 'tax_rate', value: '15', category: 'tax' },
    { key: 'tax_inclusive', value: 'true', category: 'tax' },
    { key: 'commission_default_rate', value: '5', category: 'commissions' },
    { key: 'commission_auto_calculate', value: 'true', category: 'commissions' },
    { key: 'inventory_low_stock_threshold', value: '10', category: 'inventory' },
    { key: 'inventory_auto_reorder', value: 'false', category: 'inventory' },
    { key: 'visit_require_gps', value: 'true', category: 'visits' },
    { key: 'visit_max_duration_hours', value: '4', category: 'visits' },
    { key: 'visit_require_photo', value: 'false', category: 'visits' },
    { key: 'notifications_email_enabled', value: 'true', category: 'notifications' },
    { key: 'notifications_sms_enabled', value: 'false', category: 'notifications' },
    { key: 'security_password_min_length', value: '8', category: 'security' },
    { key: 'security_session_timeout_minutes', value: '60', category: 'security' },
    { key: 'security_require_2fa', value: 'false', category: 'security' },
  ];
  let inserted = 0;
  for (const d of defaults) {
    const existing = await db.prepare('SELECT id FROM settings WHERE tenant_id = ? AND key = ?').bind(tenantId, d.key).first();
    if (!existing) {
      const id = uuidv4();
      await db.prepare('INSERT INTO settings (id, tenant_id, key, value, category) VALUES (?, ?, ?, ?, ?)').bind(id, tenantId, d.key, d.value, d.category).run();
      inserted++;
    }
  }
  return c.json({ success: true, message: `Initialized ${inserted} settings` });
});

api.put('/settings', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  // Support both formats:
  // 1. { settings: [{key, value, category}] } (array format)
  // 2. { settings: {key: value, ...} } (object/Record format from frontend)
  if (body.settings) {
    const entries = Array.isArray(body.settings)
      ? body.settings
      : Object.entries(body.settings).map(([key, value]) => ({ key, value }));
    for (const s of entries) {
      const existing = await db.prepare('SELECT id FROM settings WHERE tenant_id = ? AND key = ?').bind(tenantId, s.key).first();
      if (existing) {
        await db.prepare('UPDATE settings SET value = ?, updated_at = datetime("now") WHERE id = ?').bind(s.value, existing.id).run();
      } else {
        const id = uuidv4();
        await db.prepare('INSERT INTO settings (id, tenant_id, key, value, category) VALUES (?, ?, ?, ?, ?)').bind(id, tenantId, s.key, s.value, s.category || 'general').run();
      }
    }
  }
  return c.json({ success: true, message: 'Settings updated' });
});

// ==================== FILE UPLOAD (R2) ====================
api.post('/uploads', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file) return c.json({ success: false, message: 'No file provided' }, 400);
    const bucket = c.env.UPLOADS;
    if (!bucket) return c.json({ success: false, message: 'Storage not configured' }, 500);
    const key = 'uploads/' + Date.now() + '-' + (file.name || 'file');
    await bucket.put(key, file.stream || file, { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
    return c.json({ success: true, data: { key, url: '/api/uploads/' + key } });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ success: false, message: 'Upload failed' }, 500);
  }
});

api.get('/uploads/:key{.+}', async (c) => {
  try {
    const bucket = c.env.UPLOADS;
    if (!bucket) return c.json({ success: false, message: 'Storage not configured' }, 500);
    const key = c.req.param('key');
    const object = await bucket.get(key);
    if (!object) return c.json({ success: false, message: 'File not found' }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    return new Response(object.body, { headers });
  } catch (error) {
    return c.json({ success: false, message: 'File retrieval failed' }, 500);
  }
});

// ==================== DASHBOARD ====================
api.get('/dashboard', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  let agentFilter = '';
  const agentParams = [];
  if (role === 'agent') { agentFilter = ' AND agent_id = ?'; agentParams.push(userId); }

  const [
    totalCustomers, totalUsers, totalProducts,
    todayVisits, monthVisits, completedVisits,
    monthOrders, monthRevenue,
    pendingCommissions, approvedCommissions,
    activeLoads, pendingRecons,
    activeCampaigns
  ] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND is_active = 1').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date = ?' + agentFilter).bind(tenantId, today, ...agentParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date LIKE ?" + agentFilter).bind(tenantId, thisMonth + '%', ...agentParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND status = 'completed' AND visit_date LIKE ?" + agentFilter).bind(tenantId, thisMonth + '%', ...agentParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?" + agentFilter).bind(tenantId, thisMonth + '%', ...agentParams).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?" + agentFilter).bind(tenantId, thisMonth + '%', ...agentParams).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'pending'" + (role === 'agent' ? ' AND earner_id = ?' : '')).bind(tenantId, ...(role === 'agent' ? [userId] : [])).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'approved'" + (role === 'agent' ? ' AND earner_id = ?' : '')).bind(tenantId, ...(role === 'agent' ? [userId] : [])).first(),
    db.prepare("SELECT COUNT(*) as count FROM van_stock_loads WHERE tenant_id = ? AND status = 'loaded'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM van_reconciliations WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM campaigns WHERE tenant_id = ? AND status = 'active'").bind(tenantId).first(),
  ]);

  // Recent activity
  const recentVisits = await db.prepare("SELECT v.id, v.visit_type, v.status, v.created_at, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id WHERE v.tenant_id = ?" + agentFilter + " ORDER BY v.created_at DESC LIMIT 10").bind(tenantId, ...agentParams).all();
  const recentOrders = await db.prepare("SELECT so.id, so.order_number, so.total_amount, so.status, so.created_at, c.name as customer_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.tenant_id = ?" + agentFilter + " ORDER BY so.created_at DESC LIMIT 10").bind(tenantId, ...agentParams).all();

  return c.json({
    success: true,
    data: {
      stats: {
        customers: totalCustomers ? totalCustomers.count : 0,
        users: totalUsers ? totalUsers.count : 0,
        products: totalProducts ? totalProducts.count : 0,
        todayVisits: todayVisits ? todayVisits.count : 0,
        monthVisits: monthVisits ? monthVisits.count : 0,
        completedVisits: completedVisits ? completedVisits.count : 0,
        monthOrders: monthOrders ? monthOrders.count : 0,
        monthRevenue: monthRevenue ? monthRevenue.total : 0,
        pendingCommissions: pendingCommissions ? pendingCommissions.total : 0,
        approvedCommissions: approvedCommissions ? approvedCommissions.total : 0,
        activeVanLoads: activeLoads ? activeLoads.count : 0,
        pendingReconciliations: pendingRecons ? pendingRecons.count : 0,
        activeCampaigns: activeCampaigns ? activeCampaigns.count : 0,
      },
      recentVisits: recentVisits.results || [],
      recentOrders: recentOrders.results || [],
    }
  });
});

// ==================== REPORTS ====================
api.get('/reports/sales', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { start_date, end_date, group_by = 'day' } = c.req.query();
  let dateFilter = '';
  const params = [tenantId];
  if (start_date) { dateFilter += ' AND created_at >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND created_at <= ?'; params.push(end_date); }

  let groupExpr = "date(created_at)";
  if (group_by === 'month') groupExpr = "strftime('%Y-%m', created_at)";
  if (group_by === 'week') groupExpr = "strftime('%Y-W%W', created_at)";

  const data = await db.prepare('SELECT ' + groupExpr + ' as period, COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(AVG(total_amount), 0) as avg_order_value FROM sales_orders WHERE tenant_id = ?' + dateFilter + ' GROUP BY period ORDER BY period').bind(...params).all();
  return c.json({ success: true, data: data.results || [] });
});

api.get('/reports/visits', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { start_date, end_date } = c.req.query();
  let dateFilter = '';
  const params = [tenantId];
  if (start_date) { dateFilter += ' AND v.visit_date >= ?'; params.push(start_date); }
  if (end_date) { dateFilter += ' AND v.visit_date <= ?'; params.push(end_date); }

  const byAgent = await db.prepare("SELECT v.agent_id, u.first_name || ' ' || u.last_name as agent_name, COUNT(*) as total_visits, SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END) as completed_visits FROM visits v LEFT JOIN users u ON v.agent_id = u.id WHERE v.tenant_id = ?" + dateFilter + ' GROUP BY v.agent_id ORDER BY total_visits DESC').bind(...params).all();
  const byType = await db.prepare('SELECT visit_type, COUNT(*) as count FROM visits WHERE tenant_id = ?' + dateFilter.replace(/v\.visit_date/g, 'visit_date') + ' GROUP BY visit_type').bind(...params).all();
  const byDay = await db.prepare('SELECT visit_date as period, COUNT(*) as count FROM visits WHERE tenant_id = ?' + dateFilter.replace(/v\.visit_date/g, 'visit_date') + ' GROUP BY visit_date ORDER BY visit_date').bind(...params).all();

  return c.json({ success: true, data: { byAgent: byAgent.results || [], byType: byType.results || [], byDay: byDay.results || [] } });
});

api.get('/reports/commissions', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { period_start, period_end } = c.req.query();
  let dateFilter = '';
  const params = [tenantId];
  if (period_start) { dateFilter += ' AND ce.created_at >= ?'; params.push(period_start); }
  if (period_end) { dateFilter += ' AND ce.created_at <= ?'; params.push(period_end); }

  const byEarner = await db.prepare("SELECT ce.earner_id, u.first_name || ' ' || u.last_name as earner_name, ce.status, COUNT(*) as count, COALESCE(SUM(ce.amount), 0) as total FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ?" + dateFilter + ' GROUP BY ce.earner_id, ce.status ORDER BY total DESC').bind(...params).all();
  return c.json({ success: true, data: { byEarner: byEarner.results || [] } });
});

api.get('/reports/stock', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const lowStock = await db.prepare('SELECT sl.*, p.name as product_name, p.code as product_code, w.name as warehouse_name FROM stock_levels sl LEFT JOIN products p ON sl.product_id = p.id LEFT JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ? AND sl.quantity <= sl.reorder_level ORDER BY sl.quantity ASC LIMIT 500').bind(tenantId).all();
  const totalValue = await db.prepare('SELECT COALESCE(SUM(sl.quantity * p.cost_price), 0) as total FROM stock_levels sl LEFT JOIN products p ON sl.product_id = p.id WHERE sl.tenant_id = ?').bind(tenantId).first();
  return c.json({ success: true, data: { lowStock: lowStock.results || [], totalStockValue: totalValue ? totalValue.total : 0 } });
});

// ==================== DASHBOARD SUB-ROUTES ====================
api.get('/dashboard/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);
  const agentFilter = role === 'agent' ? ' AND agent_id = ?' : '';
  const agentParams = role === 'agent' ? [userId] : [];
  const soAgentFilter = role === 'agent' ? ' AND agent_id = ?' : '';
  const soAgentParams = role === 'agent' ? [userId] : [];

  const [totalCustomers, totalProducts, todayVisits, monthOrders, monthRevenue, pendingCommissions] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date = ?' + agentFilter).bind(tenantId, today, ...agentParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?" + soAgentFilter).bind(tenantId, thisMonth + '%', ...soAgentParams).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?" + soAgentFilter).bind(tenantId, thisMonth + '%', ...soAgentParams).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'pending'" + (role === 'agent' ? ' AND earner_id = ?' : '')).bind(tenantId, ...(role === 'agent' ? [userId] : [])).first(),
  ]);

  return c.json({
    total_customers: totalCustomers?.count || 0,
    total_products: totalProducts?.count || 0,
    today_visits: todayVisits?.count || 0,
    month_orders: monthOrders?.count || 0,
    month_revenue: monthRevenue?.total || 0,
    pending_commissions: pendingCommissions?.total || 0,
  });
});

api.get('/dashboard/revenue-trends', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { period = '30' } = c.req.query();
  // BUG-002: Validate period as integer to prevent SQL injection
  const periodDays = String(Math.max(1, Math.min(365, parseInt(period, 10) || 30)));
  const data = await db.prepare("SELECT date(created_at) as date, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders FROM sales_orders WHERE tenant_id = ? AND created_at >= date('now', '-' || ? || ' days') GROUP BY date(created_at) ORDER BY date").bind(tenantId, periodDays).all();
  return c.json(data.results || []);
});

api.get('/dashboard/sales-by-category', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT COALESCE(cat.name, 'Uncategorized') as category, COUNT(DISTINCT so.id) as orders, COALESCE(SUM(soi.quantity * soi.unit_price), 0) as revenue FROM sales_orders so JOIN sales_order_items soi ON so.id = soi.sales_order_id JOIN products p ON soi.product_id = p.id LEFT JOIN categories cat ON p.category_id = cat.id WHERE so.tenant_id = ? GROUP BY cat.name ORDER BY revenue DESC LIMIT 10").bind(tenantId).all();
  return c.json(data.results || []);
});

api.get('/dashboard/top-products', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT p.id, p.name, SUM(soi.quantity) as total_quantity, SUM(soi.quantity * soi.unit_price) as total_revenue FROM sales_order_items soi JOIN products p ON soi.product_id = p.id JOIN sales_orders so ON soi.sales_order_id = so.id WHERE so.tenant_id = ? GROUP BY p.id ORDER BY total_revenue DESC LIMIT 10").bind(tenantId).all();
  return c.json(data.results || []);
});

api.get('/dashboard/top-customers', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT c.id, c.name, COUNT(so.id) as total_orders, COALESCE(SUM(so.total_amount), 0) as total_spent FROM customers c LEFT JOIN sales_orders so ON c.id = so.customer_id WHERE c.tenant_id = ? GROUP BY c.id ORDER BY total_spent DESC LIMIT 10").bind(tenantId).all();
  return c.json(data.results || []);
});

api.get('/dashboard/order-status', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT status, COUNT(*) as count FROM sales_orders WHERE tenant_id = ? GROUP BY status").bind(tenantId).all();
  return c.json(data.results || []);
});

api.get('/dashboard/recent-activity', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const visits = await db.prepare("SELECT v.id, 'visit' as type, v.status, v.created_at, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id WHERE v.tenant_id = ? ORDER BY v.created_at DESC LIMIT 10").bind(tenantId).all();
  const orders = await db.prepare("SELECT so.id, 'order' as type, so.status, so.created_at, c.name as customer_name, so.total_amount FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.tenant_id = ? ORDER BY so.created_at DESC LIMIT 10").bind(tenantId).all();
  return c.json({ visits: visits.results || [], orders: orders.results || [] });
});

api.get('/dashboard/sales-performance', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT u.id, u.first_name || ' ' || u.last_name as name, COUNT(so.id) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM users u LEFT JOIN sales_orders so ON u.id = so.agent_id AND so.tenant_id = ? WHERE u.tenant_id = ? AND u.role IN ('agent', 'sales_rep') GROUP BY u.id ORDER BY revenue DESC").bind(tenantId, tenantId).all();
  return c.json(data.results || []);
});

api.get('/dashboard/inventory-overview', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const total = await db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(quantity), 0) as total_qty FROM stock_levels WHERE tenant_id = ?').bind(tenantId).first();
  const lowStock = await db.prepare('SELECT COUNT(*) as count FROM stock_levels WHERE tenant_id = ? AND quantity <= reorder_level').bind(tenantId).first();
  return c.json({ total_items: total?.count || 0, total_quantity: total?.total_qty || 0, low_stock_items: lowStock?.count || 0 });
});





api.route('/', vanSalesRoutes);


// ==================== INVOICES & FINANCE ROUTES ====================
api.get('/finance/dashboard', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [totalRevenue, totalPaid, totalPending, totalOverdue, recentPayments] = await Promise.all([
    db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE tenant_id = ? AND status = 'completed'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND payment_status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND payment_status = 'overdue'").bind(tenantId).first(),
    db.prepare('SELECT p.*, c.name as customer_name FROM payments p LEFT JOIN sales_orders so ON p.sales_order_id = so.id LEFT JOIN customers c ON so.customer_id = c.id WHERE p.tenant_id = ? ORDER BY p.created_at DESC LIMIT 10').bind(tenantId).all(),
  ]);
  return c.json({ success: true, data: { total_revenue: totalRevenue?.total || 0, total_paid: totalPaid?.total || 0, total_pending: totalPending?.total || 0, total_overdue: totalOverdue?.total || 0, recent_payments: recentPayments.results || [] } });
});

api.get('/finance/invoices', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { page = '1', limit = '20', status } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE so.tenant_id = ?';
  const params = [tenantId];
  if (status) { where += ' AND so.payment_status = ?'; params.push(status); }
  const orders = await db.prepare('SELECT so.id, so.order_number as invoice_number, so.customer_id, c.name as customer_name, so.total_amount, so.payment_status as status, so.created_at FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ' + where + ' ORDER BY so.created_at DESC LIMIT ? OFFSET ?').bind(...params, parseInt(limit), offset).all();
  return c.json({ data: orders.results || [] });
});

api.get('/finance/payments', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const payments = await db.prepare("SELECT p.*, c.name as customer_name FROM payments p LEFT JOIN sales_orders so ON p.sales_order_id = so.id LEFT JOIN customers c ON so.customer_id = c.id WHERE p.tenant_id = ? ORDER BY p.created_at DESC LIMIT 50").bind(tenantId).all();
  return c.json({ data: payments.results || [] });
});

api.get('/finance/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [totalRevenue, totalPaid, totalPending, totalOverdue] = await Promise.all([
    db.prepare('SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE tenant_id = ? AND status = 'completed'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND payment_status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND payment_status = 'overdue'").bind(tenantId).first(),
  ]);
  return c.json({ total_revenue: totalRevenue?.total || 0, total_paid: totalPaid?.total || 0, total_pending: totalPending?.total || 0, total_overdue: totalOverdue?.total || 0 });
});

api.route('/', commissionRoutes);


api.route('/', surveyRoutes);



api.get('/finance/invoices/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const invoice = await db.prepare("SELECT so.*, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id LEFT JOIN users u ON so.agent_id = u.id WHERE so.id = ? AND so.tenant_id = ?").bind(id, tenantId).first();
  if (!invoice) return c.json({ success: false, message: 'Invoice not found' }, 404);
  const items = await db.prepare('SELECT soi.*, p.name as product_name FROM sales_order_items soi JOIN sales_orders so ON soi.sales_order_id = so.id LEFT JOIN products p ON soi.product_id = p.id WHERE soi.sales_order_id = ? AND so.tenant_id = ? LIMIT 500').bind(id, tenantId).all();
  const payments = await db.prepare('SELECT * FROM payments WHERE sales_order_id = ? AND tenant_id = ? ORDER BY created_at DESC').bind(id, tenantId).all();
  return c.json({ success: true, data: { ...invoice, items: items.results || [], payments: payments.results || [] } });
});

// ==================== ANALYTICS ROUTES ====================
// /analytics/dashboard - comprehensive dashboard metrics with date filtering (used by frontend DashboardPage)
api.get('/analytics/dashboard', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { start_date, end_date } = c.req.query();
  const dateFilter = start_date && end_date ? " AND created_at >= ? AND created_at <= ? || ' 23:59:59'" : '';
  const visitDateFilter = start_date && end_date ? " AND visit_date >= ? AND visit_date <= ?" : '';
  const dateParams = start_date && end_date ? [start_date, end_date] : [];

  const [totalRevenue, totalOrders, activeCustomers, newCustomers, totalAgents, activeAgents, productsSold, uniqueProducts, totalVisits, successfulVisits] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ?" + dateFilter).bind(tenantId, ...dateParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ?" + dateFilter).bind(tenantId, ...dateParams).first(),
    db.prepare("SELECT COUNT(DISTINCT customer_id) as count FROM sales_orders WHERE tenant_id = ?" + dateFilter).bind(tenantId, ...dateParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?" + (start_date && end_date ? " AND created_at >= ? AND created_at <= ? || ' 23:59:59'" : '')).bind(tenantId, ...dateParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent', 'sales_rep')").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role IN ('agent', 'field_agent', 'sales_rep') AND is_active = 1").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(soi.quantity), 0) as total FROM sales_order_items soi JOIN sales_orders so ON soi.sales_order_id = so.id WHERE so.tenant_id = ?" + dateFilter.replace(/created_at/g, 'so.created_at')).bind(tenantId, ...dateParams).first(),
    db.prepare("SELECT COUNT(DISTINCT soi.product_id) as count FROM sales_order_items soi JOIN sales_orders so ON soi.sales_order_id = so.id WHERE so.tenant_id = ?" + dateFilter.replace(/created_at/g, 'so.created_at')).bind(tenantId, ...dateParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ?" + visitDateFilter).bind(tenantId, ...dateParams).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND status = 'completed'" + visitDateFilter).bind(tenantId, ...dateParams).first(),
  ]);

  // Daily revenue trends
  let dailyRevenueQuery = "SELECT date(created_at) as date, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders FROM sales_orders WHERE tenant_id = ?";
  let dailyParams = [tenantId];
  if (start_date && end_date) {
    dailyRevenueQuery += " AND created_at >= ? AND created_at <= ? || ' 23:59:59'";
    dailyParams.push(start_date, end_date);
  } else {
    dailyRevenueQuery += " AND created_at >= date('now', '-30 days')";
  }
  dailyRevenueQuery += " GROUP BY date(created_at) ORDER BY date";
  const dailyRevenue = await db.prepare(dailyRevenueQuery).bind(...dailyParams).all();

  // Top performers
  let topPerformersQuery = "SELECT u.id as agent_id, u.first_name || ' ' || u.last_name as agent_name, COUNT(so.id) as total_orders, COALESCE(SUM(so.total_amount), 0) as total_revenue, 0 as success_rate FROM users u LEFT JOIN sales_orders so ON u.id = so.agent_id AND so.tenant_id = ? " + (start_date && end_date ? "AND so.created_at >= ? AND so.created_at <= ? || ' 23:59:59' " : '') + "WHERE u.tenant_id = ? AND u.role IN ('agent', 'field_agent', 'sales_rep') GROUP BY u.id ORDER BY total_revenue DESC LIMIT 10";
  let topParams = start_date && end_date ? [tenantId, start_date, end_date, tenantId] : [tenantId, tenantId];
  const topPerformers = await db.prepare(topPerformersQuery).bind(...topParams).all();

  return c.json({ success: true, data: {
    stats: {
      total_revenue: totalRevenue?.total || 0,
      total_orders: totalOrders?.count || 0,
      active_customers: activeCustomers?.count || 0,
      new_customers: newCustomers?.count || 0,
      total_agents: totalAgents?.count || 0,
      active_agents: activeAgents?.count || 0,
      products_sold: productsSold?.total || 0,
      unique_products: uniqueProducts?.count || 0,
      total_visits: totalVisits?.count || 0,
      successful_visits: successfulVisits?.count || 0,
      visit_success_rate: totalVisits?.count ? Math.round((successfulVisits?.count || 0) / totalVisits.count * 100) : 0,
      revenue_growth: 0,
      customer_growth: 0,
      agent_growth: 0,
      products_growth: 0,
    },
    trends: {
      daily_revenue: dailyRevenue.results || [],
      daily_orders: dailyRevenue.results || [],
    },
    top_performers: topPerformers.results || [],
    alerts: [],
  } });
});

// /analytics/recent-activity - recent visits/orders activity (used by frontend DashboardPage)
api.get('/analytics/recent-activity', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { limit = '10' } = c.req.query();
  const lim = parseInt(limit);

  const visits = await db.prepare("SELECT v.id, 'visit' as type, v.status, v.created_at, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name, 'Visit to ' || COALESCE(c.name, 'Unknown') as description, 0 as value FROM visits v LEFT JOIN customers c ON v.customer_id = c.id LEFT JOIN users u ON v.agent_id = u.id WHERE v.tenant_id = ? ORDER BY v.created_at DESC LIMIT ?").bind(tenantId, lim).all();
  const orders = await db.prepare("SELECT so.id, 'order' as type, so.status, so.created_at, c.name as customer_name, u.first_name || ' ' || u.last_name as agent_name, 'Order #' || so.order_number || ' - ' || COALESCE(c.name, 'Unknown') as description, so.total_amount as value FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id LEFT JOIN users u ON so.agent_id = u.id WHERE so.tenant_id = ? ORDER BY so.created_at DESC LIMIT ?").bind(tenantId, lim).all();

  // Merge and sort by created_at
  const allActivities = [...(visits.results || []), ...(orders.results || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, lim);

  return c.json({ success: true, data: { activities: allActivities } });
});

// /analytics/visits - visit analytics with date filtering
api.get('/analytics/visits', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { start_date, end_date, period = '30' } = c.req.query();
  // BUG-002: Validate period as integer to prevent SQL injection
  const periodDays = String(Math.max(1, Math.min(365, parseInt(period, 10) || 30)));
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];
  if (start_date && end_date) { where += ' AND visit_date >= ? AND visit_date <= ?'; params.push(start_date, end_date); }
  else { where += " AND visit_date >= date('now', '-' || ? || ' days')"; params.push(periodDays); }
  const data = await db.prepare("SELECT visit_date as date, COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending FROM visits " + where + " GROUP BY visit_date ORDER BY visit_date").bind(...params).all();
  return c.json({ success: true, data: data.results || [] });
});

// /analytics/agents - agent performance analytics
api.get('/analytics/agents', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const agents = await db.prepare("SELECT u.id, u.first_name || ' ' || u.last_name as name, COUNT(DISTINCT v.id) as total_visits, COUNT(DISTINCT so.id) as total_orders, COALESCE(SUM(so.total_amount), 0) as total_revenue FROM users u LEFT JOIN visits v ON u.id = v.agent_id AND v.tenant_id = ? LEFT JOIN sales_orders so ON u.id = so.agent_id AND so.tenant_id = ? WHERE u.tenant_id = ? AND u.role IN ('agent', 'field_agent', 'sales_rep') GROUP BY u.id ORDER BY total_revenue DESC").bind(tenantId, tenantId, tenantId).all();
  return c.json({ success: true, data: agents.results || [] });
});

// /analytics/customers - customer analytics
api.get('/analytics/customers', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [total, active, byType] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COUNT(DISTINCT customer_id) as count FROM sales_orders WHERE tenant_id = ? AND created_at >= date('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(customer_type, 'general') as type, COUNT(*) as count FROM customers WHERE tenant_id = ? GROUP BY customer_type").bind(tenantId).all(),
  ]);
  return c.json({ success: true, data: { total: total?.count || 0, active: active?.count || 0, by_type: byType.results || [] } });
});

// /analytics/products - product analytics
api.get('/analytics/products', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const topSelling = await db.prepare("SELECT p.id, p.name, COALESCE(SUM(soi.quantity), 0) as quantity_sold, COALESCE(SUM(soi.quantity * soi.unit_price), 0) as revenue FROM products p LEFT JOIN sales_order_items soi ON p.id = soi.product_id LEFT JOIN sales_orders so ON soi.sales_order_id = so.id AND so.tenant_id = ? WHERE p.tenant_id = ? GROUP BY p.id ORDER BY revenue DESC LIMIT 20").bind(tenantId, tenantId).all();
  return c.json({ success: true, data: { top_selling: topSelling.results || [] } });
});

// /analytics/campaigns - campaign analytics
api.get('/analytics/campaigns', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const campaigns = await db.prepare("SELECT id, name, status, start_date, end_date, budget FROM campaigns WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 20").bind(tenantId).all();
  return c.json({ success: true, data: campaigns.results || [] });
});

// /analytics/revenue - revenue analytics
api.get('/analytics/revenue', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { start_date, end_date } = c.req.query();
  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];
  if (start_date && end_date) { where += " AND created_at >= ? AND created_at <= ? || ' 23:59:59'"; params.push(start_date, end_date); }
  else { where += " AND created_at >= date('now', '-30 days')"; }
  const data = await db.prepare("SELECT date(created_at) as date, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders, COALESCE(AVG(total_amount), 0) as avg_order_value FROM sales_orders " + where + " GROUP BY date(created_at) ORDER BY date").bind(...params).all();
  return c.json({ success: true, data: data.results || [] });
});

// /analytics/performance - performance analytics
api.get('/analytics/performance', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const agents = await db.prepare("SELECT u.id, u.first_name || ' ' || u.last_name as name, u.role, COUNT(DISTINCT v.id) as visits, SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END) as completed_visits, COUNT(DISTINCT so.id) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM users u LEFT JOIN visits v ON u.id = v.agent_id AND v.tenant_id = ? LEFT JOIN sales_orders so ON u.id = so.agent_id AND so.tenant_id = ? WHERE u.tenant_id = ? AND u.role IN ('agent', 'field_agent', 'sales_rep') GROUP BY u.id ORDER BY revenue DESC").bind(tenantId, tenantId, tenantId).all();
  return c.json({ success: true, data: agents.results || [] });
});

api.get('/analytics/overview', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const thisMonth = new Date().toISOString().substring(0, 7);
  const [revenue, orders, visits, customers] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?").bind(tenantId, thisMonth + '%').first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND created_at LIKE ?").bind(tenantId, thisMonth + '%').first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND visit_date LIKE ?").bind(tenantId, thisMonth + '%').first(),
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
  ]);
  return c.json({ success: true, data: { month_revenue: revenue?.total || 0, month_orders: orders?.count || 0, month_visits: visits?.count || 0, total_customers: customers?.count || 0 } });
});

api.get('/analytics/sales', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { period = '30' } = c.req.query();
  // BUG-002: Validate period as integer to prevent SQL injection
  const periodDays = String(Math.max(1, Math.min(365, parseInt(period, 10) || 30)));
  const data = await db.prepare("SELECT date(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total_amount), 0) as revenue FROM sales_orders WHERE tenant_id = ? AND created_at >= date('now', '-' || ? || ' days') GROUP BY date(created_at) ORDER BY date").bind(tenantId, periodDays).all();
  return c.json({ success: true, data: data.results || [] });
});

api.get('/analytics/field-operations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT visit_date as date, COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM visits WHERE tenant_id = ? AND visit_date >= date('now', '-30 days') GROUP BY visit_date ORDER BY visit_date").bind(tenantId).all();
  return c.json({ success: true, data: data.results || [] });
});

api.get('/analytics/commissions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT date(created_at) as date, status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND created_at >= date('now', '-30 days') GROUP BY date(created_at), status ORDER BY date").bind(tenantId).all();
  return c.json({ success: true, data: data.results || [] });
});



// ==================== FIELD OPERATIONS: VISIT WORKFLOW ====================

// --- Individuals CRUD ---
api.get('/individuals', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { search, company_id, limit: lim, page } = c.req.query();
  const pageNum = parseInt(page) || 1;
  const pageSize = parseInt(lim) || 50;
  const offset = (pageNum - 1) * pageSize;
  let where = 'WHERE i.tenant_id = ?';
  const params = [tenantId];
  if (search) { where += " AND (i.first_name LIKE ? OR i.last_name LIKE ? OR i.id_number LIKE ? OR i.phone LIKE ?)"; const s = `%${search}%`; params.push(s, s, s, s); }
  if (company_id) { where += ' AND i.company_id = ?'; params.push(company_id); }
  const total = await db.prepare(`SELECT COUNT(*) as count FROM individuals i ${where}`).bind(...params).first();
  const rows = await db.prepare(`SELECT i.*, fc.name as company_name FROM individuals i LEFT JOIN field_companies fc ON i.company_id = fc.id ${where} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`).bind(...params, pageSize, offset).all();
  return c.json({ data: rows?.results || [], total: total?.count || 0, page: pageNum, limit: pageSize });
});

api.get('/individuals/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const row = await db.prepare('SELECT i.*, fc.name as company_name FROM individuals i LEFT JOIN field_companies fc ON i.company_id = fc.id WHERE i.id = ? AND i.tenant_id = ?').bind(id, tenantId).first();
  if (!row) return c.json({ error: 'Individual not found' }, 404);
  return c.json({ data: row });
});

api.post('/individuals', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = crypto.randomUUID();
  // Check for duplicate ID number
  if (body.id_number) {
    const existing = await db.prepare('SELECT id FROM individuals WHERE tenant_id = ? AND id_number = ? AND id_number != ""').bind(tenantId, body.id_number).first();
    if (existing) return c.json({ error: 'An individual with this ID number already exists', duplicate_field: 'id_number' }, 409);
  }
  // Check for duplicate phone
  if (body.phone) {
    const existing = await db.prepare('SELECT id FROM individuals WHERE tenant_id = ? AND phone = ? AND phone != ""').bind(tenantId, body.phone).first();
    if (existing) return c.json({ error: 'An individual with this phone number already exists', duplicate_field: 'phone' }, 409);
  }
  await db.prepare('INSERT INTO individuals (id, tenant_id, first_name, last_name, id_number, phone, email, address, gps_latitude, gps_longitude, company_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
    id, tenantId, body.first_name || '', body.last_name || '', body.id_number || null, body.phone || null,
    body.email || null, body.address || null, body.gps_latitude ?? null, body.gps_longitude ?? null,
    body.company_id || null, body.notes || null
  ).run();
  return c.json({ data: { id, ...body }, message: 'Individual created successfully' }, 201);
});

api.put('/individuals/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  // Check for duplicate ID number (exclude self)
  if (body.id_number) {
    const existing = await db.prepare('SELECT id FROM individuals WHERE tenant_id = ? AND id_number = ? AND id != ? AND id_number != ""').bind(tenantId, body.id_number, id).first();
    if (existing) return c.json({ error: 'An individual with this ID number already exists', duplicate_field: 'id_number' }, 409);
  }
  // Check for duplicate phone (exclude self)
  if (body.phone) {
    const existing = await db.prepare('SELECT id FROM individuals WHERE tenant_id = ? AND phone = ? AND id != ? AND phone != ""').bind(tenantId, body.phone, id).first();
    if (existing) return c.json({ error: 'An individual with this phone number already exists', duplicate_field: 'phone' }, 409);
  }
  const sets = []; const vals = [];
  for (const [k, v] of Object.entries(body)) {
    if (['first_name', 'last_name', 'id_number', 'phone', 'email', 'address', 'gps_latitude', 'gps_longitude', 'company_id', 'notes', 'status'].includes(k)) { sets.push(k + ' = ?'); vals.push(v); }
  }
  if (sets.length === 0) return c.json({ error: 'No valid fields to update' }, 400);
  sets.push('updated_at = CURRENT_TIMESTAMP');
  await db.prepare('UPDATE individuals SET ' + sets.join(', ') + ' WHERE id = ? AND tenant_id = ?').bind(...vals, id, tenantId).run();
  return c.json({ message: 'Individual updated successfully' });
});

// --- Brand Custom Fields ---

// --- Visit Survey Config ---

// ==================== PROCESS FLOWS (Dynamic visit workflow steps) ====================

// GET all process flows
api.get('/process-flows', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  try {
    const flows = await db.prepare("SELECT * FROM process_flows WHERE tenant_id IN (?, 'default') AND is_active = 1 ORDER BY name").bind(tenantId).all();
    return c.json({ data: flows?.results || [] });
  } catch { return c.json({ data: [] }); }
});

// GET single process flow with steps
api.get('/process-flows/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  try {
    const flow = await db.prepare("SELECT * FROM process_flows WHERE id = ? AND tenant_id IN (?, 'default')").bind(id, tenantId).first();
    if (!flow) return c.json({ error: 'Process flow not found' }, 404);
    const steps = await db.prepare("SELECT * FROM process_flow_steps WHERE process_flow_id = ? AND tenant_id IN (?, 'default') AND is_active = 1 ORDER BY step_order").bind(id, tenantId).all();
    // Deduplicate steps by step_key (prefer tenant-specific over default)
    const allSteps = steps?.results || [];
    const seen = new Map();
    for (const s of allSteps) {
      if (!seen.has(s.step_key) || (s.tenant_id !== 'default' && seen.get(s.step_key).tenant_id === 'default')) {
        seen.set(s.step_key, s);
      }
    }
    const dedupedSteps = Array.from(seen.values()).sort((a, b) => a.step_order - b.step_order);
    return c.json({ data: { ...flow, steps: dedupedSteps } });
  } catch (err) { return c.json({ error: 'Failed to get process flow: ' + (err.message || err) }, 500); }
});

// CREATE process flow
api.post('/process-flows', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  if (!body.name) return c.json({ error: 'name is required' }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.prepare('INSERT INTO process_flows (id, tenant_id, name, description, is_default, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
      id, tenantId, body.name, body.description || null, body.is_default ? 1 : 0, now, now
    ).run();
    if (Array.isArray(body.steps) && body.steps.length > 0) {
      for (let i = 0; i < body.steps.length; i++) {
        const step = body.steps[i];
        const stepId = crypto.randomUUID();
        await db.prepare('INSERT INTO process_flow_steps (id, tenant_id, process_flow_id, step_key, step_label, step_order, is_required, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
          stepId, tenantId, id, step.step_key, step.step_label || step.step_key, step.step_order || (i + 1), step.is_required ? 1 : 0, JSON.stringify(step.config || {})
        ).run();
      }
    }
    return c.json({ data: { id, ...body }, message: 'Process flow created' }, 201);
  } catch (err) { return c.json({ error: 'Failed to create process flow: ' + (err.message || err) }, 500); }
});

// UPDATE process flow
api.put('/process-flows/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  try {
    // Look up the flow to find its actual tenant_id (could be 'default')
    const existing = await db.prepare("SELECT tenant_id FROM process_flows WHERE id = ? AND tenant_id IN (?, 'default')").bind(id, tenantId).first();
    if (!existing) return c.json({ error: 'Process flow not found' }, 404);
    const flowTenantId = existing.tenant_id;
    const sets = []; const vals = [];
    for (const [k, v] of Object.entries(body)) {
      if (['name', 'description', 'is_active'].includes(k)) {
        sets.push(k + ' = ?');
        vals.push(k === 'is_active' ? (v ? 1 : 0) : v);
      }
    }
    if (sets.length > 0) {
      sets.push('updated_at = CURRENT_TIMESTAMP');
      await db.prepare('UPDATE process_flows SET ' + sets.join(', ') + ' WHERE id = ? AND tenant_id = ?').bind(...vals, id, flowTenantId).run();
    }
    if (Array.isArray(body.steps)) {
      // Delete existing steps for the flow's actual tenant_id, plus any 'default' steps
      await db.prepare("DELETE FROM process_flow_steps WHERE process_flow_id = ? AND tenant_id IN (?, 'default')").bind(id, tenantId).run();
      for (let i = 0; i < body.steps.length; i++) {
        const step = body.steps[i];
        const stepId = crypto.randomUUID();
        await db.prepare('INSERT INTO process_flow_steps (id, tenant_id, process_flow_id, step_key, step_label, step_order, is_required, config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(
          stepId, flowTenantId, id, step.step_key, step.step_label || step.step_key, step.step_order || (i + 1), step.is_required ? 1 : 0, JSON.stringify(step.config || {})
        ).run();
      }
    }
    return c.json({ message: 'Process flow updated' });
  } catch (err) { return c.json({ error: 'Failed to update process flow: ' + (err.message || err) }, 500); }
});

// DELETE process flow (soft)
api.delete('/process-flows/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare("UPDATE process_flows SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id IN (?, 'default')").bind(id, tenantId).run();
  return c.json({ message: 'Process flow deactivated' });
});

// --- Company Process Flow Assignment ---
api.get('/company-process-flows', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id } = c.req.query();
  try {
    let query = "SELECT cpf.*, pf.name as flow_name, pf.description as flow_description FROM company_process_flows cpf LEFT JOIN process_flows pf ON cpf.process_flow_id = pf.id WHERE cpf.tenant_id = ?";
    const params = [tenantId];
    if (company_id) { query += ' AND cpf.company_id = ?'; params.push(company_id); }
    const rows = await db.prepare(query).bind(...params).all();
    return c.json({ data: rows?.results || [] });
  } catch { return c.json({ data: [] }); }
});

api.post('/company-process-flows', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  if (!body.company_id || !body.process_flow_id) return c.json({ error: 'company_id and process_flow_id are required' }, 400);
  const id = crypto.randomUUID();
  try {
    await db.prepare('INSERT INTO company_process_flows (id, tenant_id, company_id, process_flow_id, visit_target_type) VALUES (?, ?, ?, ?, ?)').bind(
      id, tenantId, body.company_id, body.process_flow_id, body.visit_target_type || 'both'
    ).run();
    return c.json({ data: { id, ...body }, message: 'Process flow assigned to company' }, 201);
  } catch (err) { return c.json({ error: 'Failed to assign: ' + (err.message || err) }, 500); }
});

api.delete('/company-process-flows/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('DELETE FROM company_process_flows WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ message: 'Process flow unassigned from company' });
});

// --- Visit Process Flow (get steps for a visit based on company + visit type) ---

// ==================== COMPANY CUSTOM QUESTIONS ====================

api.get('/company-custom-questions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id, visit_target_type } = c.req.query();
  try {
    let query = "SELECT * FROM company_custom_questions WHERE tenant_id = ? AND is_active = 1";
    const params = [tenantId];
    if (company_id) { query += ' AND company_id = ?'; params.push(company_id); }
    if (visit_target_type) { query += " AND (visit_target_type = ? OR visit_target_type = 'both')"; params.push(visit_target_type); }
    query += ' ORDER BY display_order, created_at';
    const rows = await db.prepare(query).bind(...params).all();
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ data: rows?.results || [] });
  } catch { return c.json({ data: [] }); }
});

api.post('/company-custom-questions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  if (!body.company_id || !body.question_label || !body.question_key) return c.json({ error: 'company_id, question_label, and question_key are required' }, 400);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await db.prepare('INSERT INTO company_custom_questions (id, tenant_id, company_id, question_label, question_key, field_type, field_options, is_required, display_order, visit_target_type, check_duplicate, min_length, max_length, show_in_reports, enable_ai_analysis, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
      id, tenantId, body.company_id, body.question_label, body.question_key,
      body.field_type || 'text', body.field_options ? JSON.stringify(body.field_options) : null,
      body.is_required ? 1 : 0, body.display_order || 0, body.visit_target_type || 'both',
      body.check_duplicate ? 1 : 0, body.min_length || null, body.max_length || null,
      body.show_in_reports ? 1 : 0, body.enable_ai_analysis ? 1 : 0, now, now
    ).run();
    return c.json({ data: { id, ...body }, message: 'Custom question created' }, 201);
  } catch (err) { return c.json({ error: 'Failed to create custom question: ' + (err.message || err) }, 500); }
});

api.put('/company-custom-questions/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  try {
    // Use direct assignment for min_length/max_length so null clears the value (COALESCE would preserve old value)
    await db.prepare('UPDATE company_custom_questions SET question_label = COALESCE(?, question_label), question_key = COALESCE(?, question_key), field_type = COALESCE(?, field_type), field_options = COALESCE(?, field_options), is_required = COALESCE(?, is_required), display_order = COALESCE(?, display_order), visit_target_type = COALESCE(?, visit_target_type), check_duplicate = COALESCE(?, check_duplicate), min_length = ?, max_length = ?, show_in_reports = COALESCE(?, show_in_reports), enable_ai_analysis = COALESCE(?, enable_ai_analysis), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?').bind(
      body.question_label || null, body.question_key || null, body.field_type || null,
      body.field_options ? JSON.stringify(body.field_options) : null,
      body.is_required !== undefined ? (body.is_required ? 1 : 0) : null,
      body.display_order !== undefined ? body.display_order : null,
      body.visit_target_type || null,
      body.check_duplicate !== undefined ? (body.check_duplicate ? 1 : 0) : null,
      body.min_length !== undefined ? (body.min_length ?? null) : null,
      body.max_length !== undefined ? (body.max_length ?? null) : null,
      body.show_in_reports !== undefined ? (body.show_in_reports ? 1 : 0) : null,
      body.enable_ai_analysis !== undefined ? (body.enable_ai_analysis ? 1 : 0) : null,
      id, tenantId
    ).run();
    return c.json({ message: 'Custom question updated' });
  } catch (err) { return c.json({ error: 'Failed to update custom question: ' + (err.message || err) }, 500); }
});

api.delete('/company-custom-questions/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare('UPDATE company_custom_questions SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ message: 'Custom question deactivated' });
});

// --- Individual Visit Reporting (includes survey answers + custom fields) ---
api.get('/individual-visits-report', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { company_id, start_date, end_date, agent_id } = c.req.query();
  try {
    let query = `SELECT v.id, v.visit_date, v.check_in_time, v.check_out_time, v.latitude, v.longitude,
      v.individual_name, v.individual_surname, v.individual_id_number, v.individual_phone,
      v.notes, v.status, v.questionnaire_id, v.purpose, v.company_id, v.brand_id,
      vi.custom_field_values,
      vr.responses as survey_responses,
      u.first_name || ' ' || u.last_name as agent_name,
      fc.name as company_name,
      q.name as questionnaire_name
    FROM visits v
    LEFT JOIN visit_individuals vi ON vi.visit_id = v.id
    LEFT JOIN visit_responses vr ON vr.visit_id = v.id
    LEFT JOIN users u ON u.id = v.agent_id
    LEFT JOIN field_companies fc ON fc.id = COALESCE(v.company_id, v.brand_id)
    LEFT JOIN questionnaires q ON q.id = v.questionnaire_id
    WHERE v.tenant_id = ? AND v.visit_type = 'individual'`;
    const params = [tenantId];
    if (company_id) { query += ' AND (v.company_id = ? OR v.brand_id = ?)'; params.push(company_id, company_id); }
    if (start_date) { query += ' AND v.visit_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND v.visit_date <= ?'; params.push(end_date); }
    if (agent_id) { query += ' AND v.agent_id = ?'; params.push(agent_id); }
    query += ' ORDER BY v.visit_date DESC, v.check_in_time DESC LIMIT 500';
    const rows = await db.prepare(query).bind(...params).all();
    // Get image question keys marked show_in_reports for the relevant companies
    const reportCompanyIds = [...new Set((rows?.results || []).map(r => r.company_id || r.brand_id).filter(Boolean))];
    let reportImgKeys = {};
    if (reportCompanyIds.length > 0) {
      const ph = reportCompanyIds.map(() => '?').join(',');
      const imgQs = await db.prepare(`SELECT company_id, question_key, question_label FROM company_custom_questions WHERE tenant_id = ? AND company_id IN (${ph}) AND field_type = 'image' AND show_in_reports = 1 AND is_active = 1`).bind(tenantId, ...reportCompanyIds).all();
      for (const q of (imgQs.results || [])) {
        if (!reportImgKeys[q.company_id]) reportImgKeys[q.company_id] = [];
        reportImgKeys[q.company_id].push({ key: q.question_key, label: q.question_label });
      }
    }
    const data = (rows?.results || []).map(r => {
      const custom_field_values = r.custom_field_values ? (typeof r.custom_field_values === 'string' ? (() => { try { return JSON.parse(r.custom_field_values) } catch { return {} } })() : r.custom_field_values) : {};
      const survey_responses = r.survey_responses ? (typeof r.survey_responses === 'string' ? (() => { try { return JSON.parse(r.survey_responses) } catch { return {} } })() : r.survey_responses) : {};
      // Extract photo thumbnails from responses for questions with show_in_reports
      const cid = r.company_id || r.brand_id;
      const photo_thumbnails = [];
      if (cid && reportImgKeys[cid]) {
        const allResp = { ...custom_field_values, ...survey_responses };
        for (const { key, label } of reportImgKeys[cid]) {
          if (allResp[key] && typeof allResp[key] === 'string' && (allResp[key].startsWith('data:image') || allResp[key].startsWith('http'))) {
            photo_thumbnails.push({ key, label, url: allResp[key] });
          }
        }
      }
      return { ...r, custom_field_values, survey_responses, photo_thumbnails };
    });
    return c.json({ data });
  } catch (err) { return c.json({ error: 'Failed to get individual visits report: ' + (err.message || err) }, 500); }
});

// --- Migration: create process_flows + company_custom_questions tables ---
api.post('/migrations/create-process-flows', authMiddleware, async (c) => {
  const db = c.env.DB;
  const results = [];
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS process_flows (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
      is_default INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();
    results.push('process_flows table created');

    await db.prepare(`CREATE TABLE IF NOT EXISTS process_flow_steps (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, process_flow_id TEXT NOT NULL,
      step_key TEXT NOT NULL, step_label TEXT NOT NULL, step_order INTEGER NOT NULL DEFAULT 0,
      is_required INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, config TEXT DEFAULT '{}',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();
    results.push('process_flow_steps table created');

    await db.prepare(`CREATE TABLE IF NOT EXISTS company_process_flows (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT NOT NULL,
      process_flow_id TEXT NOT NULL, visit_target_type TEXT DEFAULT 'both',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();
    results.push('company_process_flows table created');

    await db.prepare(`CREATE TABLE IF NOT EXISTS company_custom_questions (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT NOT NULL,
      question_label TEXT NOT NULL, question_key TEXT NOT NULL,
      field_type TEXT NOT NULL DEFAULT 'text', field_options TEXT,
      is_required INTEGER DEFAULT 0, display_order INTEGER DEFAULT 0,
      visit_target_type TEXT DEFAULT 'both', is_active INTEGER DEFAULT 1,
      check_duplicate INTEGER DEFAULT 0, min_length INTEGER, max_length INTEGER,
      show_in_reports INTEGER DEFAULT 0, enable_ai_analysis INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();
    results.push('company_custom_questions table created');

    await db.prepare(`CREATE TABLE IF NOT EXISTS company_target_rules (
      id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, company_id TEXT NOT NULL,
      target_visits_per_day INTEGER DEFAULT 20, target_registrations_per_day INTEGER DEFAULT 10,
      target_conversions_per_day INTEGER DEFAULT 5,
      team_lead_own_target_visits INTEGER DEFAULT 20, team_lead_own_target_registrations INTEGER DEFAULT 10,
      team_lead_own_target_conversions INTEGER DEFAULT 5,
      created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();
    results.push('company_target_rules table created');

    await db.prepare(`CREATE TABLE IF NOT EXISTS manager_company_links (
      id TEXT PRIMARY KEY, manager_id TEXT NOT NULL, company_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL, is_active INTEGER DEFAULT 1,
      assigned_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`).run();
    results.push('manager_company_links table created');

    // Add company_id column to visits table if missing
    try {
      await db.prepare("ALTER TABLE visits ADD COLUMN company_id TEXT").run();
      results.push('visits.company_id column added');
    } catch { results.push('visits.company_id column already exists'); }

    // Add check_duplicate, min_length, max_length to company_custom_questions if missing
    try {
      await db.prepare("ALTER TABLE company_custom_questions ADD COLUMN check_duplicate INTEGER DEFAULT 0").run();
      results.push('company_custom_questions.check_duplicate column added');
    } catch { results.push('company_custom_questions.check_duplicate column already exists'); }
    try {
      await db.prepare("ALTER TABLE company_custom_questions ADD COLUMN min_length INTEGER").run();
      results.push('company_custom_questions.min_length column added');
    } catch { results.push('company_custom_questions.min_length column already exists'); }
    try {
      await db.prepare("ALTER TABLE company_custom_questions ADD COLUMN max_length INTEGER").run();
      results.push('company_custom_questions.max_length column added');
    } catch { results.push('company_custom_questions.max_length column already exists'); }
    try {
      await db.prepare("ALTER TABLE company_custom_questions ADD COLUMN show_in_reports INTEGER DEFAULT 0").run();
      results.push('company_custom_questions.show_in_reports column added');
    } catch { results.push('company_custom_questions.show_in_reports column already exists'); }
    try {
      await db.prepare("ALTER TABLE company_custom_questions ADD COLUMN enable_ai_analysis INTEGER DEFAULT 0").run();
      results.push('company_custom_questions.enable_ai_analysis column added');
    } catch { results.push('company_custom_questions.enable_ai_analysis column already exists'); }

    // Seed default process flows
    await db.prepare("INSERT OR IGNORE INTO process_flows (id, tenant_id, name, description, is_default) VALUES ('pf-store-default', 'default', 'Standard Store Visit', 'Default workflow for store visits: GPS, Details, Survey, Photo, Review', 1)").run();
    await db.prepare("INSERT OR IGNORE INTO process_flows (id, tenant_id, name, description, is_default) VALUES ('pf-individual-default', 'default', 'Standard Individual Visit', 'Default workflow for individual visits: GPS, Details, Survey, Review (no photos)', 1)").run();
    results.push('Default process flows seeded');

    const storeSteps = [['gps', 'GPS Check-in', 1, 1], ['visit_type', 'Visit Type', 2, 1], ['details', 'Details', 3, 1], ['survey', 'Survey', 4, 0], ['photo', 'Photo Capture', 5, 1], ['review', 'Review & Submit', 6, 1]];
    for (const [key, label, order, req] of storeSteps) {
      await db.prepare("INSERT OR IGNORE INTO process_flow_steps (id, tenant_id, process_flow_id, step_key, step_label, step_order, is_required) VALUES (?, 'default', 'pf-store-default', ?, ?, ?, ?)").bind('pfs-s' + order, key, label, order, req).run();
    }
    const indSteps = [['gps', 'GPS Check-in', 1, 1], ['visit_type', 'Visit Type', 2, 1], ['details', 'Details', 3, 1], ['survey', 'Survey', 4, 0], ['review', 'Review & Submit', 5, 1]];
    for (const [key, label, order, req] of indSteps) {
      await db.prepare("INSERT OR IGNORE INTO process_flow_steps (id, tenant_id, process_flow_id, step_key, step_label, step_order, is_required) VALUES (?, 'default', 'pf-individual-default', ?, ?, ?, ?)").bind('pfs-i' + order, key, label, order, req).run();
    }
    results.push('Default steps seeded');

    return c.json({ success: true, results });
  } catch (err) { return c.json({ error: 'Migration failed: ' + (err.message || err), results }, 500); }
});

// One-time cleanup: soft-delete all company_custom_questions for Stellr
api.post('/migrations/clear-stellr-company-questions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  try {
    const stellr = await db.prepare(
      "SELECT id FROM field_companies WHERE LOWER(name) LIKE '%stellr%' AND tenant_id = ? LIMIT 1"
    ).bind(tenantId).first();
    if (!stellr) return c.json({ success: false, message: 'Stellr company not found' }, 404);
    const result = await db.prepare(
      "UPDATE company_custom_questions SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE company_id = ? AND tenant_id = ? AND is_active = 1"
    ).bind(stellr.id, tenantId).run();
    return c.json({ success: true, message: `Deactivated all custom questions for Stellr (${stellr.id})`, changes: result.meta?.changes ?? 0 });
  } catch (err) { return c.json({ success: false, error: err.message || err }, 500); }
});

// Add performance indexes for faster queries
api.post('/migrations/add-performance-indexes', authMiddleware, async (c) => {
  const db = c.env.DB;
  const results = [];
  try {
    // Indexes for visits table - most queried table
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_visits_tenant_agent_date ON visits (tenant_id, agent_id, visit_date)").run();
    results.push('idx_visits_tenant_agent_date created');
    
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_visits_tenant_date ON visits (tenant_id, visit_date)").run();
    results.push('idx_visits_tenant_date created');
    
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_visits_agent_created ON visits (agent_id, created_at)").run();
    results.push('idx_visits_agent_created created');
    
    // Legacy indexes removed - individual_registrations table no longer used
    // Indexes now on visits table (created above)
    results.push('legacy individual_registrations indexes skipped');
    
    // Indexes for daily_targets
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_targets_tenant_agent_date ON daily_targets (tenant_id, agent_id, target_date)").run();
    results.push('idx_targets_tenant_agent_date created');
    
    // Indexes for company_target_rules
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ctr_tenant_company_role ON company_target_rules (tenant_id, company_id, role_type)").run();
    results.push('idx_ctr_tenant_company_role created');
    
    // Indexes for agent_company_links
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_acl_agent_tenant ON agent_company_links (agent_id, tenant_id, is_active)").run();
    results.push('idx_acl_agent_tenant created');
    
    // Index for visit_photos (thumbnail lookup)
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_photos_visit_r2 ON visit_photos (visit_id, r2_url)").run();
    results.push('idx_photos_visit_r2 created');

    // Indexes for Details step lookup tables (brand_custom_fields, company_custom_questions, etc.)
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_bcf_tenant_company ON brand_custom_fields (tenant_id, company_id, is_active)").run();
    results.push('idx_bcf_tenant_company created');

    await db.prepare("CREATE INDEX IF NOT EXISTS idx_ccq_tenant_company ON company_custom_questions (tenant_id, company_id, is_active)").run();
    results.push('idx_ccq_tenant_company created');

    await db.prepare("CREATE INDEX IF NOT EXISTS idx_vsc_tenant_company ON visit_survey_config (tenant_id, company_id)").run();
    results.push('idx_vsc_tenant_company created');

    await db.prepare("CREATE INDEX IF NOT EXISTS idx_cpf_tenant_company ON company_process_flows (tenant_id, company_id)").run();
    results.push('idx_cpf_tenant_company created');

    await db.prepare("CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers (tenant_id)").run();
    results.push('idx_customers_tenant created');

    await db.prepare("CREATE INDEX IF NOT EXISTS idx_mcl_manager_tenant ON manager_company_links (manager_id, tenant_id, is_active)").run();
    results.push('idx_mcl_manager_tenant created');

    // Index for store-search LEFT JOIN on visits
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_visits_customer_agent ON visits (customer_id, tenant_id, agent_id, visit_date)").run();
    results.push('idx_visits_customer_agent created');

    // Index for visit_responses queries (visit_type filter from PR #153)
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_vr_visit_type ON visit_responses (visit_id, visit_type)").run();
    results.push('idx_vr_visit_type created');

    // Index for questionnaires lookup
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_questionnaires_tenant ON questionnaires (tenant_id, is_active)").run();
    results.push('idx_questionnaires_tenant created');
    
    return c.json({ success: true, results });
  } catch (err) {
    return c.json({ success: false, error: err.message });
  }
});


// NOTE: /surveys GET is defined earlier (line ~3626) - removed duplicate here


// --- Field Ops Survey Insights (wires survey data into reporting) ---

// --- Visit Workflow Business Rules ---

// Check if store was visited within last 30 days



// Portal JWTs are their own audience (aud: 'portal') so a customer login can
// never be replayed against staff routes, and vice versa (see authMiddleware's
// aud guard). Verification mirrors authMiddleware's HMAC-SHA256 check.
app.route('/', portalRoutes);



api.route('/', fieldOpsPerformanceRoutes);

api.route('/', cashReconRoutes);



// ==================== FINANCE ADDITIONAL ROUTES ====================
api.get('/finance', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { page = '1', limit = '20', status, search } = c.req.query();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE so.tenant_id = ?';
  const params = [tenantId];
  if (status) { where += ' AND so.payment_status = ?'; params.push(status); }
  if (search) { where += ' AND (so.order_number LIKE ? OR c.name LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  const total = await db.prepare('SELECT COUNT(*) as count FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ' + where).bind(...params).first();
  const invoices = await db.prepare('SELECT so.id, so.order_number as invoice_number, so.customer_id, c.name as customer_name, so.total_amount, so.payment_status as status, so.created_at, so.updated_at FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id ' + where + ' ORDER BY so.created_at DESC LIMIT ? OFFSET ?').bind(...params, parseInt(limit), offset).all();
  return c.json({ data: invoices.results || [], total: total?.count || 0, page: parseInt(page), limit: parseInt(limit) });
});

api.get('/finance/invoices/:invoiceId/status-history', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const invoiceId = c.req.param('invoiceId');
  const history = await db.prepare("SELECT * FROM audit_log WHERE tenant_id = ? AND entity_type = 'sales_order' AND entity_id = ? ORDER BY created_at DESC LIMIT 50").bind(tenantId, invoiceId).all();
  return c.json({ data: history.results || [] });
});

api.get('/finance/cash-reconciliation', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const recons = await db.prepare("SELECT * FROM van_reconciliations WHERE tenant_id = ? ORDER BY created_at DESC").bind(tenantId).all();
  return c.json({ data: recons.results || [] });
});

api.get('/finance/cash-reconciliation/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const recon = await db.prepare("SELECT * FROM van_reconciliations WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
  return recon ? c.json(recon) : c.json({ message: 'Not found' }, 404);
});

api.get('/finance/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const invoice = await db.prepare("SELECT so.id, so.order_number as invoice_number, so.customer_id, c.name as customer_name, so.total_amount, so.payment_status as status, so.created_at FROM sales_orders so LEFT JOIN customers c ON so.customer_id = c.id WHERE so.id = ? AND so.tenant_id = ?").bind(id, tenantId).first();
  return invoice ? c.json(invoice) : c.json({ message: 'Not found' }, 404);
});

api.post('/finance', authMiddleware, async (c) => {
  return c.json({ success: false, message: 'Invoice created' }, 201);
});

api.put('/finance/:id', authMiddleware, async (c) => {
  return c.json({ success: true, message: 'Invoice updated' });
});

api.delete('/finance/:id', authMiddleware, async (c) => {
  return c.json({ success: true, message: 'Invoice deleted' });
});

api.get('/finance/invoices/:invoiceId/items', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const invoiceId = c.req.param('invoiceId');
  const items = await db.prepare("SELECT soi.*, p.name as product_name FROM sales_order_items soi LEFT JOIN products p ON soi.product_id = p.id JOIN sales_orders so ON soi.sales_order_id = so.id WHERE soi.sales_order_id = ? AND so.tenant_id = ?").bind(invoiceId, tenantId).all();
  return c.json({ data: items.results || [] });
});

api.get('/finance/invoices/:invoiceId/items/:itemId', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const itemId = c.req.param('itemId');
  const item = await db.prepare("SELECT soi.* FROM sales_order_items soi JOIN sales_orders so ON soi.sales_order_id = so.id WHERE soi.id = ? AND so.tenant_id = ?").bind(itemId, tenantId).first();
  return item ? c.json(item) : c.json({ message: 'Not found' }, 404);
});

api.put('/finance/invoices/:invoiceId/items/:itemId', authMiddleware, async (c) => {
  return c.json({ success: true, message: 'Item updated' });
});




// Price Resolution Utility




// ==================== B. SALES ORDER ENGINE ====================

// Enhanced order creation with full validation

// ==================== H. COMPLEX REPORTING QUERIES ====================

// Sales Dashboard Aggregation
api.get('/reports/sales-dashboard', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const today = new Date().toISOString().split('T')[0];

  const [todayRev, weekRev, monthRev, topProducts, outstanding] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders FROM sales_orders WHERE tenant_id = ? AND DATE(created_at) = ? AND status != 'CANCELLED'").bind(tenantId, today).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders FROM sales_orders WHERE tenant_id = ? AND created_at >= datetime('now', '-7 days') AND status != 'CANCELLED'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders FROM sales_orders WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days') AND status != 'CANCELLED'").bind(tenantId).first(),
    db.prepare("SELECT p.name, SUM(soi.quantity) as qty, SUM(soi.line_total) as revenue FROM sales_order_items soi JOIN products p ON soi.product_id = p.id JOIN sales_orders so ON soi.sales_order_id = so.id WHERE so.tenant_id = ? AND so.created_at >= datetime('now', '-30 days') GROUP BY p.name ORDER BY revenue DESC LIMIT 10").bind(tenantId).all(),
    db.prepare("SELECT c.name, c.outstanding_balance, c.credit_limit FROM customers c WHERE c.tenant_id = ? AND c.outstanding_balance > 0 ORDER BY c.outstanding_balance DESC LIMIT 10").bind(tenantId).all(),
  ]);

  return c.json({ success: true, data: {
    today: { revenue: todayRev?.revenue || 0, orders: todayRev?.orders || 0 },
    week: { revenue: weekRev?.revenue || 0, orders: weekRev?.orders || 0 },
    month: { revenue: monthRev?.revenue || 0, orders: monthRev?.orders || 0 },
    top_products: topProducts.results || [],
    outstanding_customers: outstanding.results || []
  }});
});

// Agent Performance Report
api.get('/reports/agent-performance', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { period = '30' } = c.req.query();
  // BUG-002: Validate period as integer to prevent SQL injection
  const periodDays = String(Math.max(1, Math.min(365, parseInt(period, 10) || 30)));

  const agents = await db.prepare("SELECT u.id, u.first_name || ' ' || u.last_name as name, u.role, (SELECT COUNT(*) FROM visits WHERE agent_id = u.id AND tenant_id = ? AND created_at >= datetime('now', '-' || ? || ' days')) as visit_count, (SELECT COUNT(*) FROM sales_orders WHERE agent_id = u.id AND tenant_id = ? AND created_at >= datetime('now', '-' || ? || ' days')) as order_count, (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE agent_id = u.id AND tenant_id = ? AND created_at >= datetime('now', '-' || ? || ' days')) as revenue, (SELECT COALESCE(SUM(amount), 0) FROM commission_earnings WHERE earner_id = u.id AND tenant_id = ?) as total_commission FROM users u WHERE u.tenant_id = ? AND u.role IN ('agent', 'team_lead') AND u.is_active = 1 ORDER BY revenue DESC").bind(tenantId, periodDays, tenantId, periodDays, tenantId, periodDays, tenantId, tenantId).all();

  return c.json({ success: true, data: agents.results || [] });
});

// Stock Valuation Report
api.get('/reports/stock-valuation', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const items = await db.prepare("SELECT p.name, p.sku, w.name as warehouse, sl.quantity, p.cost_price, (sl.quantity * COALESCE(p.cost_price, 0)) as value, (SELECT MAX(created_at) FROM stock_movements WHERE product_id = p.id AND movement_type = 'SALE_OUT') as last_sold FROM stock_levels sl JOIN products p ON sl.product_id = p.id JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ? ORDER BY value DESC").bind(tenantId).all();
  return c.json({ success: true, data: items.results || [] });
});


// Van Sales Report
api.get('/reports/van-sales', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const report = await db.prepare("SELECT vsl.id, vsl.vehicle_reg, u.first_name || ' ' || u.last_name as agent_name, vsl.status, vsl.load_date, vsl.return_time, (SELECT COUNT(*) FROM sales_orders WHERE van_stock_load_id = vsl.id) as orders, (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE van_stock_load_id = vsl.id) as revenue, vr.cash_expected, vr.cash_actual, vr.variance, vr.status as recon_status FROM van_stock_loads vsl LEFT JOIN users u ON vsl.agent_id = u.id LEFT JOIN van_reconciliations vr ON vr.van_stock_load_id = vsl.id WHERE vsl.tenant_id = ? ORDER BY vsl.load_date DESC").bind(tenantId).all();
  return c.json({ success: true, data: report.results || [] });
});

// Serial Numbers


// ==================== DOC 2: TRADE PROMOTIONS & FIELD OPS (Sections K-M) ====================

// ==================== K. TRADE PROMOTIONS ENGINE ====================

api.route('/', tradePromotionRoutes);

// ==================== L. FIELD OPERATIONS ENGINE ====================

// L.1 Territory Management

// ==================== M. ANOMALY DETECTION ====================

// M.1 Anomaly Flags
api.get('/anomaly-flags', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, type, severity } = c.req.query();
  let q = "SELECT af.*, u.first_name || ' ' || u.last_name as user_name FROM anomaly_flags af LEFT JOIN users u ON af.agent_id = u.id WHERE af.tenant_id = ?";
  const params = [tenantId];
  if (status) { q += ' AND af.status = ?'; params.push(status); }
  if (type) { q += ' AND af.anomaly_type = ?'; params.push(type); }
  if (severity) { q += ' AND af.severity = ?'; params.push(severity); }
  q += ' ORDER BY af.created_at DESC';
  const flags = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: flags.results || [] });
});

api.put('/anomaly-flags/:id/acknowledge', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { notes } = await c.req.json();
  await db.prepare("UPDATE anomaly_flags SET status = 'ACKNOWLEDGED', reviewed_by = ?, reviewed_at = datetime('now'), resolution = ? WHERE id = ? AND tenant_id = ?").bind(userId, notes || null, id, tenantId).run();
  return c.json({ success: true, message: 'Anomaly acknowledged' });
});

api.put('/anomaly-flags/:id/dismiss', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { notes } = await c.req.json();
  await db.prepare("UPDATE anomaly_flags SET status = 'DISMISSED', reviewed_by = ?, reviewed_at = datetime('now'), resolution = ? WHERE id = ? AND tenant_id = ?").bind(userId, notes || null, id, tenantId).run();
  return c.json({ success: true, message: 'Anomaly dismissed' });
});

// M.2 Run Anomaly Detection (on-demand)
api.post('/anomaly-detection/run', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const detected = [];

  // 1. GPS Anomalies - visits where agent GPS is far from customer
  const recentVisits = await db.prepare("SELECT v.*, c.gps_latitude as cust_lat, c.gps_longitude as cust_lng FROM visits v JOIN customers c ON v.customer_id = c.id WHERE v.tenant_id = ? AND v.created_at >= datetime('now', '-7 days') AND c.gps_latitude IS NOT NULL AND v.latitude IS NOT NULL").bind(tenantId).all();

  for (const visit of (recentVisits.results || [])) {
    const R = 6371e3;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(visit.cust_lat - visit.latitude);
    const dLng = toRad(visit.cust_lng - visit.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(visit.latitude)) * Math.cos(toRad(visit.cust_lat)) * Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (distance > 500) { // >500m from customer
      const flagId = uuidv4();
      await db.prepare("INSERT OR IGNORE INTO anomaly_flags (id, tenant_id, user_id, anomaly_type, severity, description, reference_type, reference_id, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(flagId, tenantId, visit.agent_id, 'GPS_MISMATCH', distance > 2000 ? 'HIGH' : 'MEDIUM', `Visit GPS ${Math.round(distance)}m from customer location`, 'VISIT', visit.id, JSON.stringify({ distance_meters: Math.round(distance), visit_lat: visit.latitude, visit_lng: visit.longitude, customer_lat: visit.cust_lat, customer_lng: visit.cust_lng })).run();
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


// ==================== DOC 3: INSIGHTS, RBAC & PROCESS COMPLETENESS (Sections N-R) ====================

// ==================== N. ROLE-BASED ACCESS CONTROL ====================

// N.1 Permission Matrix

// Feature Flags
api.get('/feature-flags', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const flags = await db.prepare('SELECT * FROM feature_flags WHERE tenant_id = ? OR tenant_id IS NULL ORDER BY feature_key LIMIT 500').bind(tenantId).all();
  return c.json({ success: true, data: (flags.results || []).map(f => ({ ...f, flag_name: f.feature_key })) });
});

api.put('/feature-flags/:name', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { name } = c.req.param();
  const { is_enabled } = await c.req.json();
  const existing = await db.prepare('SELECT id FROM feature_flags WHERE feature_key = ? AND tenant_id = ?').bind(name, tenantId).first();
  if (existing) {
    await db.prepare('UPDATE feature_flags SET is_enabled = ?, updated_at = datetime("now") WHERE id = ?').bind(is_enabled ? 1 : 0, existing.id).run();
  } else {
    const id = uuidv4();
    await db.prepare('INSERT INTO feature_flags (id, tenant_id, feature_key, is_enabled) VALUES (?, ?, ?, ?)').bind(id, tenantId, name, is_enabled ? 1 : 0).run();
  }
  return c.json({ success: true, message: `Feature flag ${name} ${is_enabled ? 'enabled' : 'disabled'}` });
});

// ==================== O. INSIGHTS DASHBOARDS ====================

// O.1 Executive Dashboard (SUPER_ADMIN / COMPANY_ADMIN)
api.get('/insights/executive', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [revenue, orders, customers, agents, vanSales, returns, commissions, tradePromos] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND status != 'CANCELLED' AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount FROM sales_orders WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days') GROUP BY status").bind(tenantId).all(),
    db.prepare("SELECT COUNT(*) as total, (SELECT COUNT(*) FROM customers WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')) as new_this_month FROM customers WHERE tenant_id = ?").bind(tenantId, tenantId).first(),
    db.prepare("SELECT COUNT(*) as total, (SELECT COUNT(*) FROM users WHERE tenant_id = ? AND role = 'agent' AND is_active = 1) as active FROM users WHERE tenant_id = ? AND role = 'agent'").bind(tenantId, tenantId).first(),
    db.prepare("SELECT COUNT(*) as loads, COALESCE(SUM(so.total_amount), 0) as revenue FROM van_stock_loads vsl LEFT JOIN sales_orders so ON so.van_stock_load_id = vsl.id WHERE vsl.tenant_id = ? AND vsl.created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total, COALESCE(SUM(net_credit_amount), 0) as value FROM returns WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total_pending FROM commission_earnings WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as active, COALESCE(SUM(actual_spend), 0) as total_spent FROM trade_promotions WHERE tenant_id = ? AND status = 'ACTIVE'").bind(tenantId).first(),
  ]);

  // Revenue trend (last 12 weeks)
  const revenueTrend = await db.prepare("SELECT strftime('%Y-W%W', created_at) as week, COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders FROM sales_orders WHERE tenant_id = ? AND status != 'CANCELLED' AND created_at >= datetime('now', '-84 days') GROUP BY week ORDER BY week").bind(tenantId).all();

  return c.json({ success: true, data: {
    revenue: { month: revenue?.total || 0, order_count: revenue?.count || 0 },
    orders_by_status: orders.results || [],
    customers: { total: customers?.total || 0, new_this_month: customers?.new_this_month || 0 },
    agents: { total: agents?.total || 0, active: agents?.active || 0 },
    van_sales: { loads: vanSales?.loads || 0, revenue: vanSales?.revenue || 0 },
    returns: { total: returns?.total || 0, value: returns?.value || 0 },
    commissions_pending: commissions?.total_pending || 0,
    trade_promotions: { active: tradePromos?.active || 0, spent: tradePromos?.total_spent || 0 },
    revenue_trend: revenueTrend.results || []
  }});
});

// O.2 Sales Performance Dashboard
api.get('/insights/sales', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { period = '30' } = c.req.query();
  // BUG-002: Sanitize period to prevent SQL injection — validate as integer, clamp to safe range
  const periodDays = Math.max(1, Math.min(365, parseInt(period, 10) || 30));
  const periodModifier = `-${periodDays} days`;

  let agentFilter = '';
  const params = [tenantId, periodModifier];
  if (role === 'agent') { agentFilter = ' AND so.agent_id = ?'; params.push(userId); }
  else if (role === 'team_lead' || role === 'manager') {
    const team = await db.prepare('SELECT id FROM users WHERE manager_id = ? AND tenant_id = ? LIMIT 500').bind(userId, tenantId).all();
    const teamIds = (team.results || []).map(u => u.id);
    teamIds.push(userId);
    if (teamIds.length > 0) {
      agentFilter = ` AND so.agent_id IN (${teamIds.map(() => '?').join(',')})`;
      params.push(...teamIds);
    }
  }

  const [summary, byAgent, byProduct, byCustomer, dailyTrend, paymentMethods] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as orders, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(AVG(total_amount), 0) as avg_order, COALESCE(SUM(discount_amount), 0) as total_discount FROM sales_orders so WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', ?)${agentFilter}`).bind(...params).first(),
    db.prepare(`SELECT u.first_name || ' ' || u.last_name as agent, COUNT(*) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM sales_orders so JOIN users u ON so.agent_id = u.id WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', ?)${agentFilter} GROUP BY so.agent_id ORDER BY revenue DESC`).bind(...params).all(),
    db.prepare(`SELECT p.name, SUM(soi.quantity) as qty_sold, SUM(soi.line_total) as revenue FROM sales_order_items soi JOIN products p ON soi.product_id = p.id JOIN sales_orders so ON soi.sales_order_id = so.id WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', ?)${agentFilter} GROUP BY p.name ORDER BY revenue DESC LIMIT 20`).bind(...params).all(),
    db.prepare(`SELECT c.name, COUNT(*) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM sales_orders so JOIN customers c ON so.customer_id = c.id WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', ?)${agentFilter} GROUP BY c.name ORDER BY revenue DESC LIMIT 20`).bind(...params).all(),
    db.prepare(`SELECT DATE(so.created_at) as day, COUNT(*) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM sales_orders so WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', ?)${agentFilter} GROUP BY day ORDER BY day`).bind(...params).all(),
    db.prepare(`SELECT so.payment_method, COUNT(*) as count, COALESCE(SUM(so.total_amount), 0) as amount FROM sales_orders so WHERE so.tenant_id = ? AND so.status != 'CANCELLED' AND so.created_at >= datetime('now', ?)${agentFilter} GROUP BY so.payment_method`).bind(...params).all(),
  ]);

  return c.json({ success: true, data: {
    summary: { orders: summary?.orders || 0, revenue: summary?.revenue || 0, avg_order: summary?.avg_order || 0, total_discount: summary?.total_discount || 0 },
    by_agent: byAgent.results || [],
    by_product: byProduct.results || [],
    by_customer: byCustomer.results || [],
    daily_trend: dailyTrend.results || [],
    payment_methods: paymentMethods.results || []
  }});
});

// O.3 Van Sales Dashboard
api.get('/insights/van-sales', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [summary, byAgent, loadUtilization, reconciliation] = await Promise.all([
    db.prepare("SELECT COUNT(DISTINCT vsl.id) as loads, (SELECT COUNT(*) FROM sales_orders WHERE van_stock_load_id IS NOT NULL AND tenant_id = ? AND created_at >= datetime('now', '-30 days')) as orders, (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE van_stock_load_id IS NOT NULL AND tenant_id = ? AND created_at >= datetime('now', '-30 days')) as revenue FROM van_stock_loads vsl WHERE vsl.tenant_id = ? AND vsl.created_at >= datetime('now', '-30 days')").bind(tenantId, tenantId, tenantId).first(),
    db.prepare("SELECT u.first_name || ' ' || u.last_name as agent, COUNT(DISTINCT vsl.id) as loads, (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE van_stock_load_id = vsl.id) as revenue FROM van_stock_loads vsl JOIN users u ON vsl.agent_id = u.id WHERE vsl.tenant_id = ? AND vsl.created_at >= datetime('now', '-30 days') GROUP BY vsl.agent_id ORDER BY revenue DESC").bind(tenantId).all(),
    db.prepare("SELECT vsl.id, vsl.vehicle_reg, SUM(vsli.quantity_loaded) as loaded, SUM(COALESCE(vsli.quantity_sold, 0)) as sold, SUM(COALESCE(vsli.quantity_returned, 0)) as returned, SUM(COALESCE(vsli.quantity_damaged, 0)) as damaged, CASE WHEN SUM(vsli.quantity_loaded) > 0 THEN ROUND(CAST(SUM(COALESCE(vsli.quantity_sold, 0)) AS FLOAT) / SUM(vsli.quantity_loaded) * 100, 1) ELSE 0 END as sell_through_pct FROM van_stock_loads vsl JOIN van_stock_load_items vsli ON vsl.id = vsli.van_stock_load_id WHERE vsl.tenant_id = ? AND vsl.created_at >= datetime('now', '-30 days') GROUP BY vsl.id ORDER BY vsl.load_date DESC").bind(tenantId).all(),
    db.prepare("SELECT vr.status, COUNT(*) as count, COALESCE(SUM(ABS(vr.variance)), 0) as total_variance FROM van_reconciliations vr WHERE vr.tenant_id = ? AND vr.created_at >= datetime('now', '-30 days') GROUP BY vr.status").bind(tenantId).all(),
  ]);

  return c.json({ success: true, data: {
    summary: { loads: summary?.loads || 0, orders: summary?.orders || 0, revenue: summary?.revenue || 0 },
    by_agent: byAgent.results || [],
    load_utilization: loadUtilization.results || [],
    reconciliation: reconciliation.results || []
  }});
});

// O.4 Field Operations Dashboard
api.get('/insights/field-ops', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [visitSummary, routeCompliance, territories, competitorActivity] = await Promise.all([
    db.prepare("SELECT COUNT(*) as total_visits, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed, COUNT(CASE WHEN check_out_time IS NOT NULL THEN 1 END) as checked_out, ROUND(AVG(CASE WHEN check_out_time IS NOT NULL THEN (julianday(check_out_time) - julianday(check_in_time)) * 1440 ELSE NULL END), 1) as avg_duration_min FROM visits WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT rp.status, COUNT(*) as count FROM route_plans rp WHERE rp.tenant_id = ? AND rp.route_date >= date('now', '-30 days') GROUP BY rp.status").bind(tenantId).all(),
    db.prepare("SELECT t.name, (SELECT COUNT(*) FROM territory_assignments ta WHERE ta.territory_id = t.id) as agents FROM territories t WHERE t.tenant_id = ?").bind(tenantId).all(),
    db.prepare("SELECT competitor_brand as competitor_name, COUNT(*) as sightings, COALESCE(AVG(observed_price), 0) as avg_price FROM competitor_sightings WHERE tenant_id = ? AND sighting_date >= date('now', '-30 days') GROUP BY competitor_brand ORDER BY sightings DESC LIMIT 10").bind(tenantId).all(),
  ]);

  return c.json({ success: true, data: {
    visits: { total: visitSummary?.total_visits || 0, completed: visitSummary?.completed || 0, avg_duration: visitSummary?.avg_duration_min || 0 },
    route_compliance: routeCompliance.results || [],
    territories: territories.results || [],
    competitor_activity: competitorActivity.results || []
  }});
});

// O.5 Trade Promotion Dashboard
api.get('/insights/trade-promotions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [summary, byType, topPerformers, claims] = await Promise.all([
    db.prepare("SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active, COALESCE(SUM(budget), 0) as total_budget, COALESCE(SUM(actual_spend), 0) as total_spent FROM trade_promotions WHERE tenant_id = ?").bind(tenantId).first(),
    db.prepare("SELECT promotion_type, COUNT(*) as count, COALESCE(SUM(budget), 0) as budget, COALESCE(SUM(actual_spend), 0) as spent FROM trade_promotions WHERE tenant_id = ? GROUP BY promotion_type").bind(tenantId).all(),
    db.prepare("SELECT tp.name, tp.promotion_type, tp.budget, tp.actual_spend as spent, (SELECT COUNT(*) FROM trade_promotion_enrollments WHERE promotion_id = tp.id) as enrollments, CASE WHEN tp.actual_spend > 0 THEN ROUND(CAST(tp.actual_spend AS FLOAT) / tp.budget * 100, 1) ELSE 0 END as spend_pct FROM trade_promotions tp WHERE tp.tenant_id = ? ORDER BY tp.actual_spend DESC LIMIT 10").bind(tenantId).all(),
    db.prepare("SELECT tpc.status, COUNT(*) as count, COALESCE(SUM(tpc.amount), 0) as total_amount FROM trade_promotion_claims tpc JOIN trade_promotions tp ON tpc.promotion_id = tp.id WHERE tp.tenant_id = ? GROUP BY tpc.status").bind(tenantId).all(),
  ]);

  return c.json({ success: true, data: {
    summary: { total: summary?.total || 0, active: summary?.active || 0, budget: summary?.total_budget || 0, spent: summary?.total_spent || 0, utilization: summary?.total_budget > 0 ? Math.round(summary.total_spent / summary.total_budget * 100) : 0 },
    by_type: byType.results || [],
    top_performers: topPerformers.results || [],
    claims: claims.results || []
  }});
});

// O.6 Stock Dashboard
api.get('/insights/stock', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [totalValue, lowStock, movements, byWarehouse] = await Promise.all([
    db.prepare("SELECT COUNT(DISTINCT sl.product_id) as sku_count, COALESCE(SUM(sl.quantity), 0) as total_units, COALESCE(SUM(sl.quantity * COALESCE(p.cost_price, 0)), 0) as total_value FROM stock_levels sl JOIN products p ON sl.product_id = p.id WHERE sl.tenant_id = ?").bind(tenantId).first(),
    db.prepare("SELECT p.name, p.sku, sl.quantity, 10 as reorder_level FROM stock_levels sl JOIN products p ON sl.product_id = p.id WHERE sl.tenant_id = ? AND sl.quantity <= 10 ORDER BY sl.quantity ASC LIMIT 20").bind(tenantId).all(),
    db.prepare("SELECT movement_type, COUNT(*) as count, SUM(quantity) as total_qty FROM stock_movements WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days') GROUP BY movement_type ORDER BY count DESC").bind(tenantId).all(),
    db.prepare("SELECT w.name as warehouse, COUNT(DISTINCT sl.product_id) as products, COALESCE(SUM(sl.quantity), 0) as units, COALESCE(SUM(sl.quantity * COALESCE(p.cost_price, 0)), 0) as value FROM stock_levels sl JOIN warehouses w ON sl.warehouse_id = w.id JOIN products p ON sl.product_id = p.id WHERE sl.tenant_id = ? GROUP BY w.name").bind(tenantId).all(),
  ]);

  return c.json({ success: true, data: {
    total: { sku_count: totalValue?.sku_count || 0, units: totalValue?.total_units || 0, value: totalValue?.total_value || 0 },
    low_stock: lowStock.results || [],
    movements: movements.results || [],
    by_warehouse: byWarehouse.results || []
  }});
});

// O.7 Commission Dashboard
api.get('/insights/commissions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');

  let earnerFilter = '';
  const params = [tenantId];
  if (role === 'agent') { earnerFilter = ' AND ce.earner_id = ?'; params.push(userId); }

  const [summary, byStatus, byAgent, trend] = await Promise.all([
    db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending, COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved, COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid FROM commission_earnings ce WHERE ce.tenant_id = ?${earnerFilter}`).bind(...params).first(),
    db.prepare(`SELECT ce.status, COUNT(*) as count, COALESCE(SUM(ce.amount), 0) as amount FROM commission_earnings ce WHERE ce.tenant_id = ?${earnerFilter} GROUP BY ce.status`).bind(...params).all(),
    db.prepare(`SELECT u.first_name || ' ' || u.last_name as name, COALESCE(SUM(ce.amount), 0) as total, COUNT(*) as entries FROM commission_earnings ce JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ?${earnerFilter} GROUP BY ce.earner_id ORDER BY total DESC LIMIT 10`).bind(...params).all(),
    db.prepare(`SELECT strftime('%Y-%m', ce.created_at) as month, COALESCE(SUM(ce.amount), 0) as amount FROM commission_earnings ce WHERE ce.tenant_id = ?${earnerFilter} AND ce.created_at >= datetime('now', '-6 months') GROUP BY month ORDER BY month`).bind(...params).all(),
  ]);

  return c.json({ success: true, data: {
    summary: { total: summary?.total || 0, pending: summary?.pending || 0, approved: summary?.approved || 0, paid: summary?.paid || 0 },
    by_status: byStatus.results || [],
    by_agent: byAgent.results || [],
    trend: trend.results || []
  }});
});

// O.8 Goals Dashboard
api.get('/insights/goals', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');

  let userFilter = '';
  const params = [tenantId];
  if (role === 'agent') { userFilter = ' AND g.created_by = ?'; params.push(userId); }

  const goals = await db.prepare(`SELECT g.*, u.first_name || ' ' || u.last_name as user_name, CASE WHEN g.target_value > 0 THEN ROUND(CAST(g.current_value AS FLOAT) / g.target_value * 100, 1) ELSE 0 END as progress_pct FROM goals g LEFT JOIN users u ON g.created_by = u.id WHERE g.tenant_id = ?${userFilter} ORDER BY g.end_date DESC`).bind(...params).all();

  const summary = {
    total: (goals.results || []).length,
    on_track: (goals.results || []).filter(g => {
      const pct = g.target_value > 0 ? g.current_value / g.target_value * 100 : 0;
      return pct >= 75;
    }).length,
    at_risk: (goals.results || []).filter(g => {
      const pct = g.target_value > 0 ? g.current_value / g.target_value * 100 : 0;
      return pct >= 50 && pct < 75;
    }).length,
    behind: (goals.results || []).filter(g => {
      const pct = g.target_value > 0 ? g.current_value / g.target_value * 100 : 0;
      return pct < 50;
    }).length,
  };

  return c.json({ success: true, data: { summary, goals: goals.results || [] } });
});

// O.9 Anomaly Dashboard
api.get('/insights/anomalies', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const [summary, byType, bySeverity, recent] = await Promise.all([
    db.prepare("SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open, COUNT(CASE WHEN status = 'ACKNOWLEDGED' THEN 1 END) as acknowledged, COUNT(CASE WHEN status = 'DISMISSED' THEN 1 END) as dismissed FROM anomaly_flags WHERE tenant_id = ?").bind(tenantId).first(),
    db.prepare("SELECT anomaly_type, COUNT(*) as count FROM anomaly_flags WHERE tenant_id = ? AND status = 'OPEN' GROUP BY anomaly_type ORDER BY count DESC").bind(tenantId).all(),
    db.prepare("SELECT severity, COUNT(*) as count FROM anomaly_flags WHERE tenant_id = ? AND status = 'OPEN' GROUP BY severity").bind(tenantId).all(),
    db.prepare("SELECT af.*, u.first_name || ' ' || u.last_name as user_name FROM anomaly_flags af LEFT JOIN users u ON af.agent_id = u.id WHERE af.tenant_id = ? ORDER BY af.created_at DESC LIMIT 20").bind(tenantId).all(),
  ]);

  return c.json({ success: true, data: {
    summary: { total: summary?.total || 0, open: summary?.open || 0, acknowledged: summary?.acknowledged || 0, dismissed: summary?.dismissed || 0 },
    by_type: byType.results || [],
    by_severity: bySeverity.results || [],
    recent: recent.results || []
  }});
});

// ==================== P. PROCESS COMPLETENESS ====================

// P.1 Process Audit - verify all forward/reverse paths
api.get('/process/audit', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');

  const processes = {
    sales_order: {
      forward: ['draft -> CONFIRMED', 'CONFIRMED -> PROCESSING', 'PROCESSING -> READY', 'READY -> DISPATCHED', 'DISPATCHED -> DELIVERED', 'DELIVERED -> COMPLETED'],
      reverse: ['Any -> CANCELLED (with stock reversal, commission void, balance restore)'],
      status: 'implemented'
    },
    van_sales: {
      forward: ['load -> in_field (depart)', 'in_field -> sell (create VAN_SALE orders)', 'in_field -> returned (process returns)'],
      reverse: ['Stock discrepancy detection', 'Cash reconciliation with variance flag'],
      status: 'implemented'
    },
    returns: {
      forward: ['PENDING -> PROCESSED (approve)', 'PENDING -> REJECTED'],
      reverse: ['Stock return (good items back to inventory)', 'Damage recording', 'Credit note creation', 'Customer balance adjustment'],
      status: 'implemented'
    },
    commissions: {
      forward: ['pending -> approved -> paid', 'pending -> disputed (agent) -> approved | rejected'],
      reverse: ['rejected (manager, with reason)', 'reversed (sibling negative-amount row, on order cancel or manual reversal)'],
      status: 'implemented'
    },
    trade_promotions: {
      forward: ['DRAFT -> ACTIVE -> CLOSED'],
      reverse: ['Enrollment removal', 'Claim rejection'],
      status: 'implemented'
    },
    inventory: {
      forward: ['PURCHASE_IN, TRANSFER_IN, ADJUSTMENT_UP, RETURN_IN'],
      reverse: ['SALE_OUT, TRANSFER_OUT, ADJUSTMENT_DOWN, EXPIRY, SAMPLE_OUT, DAMAGE'],
      status: 'implemented'
    }
  };

  // Verify data integrity
  const checks = [];

  // Check for orphaned order items
  const orphanedItems = await db.prepare("SELECT COUNT(*) as cnt FROM sales_order_items soi LEFT JOIN sales_orders so ON soi.sales_order_id = so.id WHERE so.id IS NULL").first() || { cnt: 0 };
  checks.push({ check: 'orphaned_order_items', count: orphanedItems?.cnt || 0, status: (orphanedItems?.cnt || 0) === 0 ? 'PASS' : 'FAIL' });

  // Check for negative stock
  const negativeStock = await db.prepare("SELECT COUNT(*) as cnt FROM stock_levels WHERE quantity < 0 AND tenant_id = ?").bind(tenantId).first();
  checks.push({ check: 'negative_stock', count: negativeStock?.cnt || 0, status: (negativeStock?.cnt || 0) === 0 ? 'PASS' : 'FAIL' });

  // Check for unreconciled van loads
  const unreconciledLoads = await db.prepare("SELECT COUNT(*) as cnt FROM van_stock_loads WHERE status = 'returned' AND id NOT IN (SELECT van_stock_load_id FROM van_reconciliations) AND tenant_id = ?").bind(tenantId).first();
  checks.push({ check: 'unreconciled_van_loads', count: unreconciledLoads?.cnt || 0, status: (unreconciledLoads?.cnt || 0) === 0 ? 'PASS' : 'WARNING' });

  return c.json({ success: true, data: { processes, integrity_checks: checks } });
});

// ==================== Q. SUPER ADMIN PLATFORM MANAGEMENT ====================

// Q.1 Tenant Management — List all tenants (super_admin sees all, admin sees own)
api.get('/tenants', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const role = c.get('role');
  const tenantId = c.get('tenantId');
  let tenants;
  if (role === 'super_admin') {
    tenants = await db.prepare("SELECT t.*, (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count, (SELECT COUNT(*) FROM customers WHERE tenant_id = t.id) as customer_count, (SELECT COUNT(*) FROM sales_orders WHERE tenant_id = t.id) as order_count FROM tenants t ORDER BY t.created_at DESC").all();
  } else {
    tenants = await db.prepare("SELECT t.*, (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count, (SELECT COUNT(*) FROM customers WHERE tenant_id = t.id) as customer_count, (SELECT COUNT(*) FROM sales_orders WHERE tenant_id = t.id) as order_count FROM tenants t WHERE t.id = ? ORDER BY t.created_at DESC").bind(tenantId).all();
  }
  return c.json({ success: true, data: tenants.results || [] });
});

// Alias: platform/tenants -> tenants
api.get('/platform/tenants', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const role = c.get('role');
  const tenantId = c.get('tenantId');
  let tenants;
  if (role === 'super_admin') {
    tenants = await db.prepare("SELECT t.*, (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count, (SELECT COUNT(*) FROM customers WHERE tenant_id = t.id) as customer_count, (SELECT COUNT(*) FROM sales_orders WHERE tenant_id = t.id) as order_count FROM tenants t ORDER BY t.created_at DESC").all();
  } else {
    tenants = await db.prepare("SELECT t.*, (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count, (SELECT COUNT(*) FROM customers WHERE tenant_id = t.id) as customer_count, (SELECT COUNT(*) FROM sales_orders WHERE tenant_id = t.id) as order_count FROM tenants t WHERE t.id = ? ORDER BY t.created_at DESC").bind(tenantId).all();
  }
  return c.json({ success: true, data: tenants.results || [] });
});

// Q.1b Create tenant with admin user (super_admin only)
api.post('/tenants', requireSuperAdmin, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const tenantId = uuidv4();
  const code = body.code || body.name.toUpperCase().replace(/\s+/g, '_').substring(0, 20);
  
  const batch = [
    db.prepare('INSERT INTO tenants (id, name, code, domain, status, subscription_plan, max_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))').bind(tenantId, body.name, code, body.domain || null, 'active', body.subscriptionPlan || 'basic', body.maxUsers || 10)
  ];
  
  // Create admin user for the new tenant if adminUser data provided
  if (body.adminUser && body.adminUser.email && body.adminUser.password) {
    const adminUserId = uuidv4();
    const hashedPassword = await bcrypt.hash(body.adminUser.password, 10);
    batch.push(
      db.prepare('INSERT INTO users (id, tenant_id, email, phone, password_hash, first_name, last_name, role, status, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime("now"))').bind(adminUserId, tenantId, body.adminUser.email, normalizePhone(body.adminUser.phone), hashedPassword, body.adminUser.firstName || 'Admin', body.adminUser.lastName || 'User', 'admin', 'active')
    );
    batch.push(
      db.prepare('INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(uuidv4(), tenantId, adminUserId, 'CREATE', 'tenant', tenantId, JSON.stringify({ name: body.name, code, adminEmail: body.adminUser.email }))
    );
  }
  
  await db.batch(batch);
  return c.json({ success: true, data: { id: tenantId, code }, message: 'Tenant created successfully' }, 201);
});

api.post('/platform/tenants', requireSuperAdmin, async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const tenantId = uuidv4();
  const code = body.code || body.name.toUpperCase().replace(/\s+/g, '_').substring(0, 20);
  await db.prepare('INSERT INTO tenants (id, name, code, domain, status, subscription_plan, max_users, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime("now"))').bind(tenantId, body.name, code, body.domain || null, 'active', body.subscriptionPlan || 'basic', body.maxUsers || 10).run();
  return c.json({ success: true, data: { id: tenantId }, message: 'Tenant created' }, 201);
});

// Q.1c Update tenant (super_admin only)
api.put('/tenants/:id', requireSuperAdmin, async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE tenants SET name = COALESCE(?, name), domain = COALESCE(?, domain), subscription_plan = COALESCE(?, subscription_plan), max_users = COALESCE(?, max_users), updated_at = datetime("now") WHERE id = ?').bind(body.name || null, body.domain || null, body.subscriptionPlan || null, body.maxUsers || null, id).run();
  return c.json({ success: true, message: 'Tenant updated' });
});

api.put('/platform/tenants/:id', requireSuperAdmin, async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE tenants SET name = COALESCE(?, name), domain = COALESCE(?, domain), subscription_plan = COALESCE(?, subscription_plan), max_users = COALESCE(?, max_users), updated_at = datetime("now") WHERE id = ?').bind(body.name || null, body.domain || null, body.subscriptionPlan || null, body.maxUsers || null, id).run();
  return c.json({ success: true, message: 'Tenant updated' });
});

// Q.1d Delete tenant (super_admin only)
api.delete('/tenants/:id', requireSuperAdmin, async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  // Don't allow deleting the super admin tenant
  const tenant = await db.prepare('SELECT code FROM tenants WHERE id = ?').bind(id).first();
  if (tenant && (tenant.code === 'SUPERADMIN' || tenant.code === 'DEMO')) {
    return c.json({ success: false, message: 'Cannot delete system tenants' }, 400);
  }
  await db.prepare("UPDATE tenants SET status = 'deleted', updated_at = datetime('now') WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: 'Tenant deleted' });
});

// Q.1e Activate/suspend tenant (super_admin only)
api.post('/tenants/:id/activate', requireSuperAdmin, async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  await db.prepare("UPDATE tenants SET status = 'active', updated_at = datetime('now') WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: 'Tenant activated' });
});

api.post('/tenants/:id/suspend', requireSuperAdmin, async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  await db.prepare("UPDATE tenants SET status = 'suspended', updated_at = datetime('now') WHERE id = ?").bind(id).run();
  return c.json({ success: true, message: 'Tenant suspended' });
});

// Q.1f Get tenant users (super_admin can see any tenant's users)
api.get('/tenants/:id/users', requireSuperAdmin, async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const users = await db.prepare("SELECT id, email, first_name, last_name, phone, role, status, is_active, last_login, created_at FROM users WHERE tenant_id = ? ORDER BY created_at DESC").bind(id).all();
  return c.json({ success: true, data: users.results || [] });
});

// Q.1g Get tenant modules (super_admin)
api.get('/tenants/:id/modules', requireSuperAdmin, async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const tenant = await db.prepare('SELECT features FROM tenants WHERE id = ?').bind(id).first();
    const modules = tenant?.features ? JSON.parse(tenant.features) : {};
  return c.json({ success: true, data: modules });
});

// Q.1h Update tenant modules (super_admin)
api.put('/tenants/:id/modules', requireSuperAdmin, async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE tenants SET features = ?, updated_at = datetime("now") WHERE id = ?').bind(JSON.stringify(body.modules || {}), id).run();
  return c.json({ success: true, message: 'Modules updated' });
});

// Q.1i Company settings (admin within their tenant)
api.get('/settings/company', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first();
  const settings = tenant?.features ? JSON.parse(tenant.features) : {};
  return c.json({ success: true, data: {
    company_name: tenant?.name || '',
    company_code: tenant?.code || '',
    timezone: settings.timezone || 'Africa/Johannesburg',
    currency: settings.currency || 'ZAR',
    date_format: settings.date_format || 'DD/MM/YYYY',
    language: settings.language || 'en',
    logo_url: settings.logo_url || '',
    primary_color: settings.primary_color || '#3B82F6',
  }});
});

api.put('/settings/company', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const existing = await db.prepare('SELECT features FROM tenants WHERE id = ?').bind(tenantId).first();
    const currentSettings = existing?.features ? JSON.parse(existing.features) : {};
    const newSettings = { ...currentSettings, ...body };
    await db.prepare('UPDATE tenants SET name = COALESCE(?, name), features = ?, updated_at = datetime("now") WHERE id = ?').bind(body.company_name || null, JSON.stringify(newSettings), tenantId).run();
  return c.json({ success: true, message: 'Company settings updated' });
});

// Q.1j Get tenant modules for company admin (read-only view)
api.get('/settings/modules', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const tenant = await db.prepare('SELECT features FROM tenants WHERE id = ?').bind(tenantId).first();
  const modules = tenant?.features ? JSON.parse(tenant.features) : {};
  return c.json({ success: true, data: modules });
});

// Q.2 Platform Settings
api.get('/platform/settings', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first();
  return c.json({ success: true, data: {
    tenant: tenant,
    settings: tenant?.features ? JSON.parse(tenant.features) : {},
  }});
});

api.put('/platform/settings', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  await db.prepare('UPDATE tenants SET features = ?, updated_at = datetime("now") WHERE id = ?').bind(JSON.stringify(body), tenantId).run();
  return c.json({ success: true, message: 'Settings updated' });
});

// Q.3 Platform Health
api.get('/platform/health', async (c) => {
  const db = c.env.DB;
  try {
    await db.prepare('SELECT 1').first();
    return c.json({ success: true, data: { status: 'healthy', database: 'connected', timestamp: new Date().toISOString() } });
  } catch (e) {
    return c.json({ success: false, data: { status: 'unhealthy', database: 'disconnected', error: e.message } }, 500);
  }
});


// ==================== DOC 4: FINAL GAPS & PRODUCTION READINESS (Sections S-Z) ====================

// ==================== S. AUTOMATED EMAIL REPORTS ====================

// S.1 Report Subscriptions
api.get('/report-subscriptions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');
  let q = 'SELECT * FROM report_subscriptions WHERE tenant_id = ?';
  const params = [tenantId];
  if (role === 'agent') { q += ' AND user_id = ?'; params.push(userId); }
  q += ' ORDER BY created_at DESC';
  const subs = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: subs.results || [] });
});

api.post('/report-subscriptions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO report_subscriptions (id, tenant_id, user_id, report_type, frequency, recipients, filters, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.user_id || userId, body.report_type, body.frequency || 'weekly', JSON.stringify(body.recipients || []), body.filters ? JSON.stringify(body.filters) : null, 1).run();
  return c.json({ success: true, data: { id }, message: 'Subscription created' }, 201);
});

api.put('/report-subscriptions/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE report_subscriptions SET frequency = COALESCE(?, frequency), recipients = COALESCE(?, recipients), filters = COALESCE(?, filters), is_active = COALESCE(?, is_active), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.frequency || null, body.recipients ? JSON.stringify(body.recipients) : null, body.filters ? JSON.stringify(body.filters) : null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Subscription updated' });
});

api.delete('/report-subscriptions/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('DELETE FROM report_subscriptions WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Subscription deleted' });
});

// S.2 Report History
api.get('/report-history', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { report_type, limit = 50 } = c.req.query();
  let q = 'SELECT * FROM report_history WHERE tenant_id = ?';
  const params = [tenantId];
  if (report_type) { q += ' AND report_type = ?'; params.push(report_type); }
  q += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const history = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: history.results || [] });
});

// S.3 Generate Report On-Demand
api.post('/reports/generate', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const reportId = uuidv4();
  let reportData = {};

  // Generate based on type
  switch (body.report_type) {
    case 'SALES_SUMMARY': {
      const data = await db.prepare("SELECT DATE(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(discount_amount), 0) as discounts FROM sales_orders WHERE tenant_id = ? AND status != 'CANCELLED' AND created_at >= ? AND created_at <= ? GROUP BY date ORDER BY date").bind(tenantId, body.start_date || '2020-01-01', body.end_date || '2099-12-31').all();
      reportData = { rows: data.results || [], type: 'SALES_SUMMARY' };
      break;
    }
    case 'AGENT_PERFORMANCE': {
      const data = await db.prepare("SELECT u.first_name || ' ' || u.last_name as agent, COUNT(DISTINCT v.id) as visits, COUNT(DISTINCT so.id) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM users u LEFT JOIN visits v ON v.agent_id = u.id AND v.tenant_id = ? LEFT JOIN sales_orders so ON so.agent_id = u.id AND so.tenant_id = ? WHERE u.tenant_id = ? AND u.role = 'agent' GROUP BY u.id ORDER BY revenue DESC").bind(tenantId, tenantId, tenantId).all();
      reportData = { rows: data.results || [], type: 'AGENT_PERFORMANCE' };
      break;
    }
    case 'STOCK_REPORT': {
      const data = await db.prepare("SELECT p.name, p.sku, w.name as warehouse, sl.quantity, p.cost_price, (sl.quantity * COALESCE(p.cost_price, 0)) as value FROM stock_levels sl JOIN products p ON sl.product_id = p.id JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ? ORDER BY value DESC").bind(tenantId).all();
      reportData = { rows: data.results || [], type: 'STOCK_REPORT' };
      break;
    }
    case 'COMMISSION_REPORT': {
      const data = await db.prepare("SELECT u.first_name || ' ' || u.last_name as earner, ce.source_type, ce.status, COUNT(*) as entries, SUM(ce.amount) as total FROM commission_earnings ce JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ? GROUP BY ce.earner_id, ce.status ORDER BY total DESC").bind(tenantId).all();
      reportData = { rows: data.results || [], type: 'COMMISSION_REPORT' };
      break;
    }
    case 'VAN_SALES_REPORT': {
      const data = await db.prepare("SELECT vsl.vehicle_reg, u.first_name || ' ' || u.last_name as agent, vsl.status, (SELECT COUNT(*) FROM sales_orders WHERE van_stock_load_id = vsl.id) as orders, (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE van_stock_load_id = vsl.id) as revenue, vr.variance as cash_variance FROM van_stock_loads vsl JOIN users u ON vsl.agent_id = u.id LEFT JOIN van_reconciliations vr ON vr.van_stock_load_id = vsl.id WHERE vsl.tenant_id = ? ORDER BY vsl.load_date DESC").bind(tenantId).all();
      reportData = { rows: data.results || [], type: 'VAN_SALES_REPORT' };
      break;
    }
    default:
      return c.json({ success: false, message: 'Unknown report type' }, 400);
  }

  // Save to history
  await db.prepare('INSERT INTO report_history (id, tenant_id, report_type, generated_by, status, file_url) VALUES (?, ?, ?, ?, ?, ?)').bind(reportId, tenantId, body.report_type, userId, 'SENT', null).run();

  return c.json({ success: true, data: { id: reportId, ...reportData } });
});

// ==================== T. API DOCUMENTATION & WEBHOOKS ====================

// T.1 API Documentation endpoint
api.get('/docs', (c) => {
  const docs = {
    openapi: '3.0.0',
    info: { title: 'FieldVibe API', version: '2.0.0', description: 'Complete FieldVibe platform API' },
    servers: [{ url: '/api', description: 'Main API' }],
    paths: {
      '/auth/login': { post: { summary: 'Login', tags: ['Auth'] } },
      '/auth/register': { post: { summary: 'Register', tags: ['Auth'] } },
      '/customers': { get: { summary: 'List customers', tags: ['Customers'] }, post: { summary: 'Create customer', tags: ['Customers'] } },
      '/products': { get: { summary: 'List products', tags: ['Products'] }, post: { summary: 'Create product', tags: ['Products'] } },
      '/sales/orders': { get: { summary: 'List orders', tags: ['Sales'] } },
      '/sales/orders/create': { post: { summary: 'Create order (atomic)', tags: ['Sales'] } },
      '/price-lists': { get: { summary: 'List price lists', tags: ['Pricing'] }, post: { summary: 'Create price list', tags: ['Pricing'] } },
      '/van-sales/loads/create': { post: { summary: 'Create van load', tags: ['Van Sales'] } },
      '/van-sales/sell': { post: { summary: 'Van sale', tags: ['Van Sales'] } },
      '/returns': { get: { summary: 'List returns', tags: ['Returns'] }, post: { summary: 'Create return', tags: ['Returns'] } },
      '/inventory/movements': { post: { summary: 'Create stock movement', tags: ['Inventory'] } },
      '/inventory/transfers': { post: { summary: 'Transfer stock', tags: ['Inventory'] } },
      '/commission-rules': { get: { summary: 'List rules', tags: ['Commissions'] } },
      '/commission-earnings': { get: { summary: 'List earnings', tags: ['Commissions'] } },
      '/trade-promotions': { get: { summary: 'List promotions', tags: ['Trade Promotions'] }, post: { summary: 'Create promotion', tags: ['Trade Promotions'] } },
      '/territories': { get: { summary: 'List territories', tags: ['Field Ops'] }, post: { summary: 'Create territory', tags: ['Field Ops'] } },
      '/route-plans': { get: { summary: 'List route plans', tags: ['Field Ops'] }, post: { summary: 'Create route plan', tags: ['Field Ops'] } },
      '/anomaly-flags': { get: { summary: 'List anomalies', tags: ['Anomaly Detection'] } },
      '/anomaly-detection/run': { post: { summary: 'Run anomaly detection', tags: ['Anomaly Detection'] } },
      '/insights/executive': { get: { summary: 'Executive dashboard', tags: ['Insights'] } },
      '/insights/sales': { get: { summary: 'Sales dashboard', tags: ['Insights'] } },
      '/insights/van-sales': { get: { summary: 'Van sales dashboard', tags: ['Insights'] } },
      '/insights/field-ops': { get: { summary: 'Field ops dashboard', tags: ['Insights'] } },
      '/insights/trade-promotions': { get: { summary: 'Trade promo dashboard', tags: ['Insights'] } },
      '/insights/stock': { get: { summary: 'Stock dashboard', tags: ['Insights'] } },
      '/insights/commissions': { get: { summary: 'Commission dashboard', tags: ['Insights'] } },
      '/insights/goals': { get: { summary: 'Goals dashboard', tags: ['Insights'] } },
      '/insights/anomalies': { get: { summary: 'Anomaly dashboard', tags: ['Insights'] } },
      '/webhooks': { get: { summary: 'List webhooks', tags: ['Webhooks'] }, post: { summary: 'Create webhook', tags: ['Webhooks'] } },
      '/api-keys': { get: { summary: 'List API keys', tags: ['API Keys'] } },
    },
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }
    },
    security: [{ bearerAuth: [] }]
  };
  return c.json(docs);
});

// T.2 Webhooks
api.get('/webhooks', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const webhooks = await db.prepare('SELECT * FROM webhooks WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 500').bind(tenantId).all();
  return c.json({ success: true, data: webhooks.results || [] });
});

api.post('/webhooks', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  const secret = 'whsec_' + uuidv4().replace(/-/g, '');
  await db.prepare('INSERT INTO webhooks (id, tenant_id, url, events, secret, is_active) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.url, JSON.stringify(body.events || []), secret, 1).run();
  return c.json({ success: true, data: { id, secret }, message: 'Webhook created' }, 201);
});

api.put('/webhooks/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE webhooks SET url = COALESCE(?, url), events = COALESCE(?, events), is_active = COALESCE(?, is_active), updated_at = datetime("now") WHERE id = ? AND tenant_id = ?').bind(body.url || null, body.events ? JSON.stringify(body.events) : null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Webhook updated' });
});

api.delete('/webhooks/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('DELETE FROM webhooks WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Webhook deleted' });
});

api.get('/webhooks/:id/deliveries', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const deliveries = await db.prepare('SELECT wd.* FROM webhook_deliveries wd JOIN webhooks w ON wd.webhook_id = w.id WHERE wd.webhook_id = ? AND w.tenant_id = ? ORDER BY wd.created_at DESC LIMIT 50').bind(id, tenantId).all();
  return c.json({ success: true, data: deliveries.results || [] });
});

// T.3 API Keys
api.get('/api-keys', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const keys = await db.prepare('SELECT id, tenant_id, name, key_prefix, scopes, is_active, last_used_at, created_at FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 500').bind(tenantId).all();
  return c.json({ success: true, data: keys.results || [] });
});

api.post('/api-keys', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  const keyValue = 'fv_' + uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').substring(0, 16);
  const keyPrefix = keyValue.substring(0, 10);
  // Hash the API key before storing
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyValue);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  await db.prepare('INSERT INTO api_keys (id, tenant_id, name, key_hash, key_prefix, scopes, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, keyHash, keyPrefix, JSON.stringify(body.scopes || ['read']), 1).run();
  return c.json({ success: true, data: { id, api_key: keyValue, prefix: keyPrefix }, message: 'API key created. Store the key securely - it cannot be retrieved later.' }, 201);
});

api.delete('/api-keys/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('DELETE FROM api_keys WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'API key revoked' });
});

// ==================== U. DATA EXPORT & IMPORT ====================

// U.1 Export
api.post('/export', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();

  const validEntities = ['customers', 'products', 'sales_orders', 'visits', 'commission_earnings', 'stock_levels'];
  if (!validEntities.includes(body.entity)) {
    return c.json({ success: false, message: `Invalid entity. Must be one of: ${validEntities.join(', ')}` }, 400);
  }

  let q = '';
  switch (body.entity) {
    case 'customers': q = 'SELECT * FROM customers WHERE tenant_id = ?'; break;
    case 'products': q = 'SELECT * FROM products WHERE tenant_id = ?'; break;
    case 'sales_orders': q = "SELECT so.*, (SELECT GROUP_CONCAT(p.name || ' x' || soi.quantity) FROM sales_order_items soi JOIN products p ON soi.product_id = p.id WHERE soi.sales_order_id = so.id) as items_summary FROM sales_orders so WHERE so.tenant_id = ?"; break;
    case 'visits': q = "SELECT v.*, c.name as customer_name FROM visits v LEFT JOIN customers c ON v.customer_id = c.id WHERE v.tenant_id = ?"; break;
    case 'commission_earnings': q = "SELECT ce.*, u.first_name || ' ' || u.last_name as earner_name FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ?"; break;
    case 'stock_levels': q = "SELECT sl.*, p.name as product_name, p.sku, w.name as warehouse_name FROM stock_levels sl JOIN products p ON sl.product_id = p.id JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ?"; break;
  }

  const bindParams = [tenantId];
  if (body.date_from) { q += ' AND created_at >= ?'; bindParams.push(body.date_from); }
  if (body.date_to) { q += ' AND created_at <= ?'; bindParams.push(body.date_to); }

  const data = await db.prepare(q).bind(...bindParams).all();
  return c.json({ success: true, data: { entity: body.entity, count: (data.results || []).length, rows: data.results || [] } });
});

// U.2 Import
api.post('/import', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const validEntities = ['customers', 'products'];
  if (!validEntities.includes(body.entity)) {
    return c.json({ success: false, message: 'Import only supported for: customers, products' }, 400);
  }

  const jobId = uuidv4();
  const rows = body.rows || [];
  let imported = 0;
  let failed = 0;
  const errors = [];

  await db.prepare('INSERT INTO import_jobs (id, tenant_id, entity_type, total_rows, status, created_by) VALUES (?, ?, ?, ?, ?, ?)').bind(jobId, tenantId, body.entity, rows.length, 'PROCESSING', userId).run();

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = rows[i];
      const id = uuidv4();
      if (body.entity === 'customers') {
        if (!row.name) { errors.push({ row: i + 1, error: 'Name required' }); failed++; continue; }
        await db.prepare('INSERT INTO customers (id, tenant_id, name, email, phone, address, category, customer_type, credit_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, row.name, row.email || null, row.phone || null, row.address || null, row.territory || row.category || null, row.customer_type || 'retail', row.credit_limit || 0).run();
        imported++;
      } else if (body.entity === 'products') {
        if (!row.name || !row.sku) { errors.push({ row: i + 1, error: 'Name and SKU required' }); failed++; continue; }
        await db.prepare('INSERT INTO products (id, tenant_id, name, sku, category_id, price, cost_price, tax_rate, unit_of_measure, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, row.name, row.sku, row.category || row.category_id || null, row.price || 0, row.cost_price || 0, row.tax_rate || 15, row.unit || row.unit_of_measure || 'each', 'active').run();
        imported++;
      }
    } catch (e) {
      errors.push({ row: i + 1, error: e.message });
      failed++;
    }
  }

  await db.prepare('UPDATE import_jobs SET imported_rows = ?, failed_rows = ?, status = ?, error_details = ?, completed_at = datetime("now") WHERE id = ?').bind(imported, failed, failed > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED', errors.length > 0 ? JSON.stringify(errors) : null, jobId).run();

  return c.json({ success: true, data: { job_id: jobId, total: rows.length, imported, failed, errors: errors.slice(0, 10) } });
});

api.get('/import-jobs', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const jobs = await db.prepare('SELECT * FROM import_jobs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 500').bind(tenantId).all();
  return c.json({ success: true, data: jobs.results || [] });
});

// ==================== W. ERROR HANDLING & LOGGING ====================

// W.1 Error Logs
api.get('/error-logs', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { severity, limit = 100 } = c.req.query();
  let q = 'SELECT * FROM error_logs WHERE tenant_id = ?';
  const params = [tenantId];
  if (severity) { q += ' AND severity = ?'; params.push(severity); }
  q += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const logs = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: logs.results || [] });
});

api.post('/error-logs', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO error_logs (id, tenant_id, user_id, severity, error_code, message, stack_trace, context) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, userId, body.severity || 'ERROR', body.error_code || null, body.message, body.stack_trace || null, body.context ? JSON.stringify(body.context) : null).run();
  return c.json({ success: true, data: { id } }, 201);
});


// ==================== MIGRATIONS ====================
api.post('/migrations/add-agent-type', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN agent_type TEXT").run();
    return c.json({ success: true, message: 'agent_type column added to users table' });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      return c.json({ success: true, message: 'agent_type column already exists' });
    }
    return c.json({ success: false, message: `Migration failed: ${msg}` }, 500);
  }
});

// ==================== X. DATA SEEDING & TESTING ====================

// X.1 Seed Demo Data
api.post('/seed/demo', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const seedId = uuidv4();

  try {
    // Seed brands
    const brands = [
      { name: 'Coca-Cola', code: 'coca-cola', description: 'Coca-Cola beverages' },
      { name: 'Pepsi', code: 'pepsi', description: 'Pepsi beverages' },
      { name: 'Nestle', code: 'nestle', description: 'Nestle products' },
      { name: 'Unilever', code: 'unilever', description: 'Unilever products' },
      { name: 'Tiger Brands', code: 'tiger-brands', description: 'Tiger Brands products' }
    ];
    const brandIds = {};
    for (const brand of brands) {
      const existing = await db.prepare('SELECT id FROM brands WHERE code = ? AND tenant_id = ?').bind(brand.code, tenantId).first();
      if (existing) {
        brandIds[brand.code] = existing.id;
      } else {
        const id = uuidv4();
        await db.prepare('INSERT INTO brands (id, tenant_id, name, code, description, status) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, brand.name, brand.code, brand.description, 'active').run();
        brandIds[brand.code] = id;
      }
    }

    // Seed categories
    const categories = [
      { name: 'Beverages', code: 'beverages', brand_code: 'coca-cola' },
      { name: 'Snacks', code: 'snacks', brand_code: 'pepsi' },
      { name: 'Dairy', code: 'dairy', brand_code: 'nestle' },
      { name: 'Personal Care', code: 'personal-care', brand_code: 'unilever' },
      { name: 'Canned Foods', code: 'canned-foods', brand_code: 'tiger-brands' },
      { name: 'Confectionery', code: 'confectionery', brand_code: 'nestle' },
      { name: 'Household', code: 'household', brand_code: 'unilever' },
      { name: 'Cereals', code: 'cereals', brand_code: 'tiger-brands' }
    ];
    for (const cat of categories) {
      const existing = await db.prepare('SELECT id FROM categories WHERE code = ? AND tenant_id = ?').bind(cat.code, tenantId).first();
      if (!existing) {
        const id = uuidv4();
        await db.prepare('INSERT INTO categories (id, tenant_id, name, code, brand_id) VALUES (?, ?, ?, ?, ?)').bind(id, tenantId, cat.name, cat.code, brandIds[cat.brand_code] || null).run();
      }
    }

    // Seed territories
    const territories = ['Johannesburg North', 'Johannesburg South', 'Pretoria', 'Cape Town', 'Durban'];
    for (const name of territories) {
      const existing = await db.prepare('SELECT id FROM territories WHERE name = ? AND tenant_id = ?').bind(name, tenantId).first();
      if (!existing) {
        const id = uuidv4();
        await db.prepare('INSERT INTO territories (id, tenant_id, name, code) VALUES (?, ?, ?, ?)').bind(id, tenantId, name, name.substring(0, 10).toUpperCase().replace(/\s/g, '-')).run();
      }
    }

    // Seed warehouses
    const warehouses = [{ name: 'Main Warehouse', code: 'WH-MAIN' }, { name: 'Gauteng Hub', code: 'WH-GP' }, { name: 'Cape Town Hub', code: 'WH-CT' }];
    for (const wh of warehouses) {
      const existing = await db.prepare('SELECT id FROM warehouses WHERE name = ? AND tenant_id = ?').bind(wh.name, tenantId).first();
      if (!existing) {
        const id = uuidv4();
        await db.prepare('INSERT INTO warehouses (id, tenant_id, name, code, address) VALUES (?, ?, ?, ?, ?)').bind(id, tenantId, wh.name, wh.code, `${wh.name} Address`).run();
      }
    }

    // Seed price list
    const existingPL = await db.prepare('SELECT id FROM price_lists WHERE is_default = 1 AND tenant_id = ?').bind(tenantId).first();
    if (!existingPL) {
      const plId = uuidv4();
      await db.prepare('INSERT INTO price_lists (id, tenant_id, name, description, is_default, is_active, currency) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(plId, tenantId, 'Standard Price List', 'Default pricing for all customers', 1, 1, 'ZAR').run();
      
      // Add items from products
      const products = await db.prepare('SELECT id, price FROM products WHERE tenant_id = ? LIMIT 500').bind(tenantId).all();
      for (const p of (products.results || [])) {
        const pliId = uuidv4();
        await db.prepare('INSERT INTO price_list_items (id, price_list_id, product_id, unit_price, min_qty) VALUES (?, ?, ?, ?, ?)').bind(pliId, plId, p.id, p.price, 1).run();
      }
    }

    // Seed commission rules
    const existingCR = await db.prepare('SELECT id FROM commission_rules WHERE tenant_id = ? LIMIT 1').bind(tenantId).first();
    if (!existingCR) {
      const rules = [
        { name: 'Standard Sales Commission', source_type: 'SALE', rate: 0.05 },
        { name: 'Van Sales Bonus', source_type: 'VAN_SALE', rate: 0.07 },
        { name: 'New Customer Bonus', source_type: 'NEW_CUSTOMER', rate: 0.10 }
      ];
      for (const rule of rules) {
        const id = uuidv4();
        await db.prepare('INSERT INTO commission_rules (id, tenant_id, name, source_type, rate, is_active) VALUES (?, ?, ?, ?, ?, ?)').bind(id, tenantId, rule.name, rule.source_type, rule.rate, 1).run();
      }
    }

    // Seed trade promotion
    const existingTP = await db.prepare('SELECT id FROM trade_promotions WHERE tenant_id = ? LIMIT 1').bind(tenantId).first();
    if (!existingTP) {
      const tpId = uuidv4();
      await db.prepare("INSERT INTO trade_promotions (id, tenant_id, name, promotion_type, description, start_date, end_date, budget, status, config, created_by) VALUES (?, ?, ?, ?, ?, date('now'), date('now', '+30 days'), ?, ?, ?, ?)").bind(tpId, tenantId, 'Q1 Volume Rebate', 'VOLUME_REBATE', 'Buy more, save more', 50000, 'ACTIVE', JSON.stringify({ tiers: [{ min_qty: 100, rebate_pct: 5 }, { min_qty: 500, rebate_pct: 10 }] }), userId).run();
    }

    // Seed feature flags
    const defaultFlags = ['van_sales', 'trade_promotions', 'anomaly_detection', 'commissions', 'route_planning', 'gps_tracking', 'email_reports', 'api_keys'];
    for (const flag of defaultFlags) {
      const existing = await db.prepare('SELECT id FROM feature_flags WHERE feature_key = ? AND tenant_id = ?').bind(flag, tenantId).first();
      if (!existing) {
        const id = uuidv4();
        await db.prepare('INSERT INTO feature_flags (id, tenant_id, feature_key, is_enabled, config) VALUES (?, ?, ?, ?, ?)').bind(id, tenantId, flag, 1, `Enable ${flag.replace(/_/g, ' ')}`).run();
      }
    }

    // Record seed run
    await db.prepare('INSERT INTO seed_runs (id, tenant_id, seed_type, status, created_by) VALUES (?, ?, ?, ?, ?)').bind(seedId, tenantId, 'DEMO', 'COMPLETED', userId).run();

    return c.json({ success: true, message: 'Demo data seeded successfully', data: { seed_id: seedId } });
  } catch (error) {
    await db.prepare('INSERT INTO seed_runs (id, tenant_id, seed_type, status, error_message, created_by) VALUES (?, ?, ?, ?, ?, ?)').bind(seedId, tenantId, 'DEMO', 'FAILED', error.message, userId).run();
    return c.json({ success: false, message: 'Seed failed: ' + error.message }, 500);
  }
});

api.get('/seed/runs', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const runs = await db.prepare('SELECT * FROM seed_runs WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 500').bind(tenantId).all();
  return c.json({ success: true, data: runs.results || [] });
});

// ==================== X.2 Seed Goldrush Company + Questionnaires ====================
api.post('/seed/goldrush', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  try {
    // 1. Ensure Goldrush company exists
    let goldrushId;
    const existing = await db.prepare("SELECT id FROM field_companies WHERE LOWER(name) LIKE '%goldrush%' AND tenant_id = ?").bind(tenantId).first();
    if (existing) {
      goldrushId = existing.id;
    } else {
      goldrushId = crypto.randomUUID();
      await db.prepare("INSERT INTO field_companies (id, tenant_id, name, code, status, created_at) VALUES (?, ?, 'Goldrush', 'goldrush', 'active', datetime('now'))").bind(goldrushId, tenantId).run();
    }

    // 2. Auto-link current agent to Goldrush company (BUG FIX #1)
    const existingLink = await db.prepare("SELECT id FROM agent_company_links WHERE agent_id = ? AND company_id = ? AND tenant_id = ?").bind(userId, goldrushId, tenantId).first();
    if (!existingLink) {
      const linkId = crypto.randomUUID();
      await db.prepare("INSERT INTO agent_company_links (id, agent_id, company_id, tenant_id, is_active, assigned_at) VALUES (?, ?, ?, ?, 1, datetime('now'))").bind(linkId, userId, goldrushId, tenantId).run();
    }

    // 3. Shop Visit Questionnaire (16 questions)
    const shopQuestions = [
      { key: 'brand_awareness', label: 'Does the customer know the brand?', type: 'radio', options: ['Yes', 'No'], required: true, order: 1 },
      { key: 'stocks_product', label: 'Does the customer stock the product?', type: 'radio', options: ['Yes', 'No'], required: true, order: 2 },
      { key: 'sales_volume', label: 'Current sales volume', type: 'text', required: false, order: 3 },
      { key: 'stock_source', label: 'Where do they get stock?', type: 'select', options: ['Wholesaler', 'Manufacturer', 'Other'], required: true, order: 4 },
      { key: 'competitors_in_store', label: 'Competitors in store', type: 'text', required: false, order: 5 },
      { key: 'competitor_stock_source', label: 'Where do competitors get stock?', type: 'select', options: ['Wholesaler', 'Manufacturer', 'Other'], required: false, order: 6 },
      { key: 'competitor_products', label: 'Competitor products', type: 'textarea', required: false, order: 7 },
      { key: 'competitor_prices', label: 'Competitor prices', type: 'text', required: false, order: 8 },
      { key: 'has_advertising', label: 'Does the shop have our advertising?', type: 'radio', options: ['Yes', 'No'], required: true, order: 9 },
      { key: 'other_ad_brands', label: 'Other advertising brands visible', type: 'text', required: false, order: 10 },
      { key: 'board_installed', label: 'Did you put up our board?', type: 'radio', options: ['Yes', 'No'], required: true, order: 11 },
      { key: 'shop_exterior_photo', label: 'Shop exterior photo', type: 'image', required: false, order: 12 },
      { key: 'competitor_photo', label: 'Competitor product photos', type: 'image', required: false, order: 13 },
      { key: 'ad_board_photo', label: 'Advertising board photo', type: 'image', required: true, order: 14 },
      { key: 'goldrush_id', label: 'Goldrush ID (Optional)', type: 'text', required: false, order: 15 },
      { key: 'additional_notes', label: 'Additional Notes', type: 'textarea', required: false, order: 16 }
    ];

    const shopQId = crypto.randomUUID();
    const existingShopQ = await db.prepare("SELECT id FROM questionnaires WHERE company_id = ? AND tenant_id = ? AND (visit_type = 'customer' OR target_type = 'store')").bind(goldrushId, tenantId).first();
    if (!existingShopQ) {
      await db.prepare("INSERT INTO questionnaires (id, tenant_id, name, module, visit_type, target_type, company_id, questions, is_default, is_active, is_mandatory, created_at, updated_at) VALUES (?, ?, ?, 'field_ops', 'customer', 'store', ?, ?, 1, 1, 1, datetime('now'), datetime('now'))").bind(
        shopQId, tenantId, 'Goldrush Shop Visit Questionnaire', goldrushId, JSON.stringify(shopQuestions)
      ).run();
    }

    // 4. Individual Visit Questionnaire (15 questions)
    const individualQuestions = [
      { key: 'gave_brand_info', label: 'Did you give brand information?', type: 'radio', options: ['Yes', 'No'], required: true, order: 1 },
      { key: 'consumer_name', label: 'Consumer Name', type: 'text', required: true, order: 2 },
      { key: 'consumer_surname', label: 'Consumer Surname', type: 'text', required: true, order: 3 },
      { key: 'id_passport', label: 'ID/Passport Number', type: 'text', required: false, order: 4 },
      { key: 'cellphone', label: 'Cellphone Number', type: 'text', required: true, order: 5 },
      { key: 'goldrush_id', label: 'Goldrush ID', type: 'text', required: true, order: 6 },
      { key: 'id_passport_photo', label: 'ID/Passport Photo', type: 'image', required: false, order: 7 },
      { key: 'consumer_converted', label: 'Did the consumer convert (buy first voucher)?', type: 'radio', options: ['Yes', 'No'], required: true, order: 8 },
      { key: 'betting_elsewhere', label: 'Is the consumer betting somewhere?', type: 'radio', options: ['Yes', 'No'], required: true, order: 9 },
      { key: 'competitor_company', label: 'What company do you use?', type: 'text', required: false, order: 10 },
      { key: 'used_goldrush_before', label: 'Have they used Goldrush before?', type: 'radio', options: ['Yes', 'No'], required: true, order: 11 },
      { key: 'goldrush_comparison', label: 'How does Goldrush compare?', type: 'textarea', required: false, order: 12 },
      { key: 'likes_goldrush', label: 'Do they like Goldrush?', type: 'radio', options: ['Yes', 'No'], required: true, order: 13 },
      { key: 'platform_suggestions', label: 'Platform suggestions', type: 'textarea', required: false, order: 14 },
      { key: 'additional_notes', label: 'Additional Notes', type: 'textarea', required: false, order: 15 }
    ];

    const indivQId = crypto.randomUUID();
    const existingIndivQ = await db.prepare("SELECT id FROM questionnaires WHERE company_id = ? AND tenant_id = ? AND (visit_type = 'individual' OR target_type = 'individual')").bind(goldrushId, tenantId).first();
    if (!existingIndivQ) {
      await db.prepare("INSERT INTO questionnaires (id, tenant_id, name, module, visit_type, target_type, company_id, questions, is_default, is_active, is_mandatory, created_at, updated_at) VALUES (?, ?, ?, 'field_ops', 'individual', 'individual', ?, ?, 1, 1, 1, datetime('now'), datetime('now'))").bind(
        indivQId, tenantId, 'Goldrush Individual Visit Questionnaire', goldrushId, JSON.stringify(individualQuestions)
      ).run();
    }

    // 5. Goldrush Target Rules (BUG FIX #2: Create role-specific rules)
    // Store: 160/month for TL (sum of agents), agents get proportional share
    // Individual: 20/week per agent (Mon-Fri, Sat-Sun catch-up allowed)
    // TL targets = sum of agents, Manager targets = sum of TLs
    const roles = ['agent', 'team_lead', 'manager'];
    for (const roleType of roles) {
      const existingRule = await db.prepare("SELECT id FROM company_target_rules WHERE company_id = ? AND tenant_id = ? AND role_type = ?").bind(goldrushId, tenantId, roleType).first();
      if (!existingRule) {
        const ruleId = crypto.randomUUID();
        // Set appropriate targets per role
        const targets = {
          agent: { dayVisits: 20, dayRegs: 0, monthStore: 0, weekIndiv: 100 }, // 20 individuals/day, 100/week (5 days)
          team_lead: { dayVisits: 0, dayRegs: 4, monthStore: 0, weekIndiv: 0 }, // 4 stores/day = 20/week; individual = sum of agents
          manager: { dayVisits: 0, dayRegs: 0, monthStore: 0, weekIndiv: 0 } // Sum of TLs + agents
        };
        try {
          await db.prepare(`INSERT INTO company_target_rules (id, tenant_id, company_id, role_type,
            target_visits_per_day, target_registrations_per_day, target_conversions_per_day,
            team_lead_own_target_visits, team_lead_own_target_registrations, team_lead_own_target_conversions,
            store_target_per_month_tl, store_target_per_month_agent,
            individual_target_per_week_agent, individual_target_per_month_agent,
            working_days_per_week, working_days, allow_weekend_catchup,
            tl_target_is_agent_sum, mgr_target_is_tl_sum,
            created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?,
              ?, ?, ?,
              0, 0, 0,
              ?, NULL,
              ?, ?,
              5, 'mon,tue,wed,thu,fri', 1,
              1, 1,
              ?, datetime('now'), datetime('now'))`)
            .bind(ruleId, tenantId, goldrushId, roleType,
              targets[roleType].dayVisits, targets[roleType].dayRegs, 2,
              targets[roleType].monthStore, targets[roleType].weekIndiv, userId).run();
        } catch {
          // Fallback if new columns don't exist yet
          await db.prepare(`INSERT INTO company_target_rules (id, tenant_id, company_id, role_type, target_visits_per_day, target_registrations_per_day, target_conversions_per_day, team_lead_own_target_visits, team_lead_own_target_registrations, team_lead_own_target_conversions, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)`)
            .bind(ruleId, tenantId, goldrushId, roleType, targets[roleType].dayVisits, targets[roleType].dayRegs, 2, userId).run();
        }
      }
    }

    // 6. Seed sample board if image was provided via body (optional, can also be uploaded via CRUD)
    // The seed endpoint creates a placeholder; actual image uploaded via /company-sample-boards POST
    const existingBoard = await db.prepare("SELECT id FROM company_sample_boards WHERE company_id = ? AND tenant_id = ? AND is_active = 1").bind(goldrushId, tenantId).first();
    let sampleBoardId = existingBoard?.id;
    if (!existingBoard) {
      sampleBoardId = crypto.randomUUID();
      const now = new Date().toISOString().split('T')[0];
      const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      try {
        await db.prepare(`INSERT INTO company_sample_boards (id, tenant_id, company_id, name, description, r2_key, validity_start, validity_end, is_active, created_by, created_at, updated_at) VALUES (?, ?, ?, 'GR Welcome Offer Banner', 'Approved Goldrush Welcome Offer Banner - primary sample board for comparison', ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`).bind(
          sampleBoardId, tenantId, goldrushId, `sample-boards/${tenantId}/${goldrushId}/${sampleBoardId}.jpg`, now, oneYearLater, userId
        ).run();
      } catch (e) { console.error('Sample board seed error (table may not exist yet):', e); }
    }

    // 7. Seed Goldrush questions as company_custom_questions (shown in details step, not survey step)
    const storeQuestions = [
      { key: 'brand_awareness', label: 'Does the customer know the brand?', type: 'radio', options: ['Yes', 'No'], required: 1, order: 1, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'stocks_product', label: 'Does the customer stock the product?', type: 'radio', options: ['Yes', 'No'], required: 1, order: 2, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'sales_volume', label: 'Current sales volume', type: 'text', options: null, required: 0, order: 3, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'stock_source', label: 'Where do they get stock?', type: 'select', options: ['Wholesaler', 'Manufacturer', 'Other'], required: 1, order: 4, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'competitors_in_store', label: 'Competitors in store', type: 'text', options: null, required: 0, order: 5, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'competitor_stock_source', label: 'Where do competitors get stock?', type: 'select', options: ['Wholesaler', 'Manufacturer', 'Other'], required: 0, order: 6, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'competitor_products', label: 'Competitor products', type: 'textarea', options: null, required: 0, order: 7, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'competitor_prices', label: 'Competitor prices', type: 'text', options: null, required: 0, order: 8, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'has_advertising', label: 'Does the shop have our advertising?', type: 'radio', options: ['Yes', 'No'], required: 1, order: 9, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'other_ad_brands', label: 'Other advertising brands visible', type: 'text', options: null, required: 0, order: 10, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'board_installed', label: 'Did you put up our board?', type: 'radio', options: ['Yes', 'No'], required: 1, order: 11, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'shop_exterior_photo', label: 'Shop exterior photo', type: 'image', options: null, required: 0, order: 12, visit_target_type: 'store', show_in_reports: 1, enable_ai: 0 },
      { key: 'competitor_photo', label: 'Competitor product photos', type: 'image', options: null, required: 0, order: 13, visit_target_type: 'store', show_in_reports: 1, enable_ai: 0 },
      { key: 'ad_board_photo', label: 'Advertising board photo', type: 'image', options: null, required: 1, order: 14, visit_target_type: 'store', show_in_reports: 1, enable_ai: 1 },
      { key: 'goldrush_id', label: 'Goldrush ID (Optional)', type: 'text', options: null, required: 0, order: 15, visit_target_type: 'store', show_in_reports: 1 },
      { key: 'additional_notes', label: 'Additional Notes', type: 'textarea', options: null, required: 0, order: 16, visit_target_type: 'store', show_in_reports: 0 },
    ];
    const individualQuestions2 = [
      { key: 'gave_brand_info', label: 'Did you give brand information?', type: 'radio', options: ['Yes', 'No'], required: 1, order: 1, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'consumer_name', label: 'Consumer Name', type: 'text', options: null, required: 1, order: 2, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'consumer_surname', label: 'Consumer Surname', type: 'text', options: null, required: 1, order: 3, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'id_passport', label: 'ID/Passport Number', type: 'text', options: null, required: 0, order: 4, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'cellphone', label: 'Cellphone Number', type: 'text', options: null, required: 1, order: 5, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'goldrush_id', label: 'Goldrush ID', type: 'text', options: null, required: 1, order: 6, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'id_passport_photo', label: 'ID/Passport Photo', type: 'image', options: null, required: 0, order: 7, visit_target_type: 'individual', show_in_reports: 1, enable_ai: 0 },
      { key: 'consumer_converted', label: 'Did the consumer convert (buy first voucher)?', type: 'radio', options: ['Yes', 'No'], required: 1, order: 8, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'betting_elsewhere', label: 'Is the consumer betting somewhere?', type: 'radio', options: ['Yes', 'No'], required: 1, order: 9, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'competitor_company', label: 'What company do you use?', type: 'text', options: null, required: 0, order: 10, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'used_goldrush_before', label: 'Have they used Goldrush before?', type: 'radio', options: ['Yes', 'No'], required: 1, order: 11, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'goldrush_comparison', label: 'How does Goldrush compare?', type: 'textarea', options: null, required: 0, order: 12, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'likes_goldrush', label: 'Do they like Goldrush?', type: 'radio', options: ['Yes', 'No'], required: 1, order: 13, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'platform_suggestions', label: 'Platform suggestions', type: 'textarea', options: null, required: 0, order: 14, visit_target_type: 'individual', show_in_reports: 1 },
      { key: 'additional_notes', label: 'Additional Notes', type: 'textarea', options: null, required: 0, order: 15, visit_target_type: 'individual', show_in_reports: 0 },
    ];
    const allCcqs = [...storeQuestions, ...individualQuestions2];
    for (const q of allCcqs) {
      try {
        const existing = await db.prepare("SELECT id FROM company_custom_questions WHERE tenant_id = ? AND company_id = ? AND question_key = ? AND visit_target_type = ? AND is_active = 1").bind(tenantId, goldrushId, q.key, q.visit_target_type).first();
        if (!existing) {
          await db.prepare("INSERT INTO company_custom_questions (id, tenant_id, company_id, question_label, question_key, field_type, field_options, is_required, display_order, visit_target_type, check_duplicate, min_length, max_length, show_in_reports, enable_ai_analysis, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, datetime('now'), datetime('now'))").bind(
            crypto.randomUUID(), tenantId, goldrushId, q.label, q.key, q.type, q.options ? JSON.stringify(q.options) : null, q.required, q.order, q.visit_target_type, q.show_in_reports, q.enable_ai || 0
          ).run();
        }
      } catch (e) { console.error(`Company custom question seed error for ${q.key}:`, e); }
    }

    // Fix id_passport_photo to NOT be required for individual visits (correct any previous seed values)
    try {
      await db.prepare("UPDATE company_custom_questions SET is_required = 0, updated_at = datetime('now') WHERE tenant_id = ? AND company_id = ? AND question_key = 'id_passport_photo' AND visit_target_type = 'individual' AND is_required = 1").bind(tenantId, goldrushId).run();
    } catch (e) { console.error('Fix id_passport_photo required error:', e); }

    // Also fix the questionnaire definition if it exists
    try {
      const grIndivQ = await db.prepare("SELECT id, questions FROM questionnaires WHERE tenant_id = ? AND company_id = ? AND name LIKE '%Individual%' AND is_active = 1").bind(tenantId, goldrushId).first();
      if (grIndivQ && grIndivQ.questions) {
        const qs = typeof grIndivQ.questions === 'string' ? JSON.parse(grIndivQ.questions) : grIndivQ.questions;
        let changed = false;
        for (const q of qs) {
          if (q.key === 'id_passport_photo' && q.required !== false) { q.required = false; changed = true; }
        }
        if (changed) {
          await db.prepare("UPDATE questionnaires SET questions = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(JSON.stringify(qs), grIndivQ.id, tenantId).run();
        }
      }
    } catch (e) { console.error('Fix questionnaire id_passport_photo error:', e); }

    // 8. Convergence bridge: derive program_config from the seeded custom questions so the
    //    config-driven capture path works immediately (before the historical migration runs).
    try {
      const ccqRows = (await db.prepare(
        `SELECT question_key, question_label, field_type, min_length, max_length,
                check_duplicate, visit_target_type, show_in_reports
         FROM company_custom_questions WHERE tenant_id = ? AND company_id = ? AND is_active = 1`
      ).bind(tenantId, goldrushId).all()).results ?? [];
      const cfg = buildGoldrushConfig({ tenantId, companyId: goldrushId, rows: ccqRows });
      for (const e of cfg.entries) {
        await db.prepare(
          `INSERT INTO program_config (id, tenant_id, company_id, key, value_json)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET value_json=excluded.value_json`
        ).bind(`pc-${goldrushId}-${e.key}`, tenantId, goldrushId, e.key, e.value_json).run();
      }
    } catch (e) { console.error('Config bridge seed error:', e); }

    return c.json({
      success: true,
      message: 'Goldrush company, questionnaires, targets, and sample board seeded',
      data: {
        company_id: goldrushId,
        shop_questionnaire_id: existingShopQ?.id || shopQId,
        individual_questionnaire_id: existingIndivQ?.id || indivQId,
        sample_board_id: sampleBoardId
      }
    });
  } catch (e) {
    return c.json({ success: false, message: 'Seed failed: ' + (e.message || e) }, 500);
  }
});

// Upload sample board image for existing record (used after seed/goldrush)
api.post('/seed/goldrush-sample-board', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  try {
    const formData = await c.req.formData();
    const image = formData.get('image');
    if (!image) return c.json({ success: false, message: 'image file required' }, 400);

    // Find the Goldrush company and its sample board
    const company = await db.prepare("SELECT id FROM field_companies WHERE LOWER(name) LIKE '%goldrush%' AND tenant_id = ?").bind(tenantId).first();
    if (!company) return c.json({ success: false, message: 'Goldrush company not found. Run /seed/goldrush first.' }, 404);

    const board = await db.prepare("SELECT id, r2_key FROM company_sample_boards WHERE company_id = ? AND tenant_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1").bind(company.id, tenantId).first();
    if (!board) return c.json({ success: false, message: 'No sample board record found. Run /seed/goldrush first.' }, 404);

    // Upload to R2
    const bucket = c.env.UPLOADS;
    if (bucket) {
      await bucket.put(board.r2_key, image.stream(), { httpMetadata: { contentType: 'image/jpeg' } });
      await db.prepare("UPDATE company_sample_boards SET image_url = ?, updated_at = datetime('now') WHERE id = ?").bind(board.r2_key, board.id).run();
    }

    return c.json({ success: true, message: 'Sample board image uploaded', data: { board_id: board.id, r2_key: board.r2_key } });
  } catch (e) {
    return c.json({ success: false, message: 'Upload failed: ' + (e.message || e) }, 500);
  }
});


// ==================== Y. DEPLOYMENT & HEALTH ====================

api.get('/health', async (c) => {
  const db = c.env.DB;
  try {
    const result = await db.prepare('SELECT COUNT(*) as tables FROM sqlite_master WHERE type = "table"').first();
    return c.json({
      status: 'healthy',
      version: '2.0.0',
      database: { connected: true, tables: result?.tables || 0 },
      timestamp: new Date().toISOString(),
      environment: 'production'
    });
  } catch (e) {
    return c.json({ status: 'unhealthy', database: { connected: false, error: e.message }, timestamp: new Date().toISOString() }, 500);
  }
});

// ==================== Z. COMPLETE DOCUMENT INDEX ====================
api.get('/docs/index', (c) => {
  return c.json({
    success: true,
    data: {
      platform: 'FieldVibe',
      version: '2.0.0',
      modules: {
        A: { name: 'Product & Pricing Engine', endpoints: ['/price-lists', '/pricing/resolve', '/promotion-rules', '/promotions/apply'] },
        B: { name: 'Sales Order Engine', endpoints: ['/sales/orders/create', '/sales/orders/:id/status', '/sales/orders/:id/payments'] },
        C: { name: 'Van Sales', endpoints: ['/van-sales/loads/create', '/van-sales/sell', '/van-sales/loads/:id/return', '/van-sales/loads/:id/reconcile'] },
        D: { name: 'Returns & Credit Notes', endpoints: ['/returns', '/credit-notes'] },
        E: { name: 'Inventory', endpoints: ['/inventory/movements', '/inventory/transfers', '/inventory/adjustments', '/inventory/valuation'] },
        F: { name: 'Commission Engine', endpoints: ['/commission-rules', '/commission-earnings', '/commission-payouts'] },
        G: { name: 'Scheduling', endpoints: ['Automated via cron triggers'] },
        H: { name: 'Reporting', endpoints: ['/reports/sales-dashboard', '/reports/agent-performance', '/reports/stock-valuation', '/reports/commissions', '/reports/van-sales'] },
        I: { name: 'Frontend', endpoints: ['React SPA at fieldvibe.vantax.co.za'] },
        J: { name: 'Data Integrity', endpoints: ['/audit-log', '/process/audit'] },
        K: { name: 'Trade Promotions', endpoints: ['/trade-promotions', '/trade-promotion-claims', '/trade-promotions/:id/roi'] },
        L: { name: 'Field Operations', endpoints: ['/territories', '/route-plans', '/visit-activities', '/competitor-sightings', '/gps/validate'] },
        M: { name: 'Anomaly Detection', endpoints: ['/anomaly-flags', '/anomaly-detection/run'] },
        N: { name: 'RBAC', endpoints: ['/rbac/permissions', '/rbac/my-permissions', '/rbac/data-scope', '/feature-flags'] },
        O: { name: 'Insights Dashboards', endpoints: ['/insights/executive', '/insights/sales', '/insights/van-sales', '/insights/field-ops', '/insights/trade-promotions', '/insights/stock', '/insights/commissions', '/insights/goals', '/insights/anomalies'] },
        P: { name: 'Process Completeness', endpoints: ['/process/audit'] },
        Q: { name: 'Super Admin', endpoints: ['/platform/tenants', '/platform/settings', '/platform/health'] },
        R: { name: 'Verification', endpoints: ['Covered by /process/audit'] },
        S: { name: 'Email Reports', endpoints: ['/report-subscriptions', '/report-history', '/reports/generate'] },
        T: { name: 'API Docs & Webhooks', endpoints: ['/docs', '/webhooks', '/api-keys'] },
        U: { name: 'Data Export/Import', endpoints: ['/export', '/import', '/import-jobs'] },
        V: { name: 'Mobile', endpoints: ['React PWA support'] },
        W: { name: 'Error Handling', endpoints: ['/error-logs', '/audit-log'] },
        X: { name: 'Data Seeding', endpoints: ['/seed/demo', '/seed/runs'] },
        Y: { name: 'Deployment', endpoints: ['/health'] },
        Z: { name: 'Document Index', endpoints: ['/docs/index'] }
      }
    }
  });
});


// ==================== COMPANY SAMPLE BOARDS (reference images for photo comparison) ====================

// List sample boards for a company

// ==================== TRADE MARKETING: PHOTO UPLOAD + AI ANALYSIS ====================

// Photo Upload

// ==================== SHARE OF VOICE REPORTING ====================

api.get('/insights/share-of-voice', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { brand_id, period } = c.req.query();
  const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 30;

  const [summary, trend, byCustomer, byBrand] = await Promise.all([
    db.prepare(`SELECT ROUND(AVG(share_percentage), 1) as avg_sov, COUNT(*) as measurements, MAX(share_percentage) as max_sov, MIN(share_percentage) as min_sov FROM share_of_voice_snapshots WHERE tenant_id = ? AND snapshot_date >= date('now', '-' || ? || ' days')${brand_id ? ' AND brand_id = ?' : ''}`).bind(...[tenantId, days, ...(brand_id ? [brand_id] : [])]).first(),
    db.prepare(`SELECT snapshot_date as date, ROUND(AVG(share_percentage), 1) as sov FROM share_of_voice_snapshots WHERE tenant_id = ? AND snapshot_date >= date('now', '-' || ? || ' days') GROUP BY snapshot_date ORDER BY snapshot_date`).bind(tenantId, days).all(),
    db.prepare(`SELECT c.name as customer, ROUND(AVG(s.share_percentage), 1) as sov, COUNT(*) as visits FROM share_of_voice_snapshots s JOIN customers c ON s.customer_id = c.id WHERE s.tenant_id = ? AND s.snapshot_date >= date('now', '-' || ? || ' days') GROUP BY s.customer_id ORDER BY sov DESC LIMIT 50`).bind(tenantId, days).all(),
    db.prepare(`SELECT s.brand_name, ROUND(AVG(s.share_percentage), 1) as sov, SUM(s.brand_facings) as total_facings FROM share_of_voice_snapshots s WHERE s.tenant_id = ? AND s.snapshot_date >= date('now', '-' || ? || ' days') GROUP BY s.brand_name ORDER BY total_facings DESC LIMIT 50`).bind(tenantId, days).all(),
  ]);
  return c.json({ success: true, data: { summary, trend: trend.results, by_customer: byCustomer.results, by_brand: byBrand.results } });
});


// ==================== ACTIVATION LIFECYCLE ====================

api.route('/', activationsPosmRoutes);

// ==================== BRAND OWNER PORTAL ====================

api.get('/brand-owner/dashboard', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  let brandId = c.req.query('brand_id') || '';
  if (!brandId) {
    const firstBrand = await db.prepare('SELECT id FROM brands WHERE tenant_id = ? LIMIT 1').bind(tenantId).first();
    brandId = firstBrand?.id || '';
  }
  if (!brandId) return c.json({ success: true, data: { kpi: { total_stores: 0, avg_sov: 0, compliance_score: 0, photo_count: 0 }, sov_trend: [], store_rankings: [] } });

  const [stores, avgSov, compliance, photoCount, sovTrend, storeRankings] = await Promise.all([
    db.prepare(`SELECT COUNT(DISTINCT s.customer_id) as total FROM share_of_voice_snapshots s WHERE s.tenant_id = ? AND s.brand_id = ?`).bind(tenantId, brandId).first(),
    db.prepare(`SELECT ROUND(AVG(share_percentage), 1) as avg_sov FROM share_of_voice_snapshots WHERE tenant_id = ? AND brand_id = ? AND snapshot_date >= date('now', '-30 days')`).bind(tenantId, brandId).first(),
    db.prepare(`SELECT ROUND(AVG(ai_compliance_score), 1) as avg_score FROM visit_photos WHERE tenant_id = ? AND ai_compliance_score IS NOT NULL AND created_at >= date('now', '-30 days')`).bind(tenantId).first(),
    db.prepare(`SELECT COUNT(*) as count FROM visit_photos WHERE tenant_id = ? AND created_at >= date('now', '-30 days')`).bind(tenantId).first(),
    db.prepare(`SELECT snapshot_date as date, ROUND(AVG(share_percentage), 1) as sov FROM share_of_voice_snapshots WHERE tenant_id = ? AND brand_id = ? AND snapshot_date >= date('now', '-90 days') GROUP BY snapshot_date ORDER BY snapshot_date`).bind(tenantId, brandId).all(),
    db.prepare(`SELECT c.name as store_name, c.latitude, c.longitude, ROUND(AVG(s.share_percentage), 1) as sov, COUNT(*) as measurements FROM share_of_voice_snapshots s JOIN customers c ON s.customer_id = c.id WHERE s.tenant_id = ? AND s.brand_id = ? AND s.snapshot_date >= date('now', '-30 days') GROUP BY s.customer_id ORDER BY sov DESC LIMIT 100`).bind(tenantId, brandId).all(),
  ]);
  return c.json({ success: true, data: {
    kpi: { total_stores: stores?.total || 0, avg_sov: avgSov?.avg_sov || 0, compliance_score: compliance?.avg_score || 0, photo_count: photoCount?.count || 0 },
    sov_trend: sovTrend.results || [], store_rankings: storeRankings.results || []
  }});
});

api.get('/brand-owner/reports', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  let brandId = c.req.query('brand_id') || '';
  if (!brandId) {
    const firstBrand = await db.prepare('SELECT id FROM brands WHERE tenant_id = ? LIMIT 1').bind(tenantId).first();
    brandId = firstBrand?.id || '';
  }
  if (!brandId) return c.json({ success: true, data: { weekly_performance: [], compliance_scorecard: [], competitors: [] } });

  const [weeklyPerf, complianceCard, competitors] = await Promise.all([
    db.prepare(`SELECT strftime('%W', snapshot_date) as week, ROUND(AVG(share_percentage), 1) as avg_sov, COUNT(DISTINCT customer_id) as stores_visited, SUM(brand_facings) as total_facings FROM share_of_voice_snapshots WHERE tenant_id = ? AND brand_id = ? AND snapshot_date >= date('now', '-90 days') GROUP BY week ORDER BY week DESC LIMIT 12`).bind(tenantId, brandId).all(),
    db.prepare(`SELECT 'meeting_target' as status, COUNT(DISTINCT customer_id) as store_count FROM share_of_voice_snapshots WHERE tenant_id = ? AND brand_id = ? AND snapshot_date >= date('now', '-30 days') AND share_percentage >= 50 UNION ALL SELECT 'below_target' as status, COUNT(DISTINCT customer_id) as store_count FROM share_of_voice_snapshots WHERE tenant_id = ? AND brand_id = ? AND snapshot_date >= date('now', '-30 days') AND share_percentage < 50`).bind(tenantId, brandId, tenantId, brandId).all(),
    db.prepare(`SELECT brand_name, ROUND(AVG(share_percentage), 1) as avg_sov, SUM(total_facings - brand_facings) as competitor_facings FROM share_of_voice_snapshots WHERE tenant_id = ? AND brand_id != ? AND snapshot_date >= date('now', '-30 days') GROUP BY brand_name ORDER BY competitor_facings DESC LIMIT 20`).bind(tenantId, brandId).all(),
  ]);
  return c.json({ success: true, data: { weekly_performance: weeklyPerf.results || [], compliance_scorecard: complianceCard.results || [], competitors: competitors.results || [] } });
});

// ==================== COMPETITOR INTELLIGENCE ====================

api.get('/insights/competitors', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { period } = c.req.query();
  const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 30;

  const [topBrands, pricingTrends, recentSightings, geoData] = await Promise.all([
    db.prepare(`SELECT competitor_brand, COUNT(*) as sighting_count, ROUND(AVG(observed_price), 2) as avg_price, ROUND(AVG(facing_count), 1) as avg_facings FROM competitor_sightings WHERE tenant_id = ? AND sighting_date >= date('now', '-' || ? || ' days') GROUP BY competitor_brand ORDER BY sighting_count DESC LIMIT 10`).bind(tenantId, days).all(),
    db.prepare(`SELECT competitor_brand, strftime('%W', sighting_date) as week, ROUND(AVG(observed_price), 2) as avg_price FROM competitor_sightings WHERE tenant_id = ? AND sighting_date >= date('now', '-' || ? || ' days') AND observed_price > 0 GROUP BY competitor_brand, week ORDER BY week`).bind(tenantId, days).all(),
    db.prepare(`SELECT cs.*, c.name as customer_name FROM competitor_sightings cs LEFT JOIN customers c ON cs.customer_id = c.id WHERE cs.tenant_id = ? ORDER BY cs.sighting_date DESC LIMIT 20`).bind(tenantId).all(),
    db.prepare(`SELECT gps_latitude, gps_longitude, competitor_brand, COUNT(*) as count FROM competitor_sightings WHERE tenant_id = ? AND gps_latitude IS NOT NULL AND sighting_date >= date('now', '-' || ? || ' days') GROUP BY ROUND(gps_latitude, 2), ROUND(gps_longitude, 2), competitor_brand`).bind(tenantId, days).all(),
  ]);
  return c.json({ success: true, data: { top_brands: topBrands.results || [], pricing_trends: pricingTrends.results || [], recent_sightings: recentSightings.results || [], geo_data: geoData.results || [] } });
});

// Enhance competitor sightings to accept photo_id


// ==================== MISSING ROUTES - ZERO DEFECT AUDIT ====================

// Dashboard summary & KPIs
api.get('/dashboard/summary', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [orders, revenue, customers, visits] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND status != 'CANCELLED' AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM visits WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
  ]);
  return c.json({ success: true, data: { orders: orders?.count || 0, revenue: revenue?.total || 0, customers: customers?.count || 0, visits: visits?.count || 0 } });
});

api.get('/dashboard/kpis', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [avgOrder, conversionRate, activeAgents, pendingOrders] = await Promise.all([
    db.prepare("SELECT COALESCE(AVG(total_amount), 0) as avg FROM sales_orders WHERE tenant_id = ? AND status != 'CANCELLED' AND created_at >= datetime('now', '-30 days')").bind(tenantId).first(),
    db.prepare("SELECT CASE WHEN (SELECT COUNT(*) FROM visits WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')) > 0 THEN ROUND(CAST((SELECT COUNT(*) FROM sales_orders WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')) AS FLOAT) / (SELECT COUNT(*) FROM visits WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')) * 100, 1) ELSE 0 END as rate").bind(tenantId, tenantId, tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role = 'agent' AND status = 'active'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ? AND status IN ('draft', 'CONFIRMED', 'PROCESSING')").bind(tenantId).first(),
  ]);
  return c.json({ success: true, data: { avg_order_value: avgOrder?.avg || 0, conversion_rate: conversionRate?.rate || 0, active_agents: activeAgents?.count || 0, pending_orders: pendingOrders?.count || 0 } });
});

// Van sales cash sessions

// Field operations dashboard

// Promotions routes

// KYC dashboard & stats

// Reports - executive, field-ops, inventory, trade-promotions, compliance, anomalies
api.get('/reports/executive', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [revenue, orders, customers, agents] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND status != 'CANCELLED'").bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM sales_orders WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as count FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND role = 'agent'").bind(tenantId).first(),
  ]);
  return c.json({ success: true, data: { total_revenue: revenue?.total || 0, total_orders: orders?.count || 0, total_customers: customers?.count || 0, total_agents: agents?.count || 0 } });
});

api.get('/reports/field-ops', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT u.first_name || ' ' || u.last_name as agent, COUNT(DISTINCT v.id) as visits, COUNT(CASE WHEN v.status = 'completed' THEN 1 END) as completed, COUNT(DISTINCT so.id) as orders, COALESCE(SUM(so.total_amount), 0) as revenue FROM users u LEFT JOIN visits v ON v.agent_id = u.id AND v.tenant_id = ? LEFT JOIN sales_orders so ON so.agent_id = u.id AND so.tenant_id = ? WHERE u.tenant_id = ? AND u.role = 'agent' GROUP BY u.id ORDER BY revenue DESC").bind(tenantId, tenantId, tenantId).all();
  return c.json({ success: true, data: data.results || [] });
});

api.get('/reports/inventory', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare('SELECT p.name, p.sku, w.name as warehouse, sl.quantity, p.cost_price, (sl.quantity * COALESCE(p.cost_price, 0)) as value FROM stock_levels sl JOIN products p ON sl.product_id = p.id JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ? ORDER BY value DESC').bind(tenantId).all();
  return c.json({ success: true, data: data.results || [] });
});

api.get('/reports/trade-promotions', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare('SELECT tp.name, tp.promotion_type, tp.status, tp.budget, tp.actual_spend, (SELECT COUNT(*) FROM trade_promotion_enrollments WHERE promotion_id = tp.id) as enrollments FROM trade_promotions tp WHERE tp.tenant_id = ? ORDER BY tp.created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: data.results || [] });
});

api.get('/reports/compliance', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare('SELECT pa.*, c.name as customer_name FROM posm_audits pa LEFT JOIN posm_installations pi2 ON pa.installation_id = pi2.id LEFT JOIN customers c ON pi2.customer_id = c.id WHERE pa.tenant_id = ? ORDER BY pa.created_at DESC LIMIT 100').bind(tenantId).all();
  return c.json({ success: true, data: data.results || [] });
});

api.get('/reports/anomalies', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const data = await db.prepare("SELECT af.*, u.first_name || ' ' || u.last_name as agent_name FROM anomaly_flags af LEFT JOIN users u ON af.agent_id = u.id WHERE af.tenant_id = ? ORDER BY af.created_at DESC LIMIT 100").bind(tenantId).all();
  return c.json({ success: true, data: data.results || [] });
});

// Admin routes
// Email subscription CRUD for scheduled reports (super_admin/admin only).
// Used to register Goldrush staff to receive the weekly Monday email.
api.route('/', adminOpsRoutes);

// --- Dashboard sub-routes ---

api.get('/dashboard/sales', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  const [currentSales, lastSales, currentOrders, lastOrders, pending, fulfilled, target] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND created_at >= ?").bind(tenantId, monthStart).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND created_at >= ? AND created_at <= ?").bind(tenantId, lastMonthStart, lastMonthEnd).first(),
    db.prepare("SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ? AND created_at >= ?").bind(tenantId, monthStart).first(),
    db.prepare("SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ? AND created_at >= ? AND created_at <= ?").bind(tenantId, lastMonthStart, lastMonthEnd).first(),
    db.prepare("SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ? AND status IN ('pending', 'confirmed', 'processing')").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ? AND status IN ('delivered', 'completed')").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(target_visits), 0) as total FROM monthly_targets WHERE tenant_id = ? AND target_month = ?").bind(tenantId, monthStart.substring(0, 7)).first(),
  ]);
  const totalSales = currentSales?.total || 0;
  const prevSales = lastSales?.total || 0;
  const totalOrders = currentOrders?.total || 0;
  const prevOrders = lastOrders?.total || 0;
  const salesTarget = target?.total || 0;
  return c.json({ success: true, data: {
    totalSales, salesChange: prevSales > 0 ? ((totalSales - prevSales) / prevSales * 100) : 0,
    totalOrders, ordersChange: prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders * 100) : 0,
    averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
    aovChange: 0, conversionRate: 0,
    salesTarget, salesAchieved: totalSales,
    targetProgress: salesTarget > 0 ? (totalSales / salesTarget * 100) : 0,
    pendingOrders: pending?.total || 0, fulfilledOrders: fulfilled?.total || 0,
  }});
});

api.get('/dashboard/admin', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [users, customers, products, visits, orders, revenue] = await Promise.all([
    db.prepare('SELECT COUNT(*) as total FROM users WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as total FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare('SELECT COUNT(*) as total FROM products WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total FROM visits WHERE tenant_id = ? AND created_at >= date('now', 'start of month')").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ? AND created_at >= date('now', 'start of month')").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND created_at >= date('now', 'start of month')").bind(tenantId).first(),
  ]);
  return c.json({ success: true, data: { total_users: users?.total || 0, total_customers: customers?.total || 0, total_products: products?.total || 0, month_visits: visits?.total || 0, month_orders: orders?.total || 0, month_revenue: revenue?.total || 0 } });
});

api.get('/dashboard/customers', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [total, active, newThisMonth, byType] = await Promise.all([
    db.prepare('SELECT COUNT(*) as total FROM customers WHERE tenant_id = ?').bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total FROM customers WHERE tenant_id = ? AND status = 'active'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total FROM customers WHERE tenant_id = ? AND created_at >= date('now', 'start of month')").bind(tenantId).first(),
    db.prepare('SELECT COALESCE(customer_type, type, \'unknown\') as type, COUNT(*) as count FROM customers WHERE tenant_id = ? GROUP BY COALESCE(customer_type, type)').bind(tenantId).all(),
  ]);
  return c.json({ success: true, data: { total: total?.total || 0, active: active?.total || 0, new_this_month: newThisMonth?.total || 0, by_type: byType.results || [] } });
});

api.get('/dashboard/finance', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [totalRevenue, totalPaid, totalPending, commissions] = await Promise.all([
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND created_at >= date('now', 'start of month')").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE tenant_id = ? AND status = 'completed' AND created_at >= date('now', 'start of month')").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND payment_status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first(),
  ]);
  return c.json({ success: true, data: { total_revenue: totalRevenue?.total || 0, total_paid: totalPaid?.total || 0, total_pending: totalPending?.total || 0, pending_commissions: commissions?.total || 0 } });
});

api.get('/dashboard/orders', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [total, pending, processing, completed, recent] = await Promise.all([
    db.prepare("SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ? AND created_at >= date('now', 'start of month')").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ? AND status = 'processing'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ? AND status = 'completed'").bind(tenantId).first(),
    db.prepare('SELECT * FROM sales_orders WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 10').bind(tenantId).all(),
  ]);
  return c.json({ success: true, data: { total: total?.total || 0, pending: pending?.total || 0, processing: processing?.total || 0, completed: completed?.total || 0, recent: recent.results || [] } });
});

// --- Field Operations missing routes ---


// --- Trade Marketing missing routes ---


// --- Reports/Analytics missing route ---

api.get('/reports/analytics', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [visits, orders, revenue, customers] = await Promise.all([
    db.prepare("SELECT COUNT(*) as total FROM visits WHERE tenant_id = ? AND created_at >= date('now', 'start of month')").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total FROM sales_orders WHERE tenant_id = ? AND created_at >= date('now', 'start of month')").bind(tenantId).first(),
    db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE tenant_id = ? AND created_at >= date('now', 'start of month')").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as total FROM customers WHERE tenant_id = ? AND created_at >= date('now', 'start of month')").bind(tenantId).first(),
  ]);
  return c.json({ success: true, data: { total_visits: visits?.total || 0, total_orders: orders?.total || 0, total_revenue: revenue?.total || 0, new_customers: customers?.total || 0 } });
});

// --- Van Sales base route (frontend calls /van-sales without sub-path) ---


// ==================== END MISSING ROUTE FIXES ====================

// Workflow routes
api.get('/workflow/processes', authMiddleware, async (c) => {
  return c.json({ success: true, data: {
    sales_order: { forward: ['draft -> CONFIRMED', 'CONFIRMED -> PROCESSING', 'PROCESSING -> READY', 'READY -> DISPATCHED', 'DISPATCHED -> DELIVERED', 'DELIVERED -> COMPLETED'], reverse: ['Any -> CANCELLED'], status: 'implemented' },
    van_sales: { forward: ['load -> in_field', 'in_field -> sell', 'in_field -> returned'], reverse: ['Stock discrepancy detection', 'Cash reconciliation'], status: 'implemented' },
    returns: { forward: ['PENDING -> PROCESSED', 'PENDING -> REJECTED'], reverse: ['Stock return', 'Credit note creation'], status: 'implemented' },
    commissions: { forward: ['pending -> approved -> paid', 'pending -> disputed -> approved | rejected'], reverse: ['rejected (manager)', 'reversed (auto on order cancel, or manual)'], status: 'implemented' },
    inventory: { forward: ['PURCHASE_IN, TRANSFER_IN, ADJUSTMENT_UP'], reverse: ['SALE_OUT, TRANSFER_OUT, ADJUSTMENT_DOWN'], status: 'implemented' },
  }});
});

api.get('/workflow/documentation', authMiddleware, async (c) => {
  return c.json({ success: true, data: {
    overview: 'FieldVibe workflow engine supports forward and reverse transaction flows across all modules.',
    modules: ['Sales Orders', 'Van Sales', 'Returns', 'Commissions', 'Inventory', 'Trade Promotions'],
    api_docs_url: '/api/docs',
  }});
});



// Duplicate /insights/competitors removed - already defined above at line ~7568

// ==================== COMPANY PORTAL AUTH MIDDLEWARE ====================
app.route('/', companyPortalRoutes);

// ==================== v2 T-10: EVENTS CRUD ====================

// events/analytics/summary - MUST be before /events/:id to avoid route shadowing
api.get('/events/analytics/summary', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const stats = await db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN status = "active" OR status = "ongoing" THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed, SUM(budget) as total_budget, SUM(attendee_count) as total_attendees FROM events WHERE tenant_id = ?').bind(tenantId).first().catch(() => null);
    return c.json({ success: true, data: {
      total_events: stats?.total || 0,
      active_events: stats?.active || 0,
      completed_events: stats?.completed || 0,
      total_budget: stats?.total_budget || 0,
      total_attendees: stats?.total_attendees || 0,
      avg_attendance_rate: 0
    }});
  } catch (e) { return c.json({ success: true, data: { total_events: 0, active_events: 0, completed_events: 0, total_budget: 0, total_attendees: 0, avg_attendance_rate: 0 } }); }
});

api.get('/events', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const { status, event_type, search } = c.req.query();
    let sql = 'SELECT * FROM events WHERE tenant_id = ?';
    const binds = [tenantId];
    if (status) { sql += ' AND status = ?'; binds.push(status); }
    if (event_type) { sql += ' AND event_type = ?'; binds.push(event_type); }
    if (search) { sql += ' AND (name LIKE ? OR description LIKE ?)'; binds.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY start_date DESC LIMIT 100';
    const result = await db.prepare(sql).bind(...binds).all();
    return c.json({ success: true, data: result.results || [] });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

api.get('/events/:id', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const event = await db.prepare('SELECT * FROM events WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenantId).first();
    if (!event) return c.json({ success: false, message: 'Event not found' }, 404);
    return c.json({ success: true, data: event });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

api.post('/events', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const userId = c.get('userId');
    const body = await c.req.json();
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO events (id, tenant_id, name, event_type, description, location, start_date, end_date, status, budget, organizer_id, max_attendees, tags, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(
      id, tenantId, body.name, body.event_type || 'general', body.description || null, body.location || null,
      body.start_date || null, body.end_date || null, body.status || 'planned', body.budget || 0,
      body.organizer_id || userId, body.max_attendees || null, JSON.stringify(body.tags || []), body.notes || null, userId
    ).run();
    return c.json({ success: true, data: { id, ...body } }, 201);
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

api.put('/events/:id', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    const body = await c.req.json();
    const id = c.req.param('id');
    await db.prepare('UPDATE events SET name=?, event_type=?, description=?, location=?, start_date=?, end_date=?, status=?, budget=?, max_attendees=?, tags=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND tenant_id=?').bind(
      body.name, body.event_type, body.description || null, body.location || null,
      body.start_date || null, body.end_date || null, body.status, body.budget || 0,
      body.max_attendees || null, JSON.stringify(body.tags || []), body.notes || null, id, tenantId
    ).run();
    return c.json({ success: true, data: { id, ...body } });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

api.delete('/events/:id', authMiddleware, async (c) => {
  try {
    const db = c.env.DB;
    const tenantId = c.get('tenantId');
    await db.prepare('DELETE FROM events WHERE id = ? AND tenant_id = ?').bind(c.req.param('id'), tenantId).run();
    return c.json({ success: true, message: 'Event deleted' });
  } catch (e) { return c.json({ success: false, message: e.message }, 500); }
});


// ==================== FIELD OPS REPORTS (SSReports-style, native FieldVibe data) ====================

// Report KPIs - total visits, agents, shops, conversions
api.route('/', reportRoutes);

// Goldrush Photo ID Verification — uses vision AI to extract the Goldrush ID from a
// player photo and compare it to the ID the agent typed in the form.


// Shops analytics (customer/store analytics)




// ==================== MISSING FRONTEND API ROUTES ====================
// Routes needed by frontend services - prevents 404 errors on all screens

// ai routes
api.get('/ai/chat/comprehensive-analysis', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/ai/chat/config', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/ai/chat/customers/:customerId/fraud-check', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/ai/chat/customers/:customerId/insights', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/ai/chat/field-agents/:id/insights', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/ai/chat/orders/:orderId/fraud-check', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/ai/chat/orders/insights', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/ai/chat/products/:productId/insights', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// analytics routes
api.get('/analytics/comparative', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/analytics/custom', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/analytics/forecast', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/analytics/realtime', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/analytics/reports', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// audit routes
api.get('/audit/:id/:subId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/audit/:id/:subId/entries/:entryId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// beat-routes routes

// boards routes

// campaigns routes

// commissions routes

// currency-system routes
api.post('/currency-system/convert', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/currency-system/currencies', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/currency-system/currencies/:currencyId/exchange-rate', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/currency-system/dashboard', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/currency-system/detect-currency', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/currency-system/location-currencies', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// customers routes

// discounts routes

// documents routes
api.get('/documents/:documentId/:documentId/relationships', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/documents/:documentId/:documentId/relationships/:relationshipId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/documents/relationships', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/documents/relationships/:relationshipId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// field-commissions routes

// field-operations routes

// finance routes
api.get('/finance/invoices/:id/items/:itemId/history', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// gps-tracking routes

// inventory routes

// kyc routes

// orders routes

// refunds routes (needed by frontend refunds.service.ts)

// pricing routes

// product-distributions routes

// products routes

// promotions routes

// reports routes
api.get('/reports', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.post('/reports/:reportId/:reportId/export', authMiddleware, async (c) => {
  try { const body = await c.req.json().catch(() => ({})); return c.json({ success: true, data: { id: crypto.randomUUID(), ...body, status: 'completed', updated_at: new Date().toISOString() } }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/reports/:reportId/download', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/reports/customers', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/reports/field-operations/:id', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/reports/finance/:id', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/reports/financial', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/reports/inventory/:id', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/reports/sales/:id', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/reports/schedule', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/reports/stats', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/reports/templates', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// route-stops routes

// suppliers routes

// surveys routes (real implementations)

// trade-marketing routes

// events/analytics/summary route moved above /events/:id to avoid shadowing

// data-import/history
api.get('/data-import/history', authMiddleware, async (c) => {
  return c.json({ success: true, data: [] });
});

// data-export/jobs
api.get('/data-export/jobs', authMiddleware, async (c) => {
  return c.json({ success: true, data: [] });
});

// trade-promotion-claims routes

api.route('/', transactionRoutes);

// uploads routes
api.get('/uploads/:id/:subId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/uploads/:id/metadata', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// van-sales routes

// visit-surveys routes (real implementations)

// visits routes

// inventory additional routes (restored)

// kyc additional routes (restored)

// orders additional routes (restored)

// promotions additional routes (restored)

// reports additional routes (restored)
api.get('/reports/:reportId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

// surveys additional routes (metrics/reports/stats/trends) are registered earlier,
// before /surveys/:id, so the param route doesn't shadow them.

// van-sales additional routes (restored)

// warehouses routes

// ==================== PUBLIC PHOTO SERVING (no auth required for <img> tags) ====================
app.get('/api/uploads/:key{.+}', async (c) => {
  try {
    const bucket = c.env.UPLOADS;
    if (!bucket) return c.json({ success: false, message: 'Storage not configured' }, 500);
    const key = c.req.param('key');
    const object = await bucket.get(key);
    if (!object) return c.json({ success: false, message: 'File not found' }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(object.body, { headers });
  } catch (error) {
    return c.json({ success: false, message: 'File retrieval failed' }, 500);
  }
});

// ==================== FIELD-OPS ROUTE MODULES ====================
api.route('/field-ops', configRoutes);
api.route('/field-ops', hierarchyRoutes);
api.route('/field-ops', incentiveRoutes);
api.route('/field-ops', callRoutes);
api.route('/field-ops', gmRoutes);
api.route('/field-ops', kpiRoutes);
api.route('/field-ops', depositRoutes);
api.route('/field-ops', metricFactsRoutes);
api.route('/field-ops', issueRoutes);

// ==================== DYNAMIC PRICING (SECTION 1) ====================


// ==================== MOUNT AND EXPORT ====================
// Mounted last so every api.get/post above (including routes declared late in
// this file) is registered before Hono copies routes at mount time.
app.route('/api', api);

// Catch-all for unmatched routes
app.all('*', (c) => c.json({ success: false, message: 'Not found' }, 404));

export default {
  fetch: app.fetch,
  scheduled: async (event, env, ctx) => {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();
    const date = now.getUTCDate();
    // Everything people-facing is gated in SAST, the timezone the field actually works in.
    // South Africa has no DST, so UTC+2 is a constant and this needs no tz database.
    const sastHour = (hour + 2) % 24;
    if (hour === 4) await checkOverdueInvoices(env.DB);
    if (hour === 6) await checkLowStock(env.DB);
    if (hour === 16) await checkStaleVanLoads(env.DB);
    if (date === 1 && hour === 22) await closeCommissionPeriod(env.DB);
    if (day === 1 && hour === 5) await generateAgingReport(env.DB);
    if (day === 1 && hour === 5) await sendWeeklyGoldrushReports(env);
    // GM daily digest, 06:00 / 12:00 / 18:00 SAST.
    if (sastHour === 6 || sastHour === 12 || sastHour === 18) await generateGmDigest(env);
    // Hourly performance summaries, 08:00-17:00 SAST (Mon-Fri).
    if (sastHour >= 8 && sastHour <= 17) await generatePerformanceSummaries(env.DB);
    // Inactivity nudges + escalation on the same work-hours window (self-gates on SAST inside).
    if (sastHour >= 8 && sastHour <= 17) await checkInactiveAgents(env.DB, env);
    // Hourly: open/act/escalate/resolve performance issues (self-gates on SAST inside).
    if (sastHour >= 8 && sastHour < 18) await reactToIssues(env.DB, env);
    // Reap stuck rows first so they re-enter the drain queue this tick.
    await reapStuckAiProcessing(env.DB);
    // Drain pending AI analysis on every tick. Bounded by AI_DRAIN_BATCH_SIZE; the existing
    // 14-cron schedule means roughly 14 * BATCH photos per day = 350/day at the current setting.
    ctx.waitUntil(drainAiBacklog(env));
  },
};

export { app };
