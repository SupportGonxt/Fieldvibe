# PWA Per-Role Audit — 2026-07-14

Source: background Explore agent, full sweep of AgentLayout/MobileBottomTabs/App.tsx routes/navigation.ts. Feeds Stage 4-6 redesign ("world class per role").

## Money-rule violations (canonical: field roles counts-only; exemptions: own commission pay + tier ladder)

1. **DashboardPage.tsx (office `/dashboard`)** — uniform layout for all dual-access roles, raw `formatCurrency(total_revenue / activity.value / performer.total_revenue)` ~lines 185-357, NO canSeeMoney gate. `manager` reaches it via `/choose` (officeHome('manager') → `/dashboard`). **FIX IN FLIGHT: branch fix/dashboard-money-gate.**
2. ManagerTeamsTab.tsx 325/329/333 `org_commission` rand + tier amounts — likely EXEMPT (own commission pay + ladder), needs business-rule confirm only if user disputes.
3. TeamTab.tsx 284-292 team_commission rand, AgentStats.tsx ~684 tier rand — same exemption reading.

## Dead/misrouted

- **Finance tab dead-end for `manager`**: MobileBottomTabs.tsx:10 hand-rolled `MGMT` array includes manager, but `/finance/*` wrapped `<ProtectedRoute requiredRole="admin">` (App.tsx ~830-846, 1047-1066) → "Access Denied". Root cause: MGMT array duplicates capabilities.ts's ADMIN_EQUIVALENT and disagrees. Fix: derive from capabilities.ts.
- **`/agent/pin-management`** (App.tsx:1120) registered in office AppShell tree, not AgentLayout children — unreachable from backoffice_admin PWA tabs (their working surface). Route-tree misplacement.
- **`/mobile-dashboard`** (App.tsx:1152) orphaned — zero nav references.
- `/inventory` + `/marketing` have NO ProtectedRoute at all — any authenticated role by URL.
- `/more` (MoreMenuPage) only reachable by office-shell roles; menuSections nearly ungated (only System Settings gated admin/super_admin) — exposes Finance/Commissions links to manager, inconsistent with MobileBottomTabs per-tab arrays.
- navigation.ts child links: `permission: null` almost everywhere — child filtering inert.

## Per-role feature gaps (Stage 4-6 backlog)

- **team_lead**: no coaching/1-on-1 action surface; Team tab is commission-display only. Wants BOActionQueue-style actionable queue for underperforming agents.
- **manager**: no counts-only "team pulse" aggregate anywhere — Teams tab is Rand-commission-first, inverted vs the business rule. No manager-detail drill-down exists (GmOverview.tsx ~309 self-flagged ponytail comment).
- **general_manager**: Managers section in Overview has no drill-down (Teams and Top performers do).
- **backoffice_admin**: PIN management unreachable from PWA tabs; no dedicated commission-approval tool in PWA tab set (only desktop Finance path). BOActionQueue = best UX pattern in app — replicate for other roles.
- Cross-role: no coaching notes / 1:1 log feature anywhere.

## Patterns worth reusing

- BOActionQueue.tsx: 4 parallel count-only endpoints, worst-first tap-through, queue-clear empty state — the model for role-tailored action-oriented home.
- BOUploadFailures reachable from two entry points (BO queue + leader KPI card) — consistent, but duplicated wiring.
