// workers-api/src/services/rootCauseSignals.js
// Pure GPS/time root-cause signals: WHY an agent misses target, derived from
// per-visit check-in timestamps + GPS. No DB, no I/O (mirrors kpiSignals.js).
// check_out_time is mostly NULL in prod, so the active field span is measured
// between the first and last CHECK-IN of a day, not check-in→check-out.
// Single-tenant SA deployment: timestamps are UTC, local = UTC+2 (SAST).
// ponytail: SAST hardcoded; thread tenant tz through if we ever go multi-region.

const SAST_OFFSET_MIN = 120;

export const ROOT_CAUSE_DEFAULTS = {
  late_start_after_min: 9 * 60, // avg first check-in later than 09:00 local
  short_span_min: 5 * 60,       // avg first→last check-in span under 5h
  idle_gap_min: 90,             // a between-stop gap ≥90min...
  idle_gap_max_km: 2,           // ...with ≤2km travel = idle, not driving
  idle_day_min: 120,            // avg >2h idle/day flags
  travel_km_per_hop: 12,        // avg driving distance between stops
  min_days: 3,                  // need a few active days before judging
};

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// local minutes-of-day (0..1439) from an ISO UTC timestamp
function localMinOfDay(t) {
  const utcMin = (t % 86400000) / 60000; // ms since UTC midnight → min
  return (((utcMin + SAST_OFFSET_MIN) % 1440) + 1440) % 1440;
}

// rows: [{ visit_date, check_in_time (ISO UTC), latitude, longitude }], any order.
export function rootCauseSignals(rows, thresholds = {}) {
  const th = { ...ROOT_CAUSE_DEFAULTS, ...thresholds };
  const byDay = new Map();
  for (const r of rows || []) {
    if (!r.check_in_time) continue;
    const t = Date.parse(r.check_in_time);
    if (Number.isNaN(t)) continue;
    if (!byDay.has(r.visit_date)) byDay.set(r.visit_date, []);
    byDay.get(r.visit_date).push({ t, lat: r.latitude, lng: r.longitude });
  }

  let days = 0, firstMinSum = 0, spanSum = 0, idleSum = 0, hops = 0, travelSum = 0;
  for (const pts of byDay.values()) {
    pts.sort((a, b) => a.t - b.t);
    days++;
    firstMinSum += localMinOfDay(pts[0].t);
    spanSum += (pts[pts.length - 1].t - pts[0].t) / 60000;
    for (let i = 1; i < pts.length; i++) {
      const gap = (pts[i].t - pts[i - 1].t) / 60000;
      const known = pts[i].lat != null && pts[i - 1].lat != null;
      const km = known ? haversineKm(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng) : 0;
      travelSum += km; hops++;
      if (gap >= th.idle_gap_min && km <= th.idle_gap_max_km) idleSum += gap;
    }
  }
  if (days < th.min_days) return [];

  const avgFirst = firstMinSum / days;
  const avgSpan = spanSum / days;
  const avgIdle = idleSum / days;
  const avgKmPerHop = hops ? travelSum / hops : 0;

  const out = [];
  if (avgFirst > th.late_start_after_min)
    out.push({ type: 'late_start', detail: { avg_start_min: Math.round(avgFirst) } });
  if (avgSpan < th.short_span_min)
    out.push({ type: 'short_field_day', detail: { avg_span_min: Math.round(avgSpan) } });
  if (avgIdle > th.idle_day_min)
    out.push({ type: 'idle_gaps', detail: { avg_idle_min: Math.round(avgIdle) } });
  if (avgKmPerHop > th.travel_km_per_hop)
    out.push({ type: 'excess_travel', detail: { avg_km_per_hop: Math.round(avgKmPerHop * 10) / 10 } });
  return out;
}
