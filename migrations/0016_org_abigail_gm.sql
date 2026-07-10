-- Org chart fix: consolidate Abigail onto her general_manager account, promote Lucky to field manager.
--
-- Before: two active Abigail Roberts rows.
--   ba582c40  Abigail@bridgethegap.site   general_manager, Goldrush + Stellr, 0 reports
--   a597c545  Abigail1@bridgethegap.site  manager,         Stellr only,       Lucky + Lungelwa report to her
-- After: ba582c40 is the only Abigail. a597c545 is deactivated and unlinked.
--
-- Lucky Mahlaba (ef70738c) becomes the field manager. He had 18 agents hanging off team_lead_id;
-- a manager is not a team lead, so those move to manager_id — otherwise reactToIssues would own
-- their issues as owner_role='team_lead' and hold Lucky to the 48h lead SLA instead of 72h.
-- Lungelwa Tyali (7f43402f) stays a team lead with her 2 agents and now reports to Lucky.
--
-- Chain after this: agent -> Lungelwa (lead, 48h) -> Lucky (manager, 72h) -> Abigail (GM)
--                   agent -> Lucky (manager, 72h) -> Abigail (GM)
--
-- DESTRUCTIVE: deactivates a login (a597c545). No rows are deleted; is_active flips to 0 and can
-- be flipped back. a597c545 has logged 0 visits, so no field history is detached.

-- 1. Retire the duplicate Abigail and every link she carried.
UPDATE users SET role = 'manager', is_active = 0 WHERE id = 'a597c545-6797-40b4-b323-80c3b8bb9bd0';
UPDATE manager_company_links SET is_active = 0 WHERE manager_id = 'a597c545-6797-40b4-b323-80c3b8bb9bd0';
UPDATE agent_company_links  SET is_active = 0 WHERE agent_id   = 'a597c545-6797-40b4-b323-80c3b8bb9bd0';

-- 2. Lucky: team_lead -> manager, reporting to the GM.
UPDATE users
   SET role = 'manager', manager_id = NULL, team_lead_id = NULL,
       gm_id = 'ba582c40-fe9f-4338-aa27-57a32b77688c'
 WHERE id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6';

-- A manager spans many customers, so his single-customer agent link moves to manager_company_links.
UPDATE agent_company_links SET is_active = 0 WHERE agent_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6';
INSERT INTO manager_company_links (id, manager_id, company_id, tenant_id, is_active)
SELECT 'mcl-lucky-stellr', 'ef70738c-eccc-4635-9234-1a964a4e5bf6', id, 'default-tenant-001', 1
  FROM field_companies WHERE name = 'Stellr'
   AND NOT EXISTS (SELECT 1 FROM manager_company_links
                    WHERE manager_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6' AND company_id = field_companies.id);

-- 3. Lucky's 18 former agents: no lead any more, they report to him as manager.
UPDATE users SET team_lead_id = NULL, manager_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6'
 WHERE team_lead_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6' AND is_active = 1;

-- 4. Lungelwa keeps her leads, now under Lucky.
UPDATE users
   SET manager_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6',
       gm_id = 'ba582c40-fe9f-4338-aa27-57a32b77688c'
 WHERE id = '7f43402f-b3b4-4c37-ab5a-fdec186602e9';

-- 5. Every other manager in the tenant had a NULL gm_id, which stalled manager->GM escalation.
UPDATE users SET gm_id = 'ba582c40-fe9f-4338-aa27-57a32b77688c'
 WHERE tenant_id = 'default-tenant-001' AND role = 'manager' AND is_active = 1 AND gm_id IS NULL;
