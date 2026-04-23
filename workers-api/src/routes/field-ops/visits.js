/**
 * Visit Routes
 * Visit management endpoints
 */

import { Router } from 'itty-router';
import { authMiddleware } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { createVisit, getAgentVisits, updateVisitStatus, deleteVisit } from '../services/visitService.js';

const router = Router();

/**
 * GET /visits - List visits with filters
 */
router.get('/visits', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const role = c.get('role');

  const { agent_id, status, start_date, end_date, page = '1', limit = '20' } = c.req.query();

  try {
    let query = `
      SELECT v.*,
             u.first_name || ' ' || u.last_name as agent_name,
             c.name as customer_name
      FROM visits v
      LEFT JOIN users u ON v.agent_id = u.id
      LEFT JOIN customers c ON v.customer_id = c.id
      WHERE v.tenant_id = ?
    `;

    const binds = [tenantId];

    if (role === 'agent' || role === 'field_agent') {
      query += ` AND v.agent_id = ?`;
      binds.push(userId);
    } else if (agent_id) {
      query += ` AND v.agent_id = ?`;
      binds.push(agent_id);
    }

    if (status) {
      query += ` AND v.status = ?`;
      binds.push(status);
    }

    if (start_date) {
      query += ` AND v.visit_date >= ?`;
      binds.push(start_date);
    }

    if (end_date) {
      query += ` AND v.visit_date <= ?`;
      binds.push(end_date);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` ORDER BY v.visit_date DESC LIMIT ? OFFSET ?`;
    binds.push(parseInt(limit), offset);

    const visits = await db.prepare(query).bind(...binds).all();

    // Fixed count query — strip ORDER BY / LIMIT / OFFSET and their binds
    const countQuery = query
      .replace(
        /SELECT v\.\*, u\.first_name \|\| ' ' \|\| u\.last_name as agent_name, c\.name as customer_name/,
        'SELECT COUNT(*) as count'
      )
      .replace(/ ORDER BY v\.visit_date DESC LIMIT \? OFFSET \?/, '');

    const countBinds = binds.slice(0, -2);
    const countResult = await db.prepare(countQuery).bind(...countBinds).first();

    return c.json({
      success: true,
      data: visits.results || [],
      meta: {
        total: countResult?.count || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil((countResult?.count || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching visits:', error);
    return c.json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Failed to fetch visits' }
    }, 500);
  }
});

/**
 * GET /visits/:id - Get single visit
 */
router.get('/visits/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const visitId = c.req.param('id');

  try {
    const visit = await db.prepare(`
      SELECT v.*,
             u.first_name || ' ' || u.last_name as agent_name,
             c.name as customer_name
      FROM visits v
      LEFT JOIN users u ON v.agent_id = u.id
      LEFT JOIN customers c ON v.customer_id = c.id
      WHERE v.id = ? AND v.tenant_id = ?
    `).bind(visitId, tenantId).first();

    if (!visit) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Visit not found' }
      }, 404);
    }

    const [photos, responses, individuals] = await Promise.all([
      db.prepare('SELECT * FROM visit_photos WHERE visit_id = ? AND tenant_id = ?').bind(visitId, tenantId).all(),
      db.prepare('SELECT * FROM visit_responses WHERE visit_id = ? AND tenant_id = ?').bind(visitId, tenantId).all(),
      db.prepare(`
        SELECT vi.*, i.first_name, i.last_name, i.id_number, i.phone
        FROM visit_individuals vi
        LEFT JOIN individuals i ON vi.individual_id = i.id
        WHERE vi.visit_id = ? AND vi.tenant_id = ?
      `).bind(visitId, tenantId).all()
    ]);

    return c.json({
      success: true,
      data: {
        ...visit,
        photos: photos.results || [],
        responses: responses.results || [],
        individuals: individuals.results || []
      }
    });
  } catch (error) {
    console.error('Error fetching visit:', error);
    return c.json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Failed to fetch visit' }
    }, 500);
  }
});

/**
 * POST /visits/workflow - Create visit with full workflow
 */
router.post('/visits/workflow', authMiddleware, validateRequest({
  body: {
    visit_target_type: 'required|in:individual,store,customer',
    visit_date: 'date',
    agent_id: 'uuid',
    customer_id: 'uuid',
    individual_first_name: 'string',
    individual_last_name: 'string',
    individual_id_number: 'string',
    individual_phone: 'phone'
  }
}), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');

  try {
    const body = await c.req.json();
    const result = await createVisit(db, tenantId, userId, body);

    return c.json({
      success: true,
      data: result,
      message: 'Visit created successfully'
    }, 201);
  } catch (error) {
    console.error('Error creating visit:', error);
    return c.json({
      success: false,
      error: { code: 'CREATE_ERROR', message: 'Failed to create visit' }
    }, 500);
  }
});

/**
 * POST /visits/:id/complete - Complete a visit
 */
router.post('/visits/:id/complete', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const visitId = c.req.param('id');

  try {
    const body = await c.req.json();
    await updateVisitStatus(db, tenantId, visitId, 'completed', body);

    return c.json({
      success: true,
      message: 'Visit completed successfully'
    });
  } catch (error) {
    console.error('Error completing visit:', error);
    return c.json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to complete visit' }
    }, 500);
  }
});

/**
 * DELETE /visits/:id - Soft delete visit
 */
