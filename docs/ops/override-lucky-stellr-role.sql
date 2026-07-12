-- Per-company role override. Migration 0021 backfills every agent_company_links row from the
-- user's GLOBAL users.role. Lucky Mahlaba is a manager in Goldrush but a team_lead in Stellr,
-- so his Stellr link needs an explicit override after 0021 runs.
--
-- Run AFTER applying migration 0021. Idempotent (sets an exact value).
UPDATE agent_company_links
   SET role = 'team_lead'
 WHERE agent_id  = 'ef70738c-eccc-4635-9234-1a964a4e5bf6'   -- Lucky Mahlaba
   AND company_id = '5b129b5b-92b1-43c2-8523-caa221179d33';  -- Stellr
