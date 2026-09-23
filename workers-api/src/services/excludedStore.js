// Pure helpers for "is the agent standing at a store this company must not visit?".
// No DB/IO — the route supplies the candidate stores and the company's excluded
// names, these decide the answer.
//
// A company's excluded list (company_existing_customers, e.g. Diplomat's calling
// base of already-serviced stores) carries names and addresses but no coordinates,
// so a listed store is located through the tenant's own customer records: a
// customer row near the agent whose name normalizes to a listed name is that store.
import { haversineM } from './presenceScore.js';

// Same normalization the name-based /visits/check-existing-customer uses, so both
// checks agree on what counts as the same store ("Shoprite (Soweto)" -> "SHOPRITESOWETO").
export function normalizeStoreName(name) {
  return String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// A coordinate as a number, or NaN for anything that isn't one. Number() alone is a
// trap here: Number(null) and Number('') are both 0, which would put a store with no
// coordinates on the equator off West Africa and make it look thousands of km away.
export function toCoord(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

// Metres of latitude per degree; longitude degrees shrink towards the poles.
const M_PER_DEG_LAT = 111320;

// Bounding box for a radius around a point, so the DB scans an index range instead
// of every customer in the tenant. Deliberately a little generous — the exact
// great-circle filter below is what decides membership.
export function boundingBox(lat, lng, radiusMeters) {
  const latDelta = radiusMeters / M_PER_DEG_LAT;
  // cos() collapses at the poles; clamp so the box stays finite.
  const lngDelta = radiusMeters / (M_PER_DEG_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return { minLat: lat - latDelta, maxLat: lat + latDelta, minLng: lng - lngDelta, maxLng: lng + lngDelta };
}

// Stores genuinely within the radius, nearest first, each tagged with its distance.
export function storesWithinRadius(lat, lng, stores, radiusMeters) {
  return (stores || [])
    .filter(s => !Number.isNaN(toCoord(s?.latitude)) && !Number.isNaN(toCoord(s?.longitude)))
    .map(s => ({ ...s, distance_meters: haversineM(lat, lng, toCoord(s.latitude), toCoord(s.longitude)) }))
    .filter(s => s.distance_meters <= radiusMeters)
    .sort((a, b) => a.distance_meters - b.distance_meters);
}

