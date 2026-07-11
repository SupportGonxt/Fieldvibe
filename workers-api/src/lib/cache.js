// In-memory D1 query cache (per-isolate). Moved verbatim from index.js.
// ==================== D1 QUERY CACHE LAYER (P2) ====================
// Uses the Cloudflare Cache API to cache slow-changing D1 query results.
// This avoids redundant D1 reads for data that changes infrequently.
const CACHE_PREFIX = 'https://d1-cache.internal/';

async function cachedD1Query(cacheKey, ttlSeconds, queryFn) {
  try {
    const cache = caches.default;
    const cacheUrl = new Request(CACHE_PREFIX + cacheKey);
    const cached = await cache.match(cacheUrl);
    if (cached) {
      return await cached.json();
    }
    const result = await queryFn();
    // Store in cache with TTL
    const response = new Response(JSON.stringify(result), {
      headers: { 'Cache-Control': `public, max-age=${ttlSeconds}` }
    });
    // Don't await cache.put — fire and forget to avoid blocking the response
    cache.put(cacheUrl, response);
    return result;
  } catch (e) {
    // Cache miss or error — fall through to direct query
    return await queryFn();
  }
}

// Invalidate a cached query (call after mutations that affect cached data)
async function invalidateCache(cacheKey) {
  try {
    const cache = caches.default;
    await cache.delete(new Request(CACHE_PREFIX + cacheKey));
  } catch (e) { /* ignore */ }
}

export { cachedD1Query, invalidateCache };
