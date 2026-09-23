// Check-in / check-out timestamps for a visit submitted through /visits/workflow.
//
// The wizard sends check_in_time = when the agent's GPS fix landed at the start of
// the visit; the submit itself is the check-out. Time on site is the gap between
// them. The client clock is not trusted blindly: a check-in that is malformed, in
// the future, or implausibly old (a draft restored days later) collapses to the
// submit time, so a visit can never show a negative or multi-day duration.

export const MAX_VISIT_HOURS = 12;

export function resolveVisitTimes(body, nowIso = new Date().toISOString()) {
  const now = new Date(nowIso);
  const check_out_time = now.toISOString();
  const raw = body && typeof body.check_in_time === 'string' ? body.check_in_time : null;
  if (!raw) return { check_in_time: check_out_time, check_out_time };
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return { check_in_time: check_out_time, check_out_time };
  const ageMs = now.getTime() - start.getTime();
  if (ageMs < 0 || ageMs > MAX_VISIT_HOURS * 3600 * 1000) return { check_in_time: check_out_time, check_out_time };
  return { check_in_time: start.toISOString(), check_out_time };
}

// Whole minutes on site, or null when either side is missing/unparseable.
export function visitDurationMinutes(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}
