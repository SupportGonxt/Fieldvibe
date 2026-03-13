// ==================== DOC 1: TRANSACTION SYSTEM (Sections A-J) ====================

// ==================== A. PRICE LISTS & PRICING ENGINE ====================

api.get('/price-lists', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const lists = await db.prepare('SELECT * FROM price_lists WHERE tenant_id = ? ORDER BY name').bind(tenantId).all();
  return c.json({ success: true, data: lists.results || [] });
});

api.get('/price-lists/:id', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const list = await db.prepare('SELECT * FROM price_lists WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!list) return c.json({ success: false, message: 'Price list not found' }, 404);
  const items = await db.prepare('SELECT pli.*, p.name as product_name, p.sku FROM price_list_items pli JOIN products p ON pli.product_id = p.id WHERE pli.price_list_id = ?').bind(id).all();
  return c.json({ success: true, data: { ...list, items: items.results || [] } });
});

api.post('/price-lists', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  if (body.is_default) {
    await db.prepare('UPDATE price_lists SET is_default = 0 WHERE tenant_id = ?').bind(tenantId).run();
  }
  await db.prepare('INSERT INTO price_lists (id, tenant_id, name, description, is_default, is_active, currency, valid_from, valid_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.description || null, body.is_default ? 1 : 0, 1, body.currency || 'ZAR', body.valid_from || null, body.valid_to || null).run();
  return c.json({ success: true, data: { id }, message: 'Price list created' }, 201);
});

api.put('/price-lists/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  if (body.is_default) {
    await db.prepare('UPDATE price_lists SET is_default = 0 WHERE tenant_id = ?').bind(tenantId).run();
  }
  await db.prepare('UPDATE price_lists SET name = COALESCE(?, name), description = COALESCE(?, description), is_default = COALESCE(?, is_default), is_active = COALESCE(?, is_active), valid_from = COALESCE(?, valid_from), valid_to = COALESCE(?, valid_to) WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.description || null, body.is_default !== undefined ? (body.is_default ? 1 : 0) : null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, body.valid_from || null, body.valid_to || null, id, tenantId).run();
  return c.json({ success: true, message: 'Price list updated' });
});

api.delete('/price-lists/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('DELETE FROM price_list_items WHERE price_list_id = ?').bind(id).run();
  await db.prepare('DELETE FROM price_lists WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Price list deleted' });
});

// Price List Items
api.post('/price-lists/:id/items', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const { id } = c.req.param();
  const body = await c.req.json();
  const items = Array.isArray(body) ? body : [body];
  for (const item of items) {
    const itemId = uuidv4();
    await db.prepare('INSERT INTO price_list_items (id, price_list_id, product_id, unit_price, min_qty, max_discount_pct) VALUES (?, ?, ?, ?, ?, ?)').bind(itemId, id, item.product_id, item.unit_price, item.min_qty || 1, item.max_discount_pct || null).run();
  }
  return c.json({ success: true, message: `${items.length} items added` }, 201);
});

api.put('/price-lists/:listId/items/:itemId', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const { listId, itemId } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE price_list_items SET unit_price = COALESCE(?, unit_price), min_qty = COALESCE(?, min_qty), max_discount_pct = COALESCE(?, max_discount_pct) WHERE id = ? AND price_list_id = ?').bind(body.unit_price || null, body.min_qty || null, body.max_discount_pct || null, itemId, listId).run();
  return c.json({ success: true, message: 'Item updated' });
});

api.delete('/price-lists/:listId/items/:itemId', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const { listId, itemId } = c.req.param();
  await db.prepare('DELETE FROM price_list_items WHERE id = ? AND price_list_id = ?').bind(itemId, listId).run();
  return c.json({ success: true, message: 'Item removed' });
});

// Price Resolution Utility
api.post('/pricing/resolve', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { product_id, customer_id, quantity } = await c.req.json();
  const product = await db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').bind(product_id, tenantId).first();
  if (!product) return c.json({ success: false, message: 'Product not found' }, 404);
  let unitPrice = product.price;
  let maxDiscountPct = 0;
  // Check customer price list
  if (customer_id) {
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND tenant_id = ?').bind(customer_id, tenantId).first();
    if (customer) {
      // Look for price list item
      const pli = await db.prepare("SELECT pli.* FROM price_list_items pli JOIN price_lists pl ON pli.price_list_id = pl.id WHERE pl.tenant_id = ? AND pl.is_active = 1 AND pli.product_id = ? AND pli.min_qty <= ? ORDER BY pli.min_qty DESC LIMIT 1").bind(tenantId, product_id, quantity || 1).first();
      if (pli) {
        unitPrice = pli.unit_price;
        maxDiscountPct = pli.max_discount_pct || 0;
      }
    }
  }
  // Fallback to default price list
  if (unitPrice === product.price) {
    const defaultPli = await db.prepare("SELECT pli.* FROM price_list_items pli JOIN price_lists pl ON pli.price_list_id = pl.id WHERE pl.tenant_id = ? AND pl.is_default = 1 AND pl.is_active = 1 AND pli.product_id = ? AND pli.min_qty <= ? ORDER BY pli.min_qty DESC LIMIT 1").bind(tenantId, product_id, quantity || 1).first();
    if (defaultPli) {
      unitPrice = defaultPli.unit_price;
      maxDiscountPct = defaultPli.max_discount_pct || 0;
    }
  }
  return c.json({ success: true, data: { unit_price: unitPrice, max_discount_pct: maxDiscountPct, tax_rate: product.tax_rate || 15, cost_price: product.cost_price, product_name: product.name } });
});

// A.3 Promotion Rules (extended)
api.get('/promotion-rules', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { active_only } = c.req.query();
  let q = 'SELECT * FROM promotion_rules WHERE tenant_id = ?';
  const params = [tenantId];
  if (active_only === 'true') { q += ' AND is_active = 1'; }
  q += ' ORDER BY created_at DESC';
  const rules = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: rules.results || [] });
});

api.post('/promotion-rules', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO promotion_rules (id, tenant_id, name, rule_type, config, product_filter, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.rule_type || 'discount', JSON.stringify(body.config || {}), body.product_filter || null, body.start_date || null, body.end_date || null, 1).run();
  return c.json({ success: true, data: { id }, message: 'Promotion rule created' }, 201);
});

api.put('/promotion-rules/:id', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE promotion_rules SET name = COALESCE(?, name), rule_type = COALESCE(?, rule_type), config = COALESCE(?, config), product_filter = COALESCE(?, product_filter), start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), is_active = COALESCE(?, is_active) WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.rule_type || null, body.config ? JSON.stringify(body.config) : null, body.product_filter || null, body.start_date || null, body.end_date || null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Promotion rule updated' });
});

api.delete('/promotion-rules/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare('DELETE FROM promotion_rules WHERE id = ? AND tenant_id = ?').bind(id, tenantId).run();
  return c.json({ success: true, message: 'Promotion rule deleted' });
});

