-- Merge the two active Lucky Mahlaba accounts into one. Same person, same phone +27730065634,
-- one account per customer — an artefact of the Goldrush migration meeting the Stellr signup.
--
--   4f0414da  lucky /  (empty)   migrated.9@goldrush.salessync   Goldrush   26 reports  last_login 2026-06-26
--   ef70738c  Lucky / Mahlaba    mahlaba.luckyman@gmail.com      Stellr     19 reports  last_login NULL
--
-- KEEPER IS 4f0414da — the only one he has ever signed in with. ef70738c has never been logged
-- into and may carry no usable password, so keeping it would risk locking him out. The email stays
-- migrated.9@goldrush.salessync for the same reason: it is his login handle, not a mailbox.
-- Only the name is corrected. Managers span many customers, so the keeper takes both.
--
-- Nothing outside `users` points at ef70738c: 0 visits, 0 territories, 0 agent_company_assignments,
-- 0 user_roles, 0 capture_failures. Only the org chain and the two link tables move.
--
-- DESTRUCTIVE: deactivates a login (ef70738c). No rows deleted; is_active flips to 0, reversible.

-- 1. Fix the keeper's name. Email/password untouched.
UPDATE users SET first_name = 'Lucky', last_name = 'Mahlaba'
 WHERE id = '4f0414da-9594-47bc-99fb-2a0f44f5775f';

-- 2. Move the org chain. ef70738c is nobody's manager_id/team_lead_id after this, so 0017's
--    both-rungs arrangement (manager AND lead of the same 18 agents) carries over intact.
UPDATE users SET manager_id = '4f0414da-9594-47bc-99fb-2a0f44f5775f'
 WHERE manager_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6' AND is_active = 1;
UPDATE users SET team_lead_id = '4f0414da-9594-47bc-99fb-2a0f44f5775f'
 WHERE team_lead_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6' AND is_active = 1;

-- 3. Stellr moves onto the keeper, who already holds Goldrush. No conflict: the two accounts
--    carried disjoint customers.
UPDATE manager_company_links SET manager_id = '4f0414da-9594-47bc-99fb-2a0f44f5775f'
 WHERE manager_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6' AND is_active = 1;

-- 4. Drop the agent link 0017 gave him. It only mattered if he were a KPI subject, and he has
--    logged 0 visits ever — reactToIssues will never see him as one. A manager's customers live
--    on manager_company_links, and that table is where both of his now sit.
UPDATE agent_company_links SET is_active = 0
 WHERE agent_id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6';

-- 5. Retire the duplicate.
UPDATE users SET is_active = 0, manager_id = NULL, team_lead_id = NULL
 WHERE id = 'ef70738c-eccc-4635-9234-1a964a4e5bf6';

-- 6. Keeper is a manager under the GM. Guard against a self-loop from step 2 (his own row could
--    not match, but a re-run against a mutated chain could).
UPDATE users
   SET role = 'manager', manager_id = NULL, team_lead_id = NULL,
       gm_id = 'ba582c40-fe9f-4338-aa27-57a32b77688c'
 WHERE id = '4f0414da-9594-47bc-99fb-2a0f44f5775f';
