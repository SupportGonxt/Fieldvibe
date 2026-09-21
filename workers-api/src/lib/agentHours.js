// Field agents may only log visits between 7am and 7pm SAST (Africa/Johannesburg,
// UTC+2 year-round, no DST). Enforced server-side using request time so it
// can't be bypassed by a spoofed client timestamp.
const AGENT_HOURS_START = '7:00';
const AGENT_HOURS_END = '19:00';
const SAST_OFFSET_MINUTES = 120;

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const startMinutes = toMinutes(AGENT_HOURS_START);
const endMinutes = toMinutes(AGENT_HOURS_END);

export function isOutsideAgentHours(date = new Date()) {
  const sastMinutes = (date.getUTCHours() * 60 + date.getUTCMinutes() + SAST_OFFSET_MINUTES) % 1440;
  return sastMinutes < startMinutes || sastMinutes >= endMinutes;
}

export const AGENT_HOURS_ERROR = `Visits can only be logged between ${AGENT_HOURS_START} and ${AGENT_HOURS_END} SAST.`;

// The window is a production rule about real field work. Preview and local runs
// exist so people can test the wizard whenever they sit down to do it, so the
// block is off there. Keyed on the ENVIRONMENT var wrangler.toml sets per env;
// an unknown or missing value enforces, so nothing production-shaped slips through.
const UNENFORCED_ENVIRONMENTS = new Set(['preview', 'development', 'dev', 'test', 'local']);
export function agentHoursEnforced(env) {
  const name = env && typeof env.ENVIRONMENT === 'string' ? env.ENVIRONMENT.toLowerCase() : '';
  return !UNENFORCED_ENVIRONMENTS.has(name);
}

// One call for the route handlers: outside the window AND this environment enforces it.
export function agentHoursBlocked(env, date = new Date()) {
  return agentHoursEnforced(env) && isOutsideAgentHours(date);
}
