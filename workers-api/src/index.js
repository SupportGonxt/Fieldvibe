import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimiter, authMiddleware } from './lib/middleware.js';
// Route modules
import configRoutes from './routes/field-ops/config.js';
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
import inventoryRoutes from './routes/inventory.js';
import vanOpsRoutes from './routes/vanOps.js';
import salesRoutes from './routes/sales.js';
import marketingRoutes from './routes/marketing.js';
import fieldOpsRoutes from './routes/fieldOps.js';
import analyticsRoutes from './routes/analytics.js';
import financeRoutes from './routes/finance.js';
import platformRoutes from './routes/platform.js';
import companyCustomerRoutes from './routes/coreCrud/companiesCustomers.js';
import mobileDashboardRoutes from './routes/mobileDashboards.js';
import authRoutes from './routes/auth.js';
import portalRoutes from './routes/portal.js';
import companyPortalRoutes from './routes/companyPortal.js';
import transactionRoutes from './routes/transactions.js';
import tradePromotionRoutes from './routes/tradePromotions.js';
import activationsPosmRoutes from './routes/activationsPosm.js';
import adminOpsRoutes from './routes/adminOps.js';
// Cron jobs (invoked by the scheduled handler)
import { generateGmDigest, generatePerformanceSummaries, checkInactiveAgents, reactToIssues, checkOverdueInvoices, checkLowStock, checkStaleVanLoads, closeCommissionPeriod, generateAgingReport, sendWeeklyGoldrushReports, drainAiBacklog, reapStuckAiProcessing } from './cron/jobs.js';
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
api.route('/', financeRoutes);
api.route('/', commissionRoutes);
api.route('/', surveyRoutes);
api.route('/', platformRoutes);
api.route('/', marketingRoutes);
api.route('/', salesRoutes);
api.route('/', analyticsRoutes);
api.route('/', tradePromotionRoutes);
api.route('/', adminOpsRoutes);
app.route('/', portalRoutes);
api.route('/', fieldOpsPerformanceRoutes);
api.route('/', cashReconRoutes);
api.route('/', activationsPosmRoutes);
app.route('/', companyPortalRoutes);
api.route('/', reportRoutes);

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






api.route('/', vanSalesRoutes);

// ==================== DEPLOYMENT & HEALTH ====================
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

api.route('/', transactionRoutes);

api.get('/uploads/:id/:subId', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});
api.get('/uploads/:id/metadata', authMiddleware, async (c) => {
  try { const tenantId = c.get('tenantId'); return c.json({ success: true, data: [], total: 0 }); }
  catch (e) { return c.json({ success: false, message: e.message }, 500); }
});

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

// ==================== MOUNT AND EXPORT ====================
// Mounted last so every api.get/post above (including routes declared late in
// this file) is registered before Hono copies routes at mount time.
app.route('/api', api);

// Catch-all for unmatched routes
app.all('*', (c) => c.json({ success: false, message: 'Not found' }, 404));

export default {
  fetch: app.fetch,
  scheduled: async (event, env, ctx) => {
    // reactToIssues runs on its own triggers for a fresh 1000-subrequest budget
    // (the hourly tick's earlier jobs drain the shared budget; see cron/jobs.js).
    const REACT_TO_ISSUES_CRONS = new Set(['30 6-15 * * *', '45 15 * * *']);
    if (REACT_TO_ISSUES_CRONS.has(event.cron)) {
      await reactToIssues(env.DB, env);
      return;
    }
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
    // Reap stuck rows first so they re-enter the drain queue this tick.
    await reapStuckAiProcessing(env.DB);
    // Drain pending AI analysis on every tick. Bounded by AI_DRAIN_BATCH_SIZE; the existing
    // 14-cron schedule means roughly 14 * BATCH photos per day = 350/day at the current setting.
    ctx.waitUntil(drainAiBacklog(env));
  },
};

export { app };
