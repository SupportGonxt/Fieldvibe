-- Payment ledger (item #3 of post-audit buildout).
-- Append-only journal of every cash movement. Live in parallel with the existing
-- `payments` table, which keeps writing as today; this commit adds parallel writes
-- so historical reporting can switch over later without backfill risk.

CREATE TABLE IF NOT EXISTS payment_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  payment_id TEXT,                              -- the receipt this entry belongs to (FK payments.id, nullable for adjustments)
  sales_order_id TEXT,                          -- nullable: unallocated receipts have NULL until applied
  entry_type TEXT NOT NULL CHECK (entry_type IN ('RECEIPT','APPLICATION','REVERSAL','FX_ADJUSTMENT','WRITE_OFF')),
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT','CREDIT')),
  amount REAL NOT NULL,                         -- always positive; direction encodes the sign
  currency TEXT NOT NULL DEFAULT 'ZAR',
  fx_rate REAL DEFAULT 1.0,
  reversal_of TEXT,                             -- payment_ledger.id this row reverses (NULL otherwise)
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (payment_id) REFERENCES payments(id),
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  FOREIGN KEY (reversal_of) REFERENCES payment_ledger(id)
);
CREATE INDEX IF NOT EXISTS idx_pl_tenant_order ON payment_ledger(tenant_id, sales_order_id);
CREATE INDEX IF NOT EXISTS idx_pl_tenant_payment ON payment_ledger(tenant_id, payment_id);
CREATE INDEX IF NOT EXISTS idx_pl_reversal ON payment_ledger(reversal_of);
