# Premium Design System — Stage 1: Token Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every color in the frontend flows from CSS custom properties in one file (`tokens.css`); the brand green `#00E87B` exists in exactly one place; tenant `theme.primaryColor` re-skins the whole app at runtime.

**Architecture:** New `frontend/src/styles/tokens.css` defines `:root` (light) + `.dark` token blocks. Tailwind color scales re-point at the variables (brand `primary` via an RGB-triplet var so slash-opacity keeps working). Mechanical codemods rename the blue `primary-*` scale to `info-*`, convert all `[#00E87B]` arbitrary classes to `primary` utilities, and convert dark-surface hex classes to semantic token classes — which makes the light-mode `!important` override block in `index.css` dead code, so it is deleted. `applyTenantTheme.ts` sets `--color-primary`/`--color-primary-rgb` at runtime. Charts read tokens via `chartTheme.ts` (`getComputedStyle`).

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind 3 (class dark mode), vitest + jsdom (tests exist under `frontend/src/**/*.test.ts`), recharts. Spec: `docs/superpowers/specs/2026-07-14-premium-design-system.md` §1, §8 (Stage 1 row), §9 (Stage 1 acceptance).

## Global Constraints

- **No new runtime dependencies** (spec global rule). `color-mix()` in CSS replaces any JS color math.
- **Both themes every PR:** every token has a value in `:root` AND `.dark`; no hex-matching theme overrides may remain for converted surfaces.
- **Pixel-equivalent:** Stage 1 intends **no visual change**. Token values are copied verbatim from today's hexes.
- **Never commit real credentials.**
- **Branch:** `design/tokens`, PR to `main`. CI deploys `main` straight to production — the branch must build clean (`npm run build` in `frontend/`) before merge.
- **Acceptance (spec §9 Stage 1):**
  - `grep -rn '#00E87B' frontend/src --include='*.ts' --include='*.tsx' --include='*.css'` (case-insensitive too) → matches only in `frontend/src/styles/tokens.css`.
  - `frontend/src/index.css` light-mode override block (lines 378–559 today) deleted; remaining `!important` only in print styles, `prefers-reduced-motion`, and the MUI dark-mode block (see Deviations).
  - Setting `--color-primary`/`--color-primary-rgb` on `:root` in devtools recolors buttons, active nav, rings, chart primaries — no rebuild.
  - Visual spot-check both themes on: agent home, GM overview, reports hub, finance dashboard, login, visit create.

## Documented deviations from spec wording (safe readings, flag in PR body)

