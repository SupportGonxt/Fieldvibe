// One-Number Rail: the ONLY definitions of converted / verified / SAST day /
// waterfall math. Pure — no DB, no IO. Every consumer (kpi, incentives, gm,
// cron, portal export) must use these; never inline these expressions again.

export const CONVERTED_SQL = (a = 'vi') =>
  `(json_extract(${a}.custom_field_values,'$.consumer_converted') = 'Yes' ` +
  `OR json_extract(${a}.custom_field_values,'$.converted') = 1)`;

export const VERIFIED_SQL = (a = 'vi') =>
  `json_extract(${a}.custom_field_values,'$.verification_status') = 'qualified'`;

export const NOT_REJECTED_SQL = (a = 'vi') =>
  `COALESCE(json_extract(${a}.custom_field_values,'$.verification_status'),'provisional') != 'rejected'`;

export function isConverted(cfv) {
  let obj = cfv;
  if (typeof cfv === 'string') {
    try { obj = JSON.parse(cfv); } catch { return false; }
  }
  if (!obj || typeof obj !== 'object') return false;
  return String(obj.consumer_converted).toLowerCase() === 'yes' || Number(obj.converted) === 1;
}

// SAST = UTC+2, no DST. Matches cron/jobs.js convention.
export function sastDay(tsMs) {
  return new Date(tsMs + 2 * 3600 * 1000).toISOString().slice(0, 10);
}

// Attainment identity (spec §3.2):
// attainment = fieldHours × visits/hour × signups/visit × verifyRate × depositRate ÷ target
// Zero denominators → null (spec §6: never NaN).
export function waterfall({ fieldHours, visits, signups, verified, deposits, target }) {
  const div = (num, den) => (den > 0 ? num / den : null);
  return {
    visitsPerHour: div(visits, fieldHours),
    signupsPerVisit: div(signups, visits),
    verifyRate: div(verified, signups),
    depositRate: div(deposits, verified),
    attainment: div(deposits, target),
  };
}