router.delete('/visits/:id', authMiddleware, async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const visitId = c.req.param('id');

  try {
    await deleteVisit(db, tenantId, visitId);

    return c.json({
      success: true,
      message: 'Visit deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting visit:', error);
    return c.json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to delete visit' }
    }, 500);
  }
});

/**
 * PATCH /visits/:id/photos/:photoId/reject - Admin rejects a photo
 */
router.patch('/visits/:id/photos/:photoId/reject', authMiddleware, async (c) => {
  const db       = c.env.DB;
  const tenantId = c.get('tenantId');
  const role     = c.get('role');
  const { id: visitId, photoId } = c.req.param();

  if (role !== 'admin' && role !== 'manager' && role !== 'super_admin') {
    return c.json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
    }, 403);
  }

  try {
    const { reason } = await c.req.json().catch(() => ({}));

    const photo = await db.prepare(`
      SELECT id FROM visit_photos
      WHERE id = ? AND visit_id = ? AND tenant_id = ?
    `).bind(photoId, visitId, tenantId).first();

    if (!photo) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Photo not found' }
      }, 404);
    }

    await db.prepare(`
      UPDATE visit_photos
      SET review_status    = 'rejected',
          rejection_reason = ?,
          reviewed_by      = ?,
          reviewed_at      = datetime('now'),
          updated_at       = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).bind(reason ?? null, c.get('userId'), photoId, tenantId).run();

    return c.json({
      success: true,
      message: 'Photo rejected',
      data: { id: photoId, review_status: 'rejected', rejection_reason: reason ?? null }
    });
  } catch (error) {
    console.error('Error rejecting photo:', error);
    return c.json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: 'Failed to reject photo' }
    }, 500);
  }
});

/**
 * PUT /visits/:id/photos/:photoId/replace - Agent replaces a rejected photo
 */
router.put('/visits/:id/photos/:photoId/replace', authMiddleware, async (c) => {
  const db       = c.env.DB;
  const r2       = c.env.UPLOADS;
  const tenantId = c.get('tenantId');
  const userId   = c.get('userId');
  const role     = c.get('role');
  const { id: visitId, photoId } = c.req.param();

  try {
    // 1. Fetch the rejected photo — uses review_status to match your schema
    const existing = await db.prepare(`
      SELECT id, r2_key, photo_type, thumbnail_r2_key
      FROM visit_photos
      WHERE id = ? AND visit_id = ? AND tenant_id = ? AND review_status = 'rejected'
    `).bind(photoId, visitId, tenantId).first();

    if (!existing) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Rejected photo not found' }
      }, 404);
    }

    // 2. Agents can only replace photos on their own visits
    const visit = await db.prepare(`
      SELECT agent_id FROM visits WHERE id = ? AND tenant_id = ?
    `).bind(visitId, tenantId).first();

    if (!visit) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Visit not found' }
      }, 404);
    }

    if ((role === 'agent' || role === 'field_agent') && visit.agent_id !== userId) {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not your visit' }
      }, 403);
    }

    // 3. Parse multipart file
    const formData  = await c.req.formData();
    const file      = formData.get('photo');
    const thumbnail = formData.get('thumbnail');

    if (!file || typeof file === 'string') {
      return c.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'photo file is required' }
      }, 400);
    }

    // 4. Delete old R2 objects — main photo and thumbnail
    if (existing.r2_key) {
      try { await r2.delete(existing.r2_key); } catch { /* already gone */ }
    }
    if (existing.thumbnail_r2_key) {
      try { await r2.delete(existing.thumbnail_r2_key); } catch { /* already gone */ }
    }

    // 5. Upload new file — same key structure as your /visit-photos/upload endpoint
    const newId    = crypto.randomUUID();
    const photoKey = `photos/${tenantId}/${visitId}/${newId}.jpg`;
    const thumbKey = `thumbnails/${tenantId}/${visitId}/${newId}_thumb.jpg`;

    await r2.put(photoKey, file.stream(), {
      httpMetadata: { contentType: 'image/jpeg' }
    });

    if (thumbnail && typeof thumbnail !== 'string') {
      await r2.put(thumbKey, thumbnail.stream(), {
        httpMetadata: { contentType: 'image/jpeg' }
      });
    }

    // 6. Build URL using your /api/uploads/ serving pattern so the image loads
    const baseUrl  = new URL(c.req.url);
    const newR2Url = `${baseUrl.protocol}//${baseUrl.host}/api/uploads/${photoKey}`;

    // 7. Update DB row — review_status matches your schema, full reset for re-review
    await db.prepare(`
      UPDATE visit_photos
      SET r2_key             = ?,
          thumbnail_r2_key   = ?,
          r2_url             = ?,
          review_status      = 'pending',
          rejection_reason   = NULL,
          reviewed_by        = NULL,
          reviewed_at        = NULL,
          uploaded_by        = ?,
          ai_analysis_status = 'pending',
          updated_at         = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `).bind(
      photoKey,
      thumbnail && typeof thumbnail !== 'string' ? thumbKey : null,
      newR2Url,
      userId,
      photoId,
      tenantId
    ).run();

    return c.json({
      success: true,
      data: {
        id:            photoId,
        r2_url:        newR2Url,
        review_status: 'pending'
      },
      message: 'Photo replaced successfully'
    });

  } catch (error) {
    console.error('Error replacing photo:', error);
    return c.json({
      success: false,
      error: { code: 'REPLACE_ERROR', message: 'Failed to replace photo' }
    }, 500);
  }
});

export default router;