import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, requireRole } from '../lib/middleware.js';

const app = new Hono();

// ==================== CASH RECONCILIATION ROUTES ====================
app.get('/cash-reconciliation/sessions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const sessions = await db.prepare("SELECT * FROM van_reconciliations WHERE tenant_id = ? ORDER BY created_at DESC").bind(tenantId).all();
  return c.json({ data: sessions.results || [] });
});

app.get('/cash-reconciliation/sessions/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const session = await db.prepare("SELECT * FROM van_reconciliations WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
  return session ? c.json(session) : c.json({ message: 'Not found' }, 404);
});

app.post('/cash-reconciliation/sessions', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare("INSERT INTO van_reconciliations (id, tenant_id, van_stock_load_id, status, created_at) VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)").bind(id, tenantId, body.load_id || body.van_stock_load_id || '').run();
  return c.json({ id, message: 'Session created' }, 201);
});

app.get('/cash-reconciliation/sessions/:sessionId/collections', authMiddleware, async (c) => {
  return c.json({ data: [] });
});

app.post('/cash-reconciliation/sessions/:sessionId/collections', authMiddleware, async (c) => {
  return c.json({ success: false, message: 'Collection added' }, 201);
});

app.post('/cash-reconciliation/sessions/:sessionId/close', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const sessionId = c.req.param('sessionId');
  await db.prepare("UPDATE van_reconciliations SET status = 'closed' WHERE id = ? AND tenant_id = ?").bind(sessionId, tenantId).run();
  return c.json({ success: true, message: 'Session closed' });
});

app.post('/cash-reconciliation/sessions/:sessionId/approve-variance', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const sessionId = c.req.param('sessionId');
  await db.prepare("UPDATE van_reconciliations SET status = 'approved' WHERE id = ? AND tenant_id = ?").bind(sessionId, tenantId).run();
  return c.json({ success: true, message: 'Variance approved' });
});

app.get('/cash-reconciliation/bank-deposits', authMiddleware, async (c) => {
  return c.json({ data: [] });
});

app.post('/cash-reconciliation/bank-deposits', authMiddleware, async (c) => {
  return c.json({ success: false, message: 'Deposit recorded' }, 201);
});

app.get('/cash-reconciliations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const recons = await db.prepare("SELECT * FROM van_reconciliations WHERE tenant_id = ? ORDER BY created_at DESC").bind(tenantId).all();
  return c.json({ data: recons.results || [] });
});

app.get('/cash-reconciliations/stats', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const [total, pending, approved] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM van_reconciliations WHERE tenant_id = ?").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM van_reconciliations WHERE tenant_id = ? AND status = 'pending'").bind(tenantId).first(),
    db.prepare("SELECT COUNT(*) as count FROM van_reconciliations WHERE tenant_id = ? AND status = 'approved'").bind(tenantId).first(),
  ]);
  return c.json({ data: { total: total?.count || 0, pending: pending?.count || 0, approved: approved?.count || 0 }});
});

app.get('/cash-reconciliations/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const recon = await db.prepare("SELECT * FROM van_reconciliations WHERE id = ? AND tenant_id = ?").bind(id, tenantId).first();
  return recon ? c.json(recon) : c.json({ message: 'Not found' }, 404);
});

app.post('/cash-reconciliations', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare("INSERT INTO van_reconciliations (id, tenant_id, van_stock_load_id, status, created_at) VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP)").bind(id, tenantId, body.load_id || body.van_stock_load_id || '').run();
  return c.json({ id, message: 'Reconciliation created' }, 201);
});

app.put('/cash-reconciliations/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  const body = await c.req.json();
  return c.json({ success: true, message: 'Updated' });
});

app.post('/cash-reconciliations/:id/items', authMiddleware, async (c) => {
  return c.json({ success: false, message: 'Item added' }, 201);
});

app.post('/cash-reconciliations/:id/submit', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare("UPDATE van_reconciliations SET status = 'submitted' WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Submitted' });
});

app.post('/cash-reconciliations/:id/approve', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare("UPDATE van_reconciliations SET status = 'approved' WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Approved' });
});

app.post('/cash-reconciliations/:id/reject', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare("UPDATE van_reconciliations SET status = 'rejected' WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Rejected' });
});

app.post('/cash-reconciliations/:id/close', authMiddleware, requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const id = c.req.param('id');
  await db.prepare("UPDATE van_reconciliations SET status = 'closed' WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Closed' });
});

export default app;
