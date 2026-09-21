// Pure checks for "does the store the agent is adding belong at this GPS position?".
// No DB/IO — the route supplies the candidate records, these decide the findings.
//
// There is no geocoder in this system, so a typed address cannot be turned into
// coordinates and compared. What can be compared is the tenant's own data: a store
// the agent types by a name or address that already exists somewhere far from the
// check-in position means one of the two is wrong — a duplicate, a different branch,
// or a store being added from somewhere other than the shop floor. None of that is
// certain enough to refuse the store, so every finding is a warning that is also
// written to anomaly_flags for a team lead to look at.
import { haversineM } from './presenceScore.js';
import { normalizeStoreName, toCoord } from './excludedStore.js';

// Far enough from an existing record of the same store to be worth a look. Branches
// of one chain are rarely within a kilometre of each other, and a GPS fix is never
// out by that much.
export const MISMATCH_DISTANCE_M = 1000;

// A fix looser than this can't place a store on the map well enough to be checked
// against later — indoors on a phone is typically 20-80m, so this only catches
// genuinely poor fixes.
export const WEAK_ACCURACY_M = 150;

// The leading run of letters/digits, used as a cheap SQL prefix filter before the
// exact normalized comparison happens here. "Shoprite (Soweto)" -> "SHOPRITE".
export function namePrefix(name) {
  const match = /[A-Za-z0-9]+/.exec(String(name || ''));
  return match ? match[0].toUpperCase() : '';
}

// `candidates` are existing customers that might be the same store, already read by
// the route. Returns [] when nothing looks wrong.
export function evaluateNewStoreLocation({ name, address, latitude, longitude, accuracy }, candidates) {
  const findings = [];
  const lat = toCoord(latitude);
  const lng = toCoord(longitude);
  const hasFix = !Number.isNaN(lat) && !Number.isNaN(lng);

  if (!hasFix) {
    findings.push({
      reason: 'NO_GPS',
      severity: 'MEDIUM',
      description: 'Store was added without a GPS position, so its location can never be verified against a later visit.',
    });
    return findings;
  }

  const acc = Number(accuracy);
  if (Number.isFinite(acc) && acc > WEAK_ACCURACY_M) {
    findings.push({
      reason: 'WEAK_GPS',
      severity: 'LOW',
      description: `Store was pinned from a weak GPS fix (±${Math.round(acc)}m), so its saved location may be off.`,
      accuracy_meters: Math.round(acc),
    });
  }

  const wantedName = normalizeStoreName(name);
  const wantedAddress = normalizeStoreName(address);

  for (const candidate of candidates || []) {
    const cLat = toCoord(candidate?.latitude);
    const cLng = toCoord(candidate?.longitude);
    if (Number.isNaN(cLat) || Number.isNaN(cLng)) continue;
    const distance = Math.round(haversineM(lat, lng, cLat, cLng));
    if (distance <= MISMATCH_DISTANCE_M) continue; // same place — not a mismatch

    const nameMatches = !!wantedName && normalizeStoreName(candidate.name) === wantedName;
    const addressMatches = !!wantedAddress && normalizeStoreName(candidate.address) === wantedAddress;
    if (!nameMatches && !addressMatches) continue;

    findings.push({
      reason: nameMatches ? 'NAME_EXISTS_ELSEWHERE' : 'ADDRESS_EXISTS_ELSEWHERE',
      severity: 'MEDIUM',
      description: nameMatches
        ? `A store called "${candidate.name}" already exists ${formatDistance(distance)} from here${candidate.address ? ` (${candidate.address})` : ''}.`
        : `The address entered already belongs to "${candidate.name}", ${formatDistance(distance)} from here.`,
      existing_customer_id: candidate.id,
      existing_name: candidate.name,
      distance_meters: distance,
    });
  }

  // One name/address collision is the point; a long list of them is noise.
  return findings.slice(0, 4);
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
}
