-- Lucky Mahlaba runs Stellr as both field manager and team lead. 0016 moved his 18 agents off
-- team_lead_id onto manager_id on the assumption a manager is never a lead; he is. Put the lead
-- link back and keep the manager link — the same person holds both rungs.
--
-- reactToIssues then owns those agents' issues via team_lead_id (48h lead SLA) and, on breach,
-- escalates past the manager rung straight to the GM, because Lucky's own manager_id is NULL and
-- an issue is never escalated to the person already sitting on it.

UPDATE users
   SET team_lead_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6'
 WHERE manager_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6'
   AND is_active = 1
   AND role IN ('agent', 'field_agent', 'sales_rep');

-- He still works the field, so he keeps a customer link as a subject of his own KPIs.
UPDATE agent_company_links SET is_active = 1
 WHERE agent_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6';
