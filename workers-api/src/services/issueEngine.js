// Pure issue logic for the accountability spine. No DB, no I/O — all persistence
// and org lookups live in the reactToIssues cron (index.js). Kept pure so the SLA
// ladder and severity ranking are unit-checkable (see demo() below).

// Hours an owner may sit on an unacted issue before it re-owns one level up.
// Defaults from the PWA blueprint: lead inaction 48h, manager unactioned 72h, BO backlog 72h.
// general_manager is the top of the chain — no further escalation (null).
export const SLA_HOURS = {
  team_lead: 48,
  manager: 72,
  backoffice_admin: 72,
  general_manager: null,
};

// Where an unactioned issue goes next. team_lead -> manager -> general_manager.
export const ESCALATE_TO = {
  team_lead: 'manager',
  manager: 'general_manager',
  backoffice_admin: 'general_manager',
};

// Worst-first weight per signal kind. Higher = more urgent. gone_quiet (agent dark)
// tops it; root-cause texture signals sit at the floor.
const KIND_WEIGHT = {
  gone_quiet: 5,
  below_target: 4,
  dropped_vs_baseline: 3,
  low_conversion: 2,
  late_start: 1, short_field_day: 1, idle_gaps: 1, excess_travel: 1,
};

export function severityOf(signalTypes) {
  // sum of weights + count so an agent tripping many signals outranks one tripping a single heavy one
  const types = [...new Set(signalTypes || [])];
  const w = types.reduce((a, t) => a + (KIND_WEIGHT[t] || 1), 0);
  return w + types.length;
}

// True once an owner has held an unacted issue past their SLA. GM (null SLA) never breaches.
export function isBreached(ownerRole, ownerSinceMs, nowMs) {
  const hrs = SLA_HOURS[ownerRole];
  if (hrs == null) return false;
  return nowMs - ownerSinceMs >= hrs * 3600000;
}

export function nextOwnerRole(ownerRole) {
  return ESCALATE_TO[ownerRole] || null;
}

// Which timestamp the SLA runs from. An owner who actioned an issue gets a fresh SLA period
// from acted_at — if the agent is still failing after it, the issue re-opens and escalates.
// Ticking the box buys time, not immunity.
export function slaClockOf(issue) {
  return (issue.status === 'acted' ? issue.acted_at : issue.owner_since) || null;
}

// tiny self-check: node src/services/issueEngine.js
function demo() {
  const assert = (c, m) => { if (!c) throw new Error('FAIL: ' + m); };
  assert(severityOf(['gone_quiet']) === 6, 'single heavy = weight+1');
  assert(severityOf(['low_conversion', 'late_start']) > severityOf(['gone_quiet']) === false, 'heavy single still ranks');
  assert(severityOf(['gone_quiet', 'below_target']) === 5 + 4 + 2, 'multi sums');
  assert(severityOf(['x', 'x']) === 2, 'dedup then default weight 1 + count 1');
  const H = 3600000;
  assert(isBreached('team_lead', 0, 48 * H) === true, 'lead breaches at 48h');
  assert(isBreached('team_lead', 0, 47 * H) === false, 'lead ok before 48h');
  assert(isBreached('manager', 0, 71 * H) === false && isBreached('manager', 0, 72 * H) === true, 'manager 72h');
  assert(isBreached('general_manager', 0, 9999 * H) === false, 'GM never breaches');
  assert(nextOwnerRole('team_lead') === 'manager' && nextOwnerRole('manager') === 'general_manager', 'ladder up');
  assert(nextOwnerRole('general_manager') === null, 'GM tops out');
  assert(slaClockOf({ status: 'open', owner_since: 'A', acted_at: 'B' }) === 'A', 'open runs from owner_since');
  assert(slaClockOf({ status: 'acted', owner_since: 'A', acted_at: 'B' }) === 'B', 'acted buys a fresh period');
  assert(slaClockOf({ status: 'acted', owner_since: 'A' }) === null, 'no acted_at = no clock, never escalate blind');
  console.log('issueEngine ok');
}
if (import.meta.url === `file://${process.argv[1]}`) demo();