// Promotion Application Engine
api.post('/promotions/apply', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { items, customer_id } = await c.req.json();
  const now = new Date().toISOString();
  const rules = await db.prepare("SELECT * FROM promotion_rules WHERE tenant_id = ? AND is_active = 1 AND (start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?) ORDER BY CAST(COALESCE(json_extract(config, '$.priority'), '0') AS INTEGER) DESC").bind(tenantId, now, now).all();
  let totalDiscount = 0;
  const appliedPromos = [];
  const modifiedItems = items.map(i => ({ ...i }));
  for (const rule of (rules.results || [])) {
    const config = JSON.parse(rule.config || '{}');
    if (rule.rule_type === 'discount' || rule.rule_type === 'DISCOUNT_PCT') {
      const discPct = config.discount_pct || config.discount || 0;
      for (const item of modifiedItems) {
        if (!rule.product_filter || rule.product_filter === item.product_id) {
          const disc = (item.unit_price * item.quantity) * (discPct / 100);
          item.discount_amount = (item.discount_amount || 0) + disc;
          totalDiscount += disc;
        }
      }
      appliedPromos.push({ rule_id: rule.id, name: rule.name, type: rule.rule_type, discount: totalDiscount });
    } else if (rule.rule_type === 'DISCOUNT_AMT') {
      const discAmt = config.discount_amt || 0;
      totalDiscount += discAmt;
      appliedPromos.push({ rule_id: rule.id, name: rule.name, type: rule.rule_type, discount: discAmt });
    } else if (rule.rule_type === 'BUY_X_GET_Y') {
      for (const item of modifiedItems) {
        if (!rule.product_filter || rule.product_filter === item.product_id) {
          const buyQty = config.buy_qty || 3;
          const freeQty = config.free_qty || 1;
          if (item.quantity >= buyQty) {
            const freeItems = Math.floor(item.quantity / buyQty) * freeQty;
            const freeValue = freeItems * item.unit_price;
            item.free_items = freeItems;
            totalDiscount += freeValue;
            appliedPromos.push({ rule_id: rule.id, name: rule.name, type: 'BUY_X_GET_Y', free_items: freeItems, discount: freeValue });
          }
        }
      }
    } else if (rule.rule_type === 'VOLUME_BREAK') {
      const tiers = config.tiers || [];
      for (const item of modifiedItems) {
        if (!rule.product_filter || rule.product_filter === item.product_id) {
          const matchedTier = tiers.filter(t => item.quantity >= t.min_qty).sort((a, b) => b.min_qty - a.min_qty)[0];
          if (matchedTier) {
            const oldTotal = item.unit_price * item.quantity;
            item.unit_price = matchedTier.price;
            const newTotal = matchedTier.price * item.quantity;
            const disc = oldTotal - newTotal;
            totalDiscount += disc;
            appliedPromos.push({ rule_id: rule.id, name: rule.name, type: 'VOLUME_BREAK', discount: disc });
          }
        }
      }
    }
  }
  return c.json({ success: true, data: { items: modifiedItems, promotions_applied: appliedPromos, total_discount: totalDiscount } });
});

// ==================== B. SALES ORDER ENGINE ====================

