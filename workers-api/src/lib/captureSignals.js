// Behaviour checks on a Goldrush check-in, run at upload next to the screenshot rule set
// (lib/imageFraud.js). Pure: addCaptureSignals in services/imageFraudService.js loads the history.
//
// None of these is 'definite'. Each one has an innocent explanation on its own (a
// borrowed phone, a carrier IP routed via Johannesburg, a phone on charge), so they put
// the check-in on the AI Check page for review instead of blocking the agent.
import { haversineM } from '../services/presenceScore.js';

const SA = { latMin: -35.5, latMax: -22, lngMin: 16, lngMax: 33.5 };
export const BURST_MS = 90e3;              // faster than one real sign-up
export const TELEPORT_KMH = 150;
export const IP_FAR_KM = 600;              // mobile IPs geolocate to the carrier gateway, so only gross gaps count
export const BATTERY_STUCK_MIN = 60;       // same % for an hour of captures = one screenshot reused

const digits = (s) => String(s ?? '').replace(/\D/g, '');
const decimals = (x) => (String(x).split('.')[1] || '').length;
const km = (a, b) => haversineM(a.lat, a.lng, b.lat, b.lng) / 1000;
const hasGps = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(Math.abs(p.lat) < 1e-6 && Math.abs(p.lng) < 1e-6);

/**
 * cur:     { at (ISO), lat, lng, phone, idNumber, name, goldrushId, battery }
 * ip:      { country, lat, lng } from Cloudflare request.cf (any field may be missing)
 * recent:  this agent's earlier check-ins, newest first: [{ at, lat, lng, phone, idNumber, name, goldrushId }]
 * device:  { otherAgents: n agents besides this one on this device id, agentDevices: n device ids this agent used incl. this one }
 * batteryToday: this agent's earlier captures today with a readable battery: [{ at, battery }]
 */
export function captureSignals({ cur, ip = {}, recent = [], device = null, batteryToday = [] }) {
  const flags = [];
  const add = (code, level, detail) => flags.push({ code, level, detail });
  const t = Date.parse(cur.at);

  // 5. Fake GPS.
  if (hasGps(cur)) {
    if (cur.lat > SA.latMax || cur.lat < SA.latMin || cur.lng < SA.lngMin || cur.lng > SA.lngMax) add('GPS_OUTSIDE_SA', 'likely', `GPS ${cur.lat},${cur.lng} is outside South Africa`);
    if (decimals(cur.lat) <= 3 && decimals(cur.lng) <= 3) add('GPS_ROUNDED', 'review', `GPS ${cur.lat},${cur.lng} has 3 or fewer decimals: typed or spoofed`);
    if (hasGps(ip)) {
      const d = km(cur, ip);
      if (d > IP_FAR_KM) add('GPS_IP_FAR', 'review', `phone GPS is ${d.toFixed(0)} km from where its internet connection is (${ip.city || ip.country || 'unknown'})`);
    }
  }
  if (ip.country && ip.country !== 'ZA') add('IP_NOT_ZA', 'likely', `connection comes from ${ip.country}, not South Africa: VPN or GPS spoofing app`);

  // 6. One phone, many agents.
  if (device) {
    if (device.otherAgents >= 2) add('DEVICE_SHARED', 'likely', `this phone was used by ${device.otherAgents} other agents in the last 7 days`);
    else if (device.otherAgents === 1) add('DEVICE_SHARED', 'review', 'this phone was used by another agent in the last 7 days');
    if (device.agentDevices >= 3) add('AGENT_MULTI_DEVICE', 'review', `agent used ${device.agentDevices} phones in the last 7 days`);
  }

  // 7. Impossible speed: against the agent's previous check-in.
  const prev = recent[0];
  if (prev && Number.isFinite(t)) {
    const gap = t - Date.parse(prev.at);
    if (gap >= 0 && gap < BURST_MS) add('BURST', 'review', `${Math.round(gap / 1000)}s after the agent's previous sign-up`);
    if (gap > 0 && hasGps(cur) && hasGps(prev)) {
      const d = km(prev, cur), kmh = d / (gap / 3600e3);
      if (d > 5 && kmh > TELEPORT_KMH) add('GPS_TELEPORT', 'likely', `${d.toFixed(0)} km from previous check-in in ${Math.round(gap / 60e3)} min`);
    }
  }

  // 8. Same customer details reused or generated (exact duplicates are already rejected).
  const ph = digits(cur.phone);
  if (/(\d)\1{5}/.test(ph) || /0123456|1234567|2345678|3456789|9876543/.test(ph)) add('PHONE_PATTERN', 'likely', `phone ${cur.phone} is a keyboard/repeat pattern`);
  const near = (a, b, max) => a.length >= 6 && b.length >= 6 && a !== b && Math.abs(Number(a.slice(-9)) - Number(b.slice(-9))) <= max;
  const seqPhone = recent.find(r => near(ph, digits(r.phone), 3));
  if (seqPhone) add('SEQUENTIAL_PHONE', 'review', `phone ${cur.phone} is ${Math.abs(Number(ph.slice(-9)) - Number(digits(seqPhone.phone).slice(-9)))} from ${seqPhone.phone} (same agent)`);
  const id = digits(cur.idNumber);
  if (id.length === 13 && recent.some(r => { const o = digits(r.idNumber); return o.length === 13 && o !== id && o.slice(0, 10) === id.slice(0, 10); })) {
    add('SEQUENTIAL_SA_ID', 'likely', `SA ID ${cur.idNumber} differs from another of this agent's customers only in the last 3 digits`);
  }
  const name = String(cur.name || '').trim().toLowerCase();
  if (name.length > 3 && recent.some(r => String(r.name || '').trim().toLowerCase() === name && digits(r.idNumber) !== id)) add('SAME_NAME_NEW_ID', 'review', `"${cur.name}" already registered by this agent with a different ID number`);

  // 9. Goldrush IDs in a block: accounts mass-created together.
  const gid = digits(cur.goldrushId);
  const seqGid = recent.find(r => near(gid, digits(r.goldrushId), 2));
  if (seqGid) add('SEQUENTIAL_GOLDRUSH_ID', 'review', `Goldrush ID ${cur.goldrushId} is next to ${seqGid.goldrushId} from this agent`);

  // 13. Status-bar battery frozen: a real phone drains during a shift. 100% is excluded (on charge).
  const bat = digits(cur.battery);
  if (bat && bat !== '100' && Number.isFinite(t)) {
    const same = batteryToday.filter(b => digits(b.battery) === bat);
    const first = Math.min(...same.map(b => Date.parse(b.at)));
    if (same.length >= 2 && (t - first) / 60e3 >= BATTERY_STUCK_MIN) add('BATTERY_STUCK', 'likely', `battery shows ${bat}% on ${same.length + 1} check-ins over ${Math.round((t - first) / 60e3)} min`);
  }
  return flags;
}
