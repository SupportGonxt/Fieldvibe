// Pure helpers for the customer portal (Phase F). No DB/IO — unit-testable
// without a Workers runtime. Consumed by src/index.js portal routes.

// Fields that must NEVER reach a customer. The portal SQL already avoids
// selecting these, but the serializer is a belt-and-braces second gate.
export const PORTAL_AGENT_FIELDS = [
  'agent_id', 'agent_name', 'uploaded_by', 'created_by',
  'commission_earnings', 'commission', 'tier', 'base_salary',
];

// The raw survey/qualification JSON blob is an unaudited passthrough (any
// future key staff add ships straight to the customer) — never let it survive
// serialization even if a query re-selects it. Known scalars extracted from it
// (e.g. `converted`) are selected as their own column and are NOT stripped.
const PORTAL_BLOB_FIELDS = ['custom_field_values'];

function stripAgentFields(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const k of Object.keys(row)) {
    if (!PORTAL_AGENT_FIELDS.includes(k) && !PORTAL_BLOB_FIELDS.includes(k)) out[k] = row[k];
  }
  return out;
}

export const serializeIndividualForPortal = stripAgentFields;
export const serializeStoreForPortal = stripAgentFields;

// Seeded per company so a freshly-invited customer sees a useful portal
// before any staff curation. widget.source references a capture_steps key,
// a store-insight field, or a built-in metric.
export function defaultDashboardConfig(companyId) {
  return {
    company_id: companyId,
    widgets: [
      { type: 'kpi', title: 'Overview', source: 'builtin:overview', options: {} },
      { type: 'individuals_table', title: 'Registrations', source: 'builtin:individuals', options: { pageSize: 25 } },
      { type: 'stores_table', title: 'Stores', source: 'builtin:stores', options: { pageSize: 25 } },
      { type: 'insights', title: 'Store Insights', source: 'builtin:insights', options: {} },
    ],
  };
}

// Portal tokens are their own JWT audience. Throw (caller -> 401) unless the
// decoded payload is a portal token carrying a portal user id.
export function assertPortalToken(payload) {
  if (!payload || payload.aud !== 'portal' || !payload.portalUserId) {
    throw new Error('not a portal token');
  }
  return true;
}

// Fail closed: any missing/unparseable expiry counts as expired.
export function inviteTokenExpired(expiresAtIso, nowSec) {
  if (!expiresAtIso) return true;
  const t = Date.parse(expiresAtIso);
  if (Number.isNaN(t)) return true;
  return Math.floor(t / 1000) <= nowSec;
}

// Ask-panel intent matcher (Phase F7). Bounded on purpose: NOT free SQL, just
// a keyword map over a fixed set of metrics. First match wins; no match -> null.
const ASK_INTENT_KEYWORDS = [
  ['total_individuals', ['sign up', 'sign-up', 'signup', 'registration', 'registered', 'how many people', 'how many individuals']],
  ['qualification_rate', ['qualification', 'qualify', 'qualified', 'conversion', 'converted']],
  ['share_of_wall', ['share of wall', 'share of voice', 'wall share', 'shelf share']],
  ['store_coverage', ['store coverage', 'how many stores', 'stores visited', 'store visits']],
  ['trend_over_time', ['trend', 'over time', 'per day', 'daily', 'last 30 days', 'last month']],
];

export function matchAskIntent(question) {
  if (!question || typeof question !== 'string') return null;
  const q = question.toLowerCase();
  for (const [intentKey, keywords] of ASK_INTENT_KEYWORDS) {
    if (keywords.some(k => q.includes(k))) return intentKey;
  }
  return null;
}
