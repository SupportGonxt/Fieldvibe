// Field agents may only log visits between 9am and 11am SAST (Africa/Johannesburg,
// UTC+2 year-round, no DST) — TEMPORARY TEST WINDOW, revert to 7-19 before production.
// Enforced server-side using request time so it can't be bypassed by a spoofed
// client timestamp.
const AGENT_HOURS_START = 9;
const AGENT_HOURS_END = 11;
const SAST_OFFSET_MINUTES = 120;

export function isOutsideAgentHours(date = new Date()) {
  const sastMinutes = (date.getUTCHours() * 60 + date.getUTCMinutes() + SAST_OFFSET_MINUTES) % 1440;
  const sastHour = Math.floor(sastMinutes / 60);
  return sastHour < AGENT_HOURS_START || sastHour >= AGENT_HOURS_END;
}

export const AGENT_HOURS_ERROR = `Visits can only be logged between ${AGENT_HOURS_START}:00 and ${AGENT_HOURS_END}:00 SAST.`;