// Enhanced order creation with full validation
api.post('/sales/orders/create', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const errors = [];

  try {
    // 1. Validate customer
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ? AND tenant_id = ?').bind(body.customer_id, tenantId).first();
    if (!customer) return c.json({ success: false, message: 'Customer not found' }, 404);

    // 2. Validate and resolve items
    const resolvedItems = [];
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    for (let idx = 0; idx < (body.items || []).length; idx++) {
      const item = body.items[idx];
      const product = await db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ? AND status = ?').bind(item.product_id, tenantId, 'active').first();
      if (!product) { errors.push(`Item ${idx + 1}: product not found or inactive`); continue; }

      // Price resolution
      let unitPrice = item.unit_price || product.price;
      const pli = await db.prepare("SELECT pli.* FROM price_list_items pli JOIN price_lists pl ON pli.price_list_id = pl.id WHERE pl.tenant_id = ? AND pl.is_active = 1 AND pli.product_id = ? AND pli.min_qty <= ? ORDER BY pli.min_qty DESC LIMIT 1").bind(tenantId, item.product_id, item.quantity || 1).first();
      if (pli) unitPrice = pli.unit_price;

      // Discount validation
      const discountPct = item.discount_percent || item.discount_pct || 0;
      const finalPrice = unitPrice * (1 - discountPct / 100);
      const qty = item.quantity || 1;
      const lineTotal = finalPrice * qty;
      const taxRate = product.tax_rate || 15;
      const lineTax = lineTotal - (lineTotal / (1 + taxRate / 100));

      // Stock check
      if (body.order_type !== 'VAN_SALE') {
        const stock = await db.prepare('SELECT COALESCE(SUM(quantity), 0) as available FROM stock_levels WHERE tenant_id = ? AND product_id = ?').bind(tenantId, item.product_id).first();
        if (stock && stock.available < qty) {
          errors.push(`Item ${idx + 1}: only ${stock.available} of ${product.name} in stock`);
          continue;
        }
      }

      subtotal += lineTotal;
      totalTax += lineTax;
      totalDiscount += unitPrice * qty * (discountPct / 100);
      resolvedItems.push({ product_id: item.product_id, quantity: qty, unit_price: unitPrice, discount_percent: discountPct, line_total: lineTotal, product_name: product.name });
    }

    if (errors.length > 0) return c.json({ success: false, message: 'Validation failed', details: errors }, 400);
    if (resolvedItems.length === 0) return c.json({ success: false, message: 'No valid items' }, 400);

    // Credit limit check
    if (body.payment_method === 'CREDIT' || body.payment_method === 'credit') {
      const newBalance = (customer.outstanding_balance || 0) + subtotal;
      if (customer.credit_limit && newBalance > customer.credit_limit) {
        return c.json({ success: false, message: `Credit limit exceeded. Limit: R${customer.credit_limit}, Current: R${customer.outstanding_balance}, Order: R${subtotal}` }, 400);
      }
    }

    // 3. Create order
    const orderId = uuidv4();
    const orderNumber = 'SO-' + Date.now().toString(36).toUpperCase();
    const paymentMethod = body.payment_method || 'CASH';
    const paymentStatus = paymentMethod === 'CREDIT' || paymentMethod === 'credit' ? 'PENDING' : (body.amount_paid >= subtotal ? 'PAID' : 'PENDING');

    await db.prepare('INSERT INTO sales_orders (id, tenant_id, order_number, agent_id, customer_id, visit_id, order_type, status, subtotal, tax_amount, discount_amount, total_amount, payment_method, payment_status, notes, gps_latitude, gps_longitude, van_stock_load_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))').bind(orderId, tenantId, orderNumber, userId, body.customer_id, body.visit_id || null, body.order_type || 'direct_sale', 'CONFIRMED', subtotal, totalTax, totalDiscount, subtotal, paymentMethod, paymentStatus, body.notes || null, body.gps_latitude || null, body.gps_longitude || null, body.van_stock_load_id || null).run();

    // 4. Create order items
    for (const item of resolvedItems) {
      const itemId = uuidv4();
      await db.prepare('INSERT INTO sales_order_items (id, sales_order_id, product_id, quantity, unit_price, discount_percent, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(itemId, orderId, item.product_id, item.quantity, item.unit_price, item.discount_percent, item.line_total).run();
    }

    // 5. Create payment if provided
    if (body.amount_paid && body.amount_paid > 0) {
      const paymentId = uuidv4();
      await db.prepare('INSERT INTO payments (id, tenant_id, sales_order_id, amount, method, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(paymentId, tenantId, orderId, body.amount_paid, paymentMethod, body.payment_reference || null, 'completed').run();
    }

    // 6. Update customer balance for credit
    if (paymentMethod === 'CREDIT' || paymentMethod === 'credit') {
      await db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance + ? WHERE id = ?').bind(subtotal, body.customer_id).run();
    }

    // 7. Create stock movements
    if (body.order_type !== 'VAN_SALE') {
      for (const item of resolvedItems) {
        const smId = uuidv4();
        await db.prepare('INSERT INTO stock_movements (id, tenant_id, product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(smId, tenantId, item.product_id, 'SALE_OUT', item.quantity, 'SALES_ORDER', orderId, userId).run();
        await db.prepare('UPDATE stock_levels SET quantity = quantity - ?, updated_at = datetime("now") WHERE tenant_id = ? AND product_id = ?').bind(item.quantity, tenantId, item.product_id).run();
      }
    }

    // 8. Van stock update
    if (body.order_type === 'VAN_SALE' && body.van_stock_load_id) {
      for (const item of resolvedItems) {
        await db.prepare('UPDATE van_stock_load_items SET quantity_sold = quantity_sold + ? WHERE van_stock_load_id = ? AND product_id = ?').bind(item.quantity, body.van_stock_load_id, item.product_id).run();
      }
    }

    // 9. Commission calculation
    const commRules = await db.prepare("SELECT * FROM commission_rules WHERE tenant_id = ? AND source_type = 'SALE' AND is_active = 1 AND (effective_from IS NULL OR effective_from <= datetime('now')) AND (effective_to IS NULL OR effective_to >= datetime('now'))").bind(tenantId).all();
    for (const rule of (commRules.results || [])) {
      const commAmount = subtotal * (rule.rate || 0);
      if (commAmount > 0) {
        const ceId = uuidv4();
        await db.prepare('INSERT INTO commission_earnings (id, tenant_id, earner_id, source_type, source_id, rule_id, rate, base_amount, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(ceId, tenantId, userId, 'SALE', orderId, rule.id, rule.rate, subtotal, rule.max_cap && commAmount > rule.max_cap ? rule.max_cap : commAmount, 'pending').run();
      }
    }

    // 10. Audit log
    const auditId = uuidv4();
    await db.prepare('INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(auditId, tenantId, userId, 'CREATE', 'SALES_ORDER', orderId, JSON.stringify({ order_number: orderNumber, total: subtotal, items: resolvedItems.length })).run();

    return c.json({ success: true, data: { id: orderId, order_number: orderNumber, total_amount: subtotal, payment_status: paymentStatus, items: resolvedItems } }, 201);
  } catch (error) {
    console.error('Order creation error:', error);
    return c.json({ success: false, message: 'Order creation failed: ' + error.message }, 500);
  }
});

// B.2 Order State Machine
api.put('/sales/orders/:id/status', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { status, reason } = await c.req.json();
  const order = await db.prepare('SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!order) return c.json({ success: false, message: 'Order not found' }, 404);

  const validTransitions = {
    'draft': ['CONFIRMED', 'CANCELLED'],
    'CONFIRMED': ['PROCESSING', 'CANCELLED'],
    'PROCESSING': ['READY', 'CANCELLED'],
    'READY': ['DISPATCHED', 'CANCELLED'],
    'DISPATCHED': ['DELIVERED', 'CANCELLED'],
    'DELIVERED': ['COMPLETED'],
    'COMPLETED': [],
    'CANCELLED': []
  };

  const allowed = validTransitions[order.status] || [];
  if (!allowed.includes(status)) {
    return c.json({ success: false, message: `Cannot transition from ${order.status} to ${status}. Allowed: ${allowed.join(', ')}` }, 400);
  }

  await db.prepare('UPDATE sales_orders SET status = ?, updated_at = datetime("now") WHERE id = ?').bind(status, id).run();

  // Side effects
  if (status === 'CANCELLED') {
    // Reverse stock movements
    const items = await db.prepare('SELECT * FROM sales_order_items WHERE sales_order_id = ?').bind(id).all();
    for (const item of (items.results || [])) {
      const smId = uuidv4();
      await db.prepare('INSERT INTO stock_movements (id, tenant_id, product_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(smId, tenantId, item.product_id, 'ADJUSTMENT_UP', item.quantity, 'ORDER_CANCEL', id, 'Order cancelled - stock returned', userId).run();
      await db.prepare('UPDATE stock_levels SET quantity = quantity + ? WHERE tenant_id = ? AND product_id = ?').bind(item.quantity, tenantId, item.product_id).run();
    }
    // Void commissions
    await db.prepare("UPDATE commission_earnings SET status = 'voided' WHERE source_id = ? AND tenant_id = ?").bind(id, tenantId).run();
    // Restore customer balance
    if (order.payment_method === 'CREDIT' || order.payment_method === 'credit') {
      await db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance - ? WHERE id = ?').bind(order.total_amount, order.customer_id).run();
    }
  }

  // Audit log
  const auditId = uuidv4();
  await db.prepare('INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(auditId, tenantId, userId, 'STATUS_CHANGE', 'SALES_ORDER', id, JSON.stringify({ status: order.status }), JSON.stringify({ status, reason })).run();

  return c.json({ success: true, message: `Order status changed to ${status}` });
});

// B.3 Payment Engine
api.post('/sales/orders/:id/payments', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();

  const order = await db.prepare('SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!order) return c.json({ success: false, message: 'Order not found' }, 404);

  const existingPayments = await db.prepare('SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE sales_order_id = ?').bind(id).first();
  const totalPaid = existingPayments ? existingPayments.total_paid : 0;
  const outstanding = order.total_amount - totalPaid;

  if (body.amount > outstanding) {
    return c.json({ success: false, message: `Payment R${body.amount} exceeds outstanding R${outstanding}` }, 400);
  }

  const paymentId = uuidv4();
  await db.prepare('INSERT INTO payments (id, tenant_id, sales_order_id, amount, method, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(paymentId, tenantId, id, body.amount, body.method || 'CASH', body.reference || null, 'completed').run();

  const newTotalPaid = totalPaid + body.amount;
  const newStatus = newTotalPaid >= order.total_amount ? 'PAID' : 'PARTIAL';
  await db.prepare('UPDATE sales_orders SET payment_status = ?, updated_at = datetime("now") WHERE id = ?').bind(newStatus, id).run();

  // Reduce outstanding balance
  if (order.payment_method === 'CREDIT' || order.payment_method === 'credit') {
    await db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance - ? WHERE id = ?').bind(body.amount, order.customer_id).run();
  }

  return c.json({ success: true, data: { id: paymentId, total_paid: newTotalPaid, outstanding: order.total_amount - newTotalPaid, payment_status: newStatus } });
});

// ==================== C. VAN SALES COMPLEXITY ====================

// C.1 Van Load Transaction
api.post('/van-sales/loads/create', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const errors = [];

  // Validate stock availability
  for (let idx = 0; idx < (body.items || []).length; idx++) {
    const item = body.items[idx];
    const stock = await db.prepare('SELECT COALESCE(SUM(quantity), 0) as available FROM stock_levels WHERE tenant_id = ? AND product_id = ? AND warehouse_id = ?').bind(tenantId, item.product_id, body.warehouse_id).first();
    if (!stock || stock.available < item.quantity) {
      const product = await db.prepare('SELECT name FROM products WHERE id = ?').bind(item.product_id).first();
      errors.push(`Item ${idx + 1}: ${product ? product.name : item.product_id} - need ${item.quantity}, have ${stock ? stock.available : 0}`);
    }
  }
  if (errors.length > 0) return c.json({ success: false, message: 'Insufficient stock', details: errors }, 400);

  // Create load
  const loadId = uuidv4();
  await db.prepare('INSERT INTO van_stock_loads (id, tenant_id, agent_id, vehicle_reg, warehouse_id, status, load_date, created_by) VALUES (?, ?, ?, ?, ?, ?, datetime("now"), ?)').bind(loadId, tenantId, body.agent_id, body.vehicle_reg, body.warehouse_id, 'loaded', userId).run();

  // Create load items and stock movements
  for (const item of (body.items || [])) {
    const itemId = uuidv4();
    await db.prepare('INSERT INTO van_stock_load_items (id, van_stock_load_id, product_id, quantity_loaded) VALUES (?, ?, ?, ?)').bind(itemId, loadId, item.product_id, item.quantity).run();

    // Transfer out of warehouse
    const smId = uuidv4();
    await db.prepare('INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(smId, tenantId, body.warehouse_id, item.product_id, 'TRANSFER_OUT', item.quantity, 'VAN_LOAD', loadId, userId).run();
    await db.prepare('UPDATE stock_levels SET quantity = quantity - ?, updated_at = datetime("now") WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?').bind(item.quantity, tenantId, body.warehouse_id, item.product_id).run();
  }

  // Notification
  const notifId = uuidv4();
  await db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(notifId, tenantId, body.agent_id, 'info', 'Van Load Ready', 'Your van has been loaded and is ready for collection', 'VAN_LOAD', loadId).run();

  return c.json({ success: true, data: { id: loadId }, message: 'Van loaded successfully' }, 201);
});

// C.1 Van Depart
api.put('/van-sales/loads/:id/depart', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  await db.prepare("UPDATE van_stock_loads SET status = 'in_field', depart_time = datetime('now'), updated_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(id, tenantId).run();
  return c.json({ success: true, message: 'Van departed' });
});

// C.2 Van Sale (uses order engine with VAN_SALE type)
api.post('/van-sales/sell', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();
  const errors = [];

  // Validate van load is in field
  const load = await db.prepare("SELECT * FROM van_stock_loads WHERE id = ? AND tenant_id = ? AND status = 'in_field'").bind(body.van_stock_load_id, tenantId).first();
  if (!load) return c.json({ success: false, message: 'Van load not found or not in field' }, 400);

  // Check van stock availability
  for (let idx = 0; idx < (body.items || []).length; idx++) {
    const item = body.items[idx];
    const vanItem = await db.prepare('SELECT * FROM van_stock_load_items WHERE van_stock_load_id = ? AND product_id = ?').bind(body.van_stock_load_id, item.product_id).first();
    if (!vanItem) { errors.push(`Item ${idx + 1}: product not on van`); continue; }
    const available = vanItem.quantity_loaded - (vanItem.quantity_sold || 0) - (vanItem.quantity_returned || 0) - (vanItem.quantity_damaged || 0);
    if (available < (item.quantity || 1)) {
      const product = await db.prepare('SELECT name FROM products WHERE id = ?').bind(item.product_id).first();
      errors.push(`Item ${idx + 1}: only ${available} of ${product ? product.name : 'product'} available on van`);
    }
  }
  if (errors.length > 0) return c.json({ success: false, message: 'Van stock insufficient', details: errors }, 400);

  // Create order via the order engine but with VAN_SALE type
  body.order_type = 'VAN_SALE';
  // Forward to order creation logic
  const orderId = uuidv4();
  const orderNumber = 'VS-' + Date.now().toString(36).toUpperCase();
  let subtotal = 0;
  const resolvedItems = [];

  for (const item of (body.items || [])) {
    const product = await db.prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?').bind(item.product_id, tenantId).first();
    if (!product) continue;
    const unitPrice = item.unit_price || product.price;
    const qty = item.quantity || 1;
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    resolvedItems.push({ product_id: item.product_id, quantity: qty, unit_price: unitPrice, line_total: lineTotal });
  }

  await db.prepare('INSERT INTO sales_orders (id, tenant_id, order_number, agent_id, customer_id, order_type, status, subtotal, tax_amount, total_amount, payment_method, payment_status, van_stock_load_id, gps_latitude, gps_longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(orderId, tenantId, orderNumber, userId, body.customer_id, 'VAN_SALE', 'CONFIRMED', subtotal, subtotal - (subtotal / 1.15), subtotal, body.payment_method || 'CASH', body.amount_paid >= subtotal ? 'PAID' : 'PENDING', body.van_stock_load_id, body.gps_latitude || null, body.gps_longitude || null).run();

  for (const item of resolvedItems) {
    const itemId = uuidv4();
    await db.prepare('INSERT INTO sales_order_items (id, sales_order_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)').bind(itemId, orderId, item.product_id, item.quantity, item.unit_price, item.line_total).run();
    // Update van stock
    await db.prepare('UPDATE van_stock_load_items SET quantity_sold = quantity_sold + ? WHERE van_stock_load_id = ? AND product_id = ?').bind(item.quantity, body.van_stock_load_id, item.product_id).run();
  }

  // Payment
  if (body.amount_paid && body.amount_paid > 0) {
    const paymentId = uuidv4();
    await db.prepare('INSERT INTO payments (id, tenant_id, sales_order_id, amount, method, reference) VALUES (?, ?, ?, ?, ?, ?)').bind(paymentId, tenantId, orderId, body.amount_paid, body.payment_method || 'CASH', body.payment_reference || null).run();
  }

  return c.json({ success: true, data: { id: orderId, order_number: orderNumber, total_amount: subtotal } }, 201);
});

// C.3 Van Return Transaction
api.post('/van-sales/loads/:id/return', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();

  const load = await db.prepare('SELECT * FROM van_stock_loads WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!load) return c.json({ success: false, message: 'Van load not found' }, 404);

  const errors = [];
  const discrepancies = [];

  for (const item of (body.items || [])) {
    const vanItem = await db.prepare('SELECT * FROM van_stock_load_items WHERE van_stock_load_id = ? AND product_id = ?').bind(id, item.product_id).first();
    if (!vanItem) { errors.push(`Product ${item.product_id} not on this load`); continue; }

    const totalAccounted = (vanItem.quantity_sold || 0) + (item.quantity_returned || 0) + (item.quantity_damaged || 0);
    if (totalAccounted > vanItem.quantity_loaded) {
      errors.push(`Product ${item.product_id}: sold(${vanItem.quantity_sold}) + returned(${item.quantity_returned}) + damaged(${item.quantity_damaged}) exceeds loaded(${vanItem.quantity_loaded})`);
      continue;
    }

    // Check for discrepancy
    if (totalAccounted < vanItem.quantity_loaded) {
      const missing = vanItem.quantity_loaded - totalAccounted;
      discrepancies.push({ product_id: item.product_id, missing_quantity: missing });
    }

    // Update van item
    await db.prepare('UPDATE van_stock_load_items SET quantity_returned = ?, quantity_damaged = ? WHERE van_stock_load_id = ? AND product_id = ?').bind(item.quantity_returned || 0, item.quantity_damaged || 0, id, item.product_id).run();

    // Return good items to warehouse
    if ((item.quantity_returned || 0) > 0) {
      const smId = uuidv4();
      await db.prepare('INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(smId, tenantId, load.warehouse_id, item.product_id, 'TRANSFER_IN', item.quantity_returned, 'VAN_RETURN', id, userId).run();
      await db.prepare('UPDATE stock_levels SET quantity = quantity + ?, updated_at = datetime("now") WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?').bind(item.quantity_returned, tenantId, load.warehouse_id, item.product_id).run();
    }

    // Record damaged items
    if ((item.quantity_damaged || 0) > 0) {
      const smId = uuidv4();
      await db.prepare('INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(smId, tenantId, load.warehouse_id, item.product_id, 'DAMAGE', item.quantity_damaged, 'VAN_RETURN', id, 'Van return damage', userId).run();
    }
  }

  if (errors.length > 0) return c.json({ success: false, message: 'Return validation failed', details: errors }, 400);

  // Record discrepancies
  for (const d of discrepancies) {
    const adjId = uuidv4();
    await db.prepare('INSERT INTO stock_adjustments (id, tenant_id, warehouse_id, product_id, adjustment_type, quantity, reason, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(adjId, tenantId, load.warehouse_id, d.product_id, 'DISCREPANCY', d.missing_quantity, 'Van return discrepancy - missing units', 'VAN_RETURN', id, userId).run();
  }

  await db.prepare("UPDATE van_stock_loads SET status = 'returned', return_time = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(id).run();

  return c.json({ success: true, message: 'Van return processed', data: { discrepancies } });
});

// C.4 Cash Reconciliation
api.post('/van-sales/loads/:id/reconcile', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const body = await c.req.json();

  // Calculate expected cash
  const cashOrders = await db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM sales_orders WHERE van_stock_load_id = ? AND payment_method = 'CASH' AND tenant_id = ?").bind(id, tenantId).first();
  const expectedCash = cashOrders ? cashOrders.total : 0;
  const actualCash = body.actual_cash || 0;
  const variance = actualCash - expectedCash;

  const tenant = await db.prepare('SELECT * FROM tenants WHERE id = ?').bind(tenantId).first();
  const threshold = tenant ? (tenant.variance_threshold || 0.01) * expectedCash : 50;
  const autoApprove = Math.abs(variance) <= threshold;

  const reconId = uuidv4();
  await db.prepare('INSERT INTO van_reconciliations (id, tenant_id, van_stock_load_id, cash_expected, cash_actual, variance, denominations, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(reconId, tenantId, id, expectedCash, actualCash, variance, JSON.stringify(body.denominations || {}), autoApprove ? 'approved' : 'flagged', body.notes || null).run();

  if (!autoApprove) {
    // Create fraud alert notification for manager
    const agent = await db.prepare('SELECT manager_id FROM users WHERE id = ?').bind(userId).first();
    if (agent && agent.manager_id) {
      const notifId = uuidv4();
      await db.prepare('INSERT INTO notifications (id, tenant_id, user_id, type, title, message, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(notifId, tenantId, agent.manager_id, 'warning', 'Cash Variance Flagged', `Cash variance of R${variance.toFixed(2)} detected for van load ${id}`, 'VAN_RECONCILIATION', reconId).run();
    }
  }

  return c.json({ success: true, data: { id: reconId, expected: expectedCash, actual: actualCash, variance, status: autoApprove ? 'approved' : 'flagged' } });
});

api.put('/van-reconciliations/:id/approve', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  await db.prepare("UPDATE van_reconciliations SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(userId, id, tenantId).run();
  return c.json({ success: true, message: 'Reconciliation approved' });
});

api.put('/van-reconciliations/:id/reject', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { reason } = await c.req.json();
  await db.prepare("UPDATE van_reconciliations SET status = 'rejected', approved_by = ?, approved_at = datetime('now'), notes = ? WHERE id = ? AND tenant_id = ?").bind(userId, reason || 'Rejected', id, tenantId).run();
  // Audit
  const auditId = uuidv4();
  await db.prepare('INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(auditId, tenantId, userId, 'REJECT', 'VAN_RECONCILIATION', id, JSON.stringify({ reason })).run();
  return c.json({ success: true, message: 'Reconciliation rejected' });
});

// ==================== D. RETURNS, REFUNDS & CREDIT NOTES ====================

api.get('/returns', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { status, page = 1, limit = 50 } = c.req.query();
  let q = 'SELECT r.*, so.order_number, c.name as customer_name FROM returns r LEFT JOIN sales_orders so ON r.original_order_id = so.id LEFT JOIN customers c ON so.customer_id = c.id WHERE r.tenant_id = ?';
  const params = [tenantId];
  if (status) { q += ' AND r.status = ?'; params.push(status); }
  q += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const returns = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: returns.results || [] });
});

api.post('/returns', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const order = await db.prepare('SELECT * FROM sales_orders WHERE id = ? AND tenant_id = ?').bind(body.original_order_id, tenantId).first();
  if (!order) return c.json({ success: false, message: 'Original order not found' }, 404);

  const errors = [];
  let totalCredit = 0;

  // Validate return quantities
  for (let idx = 0; idx < (body.items || []).length; idx++) {
    const item = body.items[idx];
    const orderItem = await db.prepare('SELECT * FROM sales_order_items WHERE sales_order_id = ? AND product_id = ?').bind(body.original_order_id, item.product_id).first();
    if (!orderItem) { errors.push(`Item ${idx + 1}: product not in original order`); continue; }
    // Check already returned
    const alreadyReturned = await db.prepare('SELECT COALESCE(SUM(ri.quantity), 0) as returned FROM return_items ri JOIN returns r ON ri.return_id = r.id WHERE r.original_order_id = ? AND ri.product_id = ? AND r.status != ?').bind(body.original_order_id, item.product_id, 'REJECTED').first();
    const maxReturn = orderItem.quantity - (alreadyReturned ? alreadyReturned.returned : 0);
    if (item.quantity > maxReturn) {
      errors.push(`Item ${idx + 1}: can only return ${maxReturn} more units`);
    }
  }
  if (errors.length > 0) return c.json({ success: false, message: 'Return validation failed', details: errors }, 400);

  const returnId = uuidv4();
  const returnNumber = 'RET-' + Date.now().toString(36).toUpperCase();
  const isFullReturn = (body.items || []).length === (await db.prepare('SELECT COUNT(*) as cnt FROM sales_order_items WHERE sales_order_id = ?').bind(body.original_order_id).first()).cnt;

  for (const item of (body.items || [])) {
    const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(item.product_id).first();
    const unitPrice = product ? product.price : 0;
    const lineCredit = unitPrice * item.quantity;
    totalCredit += lineCredit;

    const riId = uuidv4();
    await db.prepare('INSERT INTO return_items (id, return_id, product_id, quantity, condition, unit_price, line_credit) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(riId, returnId, item.product_id, item.quantity, item.condition || 'good', unitPrice, lineCredit).run();
  }

  const restockFee = body.restock_fee || 0;
  const netCredit = totalCredit - restockFee;

  await db.prepare('INSERT INTO returns (id, tenant_id, original_order_id, return_number, return_type, status, total_credit_amount, restock_fee, net_credit_amount, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(returnId, tenantId, body.original_order_id, returnNumber, isFullReturn ? 'FULL' : 'PARTIAL', 'PENDING', totalCredit, restockFee, netCredit, body.reason || null, userId).run();

  return c.json({ success: true, data: { id: returnId, return_number: returnNumber, total_credit: totalCredit, net_credit: netCredit } }, 201);
});

api.put('/returns/:id/approve', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();

  const ret = await db.prepare('SELECT * FROM returns WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!ret) return c.json({ success: false, message: 'Return not found' }, 404);
  if (ret.status !== 'PENDING') return c.json({ success: false, message: 'Return is not pending' }, 400);

  const items = await db.prepare('SELECT * FROM return_items WHERE return_id = ?').bind(id).all();
  const order = await db.prepare('SELECT * FROM sales_orders WHERE id = ?').bind(ret.original_order_id).first();

  for (const item of (items.results || [])) {
    if (item.condition === 'good') {
      // Return to stock
      const smId = uuidv4();
      await db.prepare('INSERT INTO stock_movements (id, tenant_id, product_id, movement_type, quantity, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(smId, tenantId, item.product_id, 'RETURN_IN', item.quantity, 'RETURN', id, userId).run();
      await db.prepare('UPDATE stock_levels SET quantity = quantity + ?, updated_at = datetime("now") WHERE tenant_id = ? AND product_id = ?').bind(item.quantity, tenantId, item.product_id).run();
    } else {
      // Damaged/expired - record but don't add to stock
      const smId = uuidv4();
      await db.prepare('INSERT INTO stock_movements (id, tenant_id, product_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(smId, tenantId, item.product_id, 'DAMAGE', item.quantity, 'RETURN', id, `Return damage: ${item.condition}`, userId).run();
    }
  }

  // Create credit note
  const cnId = uuidv4();
  const cnNumber = 'CN-' + Date.now().toString(36).toUpperCase();
  await db.prepare('INSERT INTO credit_notes (id, tenant_id, return_id, customer_id, credit_number, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(cnId, tenantId, id, order.customer_id, cnNumber, ret.net_credit_amount, 'ISSUED').run();

  // Reduce customer outstanding balance
  await db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance - ? WHERE id = ?').bind(ret.net_credit_amount, order.customer_id).run();

  // Update return status
  await db.prepare("UPDATE returns SET status = 'PROCESSED', approved_by = ?, updated_at = datetime('now') WHERE id = ?").bind(userId, id).run();

  return c.json({ success: true, data: { credit_note_id: cnId, credit_number: cnNumber, credit_amount: ret.net_credit_amount } });
});

api.put('/returns/:id/reject', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { reason } = await c.req.json();
  await db.prepare("UPDATE returns SET status = 'REJECTED', approved_by = ?, updated_at = datetime('now') WHERE id = ?").bind(userId, id).run();
  return c.json({ success: true, message: 'Return rejected' });
});

// Credit Notes
api.get('/credit-notes', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const notes = await db.prepare('SELECT cn.*, c.name as customer_name FROM credit_notes cn LEFT JOIN customers c ON cn.customer_id = c.id WHERE cn.tenant_id = ? ORDER BY cn.created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: notes.results || [] });
});

api.post('/credit-notes/:id/apply', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const { order_id } = await c.req.json();
  const cn = await db.prepare('SELECT * FROM credit_notes WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!cn) return c.json({ success: false, message: 'Credit note not found' }, 404);
  if (cn.status === 'FULLY_APPLIED' || cn.status === 'VOIDED') return c.json({ success: false, message: 'Credit note already used or voided' }, 400);

  const appliedOrders = cn.applied_to_orders ? JSON.parse(cn.applied_to_orders) : [];
  appliedOrders.push(order_id);
  await db.prepare("UPDATE credit_notes SET status = 'FULLY_APPLIED', applied_to_orders = ? WHERE id = ?").bind(JSON.stringify(appliedOrders), id).run();

  // Apply as payment to order
  const paymentId = uuidv4();
  await db.prepare('INSERT INTO payments (id, tenant_id, sales_order_id, amount, method, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(paymentId, tenantId, order_id, cn.amount, 'CREDIT_NOTE', cn.credit_number, 'completed').run();

  return c.json({ success: true, message: 'Credit note applied' });
});

api.put('/credit-notes/:id/void', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const cn = await db.prepare('SELECT * FROM credit_notes WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!cn) return c.json({ success: false, message: 'Credit note not found' }, 404);
  await db.prepare("UPDATE credit_notes SET status = 'VOIDED' WHERE id = ?").bind(id).run();
  // Re-increase customer balance
  await db.prepare('UPDATE customers SET outstanding_balance = outstanding_balance + ? WHERE id = ?').bind(cn.amount, cn.customer_id).run();
  return c.json({ success: true, message: 'Credit note voided' });
});

// ==================== E. INVENTORY TRANSACTION RULES ====================

// Stock Movement Creation (the ONLY way to change stock)
api.post('/inventory/movements', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  const INCREASE = ['PURCHASE_IN', 'TRANSFER_IN', 'ADJUSTMENT_UP', 'RETURN_IN'];
  const DECREASE = ['SALE_OUT', 'TRANSFER_OUT', 'ADJUSTMENT_DOWN', 'EXPIRY', 'SAMPLE_OUT'];
  const NEUTRAL = ['DAMAGE'];

  if (!INCREASE.includes(body.movement_type) && !DECREASE.includes(body.movement_type) && !NEUTRAL.includes(body.movement_type)) {
    return c.json({ success: false, message: 'Invalid movement type' }, 400);
  }

  // Check stock for decrease movements
  if (DECREASE.includes(body.movement_type)) {
    const stock = await db.prepare('SELECT quantity FROM stock_levels WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?').bind(tenantId, body.warehouse_id, body.product_id).first();
    if (!stock || stock.quantity < body.quantity) {
      return c.json({ success: false, message: `Insufficient stock: have ${stock ? stock.quantity : 0}, need ${body.quantity}` }, 400);
    }
  }

  const smId = uuidv4();
  await db.prepare('INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(smId, tenantId, body.warehouse_id, body.product_id, body.movement_type, body.quantity, body.reference_type || null, body.reference_id || null, body.notes || null, userId).run();

  // Update stock levels
  if (INCREASE.includes(body.movement_type)) {
    const existing = await db.prepare('SELECT id FROM stock_levels WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?').bind(tenantId, body.warehouse_id, body.product_id).first();
    if (existing) {
      await db.prepare('UPDATE stock_levels SET quantity = quantity + ?, updated_at = datetime("now") WHERE id = ?').bind(body.quantity, existing.id).run();
    } else {
      const slId = uuidv4();
      await db.prepare('INSERT INTO stock_levels (id, tenant_id, warehouse_id, product_id, quantity) VALUES (?, ?, ?, ?, ?)').bind(slId, tenantId, body.warehouse_id, body.product_id, body.quantity).run();
    }
  } else if (DECREASE.includes(body.movement_type)) {
    await db.prepare('UPDATE stock_levels SET quantity = quantity - ?, updated_at = datetime("now") WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?').bind(body.quantity, tenantId, body.warehouse_id, body.product_id).run();
  }

  return c.json({ success: true, data: { id: smId }, message: 'Stock movement created' }, 201);
});

// Stock Transfer between warehouses
api.post('/inventory/transfers', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  // Check source stock
  const sourceStock = await db.prepare('SELECT quantity FROM stock_levels WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?').bind(tenantId, body.from_warehouse_id, body.product_id).first();
  if (!sourceStock || sourceStock.quantity < body.quantity) {
    return c.json({ success: false, message: 'Insufficient stock in source warehouse' }, 400);
  }

  // Transfer out
  const smOut = uuidv4();
  await db.prepare('INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(smOut, tenantId, body.from_warehouse_id, body.product_id, 'TRANSFER_OUT', body.quantity, 'TRANSFER', body.notes || null, userId).run();
  await db.prepare('UPDATE stock_levels SET quantity = quantity - ?, updated_at = datetime("now") WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?').bind(body.quantity, tenantId, body.from_warehouse_id, body.product_id).run();

  // Transfer in
  const smIn = uuidv4();
  await db.prepare('INSERT INTO stock_movements (id, tenant_id, warehouse_id, product_id, movement_type, quantity, reference_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(smIn, tenantId, body.to_warehouse_id, body.product_id, 'TRANSFER_IN', body.quantity, 'TRANSFER', body.notes || null, userId).run();
  const destStock = await db.prepare('SELECT id FROM stock_levels WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?').bind(tenantId, body.to_warehouse_id, body.product_id).first();
  if (destStock) {
    await db.prepare('UPDATE stock_levels SET quantity = quantity + ?, updated_at = datetime("now") WHERE id = ?').bind(body.quantity, destStock.id).run();
  } else {
    const slId = uuidv4();
    await db.prepare('INSERT INTO stock_levels (id, tenant_id, warehouse_id, product_id, quantity) VALUES (?, ?, ?, ?, ?)').bind(slId, tenantId, body.to_warehouse_id, body.product_id, body.quantity).run();
  }

  return c.json({ success: true, message: 'Transfer completed' });
});

// Stock Adjustments
api.get('/inventory/adjustments', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const adjustments = await db.prepare('SELECT sa.*, p.name as product_name, w.name as warehouse_name FROM stock_adjustments sa LEFT JOIN products p ON sa.product_id = p.id LEFT JOIN warehouses w ON sa.warehouse_id = w.id WHERE sa.tenant_id = ? ORDER BY sa.created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: adjustments.results || [] });
});

// Stock Valuation Report
api.get('/inventory/valuation', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { warehouse_id } = c.req.query();
  let q = 'SELECT sl.*, p.name, p.sku, p.cost_price, p.price, w.name as warehouse_name, (sl.quantity * COALESCE(p.cost_price, 0)) as stock_value FROM stock_levels sl JOIN products p ON sl.product_id = p.id JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ?';
  const params = [tenantId];
  if (warehouse_id) { q += ' AND sl.warehouse_id = ?'; params.push(warehouse_id); }
  q += ' ORDER BY stock_value DESC';
  const valuation = await db.prepare(q).bind(...params).all();
  const totalValue = (valuation.results || []).reduce((sum, r) => sum + (r.stock_value || 0), 0);
  return c.json({ success: true, data: { items: valuation.results || [], total_value: totalValue } });
});

// ==================== F. COMMISSION CALCULATION ENGINE ====================

// Commission Rules CRUD
api.get('/commission-rules', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const rules = await db.prepare('SELECT * FROM commission_rules WHERE tenant_id = ? ORDER BY created_at DESC').bind(tenantId).all();
  return c.json({ success: true, data: rules.results || [] });
});

api.post('/commission-rules', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const id = uuidv4();
  await db.prepare('INSERT INTO commission_rules (id, tenant_id, name, source_type, rate, min_threshold, max_cap, product_filter, effective_from, effective_to, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, tenantId, body.name, body.source_type, body.rate, body.min_threshold || 0, body.max_cap || null, body.product_filter || null, body.effective_from || null, body.effective_to || null, 1).run();
  return c.json({ success: true, data: { id }, message: 'Commission rule created' }, 201);
});

api.put('/commission-rules/:id', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { id } = c.req.param();
  const body = await c.req.json();
  await db.prepare('UPDATE commission_rules SET name = COALESCE(?, name), source_type = COALESCE(?, source_type), rate = COALESCE(?, rate), min_threshold = COALESCE(?, min_threshold), max_cap = ?, product_filter = ?, effective_from = ?, effective_to = ?, is_active = COALESCE(?, is_active) WHERE id = ? AND tenant_id = ?').bind(body.name || null, body.source_type || null, body.rate || null, body.min_threshold || null, body.max_cap || null, body.product_filter || null, body.effective_from || null, body.effective_to || null, body.is_active !== undefined ? (body.is_active ? 1 : 0) : null, id, tenantId).run();
  return c.json({ success: true, message: 'Commission rule updated' });
});

// Commission Earnings Management
api.get('/commission-earnings', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const role = c.get('role');
  const userId = c.get('userId');
  const { status, earner_id, period_start, period_end, page = 1, limit = 50 } = c.req.query();
  let q = "SELECT ce.*, u.first_name || ' ' || u.last_name as earner_name FROM commission_earnings ce LEFT JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ?";
  const params = [tenantId];
  // Agents can only see their own
  if (role === 'agent') { q += ' AND ce.earner_id = ?'; params.push(userId); }
  else if (earner_id) { q += ' AND ce.earner_id = ?'; params.push(earner_id); }
  if (status) { q += ' AND ce.status = ?'; params.push(status); }
  if (period_start) { q += ' AND ce.created_at >= ?'; params.push(period_start); }
  if (period_end) { q += ' AND ce.created_at <= ?'; params.push(period_end); }
  q += ' ORDER BY ce.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const earnings = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: earnings.results || [] });
});

api.put('/commission-earnings/:id/approve', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  await db.prepare("UPDATE commission_earnings SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(userId, id, tenantId).run();
  return c.json({ success: true, message: 'Commission approved' });
});

api.put('/commission-earnings/bulk-approve', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { ids } = await c.req.json();
  for (const id of (ids || [])) {
    await db.prepare("UPDATE commission_earnings SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ? AND tenant_id = ?").bind(userId, id, tenantId).run();
  }
  return c.json({ success: true, message: `${(ids || []).length} commissions approved` });
});

// Commission Payouts
api.get('/commission-payouts', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const payouts = await db.prepare("SELECT cp.*, u.first_name || ' ' || u.last_name as earner_name FROM commission_payouts cp LEFT JOIN users u ON cp.earner_id = u.id WHERE cp.tenant_id = ? ORDER BY cp.created_at DESC").bind(tenantId).all();
  return c.json({ success: true, data: payouts.results || [] });
});

api.post('/commission-payouts', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const body = await c.req.json();

  // Calculate total from approved earnings
  const earnings = await db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM commission_earnings WHERE tenant_id = ? AND earner_id = ? AND status = 'approved' AND created_at >= ? AND created_at <= ?").bind(tenantId, body.earner_id, body.period_start, body.period_end).first();

  const payoutId = uuidv4();
  await db.prepare('INSERT INTO commission_payouts (id, tenant_id, earner_id, period_start, period_end, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(payoutId, tenantId, body.earner_id, body.period_start, body.period_end, earnings ? earnings.total : 0, 'PENDING').run();

  return c.json({ success: true, data: { id: payoutId, total_amount: earnings ? earnings.total : 0 } }, 201);
});

api.put('/commission-payouts/:id/pay', requireRole('admin'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const { id } = c.req.param();
  const { payment_reference } = await c.req.json();

  const payout = await db.prepare('SELECT * FROM commission_payouts WHERE id = ? AND tenant_id = ?').bind(id, tenantId).first();
  if (!payout) return c.json({ success: false, message: 'Payout not found' }, 404);

  await db.prepare("UPDATE commission_payouts SET status = 'PAID', paid_at = datetime('now'), payment_reference = ?, approved_by = ? WHERE id = ?").bind(payment_reference || null, userId, id).run();

  // Mark related earnings as paid
  await db.prepare("UPDATE commission_earnings SET status = 'paid' WHERE tenant_id = ? AND earner_id = ? AND status = 'approved' AND created_at >= ? AND created_at <= ?").bind(tenantId, payout.earner_id, payout.period_start, payout.period_end).run();

  return c.json({ success: true, message: 'Payout processed' });
});

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

  const agents = await db.prepare("SELECT u.id, u.first_name || ' ' || u.last_name as name, u.role, (SELECT COUNT(*) FROM visits WHERE agent_id = u.id AND tenant_id = ? AND created_at >= datetime('now', '-' || ? || ' days')) as visit_count, (SELECT COUNT(*) FROM sales_orders WHERE agent_id = u.id AND tenant_id = ? AND created_at >= datetime('now', '-' || ? || ' days')) as order_count, (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE agent_id = u.id AND tenant_id = ? AND created_at >= datetime('now', '-' || ? || ' days')) as revenue, (SELECT COALESCE(SUM(amount), 0) FROM commission_earnings WHERE earner_id = u.id AND tenant_id = ?) as total_commission FROM users u WHERE u.tenant_id = ? AND u.role IN ('agent', 'team_lead') AND u.is_active = 1 ORDER BY revenue DESC").bind(tenantId, period, tenantId, period, tenantId, period, tenantId, tenantId).all();

  return c.json({ success: true, data: agents.results || [] });
});

// Stock Valuation Report
api.get('/reports/stock-valuation', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const items = await db.prepare("SELECT p.name, p.sku, w.name as warehouse, sl.quantity, p.cost_price, (sl.quantity * COALESCE(p.cost_price, 0)) as value, (SELECT MAX(created_at) FROM stock_movements WHERE product_id = p.id AND movement_type = 'SALE_OUT') as last_sold FROM stock_levels sl JOIN products p ON sl.product_id = p.id JOIN warehouses w ON sl.warehouse_id = w.id WHERE sl.tenant_id = ? ORDER BY value DESC").bind(tenantId).all();
  return c.json({ success: true, data: items.results || [] });
});

// Commission Report
api.get('/reports/commissions', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { period_start, period_end } = c.req.query();
  let q = "SELECT ce.earner_id, u.first_name || ' ' || u.last_name as name, ce.source_type, ce.status, COUNT(*) as count, SUM(ce.amount) as total_amount FROM commission_earnings ce JOIN users u ON ce.earner_id = u.id WHERE ce.tenant_id = ?";
  const params = [tenantId];
  if (period_start) { q += ' AND ce.created_at >= ?'; params.push(period_start); }
  if (period_end) { q += ' AND ce.created_at <= ?'; params.push(period_end); }
  q += ' GROUP BY ce.earner_id, ce.source_type, ce.status ORDER BY total_amount DESC';
  const report = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: report.results || [] });
});

// Van Sales Report
api.get('/reports/van-sales', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const report = await db.prepare("SELECT vsl.id, vsl.vehicle_reg, u.first_name || ' ' || u.last_name as agent_name, vsl.status, vsl.load_date, vsl.return_time, (SELECT COUNT(*) FROM sales_orders WHERE van_stock_load_id = vsl.id) as orders, (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE van_stock_load_id = vsl.id) as revenue, vr.cash_expected, vr.cash_actual, vr.variance, vr.status as recon_status FROM van_stock_loads vsl LEFT JOIN users u ON vsl.agent_id = u.id LEFT JOIN van_reconciliations vr ON vr.van_stock_load_id = vsl.id WHERE vsl.tenant_id = ? ORDER BY vsl.load_date DESC").bind(tenantId).all();
  return c.json({ success: true, data: report.results || [] });
});

// Serial Numbers
api.get('/serial-numbers', async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const { product_id, status } = c.req.query();
  let q = 'SELECT sn.*, p.name as product_name FROM serial_numbers sn JOIN products p ON sn.product_id = p.id WHERE sn.tenant_id = ?';
  const params = [tenantId];
  if (product_id) { q += ' AND sn.product_id = ?'; params.push(product_id); }
  if (status) { q += ' AND sn.status = ?'; params.push(status); }
  q += ' ORDER BY sn.created_at DESC';
  const serials = await db.prepare(q).bind(...params).all();
  return c.json({ success: true, data: serials.results || [] });
});

api.post('/serial-numbers', requireRole('admin', 'manager'), async (c) => {
  const db = c.env.DB;
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  const serials = Array.isArray(body.serial_numbers) ? body.serial_numbers : [body.serial_number];
  for (const sn of serials) {
    const id = uuidv4();
    await db.prepare('INSERT INTO serial_numbers (id, tenant_id, product_id, serial_number, status) VALUES (?, ?, ?, ?, ?)').bind(id, tenantId, body.product_id, sn, 'available').run();
  }
  return c.json({ success: true, message: `${serials.length} serial numbers registered` }, 201);
});
