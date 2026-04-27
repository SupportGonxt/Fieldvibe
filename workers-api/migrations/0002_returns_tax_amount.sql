-- Add tax_amount to returns so net credit calculation can account for tax explicitly.
-- D1/SQLite: ALTER ADD COLUMN is safe and non-locking.
ALTER TABLE returns ADD COLUMN tax_amount REAL DEFAULT 0;
