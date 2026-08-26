// Field agents may only log visits between 9:30am and 10:00am SAST (Africa/Johannesburg,
// UTC+2 year-round, no DST) — TEMPORARY TEST WINDOW, revert to 7-19 before production.
// Enforced server-side using request time so it can't be bypassed by a spoofed
// client timestamp.
const AGENT_HOURS_START = '9:30';
const AGENT_HOURS_END = '10:00';
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
