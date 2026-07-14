# FieldVibe Premium Design System — Design Spec

**Date:** 2026-07-14
**Status:** Approved for planning
**Scope:** All web + PWA screens (frontend/ — React + TS + Vite + Tailwind), no backend changes except reading existing tenant theme config.
**Goal (user's words):** "designed for ease of use, premium, and world class, all web and pwa screens. all reports, interactions, use custom icons, and designer heros." Quality bar: better than Salesforce.
**Product truth:** FieldVibe is a high-performance-driving field sales system. Agents live in the field on the PWA; office staff live on desktop web. Every screen must answer "what do I do next" before it answers "how am I doing".

---

## 0. Non-negotiable business rules (bake into every screen)

These override any visual decision. Violating any of these is a blocking defect.

1. **Data visibility by role.** Field roles (`agent`, `field_agent`, `sales_rep`, `team_lead`, `manager`) see per-day COUNTS only — signups, verified, deposits. NEVER rand values, deposit totals, or revenue. GM and admin-equivalents see revenue = deposits × R75 (from `commission_per_deposit` config, `workers-api/src/routes/field-ops/config.js`). No hero, chart, tooltip, drilldown, or export may leak rand values to field roles.
2. **Exemptions:** (a) a user's OWN incentive/commission pay is visible to that user (e.g. `frontend/src/pages/agent/HeroIncentive.tsx`, `/commissions/my`); (b) incentive tier ladders WITH rand amounts are visible to ALL roles — the ladder is motivational, publish it everywhere it's relevant.
3. **Role-tailored, not homogenized.** Each role's PWA is built around that user's job: agent = personal targets/streaks; team_lead = team-average gates; manager = org average + coaching queue; GM = revenue + org health; backoffice_admin = verification queue + SLA. Do NOT ship one layout with swapped numbers (see memory: role-tailored PWAs).
4. **Role gating uses `hasRole()`** (`frontend/src/lib/capabilities.ts` / `workers-api/src/lib/capabilities.js`), never exact role-string comparison. `backoffice_admin`, `admin`, `general_manager` are admin-equivalent; `backoffice_admin` must never be locked out of admin-gated UI by a string check.
5. **Action-oriented layouts.** The issues/actions system already exists: `frontend/src/lib/signalRegistry.ts` (mirrors `workers-api/src/services/kpiSignals.js` SIGNAL_REGISTRY), the issue queue, and nudge/checkin/recognition actions. Every home screen surfaces the actionable queue above passive stats.

---

## 1. Design tokens — CSS variables layer over Tailwind

### 1.1 Current state (verified)

- `frontend/tailwind.config.js` defines raw hex palettes: `primary` (a blue 50–900 scale, misleadingly named), `accent.*`, `surface.*`, `night.*` (dark backgrounds), `pulse.*` (brand green, `pulse.500 = #00E87B`). No CSS variables anywhere.
- 382 raw occurrences of `#00E87B` across `frontend/src` (53 files), mostly as arbitrary Tailwind values (`bg-[#00E87B]`, `text-[#00E87B]`, `shadow-[0_0_20px_#00E87B40]`).
- `frontend/src/index.css` (899 lines) contains a ~170-line hex-matching `!important` light-mode override block (starting around line 362, e.g. line 391 `color: #6B7280 !important;`). This block exists because components hardcode dark-theme hexes; it fights specificity instead of using tokens.
- Dark mode is `darkMode: 'class'` toggled by `frontend/src/store/theme.store.ts`.
- Tenant theme exists in backend config (`primaryColor` surfaced through `frontend/src/services/tenant.service.ts`, which currently hardcodes fallbacks `#3B82F6` / `#004B93`) but nothing wires it into styling.

### 1.2 Target architecture

**New file: `frontend/src/styles/tokens.css`**, imported first in `frontend/src/index.css`. Single source of truth. Two blocks: `:root` (light) and `.dark` (dark). Both themes are first-class — dark is the field/PWA default, light is the office default, but every token has a value in both.

Token inventory (exact names; Tailwind utilities map to these):

```
/* Brand */
--color-primary            /* #00E87B default; tenant-overridable */
--color-primary-strong     /* pressed/hover: color-mix(in srgb, var(--color-primary) 85%, black) */
--color-primary-soft       /* tint bg: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg)) */
--color-on-primary         /* text on primary fills: #04110A light+dark */

/* Semantic status */
--color-success  --color-warning  --color-danger  --color-info

/* Surfaces & text (flip between :root and .dark) */
--color-bg                 /* app background: #F8FAFC light / #0A0F1C dark (night.DEFAULT) */
--color-surface            /* card: #FFFFFF light / #141929 dark (night.100) */
--color-surface-raised     /* modal/dropdown: #FFFFFF light / #1A1F2E dark (night.50) */
--color-border             /* #E2E8F0 light / #1E2638 dark */
--color-text               /* #0F172A light / #F1F5F9 dark */
--color-text-muted         /* #64748B light / #94A3B8 dark */
--color-text-faint         /* #94A3B8 light / #64748B dark */

/* Spacing (4px base; used for section rhythm, not a Tailwind replacement) */
--space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
--space-6: 24px; --space-8: 32px; --space-12: 48px;

/* Radius */
--radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
--radius-xl: 20px; --radius-full: 9999px;

/* Elevation (shadows tuned per theme; dark uses subtle borders + darker shadow) */
--elevation-card; --elevation-card-hover; --elevation-raised; --elevation-hero

/* Motion */
--duration-fast: 120ms; --duration-base: 200ms; --duration-slow: 350ms;
--duration-celebrate: 900ms;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

Derived primary shades use native `color-mix()` (supported in all evergreen browsers and the PWA WebView targets) — no JS color library, no generated 50–900 scale for tenant colors.

**`frontend/tailwind.config.js` changes:**
- `pulse` scale REMAPPED: `pulse.DEFAULT`/`pulse.500` → `var(--color-primary)`; keep the numbered hex scale only inside `tokens.css` as fallback values, not in class names.
- Add semantic Tailwind colors backed by variables: `primary: 'var(--color-primary)'`, `surface`, `bg`, `border`, `text` etc. (using Tailwind's `<alpha-value>`-less var form; opacity variants come from `color-mix` utilities or explicit soft tokens).
- The existing blue `primary` scale is RENAMED `info` (it's used as a chart/info blue); a codemod pass renames `primary-500` etc. usages. After rollout, `primary` in class names means brand green everywhere.
- `borderRadius`, `boxShadow`, and `animation` extends re-pointed at the variables (`'card': 'var(--elevation-card)'` …).

**Hardcoded hex elimination:** mechanical codemod across `frontend/src`:
- `bg-[#00E87B]` → `bg-primary`; `text-[#00E87B]` → `text-primary`; `border-[#00E87B]` → `border-primary`; alpha variants like `#00E87B40` → `bg-primary/25` or `--color-primary-soft`.
- Inline style objects (`style={{ color: '#00E87B' }}`) → `var(--color-primary)`.
- Recharts fills/strokes: charts read tokens via a new `frontend/src/lib/chartTheme.ts` that exports `getChartColors()` reading `getComputedStyle(document.documentElement)` — one place, all 37 recharts files import from it.

**Kill the `!important` block:** delete the ~170-line hex-matching light-mode override section of `frontend/src/index.css` in the same PR that converts the components it was patching. Rule going forward: zero `!important` in app CSS except print styles and the PWA display-mode utilities (index.css lines 362/366 `display:none/block !important` for standalone-mode chrome, which stay).

### 1.3 Tenant theming (wire `theme.primaryColor`)

- **New file: `frontend/src/lib/applyTenantTheme.ts`** — `applyTenantTheme(theme?: { primaryColor?: string })`: validates the hex (`/^#[0-9a-fA-F]{6}$/`), sets `document.documentElement.style.setProperty('--color-primary', hex)`. Derived tokens (`-strong`, `-soft`) are defined in CSS via `color-mix()` on `--color-primary`, so they update automatically. Also sets `<meta name="theme-color">` for PWA chrome.
- Called from the app bootstrap after tenant config load (where `frontend/src/services/tenant.service.ts` theme is fetched), and on tenant switch. No theme → FieldVibe pulse green `#00E87B` stands.
- Contrast guard: if the tenant color fails 3:1 contrast against `--color-on-primary`, flip `--color-on-primary` to white; a 10-line luminance check inside `applyTenantTheme.ts`, no dependency.
- `tenant.service.ts` hardcoded fallbacks `#3B82F6`/`#004B93` change to `#00E87B` (brand default) — tenant demo palettes move to tenant config where they belong.

---

## 2. Icon system

### 2.1 Standard: lucide-react everywhere

lucide-react is already in 417 files — it is the standard. Conventions (documented in `frontend/src/components/icons/README.md` — the one doc file this system gets):

- Sizes: 16 (inline/table), 20 (buttons, nav, list rows), 24 (page headers, empty states), 32+ (heros only).
- `strokeWidth={1.75}` default app-wide (set once via lucide's `IconContext`-equivalent: a thin re-export module `frontend/src/components/icons/lucide.ts` that re-exports used icons with defaults — optional; if churn is high, just enforce via lint rule + convention).
- Icons never carry meaning alone: pair with text or `aria-label`.

### 2.2 Custom branded domain icon set

**New directory: `frontend/src/components/icons/`.** Small React SVG components, `currentColor` stroke/fill, `size` prop (default 24), `viewBox="0 0 24 24"`, drawn on the lucide 24-grid at 1.75 stroke so they sit seamlessly next to lucide icons. Exactly these eight (domain concepts lucide can't express):

| Component | File | Concept |
|---|---|---|
| `SignupIcon` | `icons/SignupIcon.tsx` | New customer signup (person + pulse spark) |
| `DepositIcon` | `icons/DepositIcon.tsx` | First deposit (coin into slot, motion tick) |
| `VerifiedIcon` | `icons/VerifiedIcon.tsx` | Verified signup (shield + brand check) |
| `StreakIcon` | `icons/StreakIcon.tsx` | Consecutive-day streak (flame with day-notches) |
| `TierIcon` | `icons/TierIcon.tsx` | Incentive tier / gate (ladder-step chevrons; accepts `tier` prop 1–3 to fill steps) |
| `ReconIcon` | `icons/ReconIcon.tsx` | Cash reconciliation (scales/balance with rand glyph) |
| `CommissionIcon` | `icons/CommissionIcon.tsx` | Commission/earnings (wallet + upward tick) |
| `TargetHitIcon` | `icons/TargetHitIcon.tsx` | Target achieved (bullseye + burst) |

Barrel export `icons/index.ts`. These are the ONLY hand-drawn SVGs; everything else stays lucide. No icon-font, no sprite sheet, no SVGR pipeline.

### 2.3 Migration list A — retire MUI (23 files, verified exact)

Replace `@mui/material` + `@mui/icons-material` + `@emotion/*` usage, then remove all four packages from `frontend/package.json`. Files:

```
src/components/AdvancedDataTable.tsx          → rebuild on components/ui/tables primitives
src/components/DashboardCharts.tsx            → recharts + ui/Card
src/components/KanbanBoard.tsx                → ui/Card + native drag events (already partly custom)
src/components/agent/DynamicForm.tsx          → ui/Input, ui/SelectField
src/components/agent/PolygonDrawer.tsx        → ui/Button, lucide icons
src/components/customers/CustomerFormModal.tsx→ ui/Modal, ui/Input
src/components/surveys/SurveyAssignmentStep.tsx → ui/SelectField, ui/Badge
src/pages/CustomersAdvanced.tsx               → ui/tables, ui/Badge
src/pages/DashboardPage.tsx                   → ui/StatCard, ui/Card
src/pages/OrdersKanban.tsx                    → same treatment as KanbanBoard
src/pages/admin/AdminDashboard.tsx            → ui/StatCard, ui/Card
src/pages/admin/ProductTypeBuilderPage.tsx    → ui/Input, ui/Modal
src/pages/admin/SurveyBuilderPage.tsx         → ui/Input, ui/Modal, ui/SelectField
src/pages/agent/AgentPinManagement.tsx        → ui/Input, ui/Button
src/pages/customers/CustomerDashboard.tsx     → ui/StatCard, recharts
src/pages/field-operations/visits/VisitCreate.tsx → ui/Input, ui/SelectField, mobile patterns
src/pages/finance/FinanceDashboard.tsx        → ui/StatCard, recharts
src/pages/orders/OrderDashboard.tsx           → ui/StatCard, recharts
src/pages/sales/SalesDashboard.tsx            → ui/StatCard, recharts
src/pages/superadmin/TenantManagement.tsx     → ui/tables, ui/Modal
src/pages/superadmin/TenantModules.tsx        → ui/Card, ui/Badge (toggle: native checkbox styled)
src/pages/surveys/SurveyCreate.tsx            → ui/Input, ui/SelectField
src/pages/surveys/SurveyEdit.tsx              → ui/Input, ui/SelectField
```

`AdvancedDataTable.tsx` is the long pole (MUI Table/Pagination). It becomes the premium table primitive in `components/ui/tables/` (sortable headers, sticky first column, density toggle, skeleton rows) and every other MUI-table consumer moves onto it.

### 2.4 Migration list B — emoji-as-icons (28 files, verified exact)

Replace decorative/semantic emoji with lucide or the custom set (emoji in user-generated content or copy strings stays):

```
src/components/ErrorBoundary.tsx
src/components/agent/DynamicForm.tsx
src/components/agent/PolygonDrawer.tsx
src/components/agents/ActivityTracker.tsx
src/pages/BoardPlacementFormPage.tsx
src/pages/CustomerSelectionPage.tsx
src/pages/FieldMarketingAgentPage.tsx
src/pages/ProductDistributionFormPage.tsx
src/pages/SKUAvailabilityCheckerPage.tsx
src/pages/ShelfAnalyticsFormPage.tsx
src/pages/TradeMarketingAgentPage.tsx
src/pages/VisitWorkflowPage.tsx
src/pages/admin-settings/IntegrationsPage.tsx
src/pages/admin-settings/SystemSettingsPage.tsx
src/pages/admin/DataImportExportPage.tsx
src/pages/agent/AgentDashboard.tsx
src/pages/field-operations/FieldOperationsDashboard.tsx
src/pages/field-operations/ProcessFlowManagementPage.tsx
src/pages/field-operations/WorkingDaysConfigPage.tsx
src/pages/field-operations/reports/CaptureFailuresReport.tsx
src/pages/field-operations/survey-responses/SurveyAnalysis.tsx
src/pages/field-operations/survey-responses/SurveyAnswerDetail.tsx
src/pages/field-operations/survey-responses/SurveyResponseDetail.tsx
src/pages/field-operations/visit-tasks/BoardPlacementDetail.tsx
src/pages/field-operations/visits/VisitCreate.tsx
src/pages/promotions/PromotionsDashboard.tsx
src/pages/surveys/SurveysDashboard.tsx
src/pages/van-sales/VanSalesDashboard.tsx
```

Exception: celebration surfaces (confetti burst, streak flame in heros) may use the custom `StreakIcon`/`TargetHitIcon`, never raw emoji.

---

## 3. Designer heros — the Hero component family

### 3.1 Benchmark

`frontend/src/pages/agent/HeroIncentive.tsx` (156 lines) is the existing quality bar: gradient panel, Trophy badge, tier ladder, personal pay framing. Generalize it; don't clone it per-screen.

### 3.2 New components — `frontend/src/components/hero/`

| File | What it is |
|---|---|
| `Hero.tsx` | Gradient panel shell. Props: `eyebrow` (small caps label), `metric` (big number, animated count-up on mount via rAF — 15 lines, no dep), `metricLabel`, `progress` (0–1, renders ProgressRing right-aligned), `cta` ({label, onClick/to, icon}), `tone` ('primary' \| 'success' \| 'warning' \| 'night'), `children` (slot for ladder/sparkline). Gradient: `linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 20%, var(--color-surface)), var(--color-surface))` with a soft radial glow top-right; `--elevation-hero`; `--radius-xl`. Full-bleed on PWA (edge-to-edge minus 16px gutter), max-width card in desktop shells. |
| `ProgressRing.tsx` | SVG ring, props `value` (0–1), `size` (default 72), `label` (center slot). Stroke = `var(--color-primary)`, track = `--color-border`. Animates stroke-dashoffset over `--duration-slow`. Also used standalone in stat rows and report headers. |
| `Celebration.tsx` | Confetti burst micro-interaction: ~24 absolutely-positioned CSS-animated particles (brand green + white + gold), `--duration-celebrate`, then unmounts. Pure CSS keyframes — no canvas, no `canvas-confetti` dependency. Exposes `useCelebration(key: string)`: fires once per unique key (persisted in `localStorage` under `fv:celebrated:<key>`) so a tier clear celebrates exactly once per achievement, not per page view. Fully suppressed under `prefers-reduced-motion` (replaced by a single scale-pulse on the metric). |
| `HeroReportHeader.tsx` | Slim hero variant for report/desktop pages: eyebrow + title + primary metric + date-range slot + export slot on one gradient band (height ~120px desktop). Used by every report in section 5. |

Celebration triggers (wired where the data already resolves): incentive tier cleared (`HeroIncentive` ladder state change), daily target hit (agent home), streak milestone (7/14/30 days). `HeroIncentive.tsx` itself is refactored to render through `Hero` + `ProgressRing` + `Celebration` and keeps its tier-ladder body as `children` — it becomes the reference consumer, not a parallel implementation.

### 3.3 Placement rule

Every role home screen (PWA and desktop dashboard) opens with exactly one `Hero`. Every report opens with `HeroReportHeader`. Nothing else on the page uses the hero gradient — one hero per screen keeps it premium instead of noisy.

---

## 4. PWA per-role screen redesigns (`/agent/*`, shell `frontend/src/pages/agent/AgentLayout.tsx`)

Universal PWA skeleton (top to bottom): **(1) Hero → (2) Today's Actions / issue queue → (3) Stats → (4) secondary content**. Bottom tab bar unchanged in structure (`getTabsForRole`). All screens: 16px gutters, `--space-6` section rhythm, cards on `--color-surface`, pull-to-refresh where lists exist. Dark theme is the field default.

### 4.1 Agent home — `frontend/src/pages/agent/AgentDashboard.tsx`

- **Hero:** "Today" eyebrow; metric = signups today vs daily target; `ProgressRing` = target progress; `StreakIcon` + streak-day count as badge; CTA = "Log a visit" → `/agent/visits/create`. Celebration on target hit.
- **Today's actions:** ordered card list from the agent's own signals — e.g. "2 signups awaiting verification detail", "You're 3 deposits from Tier 2" (tier ladder rand amounts allowed — exemption 2). Each card = custom domain icon + one-line action + chevron.
- **Stats row:** three `StatCard`s — Signups / Verified (`VerifiedIcon`) / Deposits (`DepositIcon`) — today's COUNTS. No rand anywhere except the incentive ladder and own commission (`HeroIncentive` panel sits below stats).
- **Below:** compact visit list (today), link to `/agent/stats`.

### 4.2 Team lead home — `frontend/src/pages/agent/TeamTab.tsx` (+ `AgentDashboard` Home tab)

- **Hero:** metric = team average signups/agent today vs the team gate; `ProgressRing` = gate progress; `TierIcon` shows current team tier; CTA = "Check in on <lowest agent>" (deep-link `/agent/agent-detail/:agentId`).
- **Today's actions:** coaching queue from SIGNAL_REGISTRY issues scoped to the team — gone-quiet agents, zero-signup-by-noon, unverified pileups — each with nudge/check-in/recognition action buttons (existing actions system).
- **Team roster:** one row per agent — name, per-day counts (signups/verified/deposits), mini `ProgressRing`, status dot. Sorted actionable-first (issues top), not alphabetically. COUNTS only.

### 4.3 Manager home — `frontend/src/pages/agent/ManagerTeamsTab.tsx` (+ Home tab)

- **Hero:** metric = org average signups/agent today vs org gate; secondary chips: teams on-gate vs off-gate count. CTA = "Coaching queue" (anchor-scrolls to actions).
- **Coaching queue (Today's actions):** cross-team issue list, grouped by team lead, worst-first; nudge/check-in/recognition inline. This IS the manager's job surface — it gets the most vertical space.
- **Teams grid:** card per team lead — team avg counts, gate `ProgressRing`, trend arrow → `/agent/team-detail/:teamLeadId`. COUNTS only (manager is a field role — rule 1).

### 4.4 GM overview — `frontend/src/pages/agent/GmOverview.tsx` (+ `GMPnl.tsx`, `GmStats.tsx`)

- **Hero:** metric = revenue today (deposits × R75), `tone="night"` premium dark gradient; sub-metrics: deposits count, verified rate; sparkline (7-day revenue) as hero child. CTA = "P&L" → `/agent/pnl`.
- **Org health (Today's actions):** top org-level signals — verification SLA breaches, team gates missed, anomaly flags — each linking to the responsible surface.
- **Stats:** revenue MTD, org avg/agent, active agents today; then team leaderboard (revenue visible — GM is exempt from rule 1 by definition).

### 4.5 backoffice_admin home — `frontend/src/pages/agent/BackOfficeReconcile.tsx` + `BackOfficeDeposits.tsx` + `BackOfficeCallList.tsx`

- **Hero (on the Reconcile/home tab):** metric = verification queue depth; `ProgressRing` = SLA compliance today (% verified within SLA); `ReconIcon`; CTA = "Start verifying" → oldest queue item.
- **Today's actions:** SLA-breaching verifications first (aging badge, red past-SLA), then recon exceptions, then call-list follow-ups.
- **Work surfaces:** Deposits and Call List tabs get the same skeleton — slim hero (queue depth + SLA ring), then the queue as swipe-action rows (verify / flag / call). backoffice_admin is admin-equivalent (rule 4): rand values visible where the workflow needs them (deposit amounts in recon).

---

## 5. Desktop web + reports

### 5.1 Consistent shell

`frontend/src/components/layout/DashboardLayout.tsx` + `frontend/src/config/navigation.ts` stay as the single office shell. Changes: sidebar re-skinned on tokens (active item = `--color-primary-soft` bg + primary text, no bespoke hexes); topbar gets global search slot + `ThemeToggle` + `NotificationCenter` (all existing `ui/` components); page container standardizes to `max-w-[1440px]` with `--space-8` gutters. `frontend/src/components/layout/MobileBottomTabs.tsx` (office-shell responsive nav) re-skinned on the same tokens as the PWA tab bar — one visual language.

Role dashboards (`pages/dashboard/DashboardForRole` → `DashboardPage.tsx`, `GmOverviewPage.tsx`) adopt the same Hero-first skeleton as §4, laid out two-column on desktop: hero + actions left (8/12), stats + charts right (4/12).

### 5.2 Premium report headers

Every report page (all of `frontend/src/pages/reports/**`, `pages/field-operations/reports/**`, `pages/insights/**`, `pages/trade-marketing/TradeMarketingAnalyticsPage.tsx`, `pages/reports/AnalyticsDashboardPage.tsx`) opens with `HeroReportHeader`: report title + one headline metric + `DateRangePresets` (existing `ui/DateRangePresets.tsx`) + export button. Role-aware headline: field roles get count headlines; GM/admin-equivalents get rand headlines (rule 1 enforced in the header component's data selection, not per-page ad hoc).

### 5.3 Drilldowns

Standard: every metric number on a report or dashboard is clickable and opens a breakdown, reusing existing drill routes — no new backend:

- Per-agent breakdown → `/field-operations/drill-down/:userId` (`PerformanceDrillDownPage.tsx`) or `/agent/agent-detail/:agentId` on PWA.
- Per-team → `/agent/team-detail/:teamLeadId` / `TeamCockpit.tsx`.
- Per-day breakdown → **new shared component `frontend/src/components/reports/BreakdownSheet.tsx`**: a slide-over (desktop) / bottom sheet (`ui/MobileBottomSheet.tsx`, PWA) showing per-day or per-agent rows for the clicked metric, with the same count/rand gating. One component, every report uses it.
- Affordance: drillable metrics get `cursor-pointer` + underline-on-hover + a 16px `ChevronRight`; non-drillable numbers never fake it.

### 5.4 Empty / loading / error standards

Codified in the three existing primitives — usage becomes mandatory, ad-hoc spinners removed:

- **Loading:** `ui/SkeletonLoader.tsx` skeletons shaped like the content (stat-card skeleton, table-row skeleton, hero skeleton — add these three named variants to SkeletonLoader). `ui/LoadingSpinner.tsx` allowed ONLY for sub-action feedback (button spinners), never page/section loads.
- **Empty:** `ui/EmptyState.tsx` — lucide icon (24–32), one-line headline, one-line body, ONE primary action ("Log your first visit"), never a bare "No data".
- **Error:** `ui/ErrorState.tsx` with retry action; page crashes → `ui/PageErrorBoundary.tsx`. Error copy names the thing that failed, not the exception.

---

## 6. Typography + fonts

### 6.1 Self-host two families, drop the CDN

Current: 5 families (Inter, Outfit, JetBrains Mono, DM Mono, Instrument Sans) via render-blocking Google Fonts `@import` at `frontend/src/index.css:6`, plus dns-prefetch in `frontend/index.html:15`.

Target:
- **Outfit** — everything UI + display (it's already the first `sans` font; Inter/Instrument Sans/DM Mono are dropped, their fallbacks become system-ui).
- **JetBrains Mono** — numeric/data (tables, big metrics use `font-variant-numeric: tabular-nums` — set on `font-data` utility).
- Files: woff2 subsets (latin), weights Outfit 400/500/600/700/800, JetBrains Mono 400/600 → `frontend/public/fonts/` (7 files). `@font-face` rules with `font-display: swap` at the top of `tokens.css`. Preload the two above-the-fold weights (Outfit 400 + 700) via `<link rel="preload" as="font" crossorigin>` in `frontend/index.html`. Delete the `@import` line and the googleapis dns-prefetch/preconnect lines.
- `tailwind.config.js` fontFamily: `sans: ['Outfit', 'system-ui', 'sans-serif']`, `data: ['JetBrains Mono', 'ui-monospace', 'monospace']`; remove `mono` and `ui` aliases after codemodding their usages to `sans`/`data`.

### 6.2 Type scale (Tailwind utilities, documented in tokens.css comment)

| Token | Size/leading | Weight | Use |
|---|---|---|---|
| display | 40/44 | 800 | Hero metrics (PWA), `font-data` tabular |
| h1 | 28/34 | 700 | Page titles |
| h2 | 20/28 | 600 | Section/card titles |
| body | 15/22 | 400 | Default (PWA base 15px for field readability) |
| small | 13/18 | 500 | Meta, table cells |
| eyebrow | 11/14 | 600, tracking 0.08em, uppercase | Hero eyebrows, section labels |

Minimum body text 13px anywhere; minimum tap target 44×44 on PWA.

---

## 7. Component consolidation

### 7.1 Retire `frontend/src/components/mobile/` into `components/ui/`

| mobile/ file | Disposition |
|---|---|
| `MobileButton.tsx` | Delete → `ui/Button.tsx` gains `size="lg"` (48px, full-width option) covering the mobile case |
| `MobileCard.tsx` | Delete → `ui/Card.tsx` (already responsive once tokenized) |
| `MobileInput.tsx` | Delete → `ui/Input.tsx` gains the 48px height variant |
| `SwipeableCard.tsx` | Move → `ui/SwipeableCard.tsx` (needed by §4.5 queue rows) |
| `FloatingActionButton.tsx` | Move → `ui/FloatingActionButton.tsx` |
| `CameraCapture.tsx`, `GPSCapture.tsx` | Not UI primitives — move to `components/capture/` (they're device-capability components) |
| `MobileWorkflowLayout.tsx` | Move → `components/layout/MobileWorkflowLayout.tsx` |

`components/mobile/` directory ends empty and is deleted. Import codemod across consumers in the same PR.

### 7.2 Retire MUI

Per §2.3 list; final step removes `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` from `frontend/package.json` and regenerates the lockfile. Expected bundle savings: ~300KB+ gz.

### 7.3 One primitives directory

After this spec ships, the rule is: shared visual primitives live ONLY in `frontend/src/components/ui/` (plus `hero/`, `icons/`, domain component dirs). No new parallel primitive sets.

---

## 8. Rollout stages (each = one PR, ship-safe, independently revertable)

| Stage | PR | Content | Visual change? |
|---|---|---|---|
| **1. Token layer** | `design/tokens` | `styles/tokens.css`; tailwind.config remap (pulse→var, semantic colors, blue primary→info rename codemod); `#00E87B` hex codemod (53 files); `chartTheme.ts`; delete `!important` override block; `applyTenantTheme.ts` + bootstrap wiring | None intended (pixel-equivalent; tenant theming is additive) |
| **2. Fonts + type scale** | `design/typography` | Self-host Outfit + JetBrains Mono, delete CDN import, preloads, type-scale utilities, drop Inter/Instrument Sans/DM Mono | Near-none (Outfit already primary) |
| **3. Icons** | `design/icons` | `components/icons/` custom set (8); emoji migration (28 files); MUI **icon** migration within the 23 files where only icons are used; lucide conventions | Icon-level only |
| **4. Heros + primitives** | `design/heros` | `components/hero/` (Hero, ProgressRing, Celebration, HeroReportHeader); refactor `HeroIncentive.tsx` onto it; SkeletonLoader variants; `BreakdownSheet.tsx`; `mobile/`→`ui/` consolidation (§7.1) | New components, existing screens unchanged except HeroIncentive |
| **5. PWA role homes** | `design/pwa-roles` (may split per role) | §4.1–4.5 screen redesigns on the new system | Yes — the payoff |
| **6. Desktop + reports** | `design/desktop-reports` | §5 shell polish, HeroReportHeader on all reports, drilldowns, empty/loading/error sweep; finish MUI **component** retirement (AdvancedDataTable rebuild) + dependency removal | Yes |

Order rationale: 1–2 are invisible infrastructure; 3–4 add capability without redesign risk; 5–6 are the visible redesigns and land on a stable foundation. Stage 5 before 6 because field agents are the primary users.

---

## 9. Acceptance criteria (measurable, per stage)

**Stage 1 — tokens**
- `grep -rn '#00E87B' frontend/src --include='*.ts' --include='*.tsx' --include='*.css'` returns matches ONLY in `frontend/src/styles/tokens.css` (currently 382 matches in 53 files → target: tokens.css only).
- `grep -c '!important' frontend/src/index.css` ≤ 4 (the standalone-display utilities), down from the ~170-line override block.
- Setting `--color-primary: #FF5500` on `:root` in devtools recolors buttons, active nav, rings, and chart primaries with no rebuild; `applyTenantTheme({primaryColor})` does the same at runtime.
- Dark and light themes both render every screen with zero hex-matching overrides; visual regression on 6 representative screens (agent home, GM overview, reports hub, finance dashboard, login, visit create) shows no unintended diff.

**Stage 2 — typography**
- Zero requests to `fonts.googleapis.com`/`gstatic.com` in the network panel; exactly 2 font families (≤7 woff2 files) served from `/fonts/`.
- Lighthouse (mobile, `/agent/dashboard`): render-blocking-resources audit no longer lists fonts; FCP does not regress.

**Stage 3 — icons**
- `grep -rln '@mui/icons-material' frontend/src` → 0 files.
- Emoji-as-icon grep (`grep -rlP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' frontend/src --include='*.tsx'`) → 0 of the 28 listed files (remaining hits, if any, are copy strings, individually justified in the PR).
- All 8 custom icons render correctly at 16/20/24 in both themes (Storybook-less check: a temporary `/admin/smoke-test` section or the PR screenshots).

**Stage 4 — heros**
- `HeroIncentive.tsx` renders via `Hero`/`ProgressRing` with zero visual regression to its tier ladder and pay display (own-pay exemption intact).
- `Celebration` fires exactly once per achievement key; zero animation under `prefers-reduced-motion`.
- No page-level `LoadingSpinner` remains in files touched by this stage.

**Stage 5 — PWA role homes**
- Each of the 5 role homes matches its §4 skeleton: hero first, actions second, stats third (screenshot review per role).
- **Rule-1 audit:** logged in as agent, team_lead, and manager, zero rand/`R`-prefixed values or revenue figures appear anywhere on `/agent/*` except the incentive tier ladder and the user's own commission/incentive pay. Automated: a Playwright pass per role asserting no `/R\s?\d/` text outside `data-allow-rand` marked elements.
- backoffice_admin sees every admin-gated surface it should (spot check `/agent/reconcile`, `/more` links) — no exact-role string checks introduced (`grep -rn "role === '" frontend/src/pages/agent` reviewed; new code uses `hasRole`).
- Lighthouse PWA (moto G4-class throttling, `/agent/dashboard`): Performance ≥ 85, Accessibility ≥ 95.

**Stage 6 — desktop + reports**
- `grep -rln '@mui/' frontend/src` → 0; `@mui/*` and `@emotion/*` absent from `frontend/package.json`.
- `components/mobile/` directory deleted; no imports reference it.
- Every route under `pages/reports/**`, `pages/insights/**`, `pages/field-operations/reports/**` renders `HeroReportHeader`; every headline metric on those pages opens `BreakdownSheet` or an existing drill route.
- Empty/loading/error sweep: no `LoadingSpinner` at page/section level anywhere in `frontend/src/pages` (grep-verifiable); every list screen has an `EmptyState` with an action.
- Lighthouse desktop (`/dashboard`, `/reports`): Performance ≥ 90, Accessibility ≥ 95. Bundle: main chunk shrinks vs pre-Stage-6 baseline (MUI removal).

**Global (every stage)**
- No new runtime dependencies added by any stage (the entire system builds on Tailwind, lucide-react, recharts, and hand-rolled components).
- All interactive elements keyboard-reachable with visible `:focus-visible` ring (`outline: 2px solid var(--color-primary); outline-offset: 2px` — defined once in tokens.css).
- Both themes shipped and reviewed in every visual PR; no light-only or dark-only screens.
