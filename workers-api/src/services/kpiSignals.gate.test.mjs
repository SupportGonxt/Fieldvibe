// Guards the invariant reactToIssues' resolve-gate relies on: evaluateSignals
// returns [] for BOTH a dark agent (days===0) and a recovered agent (days>0,
// no breach), so actual.days is the only thing that tells them apart.
import assert from 'node:assert';
import { aggregateKpis, evaluateSignals } from './kpiSignals.js';

const th = { visits_per_day: 5, signups_per_day: 2, drop_pct: 30, quiet_days: 3, conversion_floor_pct: 10 };

// Dark: no rows in window → days 0 → empty signals (must NOT be read as recovery).
const dark = aggregateKpis([]);
assert.equal(dark.days, 0);
assert.deepEqual(evaluateSignals({ actual: dark, baseline: dark, daysSinceLastVisit: 999, thresholds: th }), []);

// Recovered: active and meeting every threshold → days>0 → empty signals (real recovery).
const good = aggregateKpis([{ visits: 8, signups: 4, qualified: 3 }, { visits: 7, signups: 3, qualified: 2 }]);
assert.ok(good.days > 0);
assert.deepEqual(evaluateSignals({ actual: good, baseline: good, daysSinceLastVisit: 0, thresholds: th }), []);

console.log('ok: dark vs recovered separable only by actual.days');
