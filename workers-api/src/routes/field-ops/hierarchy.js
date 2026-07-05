/**
 * Org hierarchy read endpoints for field-ops roll-up UIs.
 */
import { Hono } from 'hono';
import { directReports, subtreeUserIds, subtreeAgentIds } from '../../services/hierarchyService.js';

const app = new Hono();

// GET /field-ops/hierarchy/reports?user_id=&role=  -> immediate reports
app.get('/hierarchy/reports', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.req.query('user_id') || c.get('userId');
  const role = c.req.query('role') || c.get('role');
  const reports = await directReports(db, tenantId, userId, role);
  return c.json({ success: true, reports });
});

// GET /field-ops/hierarchy/subtree?user_id=&role=  -> all descendant ids + agent ids
app.get('/hierarchy/subtree', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.req.query('user_id') || c.get('userId');
  const role = c.req.query('role') || c.get('role');
  const [userIds, agentIds] = await Promise.all([
    subtreeUserIds(db, tenantId, userId, role),
    subtreeAgentIds(db, tenantId, userId, role),
  ]);
  return c.json({ success: true, userIds, agentIds });
});

export default app;
