// Pure helpers for Goldrush store-imagery AI post-processing.
// Extracted so the share-of-wall clamp and insights parse are unit-testable
// without a Workers runtime. Consumed by src/index.js.

// Board/storefront photos have no shelf facings — the vision model returns
// share_of_wall_pct directly (0–100). Clamp and round to 0.1; null if unusable.
export function clampSharePct(value) {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

// Extract up to 3 short customer-facing observation strings from a raw AI
// response (JSON possibly wrapped in prose). Always returns an array.
export function parseStoreInsights(rawResponse) {
  if (!rawResponse) return [];
  try {
    const r = JSON.parse(String(rawResponse).match(/\{[\s\S]*\}/)?.[0] || '{}');
    if (!Array.isArray(r.insights)) return [];
    return r.insights.filter(s => typeof s === 'string' && s.trim()).slice(0, 3);
  } catch {
    return [];
  }
}
