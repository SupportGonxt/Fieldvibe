-- Per-company override for the store revisit cooldown. /visits/check-store-revisit
-- defaults to 30 days when this is NULL; a company can shorten, lengthen, or (0 or
-- less) disable it entirely — e.g. a prospecting flow that needs frequent follow-ups
-- on a store it just added, where the 30-day default doesn't apply.
ALTER TABLE field_companies ADD COLUMN revisit_cooldown_days INTEGER DEFAULT 30;
