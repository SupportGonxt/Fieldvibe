// Pull Latitude/Longitude out of a company's calling-base workbook and emit SQL that
// writes them onto company_existing_customers (migration 0029's columns).
//
// The workbook is matched to the stored rows by normalized name, not by code: the codes
// in the sheet (10015095) are not the ones 0025 imported (116344), but the names line up.
// Normalization has to mirror normalizeStoreName in workers-api — uppercase, strip every
// non-alphanumeric — and XML entities must be decoded BEFORE that, or "PUB &amp; GRILL"
// uppercases to "PUB &AMP; GRILL" and normalizes to PUBAMPGRILL instead of PUBGRILL.
//
//   node scripts/import-existing-customer-coordinates.mjs <workbook.xlsx> <company_id> [out.sql]
//
// Then apply the generated file with:
//   npx wrangler d1 execute <db> --env preview --remote --file=<out.sql>
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const [workbookPath, companyId, outPath = 'existing-customer-coordinates.sql'] = process.argv.slice(2);
if (!workbookPath || !companyId) {
  console.error('usage: node import-existing-customer-coordinates.mjs <workbook.xlsx> <company_id> [out.sql]');
  process.exit(1);
}

// Minimal xlsx reader: a workbook is a zip of XML parts, and we need two of them.
function readZipEntries(buf) {
  const out = {};
  let i = 0;
  while ((i = buf.indexOf(Buffer.from('PK\x03\x04'), i)) !== -1) {
    const method = buf.readUInt16LE(i + 8);
    const compressedSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.toString('utf8', i + 30, i + 30 + nameLen);
    const start = i + 30 + nameLen + extraLen;
    if (compressedSize > 0) {
      const raw = buf.subarray(start, start + compressedSize);
      try { out[name] = method === 8 ? inflateRawSync(raw) : raw; } catch { /* skip unreadable part */ }
      i = start + compressedSize;
    } else {
      i = start;
    }
  }
  return out;
}

const decodeEntities = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

const normalizeStoreName = (name) => decodeEntities(name).toUpperCase().replace(/[^A-Z0-9]/g, '');

const entries = readZipEntries(readFileSync(workbookPath));
const sharedStrings = [...(entries['xl/sharedStrings.xml'] || Buffer.from('')).toString('utf8')
  .matchAll(/<si>(.*?)<\/si>/gs)]
  .map(m => [...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map(x => x[1]).join(''));

const sheet = entries['xl/worksheets/sheet1.xml'].toString('utf8');
const rows = [...sheet.matchAll(/<row[^>]*>(.*?)<\/row>/gs)];

function cellsOf(rowXml) {
  const cells = {};
  for (const c of rowXml.matchAll(/<c r="([A-Z]+)\d+"([^>]*)>(?:<v>(.*?)<\/v>)?/gs)) {
    const col = c[1].replace(/[0-9]/g, '');
    cells[col] = c[3] === undefined ? '' : (/t="s"/.test(c[2]) ? sharedStrings[+c[3]] : c[3]);
  }
  return cells;
}

// Column letters are read off the header row rather than hardcoded, so a reordered
// export doesn't silently write longitudes into the latitude column.
const header = cellsOf(rows[0][1]);
const columnFor = (wanted) => Object.keys(header).find(k => decodeEntities(header[k]).trim().toLowerCase() === wanted);
const NAME_COL = columnFor('customer name');
const LAT_COL = columnFor('latitude');
const LNG_COL = columnFor('longitude');
if (!NAME_COL || !LAT_COL || !LNG_COL) {
  console.error(`could not find Customer Name / Latitude / Longitude in the header row: ${JSON.stringify(header)}`);
  process.exit(1);
}

// Gauteng-ish bounds. A calling base for Johannesburg with a point in the Atlantic is a
// bad cell, and writing it would blank out a store's real position or create a phantom
// exclusion zone somewhere nobody works.
const BOUNDS = { minLat: -27.5, maxLat: -25.0, minLng: 27.0, maxLng: 29.5 };

const byName = new Map();
let seen = 0, missing = 0, outOfBounds = 0, duplicates = 0;
for (const row of rows.slice(1)) {
  const cells = cellsOf(row[1]);
  const rawName = cells[NAME_COL];
  if (!rawName) continue;
  seen++;
  const key = normalizeStoreName(rawName);
  if (!key) continue;
  const lat = parseFloat(cells[LAT_COL]);
  const lng = parseFloat(cells[LNG_COL]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) { missing++; continue; }
  if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lng < BOUNDS.minLng || lng > BOUNDS.maxLng) { outOfBounds++; continue; }
  if (byName.has(key)) { duplicates++; continue; }  // first win; the sheet repeats some stores
  byName.set(key, { lat, lng });
}

// Where the source had no precise address it fell back to a town centroid, so hundreds of
// stores share one point — 195 on Pretoria CBD, 133 on a point in Soweto. Those are not
// shop positions: a block drawn around one would cover a whole town centre and stop agents
// at shops that are perfectly fine to visit. A point carrying this many stores is treated as
// unusable and its rows keep no coordinates, so they stay covered by the name check instead.
// Real shared points exist too (a small centre with a few shops), which is why the threshold
// is well above a handful.
const CLUSTER_LIMIT = 10;
const pointCounts = new Map();
for (const { lat, lng } of byName.values()) {
  const point = `${lat},${lng}`;
  pointCounts.set(point, (pointCounts.get(point) || 0) + 1);
}
let clustered = 0;
for (const [key, { lat, lng }] of [...byName.entries()]) {
  if (pointCounts.get(`${lat},${lng}`) >= CLUSTER_LIMIT) { byName.delete(key); clustered++; }
}

// One UPDATE per statement would be 20k round trips, so each statement carries a chunk.
// SQLite has no `AS alias(col, col)` syntax for a VALUES table — the columns come out as
// column1..columnN, which is what this addresses them by.
const CHUNK = 400;
const rowsOut = [...byName.entries()];
// Clearing first makes a re-run idempotent, and retires coordinates written by an earlier
// pass that this one now rejects.
const statements = [
  `UPDATE company_existing_customers SET latitude = NULL, longitude = NULL WHERE company_id = '${companyId.replace(/'/g, "''")}';`,
];
for (let i = 0; i < rowsOut.length; i += CHUNK) {
  const values = rowsOut.slice(i, i + CHUNK)
    .map(([key, { lat, lng }]) => `('${key.replace(/'/g, "''")}',${lat},${lng})`)
    .join(',');
  statements.push(
    `UPDATE company_existing_customers SET latitude = v.column2, longitude = v.column3 ` +
    `FROM (VALUES ${values}) AS v ` +
    `WHERE company_existing_customers.company_id = '${companyId.replace(/'/g, "''")}' ` +
    `AND company_existing_customers.normalized_name = v.column1;`
  );
}

writeFileSync(outPath, statements.join('\n') + '\n');
console.log(`workbook rows with a name: ${seen}`);
console.log(`usable coordinates:        ${byName.size}`);
console.log(`  no coordinates:          ${missing}`);
console.log(`  outside Gauteng bounds:  ${outOfBounds}`);
console.log(`  duplicate names skipped: ${duplicates}`);
console.log(`  on a shared centroid:    ${clustered} (dropped — name check still covers them)`);
console.log(`wrote ${statements.length} statements to ${outPath}`);
