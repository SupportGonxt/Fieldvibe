// Pure GPS presence-anomaly scoring — no DB/IO. See
// docs/superpowers/specs/2026-07-12-presence-validation-design.md
// Given a day's opportunistic GPS fixes for one agent + the tenant's customer
// coords, decide whether the agent looks present-and-working, absent, or parked
// somewhere off-zone (home / second job).

const EARTH_RADIUS_M = 6371000;
const CLUSTER_RADIUS_M = 150; // greedy-join radius for the dominant-cluster heuristic

// Great-circle distance in metres.
export function haversineM(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// SQLite datetime string ("YYYY-MM-DD HH:MM:SS", UTC) -> epoch ms. Parsed
// manually because Date parsing of space-separated, unzoned strings is
// implementation-defined.
function parseUtc(s) {
  const m = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(s || ''));
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

// Local hour-of-day (0-23) for a UTC recorded_at given a whole-hour tz offset.
function localHour(s, tzOffsetHours) {
  const m = /[ T](\d{2}):/.exec(String(s || ''));
  if (!m) return NaN;
  return (((+m[1] + tzOffsetHours) % 24) + 24) % 24;
}

// Metres from the given point to its nearest customer, or Infinity if none.
function nearestCustomerM(lat, lon, customers) {
  let best = Infinity;
  for (const cust of customers) {
    const d = haversineM(lat, lon, cust.latitude, cust.longitude);
    if (d < best) best = d;
  }
  return best;
}

// Greedy single-pass clustering: a point joins the first cluster whose running
// centroid is within CLUSTER_RADIUS_M, else opens a new one. Good enough to spot
// a stationary blob; not a real density cluster. ponytail: naive O(n*k) greedy,
// swap for a grid/DBSCAN only if scatter gets large per agent per day.
function dominantClusterOf(points, customers, offZoneRadiusM) {
  if (points.length === 0) return null;
  const clusters = [];
  for (const p of points) {
    let joined = null;
    for (const cl of clusters) {
      if (haversineM(p.latitude, p.longitude, cl.lat, cl.lon) <= CLUSTER_RADIUS_M) {
        joined = cl;
        break;
      }
    }
    if (!joined) {
      joined = { lat: p.latitude, lon: p.longitude, pts: [] };
      clusters.push(joined);
    }
    joined.pts.push(p);
    // recompute centroid as simple mean
    joined.lat = joined.pts.reduce((s, q) => s + q.latitude, 0) / joined.pts.length;
    joined.lon = joined.pts.reduce((s, q) => s + q.longitude, 0) / joined.pts.length;
  }
  const winner = clusters.reduce((a, b) => (b.pts.length > a.pts.length ? b : a));
  const times = winner.pts.map((q) => parseUtc(q.recorded_at)).filter((t) => !Number.isNaN(t));
  const hours = times.length ? (Math.max(...times) - Math.min(...times)) / 3600000 : 0;
  return {
    latitude: winner.lat,
    longitude: winner.lon,
    hours,
    nearCustomer: customers.length > 0 && nearestCustomerM(winner.lat, winner.lon, customers) <= offZoneRadiusM,
    pointCount: winner.pts.length,
  };
}

export function scoreAgentDay(points, customers, opts = {}) {
  const {
    offZoneRadiusM = 2000,
    minSamples = 3,
    workStartHour = 8,
    workEndHour = 17,
    tzOffsetHours = 2,
  } = opts;
  const pts = points || [];
  const custs = customers || [];

  const lastSeenAt = pts.length
    ? pts.map((p) => p.recorded_at).reduce((a, b) => (a > b ? a : b))
    : null;

  const windowed = pts.filter((p) => {
    const h = localHour(p.recorded_at, tzOffsetHours);
    return h >= workStartHour && h < workEndHour;
  });
  const sampleCount = windowed.length;

  const dominantCluster = dominantClusterOf(windowed, custs, offZoneRadiusM);

  // off-zone % only meaningful when there are customer zones to judge against.
  let offZonePct = 0;
  if (custs.length > 0 && sampleCount > 0) {
    const offZone = windowed.filter(
      (p) => nearestCustomerM(p.latitude, p.longitude, custs) > offZoneRadiusM
    ).length;
    offZonePct = Math.round((offZone / sampleCount) * 100);
  }

  let status;
  if (sampleCount === 0) status = 'no_show';
  else if (sampleCount < minSamples) status = 'low_coverage';
  else if (custs.length > 0 && offZonePct >= 60) status = 'off_zone';
  else status = 'ok';

  return { status, offZonePct, sampleCount, dominantCluster, lastSeenAt };
}

// Self-check: run the four canonical cases. Throws on regression.
export function demo() {
  const assert = (cond, msg) => {
    if (!cond) throw new Error('presenceScore demo failed: ' + msg);
  };
  const cust = [{ latitude: -26.2041, longitude: 28.0473 }]; // Johannesburg
  const at = (h) => `2026-07-12 ${String(h - 2).padStart(2, '0')}:00:00`; // local h -> UTC (SAST-2)

  // all far from customer -> off_zone
  const far = [10, 12, 14].map((h) => ({ latitude: -25.7479, longitude: 28.2293, recorded_at: at(h) })); // Pretoria, ~55km
  assert(scoreAgentDay(far, cust, {}).status === 'off_zone', 'all-far -> off_zone');

  // all near customer -> ok
  const near = [10, 12, 14].map((h) => ({ latitude: -26.2042, longitude: 28.0474, recorded_at: at(h) }));
  assert(scoreAgentDay(near, cust, {}).status === 'ok', 'all-near -> ok');

  // empty -> no_show
  assert(scoreAgentDay([], cust, {}).status === 'no_show', 'empty -> no_show');

  // exactly 2 near points -> low_coverage
  const two = [10, 12].map((h) => ({ latitude: -26.2042, longitude: 28.0474, recorded_at: at(h) }));
  assert(scoreAgentDay(two, cust, {}).status === 'low_coverage', '2 near -> low_coverage');

  return true;
}
