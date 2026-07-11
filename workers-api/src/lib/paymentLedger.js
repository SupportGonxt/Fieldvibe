import { v4 as uuidv4 } from 'uuid';

// Writes a RECEIPT + APPLICATION pair to payment_ledger to mirror a payments INSERT.
// Best-effort: a ledger failure must NEVER fail the payments write that drives
// existing dashboards. The opt-in /admin/payments/backfill-ledger endpoint can
// repair any gaps after the fact.
async function writePaymentLedgerEntries(db, { tenantId, paymentId, salesOrderId, amount, userId, notes, currency }) {
  try {
    if (!tenantId || !paymentId || amount == null) return;
    const amt = Number(amount) || 0;
    if (!Number.isFinite(amt) || amt === 0) return;
    const cur = currency || 'ZAR';
    const receiptId = uuidv4();
    const stmts = [
      db.prepare(
        'INSERT INTO payment_ledger (id, tenant_id, payment_id, sales_order_id, entry_type, direction, amount, currency, notes, created_by) ' +
        "VALUES (?, ?, ?, NULL, 'RECEIPT', 'CREDIT', ?, ?, ?, ?)"
      ).bind(receiptId, tenantId, paymentId, Math.abs(amt), cur, notes || null, userId || 'system'),
    ];
    if (salesOrderId) {
      stmts.push(
        db.prepare(
          'INSERT INTO payment_ledger (id, tenant_id, payment_id, sales_order_id, entry_type, direction, amount, currency, notes, created_by) ' +
          "VALUES (?, ?, ?, ?, 'APPLICATION', 'CREDIT', ?, ?, ?, ?)"
        ).bind(uuidv4(), tenantId, paymentId, salesOrderId, Math.abs(amt), cur, notes || null, userId || 'system'),
      );
    }
    await db.batch(stmts);
  } catch (err) {
    console.error('payment_ledger write failed for payment', paymentId, err && err.message);
  }
}

export { writePaymentLedgerEntries };
