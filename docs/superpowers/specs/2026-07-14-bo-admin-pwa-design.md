# BO Admin PWA — Wave 1 Design

Back-office admin's PWA (`/agent/*`) is underdeveloped versus the role: daily work
(photo review, Goldrush upload failures, org issue triage) only exists on the desktop
console, and the Home work queue misses two of the four gates the role clears.

## Scope — wave 1 (this branch)

1. **PWA Photo Review screen** — new `pages/agent/BOPhotoReview.tsx` at
   `/agent/photo-review`. Mobile adaptation of `AdminPhotoReviewPage.tsx`, reusing
   `photoReviewService` (`GET /visit-photos/admin-review`, approve/reject POSTs)
   unchanged. Pending-first queue, status filter chips, approve/reject (reject with
   reason), load-more pagination. Dark PWA skin (BOActionQueue idiom).
2. **PWA Upload Failures screen** — new `pages/agent/BOUploadFailures.tsx` at
   `/agent/upload-failures`. Mobile adaptation of `CaptureFailuresReport.tsx`,
   reusing `GET /field-ops/reports/goldrush-upload-failures` unchanged. Default
   range Monday→today, grouped team lead → agent, error chips. The AgentDashboard
   leader tile that linked out to the desktop report now navigates here.
3. **UnmanagedIssues visible for BO on PWA Home** — `AgentDashboard.tsx` render gate
   and `buildHomePulse` orgLeader flag switch from `isManagerPlus` (omits
   backoffice_admin) to `canSeeUnmanaged` (mirrors backend
   `requireRole('admin','general_manager')`, which BO passes via roleAllows).
   NOT adding BO to MANAGER_ROLES — that also gates manager quick-cards.
4. **BOActionQueue extended** — two new counts with tap-throughs: pending photo
   reviews (`admin-review?limit=1&review_status=pending` → pagination.total) and
   upload failures 7d (`goldrush-upload-failures` total). Four gates on one card.
5. **MobileBottomTabs Marketing tab** — roles `['admin','super_admin','manager']`
   omit backoffice_admin + general_manager (office shell); switch to MGMT list.

No backend changes: every endpoint already admits backoffice_admin.

## Deferred — wave 2

Commission approval and PIN management stay desktop-only for now; both are
occasional/seated tasks, not field-queue work. Revisit if BO users ask.

## Testing

Pure-gate vitest: `canSeeUnmanaged('backoffice_admin')` true / `'manager'` false,
plus `buildHomePulse` orgLeader unmanaged chip. tsc + build green; 40/40 baseline
kept.