1. **`--color-primary-rgb` added** (not in spec token list). Spec's own codemod examples (`bg-primary/25`) require Tailwind `<alpha-value>` support, which a plain hex var cannot give. Tailwind gets `primary: 'rgb(var(--color-primary-rgb) / <alpha-value>)'`. `applyTenantTheme` sets both vars (3-line hex parse, no dependency).
2. **`!important` count lands ~5+MUI-block, not ≤4.** Spec's "≤4" assumed only standalone-display utilities remain, but `prefers-reduced-motion` (3 legit a11y `!important`s, index.css ~891-893) and the **dark-mode MUI/recharts override block** (index.css 561–876) also exist. MUI retirement is Stage 6 — deleting its dark overrides now would break dark-mode MUI screens. Stage 1 deletes only the light-mode block (378–559), per spec §1.2's own text ("delete the ~170-line hex-matching light-mode override section"). Stage 6 deletes the MUI block.
3. Elevation tokens use today's shadow values in **both** theme blocks (pixel-equivalence). Dark-tuned shadows come with the Stage 5/6 redesigns.
4. **Dark-surface shade unification (Task 6) is deliberately NOT pixel-exact.** Six near-identical dark navies (#06090F, #0A0E18, #0A1628, #0F1420, #1A1F2E, #0A0F1C) collapse onto three tokens; light-mode renders shift by ≤2 hex steps (e.g. #F9FAFB→#F8FAFC). That consolidation IS the spec's point (§1.2 "hex-matching override section" removal). Any diff visible at arm's length in the Task 8 spot-check = wrong mapping, fix it; imperceptible shade drift = accepted.

## File Map

- Create: `frontend/src/styles/tokens.css` — single source of truth for all tokens
- Create: `frontend/src/lib/applyTenantTheme.ts` + `frontend/src/lib/applyTenantTheme.test.ts`
- Create: `frontend/src/lib/chartTheme.ts` + `frontend/src/lib/chartTheme.test.ts`
- Modify: `frontend/tailwind.config.js` — info rename, var-backed primary/pulse/surface, radius/shadow re-point
- Modify: `frontend/src/index.css` — import tokens.css first; delete light-mode override block
- Modify: `frontend/src/services/tenant.service.ts` — fallbacks → `#00E87B`; call `applyTenantTheme`
- Modify (codemod, mechanical): ~132 files `primary-*`→`info-*`; ~57 files `[#00E87B]`→`primary` utilities; recharts files with `#00E87B` → `chartTheme.ts`; dark-surface hex classes → semantic classes (file list in Task 6)

---

### Task 1: `tokens.css` + import wiring

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/index.css:1-6` (add import at very top)

**Interfaces:**
- Produces: CSS custom properties consumed by every later task: `--color-primary`, `--color-primary-rgb`, `--color-primary-strong`, `--color-primary-soft`, `--color-on-primary`, `--color-success`, `--color-warning`, `--color-danger`, `--color-info`, `--color-bg`, `--color-surface`, `--color-surface-raised`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-text-faint`, `--space-*`, `--radius-*`, `--elevation-*`, `--duration-*`, `--ease-*`.

- [ ] **Step 1: Create `frontend/src/styles/tokens.css`**

```css
/* Design tokens — single source of truth (spec: docs/superpowers/specs/2026-07-14-premium-design-system.md §1.2).
   The ONLY place #00E87B may appear in frontend/src. */

:root {
  /* Brand */
  --color-primary: #00E87B;
  --color-primary-rgb: 0 232 123; /* keep in sync with --color-primary; applyTenantTheme sets both */
  --color-primary-strong: color-mix(in srgb, var(--color-primary) 85%, black);
  --color-primary-soft: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg));
  --color-on-primary: #04110A;

  /* Semantic status */
  --color-success: #2ECC71;
  --color-warning: #F39C12;
  --color-danger: #EF4444;
  --color-info: #1890ff;
  --color-info-rgb: 24 144 255;

  /* Surfaces & text — light. -rgb triplets MUST stay in sync with hex vars:
     Tailwind slash-opacity (bg-bg/80) reads the triplet form. */
  --color-bg: #F8FAFC;
  --color-bg-rgb: 248 250 252;
  --color-surface: #FFFFFF;
  --color-surface-rgb: 255 255 255;
  --color-surface-raised: #FFFFFF;
  --color-surface-raised-rgb: 255 255 255;
  --color-border: #E2E8F0;
  --color-text: #0F172A;
  --color-text-muted: #64748B;
  --color-text-faint: #94A3B8;

  /* Spacing (4px base; section rhythm, not a Tailwind replacement) */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px;

  /* Radius */
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
  --radius-xl: 20px; --radius-full: 9999px;

  /* Elevation — today's values, both themes (pixel-equivalence; dark tuning in Stage 5/6) */
  --elevation-card: 0 2px 8px rgba(0, 0, 0, 0.06);
  --elevation-card-hover: 0 4px 16px rgba(0, 0, 0, 0.1);
  --elevation-raised: 0 10px 40px rgba(0, 0, 0, 0.12);
  --elevation-hero: 0 4px 20px rgba(0, 0, 0, 0.08);

  /* Motion */
  --duration-fast: 120ms; --duration-base: 200ms; --duration-slow: 350ms;
  --duration-celebrate: 900ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

.dark {
  /* Surfaces & text — dark (night scale: 0A0F1C=night, 141929=night.100, 1A1F2E=night.50) */
  --color-bg: #0A0F1C;
  --color-bg-rgb: 10 15 28;
  --color-surface: #141929;
  --color-surface-rgb: 20 25 41;
  --color-surface-raised: #1A1F2E;
  --color-surface-raised-rgb: 26 31 46;
  --color-border: #1E2638;
  --color-text: #F1F5F9;
  --color-text-muted: #94A3B8;
  --color-text-faint: #64748B;
}

/* Legacy pulse numbered scale — fallback reference only, no Tailwind classes point here.
   50:#E6FFF3 100:#B3FFD9 200:#80FFBF 300:#4DFFA6 400:#1AFF8C 500:#00E87B
   600:#00B862 700:#008849 800:#005830 900:#002817 */

/* Focus ring — global, spec §1 global rule */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Import first in `frontend/src/index.css`**

Add as line 1, above everything (before the Google Fonts `@import` currently at line 6 — CSS requires `@import` lines before other rules, so both imports stay at top, tokens first):

```css
@import './styles/tokens.css';
```

- [ ] **Step 3: Build check**

Run: `cd frontend && npm run build`
Expected: success, no CSS errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/src/index.css
git commit -m "feat(design): add tokens.css design token layer"
```

---

### Task 2: Tailwind remap (info rename + var-backed scales)

**Files:**
- Modify: `frontend/tailwind.config.js:16-75`

**Interfaces:**
- Consumes: variables from Task 1.
- Produces: Tailwind classes later tasks codemod onto: `primary` (+ slash opacity), `primary-strong`, `primary-soft`, `on-primary`, `info-{50..900}`, `pulse`/`pulse-500`/`pulse-600`, `bg`/`surface`/`surface-raised`/`border-token`/`text-token` semantic names, plus existing `night` scale left untouched.

- [ ] **Step 1: Replace the `colors` block in `frontend/tailwind.config.js` (lines 16-64) with:**

```js
      colors: {
        // Brand — RGB-triplet var so slash opacity (bg-primary/20) works
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          strong: 'var(--color-primary-strong)',
          soft: 'var(--color-primary-soft)',
        },
        'on-primary': 'var(--color-on-primary)',
        // Old blue "primary" scale renamed info (chart/info blue) — hexes unchanged
        info: {
          50: '#e6f4ff',
          100: '#bae0ff',
          200: '#91caff',
          300: '#69b1ff',
          400: '#4096ff',
          500: '#1890ff',
          600: '#0958d9',
          700: '#003eb3',
          800: '#002c8c',
          900: '#001d66',
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        accent: {
          blue: '#36A2EB',
          purple: '#9B59B6',
          green: '#2ECC71',
          orange: '#F39C12',
          cyan: '#00BCD4',
          pink: '#E91E63',
        },
        // Semantic surfaces (flip with .dark via tokens.css); rgb form for slash opacity
        bg: 'rgb(var(--color-bg-rgb) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
          raised: 'rgb(var(--color-surface-raised-rgb) / <alpha-value>)',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
        },
        night: {
          DEFAULT: '#0A0F1C',
          50: '#1A1F2E',
          100: '#141929',
          200: '#0F1629',
          300: '#0A0F1C',
          400: '#070B15',
          500: '#04060D',
        },
        // pulse remapped onto primary var (spec §1.2); numbered fallbacks live in tokens.css comment
        pulse: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          500: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          600: 'var(--color-primary-strong)',
        },
      },
```

Then, as sibling keys of `colors` inside `theme.extend` (NOT nested in `colors` — this keeps the generated class names `text-token`, `border-token`, `divide-token` instead of `text-text-token`):

```js
      textColor: {
        token: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
        },
      },
      borderColor: {
        token: 'var(--color-border)',
      },
      divideColor: {
        token: 'var(--color-border)',
      },
```

- [ ] **Step 2: Re-point radius/shadow at variables (lines 65-75)**

```js
      borderRadius: {
        'xl': 'var(--radius-lg)',      /* 16px — same as today's 1rem */
        '2xl': 'var(--radius-xl)',     /* 20px — same as today's 1.25rem */
        '3xl': '1.5rem',               /* no 24px token; unchanged */
      },
      boxShadow: {
        'card': 'var(--elevation-card)',
        'card-hover': 'var(--elevation-card-hover)',
        'dropdown': 'var(--elevation-raised)',
        'stat': 'var(--elevation-hero)',
      },
```

- [ ] **Step 3: Build — expect FAILURE-free compile but broken blue classes**

Run: `cd frontend && npm run build`
Expected: build succeeds (Tailwind silently drops unknown `primary-600` etc. classes — visual blue loss until Task 3 codemod lands; Tasks 2+3 must merge together, commit sequentially without pushing between).

- [ ] **Step 4: Commit**

```bash
git add frontend/tailwind.config.js
git commit -m "feat(design): remap tailwind scales onto token variables, rename blue primary to info"
```

---

### Task 3: Codemod — blue `primary-*` → `info-*` (455 uses, 132 files)

**Files:**
- Modify: every file matched by the grep below (mechanical sed).

**Interfaces:**
- Consumes: `info` scale from Task 2.

- [ ] **Step 1: Run the codemod**

Distinct classes in use today (from inventory): `text-primary-{500,600,700,800,900}`, `bg-primary-{50,100,500,600,700,800}`, `border-primary-{500,600}`, `ring-primary-500`.

```bash
cd frontend/src
grep -rlE '(bg|text|border|ring|from|to|via|divide|outline|placeholder|accent|caret|decoration|shadow|fill|stroke)-primary-[0-9]' . \
  | xargs sed -i '' -E 's/((bg|text|border|ring|from|to|via|divide|outline|placeholder|accent|caret|decoration|shadow|fill|stroke)(-opacity)?)-primary-([0-9]{2,3})/\1-info-\4/g'
```

- [ ] **Step 2: Verify zero residue**

Run: `grep -rnE '\bprimary-[0-9]' frontend/src | grep -v node_modules`
Expected: no output. (Any hit = a variant prefix the sed missed, e.g. `hover:bg-primary-600` — the sed handles it because it matches the utility segment, but verify.)

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(design): rename blue primary-* classes to info-*"
```

---

### Task 4: Codemod — `[#00E87B]` arbitrary classes → `primary` utilities (461 class uses + 118 opacity variants, 57 files)

**Files:**
- Modify: every file matched (mechanical sed) — top offenders: `pages/marketing/LandingPage.tsx` (68), `pages/agent/AgentDashboard.tsx` (38), `pages/agent/AgentStats.tsx` (33), `pages/agent/TeamTab.tsx` (25), `pages/auth/MobileLoginPage.tsx` (20).

**Interfaces:**
- Consumes: `primary` color (with `<alpha-value>`) from Task 2.

- [ ] **Step 1: Main codemod — arbitrary class → semantic class, preserving `/NN` opacity**

```bash
cd frontend/src
# bg-[#00E87B]/20 → bg-primary/20 ; text-[#00E87B] → text-primary ; etc. Case-insensitive hex.
grep -rliE '#00E87B' . | xargs sed -i '' -E 's/(bg|text|border|ring|from|to|via|fill|stroke|shadow|outline|decoration|divide|accent|caret)-\[#00[eE]87[bB]\]/\1-primary/g'
```

- [ ] **Step 2: Residue pass — inline styles, string literals, 8-digit alpha hexes, complex shadows**

Run: `grep -rniE '#00E87B' frontend/src --include='*.ts' --include='*.tsx' --include='*.css' | grep -v styles/tokens.css`

For each remaining hit, convert by hand using these rules:
- `style={{ color: '#00E87B' }}` → `style={{ color: 'var(--color-primary)' }}`
- 8-digit alpha `#00E87B40` inside arbitrary values (e.g. `shadow-[0_0_20px_#00E87B40]`) → `shadow-[0_0_20px_rgb(var(--color-primary-rgb)/0.25)]` (alpha hex → fraction: 40→0.25, 33→0.20, 1A→0.10, 4D→0.30, 80→0.50, 26→0.15, 0D→0.05, 99→0.60, B3→0.70, E6→0.90)
- Recharts `stroke="#00e87b"`/`fill="#00e87b"` and `COLORS = ['#00E87B', ...]` — leave for Task 5.
- String constants in TS (non-JSX) → `'var(--color-primary)'` if used as CSS, or import from `chartTheme.ts` (Task 5) if chart-related.

- [ ] **Step 3: Verify + build**

Run: `grep -rniE '#00E87B' frontend/src | grep -v styles/tokens.css | grep -vE '\.(test|spec)\.' | grep -v 'stroke=\|fill=\|COLORS'`
Expected: no output (chart hits remain until Task 5).
Run: `cd frontend && npm run build` — success.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(design): codemod #00E87B arbitrary classes to primary token utilities"
```

---

### Task 5: `chartTheme.ts` + recharts conversion

**Files:**
- Create: `frontend/src/lib/chartTheme.ts`
- Create: `frontend/src/lib/chartTheme.test.ts`
- Modify: recharts files still containing `#00E87B`/`#00e87b` (from Task 4 Step 3 leftover list — includes `pages/insights/ExecutiveDashboard.tsx`, `pages/insights/VanSalesInsights.tsx`).

**Interfaces:**
- Produces: `getChartColors(): { primary: string; info: string; success: string; warning: string; danger: string; textMuted: string; border: string; series: string[] }` — reads live computed token values; safe to call per-render.

- [ ] **Step 1: Write the failing test — `frontend/src/lib/chartTheme.test.ts`**

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { getChartColors } from './chartTheme'

describe('getChartColors', () => {
  it('reads token values from the document root', () => {
    document.documentElement.style.setProperty('--color-primary', '#123456')
    const c = getChartColors()
    expect(c.primary).toBe('#123456')
    expect(c.series[0]).toBe('#123456')
  })

  it('falls back to brand green when tokens are absent', () => {
    document.documentElement.style.removeProperty('--color-primary')
    const c = getChartColors()
    // rgb form, not hex — tokens.css is the only file allowed to contain the brand hex
    expect(c.primary).toBe('rgb(0 232 123)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/chartTheme.test.ts`
Expected: FAIL — `Cannot find module './chartTheme'`.

- [ ] **Step 3: Implement `frontend/src/lib/chartTheme.ts`**

```ts
// Chart colors resolved from design tokens (tokens.css) at call time —
// SVG presentation attributes can't use var(), so charts read computed values here.
const read = (name: string, fallback: string) => {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export function getChartColors() {
  // fallback in rgb form: tokens.css is the only file allowed to contain #00E87B
  const primary = read('--color-primary', 'rgb(0 232 123)')
  const info = read('--color-info', '#1890ff')
  const success = read('--color-success', '#2ECC71')
  const warning = read('--color-warning', '#F39C12')
  const danger = read('--color-danger', '#EF4444')
  return {
    primary,
    info,
    success,
    warning,
    danger,
    textMuted: read('--color-text-muted', '#64748B'),
    border: read('--color-border', '#E2E8F0'),
    series: [primary, '#36A2EB', '#9B59B6', warning, '#00BCD4', '#E91E63'],
  }
}
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx vitest run src/lib/chartTheme.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Convert remaining chart hexes**

For each file from Task 4's leftover list:
- Add `import { getChartColors } from '@/lib/chartTheme'` (match the file's existing import alias style; if the file uses relative imports, use the relative path).
- Inside the component (NOT module top level — must re-read after theme switches): `const chart = getChartColors()`.
- `stroke="#00e87b"` → `stroke={chart.primary}`; `fill="#00e87b"` → `fill={chart.primary}`.
- `const COLORS = ['#00E87B', '#36A2EB', ...]` at module scope → replace usage with `const COLORS = getChartColors().series` inside the component, or map non-green members through as literals if the array has bespoke colors: only the `#00E87B` member MUST change (`getChartColors().primary`).

- [ ] **Step 6: Final hex grep + build + tests**

Run: `grep -rniE '#00E87B' frontend/src | grep -v styles/tokens.css`
Expected: no output.
Run: `cd frontend && npm run build && npx vitest run src/lib/chartTheme.test.ts`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "feat(design): chartTheme token reader; convert chart brand hexes"
```

---

### Task 6: Dark-surface hex codemod + light-mode override block deletion

**Files:**
- Modify: 66 files carrying arbitrary dark-hex classes (170 uses: `#06090F`×65, `#0A1628`×66, `#0F1420`×21, `#0A0E18`×11, `#1A1F2E`×6, `#0A0F1C`×1)
- Modify: `frontend/src/index.css` — delete the light-mode `!important` override block (today lines 378–559; boundaries shift after Task 1's import — locate by comment `Light Mode Full Theme` at block start, and block end is the last rule before the `.dark` vendor-override section at today's line 561)

**Interfaces:**
- Consumes: `bg`/`surface`/`surface-raised` Tailwind colors (Task 2), tokens (Task 1).
- Produces: an index.css where remaining `!important` lives only in print styles, `prefers-reduced-motion`, and the `.dark` MUI/recharts vendor block.

**Why these two changes are one task:** the override block exists solely to force light replacements onto these dark-hex classes; deleting it without converting the classes leaves dark backgrounds in light mode, and converting without deleting leaves dead specificity hacks. Ship together.

- [ ] **Step 1: Background/gradient codemod (deterministic)**

Mapping (from the override block's own light replacements — #06090F/#0F1420→#F9FAFB≈bg, #0A0E18/#0A1628→#FFFFFF=surface, #1A1F2E→raised):

| Arbitrary class | Replacement |
|---|---|
| `bg-[#06090F]`, `bg-[#0F1420]`, `bg-[#0A0F1C]` | `bg-bg` |
| `bg-[#0A0E18]`, `bg-[#0A1628]` | `bg-surface` |
| `bg-[#1A1F2E]` | `bg-surface-raised` |
| `from-/to-/via-[hex]` | same semantic name (`from-surface`, `to-bg`, …) |
| opacity variants `bg-[#06090F]/80` | keep the slash: `bg-bg/80` (works via the `-rgb` triplet) |

```bash
cd frontend/src
grep -rlE '#(06090F|0F1420|0A0F1C)' --include='*.tsx' --include='*.ts' . \
  | xargs sed -i '' -E 's/(bg|from|to|via)-\[#(06090F|0F1420|0A0F1C)\]/\1-bg/g'
grep -rlE '#(0A0E18|0A1628)' --include='*.tsx' --include='*.ts' . \
  | xargs sed -i '' -E 's/(bg|from|to|via)-\[#(0A0E18|0A1628)\]/\1-surface/g'
grep -rlE '#1A1F2E' --include='*.tsx' --include='*.ts' . \
  | xargs sed -i '' -E 's/(bg|from|to|via)-\[#1A1F2E\]/\1-surface-raised/g'
```

(sed drops the brackets, so `bg-[#06090F]/80` naturally becomes `bg-bg/80`.)

- [ ] **Step 2: Text-color hexes (per-site rule, ~51 uses)**

Run: `grep -rnE 'text-\[#(06090F|0A1628|0A0E18|0F1420|1A1F2E|0A0F1C)\]' frontend/src`

For each hit apply ONE deterministic rule:
- Element (or its className string) also has `bg-primary`, `bg-pulse`, or a green gradient (`from-primary`/`to-primary`) → `text-on-primary` (dark text on brand green).
- Otherwise → `text-token` (near-black in light, near-white in dark — matches what the deleted override block was forcing).

- [ ] **Step 3: Descendant white-text/border cleanup inside converted containers**

The deleted block also forced, in light mode, `text-white`→dark gray, `text-gray-100/200`→#374151, `border-white/5|/10`→#E5E7EB — but ONLY under the old `bg-[hex]` containers. After Step 1 those containers are `bg-bg`/`bg-surface`, which are LIGHT in light mode, so any remaining `text-white`/`border-white/*` inside them becomes invisible-on-white.

For every file changed in Step 1, grep it for `text-white`, `text-gray-100`, `text-gray-200`, `text-gray-300`, `text-gray-400`, `border-white/`, `divide-white/` and convert occurrences that sit inside a converted container (same JSX subtree):
- `text-white` → `text-token`
- `text-gray-100`, `text-gray-200` → `text-token`
- `text-gray-300`, `text-gray-400` → `text-token-muted`
- `text-gray-500` → `text-token-faint` (only when inside a converted container)
- `border-white/5`, `border-white/10`, `divide-white/5`, `divide-white/10` → `border-token` / `divide-token`

Occurrences on elements NOT inside a converted container (e.g. text on brand-green buttons, marketing hero over an image) stay untouched.

- [ ] **Step 4: Delete the light-mode override block in `frontend/src/index.css`**

Locate: `grep -n 'Light Mode Full Theme' frontend/src/index.css` (block start). Delete from that comment through the last rule before the `.dark` vendor-override section (today 378–559 pre-Task-1; includes the `#auth-layout` protection rules — those exist only to counter the block itself). Do NOT touch the `.dark` MUI/recharts vendor block, print styles, `prefers-reduced-motion`, or safe-area utilities.

- [ ] **Step 5: Verify + build**

```bash
grep -rnE '#(06090F|0A1628|0A0E18|0F1420|1A1F2E|0A0F1C)' frontend/src --include='*.tsx' --include='*.ts'   # expect: empty
grep -c '!important' frontend/src/index.css   # expect: large drop from 57; record the number
cd frontend && npm run build                   # expect: success
```

- [ ] **Step 6: Visual smoke, BOTH themes**

Run `npm run dev`; check login, agent home, GM overview in light AND dark. Light mode must show light surfaces where dark hexes used to be overridden; dark must look unchanged (≤ imperceptible navy shift, Deviation 4).

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(design): dark-surface hexes to semantic tokens; drop light-mode override block"
```

---

### Task 7: `applyTenantTheme.ts` + bootstrap wiring

**Files:**
- Create: `frontend/src/lib/applyTenantTheme.ts`
- Create: `frontend/src/lib/applyTenantTheme.test.ts`
- Modify: `frontend/src/services/tenant.service.ts:31,40` (fallback hexes) and `applyTenantConfiguration` (~line 228)

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: `applyTenantTheme(theme?: { primaryColor?: string }): void`.

- [ ] **Step 1: Write the failing test — `frontend/src/lib/applyTenantTheme.test.ts`**

```ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { applyTenantTheme } from './applyTenantTheme'

const root = () => document.documentElement

beforeEach(() => {
  root().style.cssText = ''
  document.head.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove())
})

describe('applyTenantTheme', () => {
  it('sets --color-primary and --color-primary-rgb from a valid hex', () => {
    applyTenantTheme({ primaryColor: '#FF5500' })
    expect(root().style.getPropertyValue('--color-primary')).toBe('#FF5500')
    expect(root().style.getPropertyValue('--color-primary-rgb')).toBe('255 85 0')
  })

  it('updates <meta name="theme-color">', () => {
    applyTenantTheme({ primaryColor: '#FF5500' })
    const meta = document.head.querySelector('meta[name="theme-color"]') as HTMLMetaElement
    expect(meta?.content).toBe('#FF5500')
  })

  it('rejects invalid hex — leaves tokens untouched', () => {
    applyTenantTheme({ primaryColor: 'red' })
    applyTenantTheme({ primaryColor: '#12345' })
    applyTenantTheme({ primaryColor: '#GGGGGG' })
    expect(root().style.getPropertyValue('--color-primary')).toBe('')
  })

  it('no theme → no-op (brand green from tokens.css stands)', () => {
    applyTenantTheme(undefined)
    applyTenantTheme({})
    expect(root().style.getPropertyValue('--color-primary')).toBe('')
  })

  it('flips --color-on-primary to white for dark tenant colors (contrast guard)', () => {
    applyTenantTheme({ primaryColor: '#003300' }) // very dark green
    expect(root().style.getPropertyValue('--color-on-primary')).toBe('#FFFFFF')
  })

  it('keeps default on-primary for light tenant colors', () => {
    applyTenantTheme({ primaryColor: '#FFDD00' }) // bright yellow
    expect(root().style.getPropertyValue('--color-on-primary')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/lib/applyTenantTheme.test.ts`
Expected: FAIL — `Cannot find module './applyTenantTheme'`.

- [ ] **Step 3: Implement `frontend/src/lib/applyTenantTheme.ts`**

```ts
// Runtime tenant theming (spec §1.3): one validated hex re-skins the app.
// Derived tokens (-strong/-soft) are color-mix() on --color-primary in tokens.css,
// so they follow automatically.
const HEX = /^#[0-9a-fA-F]{6}$/

export function applyTenantTheme(theme?: { primaryColor?: string }): void {
  const hex = theme?.primaryColor
  if (!hex || !HEX.test(hex)) return

  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const root = document.documentElement
  root.style.setProperty('--color-primary', hex)
  root.style.setProperty('--color-primary-rgb', `${r} ${g} ${b}`)

  // Contrast guard: relative luminance vs near-black --color-on-primary (#04110A).
  // If the tenant color is dark (3:1 fails against near-black text), flip text to white.
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  // on-primary #04110A luminance ≈ 0.005; contrast = (L+0.05)/(0.005+0.05) — needs ≥ 3
  if ((L + 0.05) / 0.055 < 3) {
    root.style.setProperty('--color-on-primary', '#FFFFFF')
  }

  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = hex
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npx vitest run src/lib/applyTenantTheme.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5: Wire into `tenant.service.ts`**

In `frontend/src/services/tenant.service.ts`:
1. Add import: `import { applyTenantTheme } from '../lib/applyTenantTheme'` (match the file's existing import style).
2. DELETE the hardcoded `primaryColor` lines from the DEMO fallback (line 31, `'#3B82F6'`) and PEPSI_SA fallback (line 40, `'#004B93'`) entirely. Do NOT replace them with the brand green hex — that would re-introduce `#00E87B` outside tokens.css and break the acceptance grep. No theme → tokens.css default stands (spec §1.3: "No theme → FieldVibe pulse green stands"). If the `TenantConfig` type requires `theme.primaryColor`, make it optional (`primaryColor?: string`).
3. In `applyTenantConfiguration` (~line 228), replace:

```ts
    if (tenant.theme?.primaryColor) {
      document.documentElement.style.setProperty('--primary-color', tenant.theme.primaryColor)
    }
```

with:

```ts
    applyTenantTheme(tenant.theme)
```

(The old `--primary-color` property name is consumed nowhere in `frontend/src` — verify with `grep -rn 'var(--primary-color)' frontend/src`; expected no output — safe to drop.)

- [ ] **Step 6: Build + full frontend test suite**

Run: `cd frontend && npm run build && npx vitest run`
Expected: build success; no new test failures vs `main` baseline.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/lib/applyTenantTheme.ts frontend/src/lib/applyTenantTheme.test.ts frontend/src/services/tenant.service.ts
git commit -m "feat(design): applyTenantTheme runtime tenant theming with contrast guard"
```

---

### Task 8: Acceptance sweep + visual check + PR

**Files:** none new — verification and PR.

- [ ] **Step 1: Acceptance greps**

```bash
grep -rniE '#00E87B' frontend/src --include='*.ts' --include='*.tsx' --include='*.css' | grep -v styles/tokens.css   # expect: empty
grep -rnE '\bprimary-[0-9]' frontend/src                                                                             # expect: empty
grep -c '!important' frontend/src/index.css                                                                          # expect: value recorded in PR; light-mode block gone
```

- [ ] **Step 2: Devtools token check**

Run: `cd frontend && npm run dev`. In the browser devtools on `/login` and `/agent/dashboard`, set `:root { --color-primary: #FF5500; --color-primary-rgb: 255 85 0; }`.
Expected: buttons, active nav, focus rings, chart primary series all recolor without reload. Remove override; green returns.

- [ ] **Step 3: Visual spot-check, both themes**

Screens: agent home (`/agent/dashboard`), GM overview, reports hub, finance dashboard, login, visit create. Toggle dark/light on each.
Expected: pixel-equivalent to `main` (no unintended diff). Any diff → fix the responsible codemod line before PR.

- [ ] **Step 4: Full test suite**

Run: `cd frontend && npx vitest run`
Expected: no new failures vs main baseline.

- [ ] **Step 5: PR**

```bash
git push -u origin design/tokens
gh pr create --title "design(tokens): Stage 1 — token layer, tenant theming, hex codemod" --body "$(cat <<'EOF'
Stage 1 of docs/superpowers/specs/2026-07-14-premium-design-system.md (§8 row 1).

- tokens.css single source of truth (:root + .dark), imported first
- Tailwind: blue primary→info rename (455 uses/132 files); brand primary/pulse var-backed with slash-opacity via --color-primary-rgb; radius/shadow re-pointed at tokens
- #00E87B codemod: 594 occurrences/57 files → primary utilities / chartTheme / tokens.css only
- Dark-surface hex classes → semantic token classes; index.css light-mode !important block deleted
- applyTenantTheme(): validated tenant primaryColor re-skins app at runtime + PWA theme-color; contrast guard
- chartTheme.ts getChartColors() for recharts

Deviations from spec wording (documented in plan): --color-primary-rgb added for Tailwind alpha support; MUI dark-mode override block stays until Stage 6 MUI retirement; elevation tokens identical both themes for pixel-equivalence.

No new runtime dependencies. No intended visual change.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then: wait CI green, squash-merge, verify deploy.
