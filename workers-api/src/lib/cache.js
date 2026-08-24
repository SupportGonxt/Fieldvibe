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


// ==================== REPORT / DASHBOARD RESPONSE CACHE ====================
// Reports and dashboards are aggregate reads over the whole visit history: the admin
// agent-performance query alone reads ~240k rows to return 50, and the report page
// asks for it from three tabs. The frontend already treats these as 5-minute-stale
// (react-query staleTime), so a 60s edge cache is strictly fresher than what the UI
// renders, and it collapses every repeat load, tab switch and second viewer onto one
// D1 execution.
//
// Runs BEFORE the rate limiter (see index.js) so a cache hit costs zero D1 round
// trips instead of the limiter's SELECT + counter write.
// c.req.path is the FULL request path, mount prefix included: the protected API
// hangs off app.route('/api', api), so every path here arrives as /api/<family>.
// The first cut of this regex was anchored at /field-ops and therefore matched
// nothing in production — the prefix is stripped before matching now, and
// reportCache.test.js asserts on prefixed paths so it can't silently regress.
const API_PREFIX = /^\/api/;
const CACHEABLE = /^\/(field-ops\/(reports|performance|kpi|gm|incentives|leaderboard)|analytics|dashboard|reports|field-operations\/(reports|analytics)|team-lead\/(dashboard|agent)|manager\/(dashboard|team|agent))/;
// live-locations is a live map feed, /realtime is by definition not cacheable, and the
// export endpoints stream CSV/XLSX a user just asked to download.
const NEVER_CACHE = /(live-locations|realtime|export)/;
const RESPONSE_TTL_SECONDS = 60;

// Shared by the middleware and by the fetch wrapper in index.js, which uses it to
// decide whether a request may read from a D1 replica. Same predicate on purpose:
// a path is safe to serve from a replica exactly when it is safe to serve from a
// 60s edge cache, because both mean "seconds-stale aggregate reads are fine here".
function isCacheableReportPath(method, path) {
  return method === 'GET' && CACHEABLE.test(path.replace(API_PREFIX, '')) && !NEVER_CACHE.test(path);
}

async function reportCacheMiddleware(c, next) {
  const path = c.req.path;
  if (!isCacheableReportPath(c.req.method, path)) return next();

  // The key MUST carry tenant + user + role: these responses are tenant-scoped, and
  // several of them scope rows by the caller (an agent sees only their own visits).
  // Keying on the URL alone would serve one tenant's report to another.
  const scope = [c.get('tenantId'), c.get('userId'), c.get('role')].map(v => encodeURIComponent(v ?? '')).join('/');
  const url = new URL(c.req.url);
  const key = new Request(`https://report-cache.internal/${scope}${path}${url.search}`);

  let cache;
  try {
    cache = caches.default;
    const hit = await cache.match(key);
    if (hit) {
      const res = new Response(hit.body, hit);
      res.headers.set('X-Report-Cache', 'HIT');
      return res;
    }
  } catch (e) {
    return next(); // no Cache API in this runtime (tests, miniflare edge cases)
  }

  await next();

  // Only successful JSON responses. Caching a 500 would pin an outage for a minute.
  const res = c.res;
  if (res && res.status === 200) {
    // clone() so the body we hand the client is untouched; the clone's body is what
    // the cache consumes.
    const cloned = res.clone();
    const headers = new Headers(cloned.headers);
    headers.set('Cache-Control', `public, max-age=${RESPONSE_TTL_SECONDS}`);
    const toStore = new Response(cloned.body, { status: 200, headers });
    // Fire and forget: never make the caller wait on the cache write.
    const put = cache.put(key, toStore).catch(() => {});
    // c.executionCtx THROWS (it does not return undefined) when there is no
    // ExecutionContext, e.g. a unit test calling app.fetch(req) with no ctx.
    try { c.executionCtx.waitUntil(put); } catch { /* no ctx: fire and forget */ }
    c.res.headers.set('X-Report-Cache', 'MISS');
  }
}

export { cachedD1Query, invalidateCache, reportCacheMiddleware, isCacheableReportPath };
