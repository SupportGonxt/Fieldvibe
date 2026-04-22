# Cleanup test users from the preview/dev D1 database
# Run from inside workers-api/: .\cleanup-test-data.ps1
#
# Users removed:
#   admin-user-001       admin@demo.com
#   agent-user-001       agent@demo.com
#   manager-user-001     manager@demo.com
#   agent-test-001..005  sipho / thandiwe / bongani / naledi / thabo (@fieldvibe.test)
#   e6c2898a-...         luke@gonxt.tech
#
# Kept: super-admin-001  superadmin@fieldvibe.com

$USER_IDS = @(
    'admin-user-001',
    'agent-user-001',
    'manager-user-001',
    'agent-test-001',
    'agent-test-002',
    'agent-test-003',
    'agent-test-004',
    'agent-test-005',
    'e6c2898a-6420-4327-8000-e7857021a306'
)

$IDS = ($USER_IDS | ForEach-Object { "'$_'" }) -join ','

$SQL = @"
DELETE FROM visit_individuals WHERE visit_id IN (SELECT id FROM visits WHERE agent_id IN ($IDS));
DELETE FROM visit_responses WHERE visit_id IN (SELECT id FROM visits WHERE agent_id IN ($IDS));
DELETE FROM visit_activities WHERE visit_id IN (SELECT id FROM visits WHERE agent_id IN ($IDS));
DELETE FROM visit_photos WHERE visit_id IN (SELECT id FROM visits WHERE agent_id IN ($IDS));
DELETE FROM posm_audits WHERE visit_id IN (SELECT id FROM visits WHERE agent_id IN ($IDS));
DELETE FROM posm_installations WHERE visit_id IN (SELECT id FROM visits WHERE agent_id IN ($IDS));
DELETE FROM share_of_voice_snapshots WHERE visit_id IN (SELECT id FROM visits WHERE agent_id IN ($IDS));
DELETE FROM individual_registrations WHERE visit_id IN (SELECT id FROM visits WHERE agent_id IN ($IDS));
DELETE FROM survey_responses WHERE visit_id IN (SELECT id FROM visits WHERE agent_id IN ($IDS));
DELETE FROM visits WHERE agent_id IN ($IDS);
DELETE FROM sales_order_items WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE agent_id IN ($IDS));
DELETE FROM payments WHERE sales_order_id IN (SELECT id FROM sales_orders WHERE agent_id IN ($IDS));
DELETE FROM sales_orders WHERE agent_id IN ($IDS);
DELETE FROM van_stock_load_items WHERE van_stock_load_id IN (SELECT id FROM van_stock_loads WHERE agent_id IN ($IDS));
DELETE FROM van_reconciliations WHERE van_stock_load_id IN (SELECT id FROM van_stock_loads WHERE agent_id IN ($IDS));
DELETE FROM van_stock_loads WHERE agent_id IN ($IDS);
DELETE FROM route_plan_stops WHERE route_plan_id IN (SELECT id FROM route_plans WHERE agent_id IN ($IDS));
DELETE FROM route_plans WHERE agent_id IN ($IDS);
DELETE FROM commission_earnings WHERE earner_id IN ($IDS);
DELETE FROM commission_payouts WHERE earner_id IN ($IDS);
DELETE FROM activation_performances WHERE activation_id IN (SELECT id FROM activations WHERE agent_id IN ($IDS));
DELETE FROM activations WHERE agent_id IN ($IDS);
DELETE FROM competitor_sightings WHERE agent_id IN ($IDS);
DELETE FROM anomaly_flags WHERE agent_id IN ($IDS);
DELETE FROM individual_registrations WHERE agent_id IN ($IDS);
DELETE FROM agent_company_links WHERE agent_id IN ($IDS);
DELETE FROM agent_company_assignments WHERE user_id IN ($IDS);
DELETE FROM agent_locations WHERE agent_id IN ($IDS);
DELETE FROM daily_targets WHERE agent_id IN ($IDS);
DELETE FROM monthly_targets WHERE agent_id IN ($IDS);
DELETE FROM working_days_config WHERE agent_id IN ($IDS);
DELETE FROM territory_assignments WHERE agent_id IN ($IDS);
DELETE FROM notifications WHERE user_id IN ($IDS);
DELETE FROM push_subscriptions WHERE user_id IN ($IDS);
DELETE FROM report_subscriptions WHERE user_id IN ($IDS);
DELETE FROM password_reset_tokens WHERE user_id IN ($IDS);
DELETE FROM password_resets WHERE user_id IN ($IDS);
DELETE FROM user_roles WHERE user_id IN ($IDS);
DELETE FROM goal_assignments WHERE user_id IN ($IDS);
DELETE FROM campaign_assignments WHERE user_id IN ($IDS);
UPDATE routes SET salesman_id = NULL WHERE salesman_id IN ($IDS);
UPDATE users SET manager_id = NULL WHERE manager_id IN ($IDS);
UPDATE users SET team_lead_id = NULL WHERE team_lead_id IN ($IDS);
DELETE FROM users WHERE id IN ($IDS);
"@

$TMP = [System.IO.Path]::GetTempFileName() -replace '\.tmp$', '.sql'
$SQL | Out-File -FilePath $TMP -Encoding utf8

Write-Host "Running cleanup against fieldvibe (prod)..."
npx wrangler d1 execute fieldvibe-db --remote --file $TMP

Remove-Item $TMP
Write-Host "Done."
