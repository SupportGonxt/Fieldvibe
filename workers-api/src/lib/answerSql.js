// The answer blobs (visit_individuals.custom_field_values, visit_responses.responses) can
// carry base64 photos, so shipping them whole for thousands of rows blew the Worker's
// memory/CPU budget (reports and the weekly Goldrush cron). These pull just the named
// answers out in SQL instead.
// json_valid guards a malformed blob, which would otherwise abort the whole query.
const safeJson = (col) => `CASE WHEN json_valid(${col}) THEN ${col} END`;
// Value of `key` from the first source that has it (sources in priority order).
const jv = (key, sources) => {
  const vals = sources.map(s => `json_extract(${safeJson(s)}, '$.${key}')`);
  return vals.length > 1 ? `COALESCE(${vals.join(', ')})` : vals[0];
};
const pickAnswers = (keys, sources) => keys.map(k => `${jv(k, sources)} AS ${k}`).join(',\n        ');
const isHttp = (x) => `(${x} LIKE 'http://%' OR ${x} LIKE 'https://%')`;
// Arrays come back from json_extract as JSON text.
const asList = (v) => {
  if (typeof v === 'string' && v.startsWith('[')) { try { return JSON.parse(v); } catch { /* plain text */ } }
  return v;
};
// First matching questionnaire row per visit, joined by id instead of a correlated subquery per column.
const vrJoin = (alias, typeFilter) => `LEFT JOIN visit_responses ${alias} ON ${alias}.id = (SELECT vr2.id FROM visit_responses vr2 WHERE vr2.visit_id = v.id AND ${typeFilter.replace(/\bvr\./g, 'vr2.')} LIMIT 1)`;
const QUESTIONNAIRE = "(vr.visit_type IS NULL OR vr.visit_type != 'store_custom_questions')";

export { safeJson, jv, pickAnswers, isHttp, asList, vrJoin, QUESTIONNAIRE };
