import { describe, it, expect, beforeEach } from 'vitest';
import { reportCacheMiddleware } from '../../src/lib/cache.js';

// Map-backed stand-in for caches.default. Keyed by Request.url, which is exactly the
// thing under test: the middleware's whole safety property is what it puts in that URL.
function installFakeCache() {
  const store = new Map();
  globalThis.caches = {
    default: {
      async match(req) {
        const hit = store.get(req.url);
        return hit ? hit.clone() : undefined;
      },
      async put(req, res) { store.set(req.url, res.clone()); },
      async delete(req) { return store.delete(req.url); },
    },
  };
  return store;
}

function ctx({ method = 'GET', path = '/field-ops/reports/kpis', search = '', tenantId = 't1', userId = 'u1', role = 'admin' } = {}) {
  const vars = { tenantId, userId, role };
  const c = {
    req: { method, path, url: `https://api.test${path}${search}` },
    get: (k) => vars[k],
    res: undefined,
    executionCtx: { waitUntil: (p) => p },
  };
  return c;
}

// A handler that records how many times it actually ran.
function handler(c, body, calls) {
  return async () => {
    calls.count++;
    c.res = new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}

describe('reportCacheMiddleware', () => {
  beforeEach(() => { installFakeCache(); });

  it('serves the second identical request from cache without running the handler', async () => {
    const calls = { count: 0 };
    const a = ctx();
    await reportCacheMiddleware(a, handler(a, { kpis: { total: 7 } }, calls));
    expect(calls.count).toBe(1);
    expect(a.res.headers.get('X-Report-Cache')).toBe('MISS');

    const b = ctx();
    const hit = await reportCacheMiddleware(b, handler(b, { kpis: { total: 999 } }, calls));
    expect(calls.count).toBe(1);
    expect(hit.headers.get('X-Report-Cache')).toBe('HIT');
    expect(await hit.json()).toEqual({ kpis: { total: 7 } });
  });

  it('never serves one tenant a response cached for another', async () => {
    const calls = { count: 0 };
    const t1 = ctx({ tenantId: 't1' });
    await reportCacheMiddleware(t1, handler(t1, { secret: 'tenant-1' }, calls));

    const t2 = ctx({ tenantId: 't2' });
    const res = await reportCacheMiddleware(t2, handler(t2, { secret: 'tenant-2' }, calls));
    expect(res).toBeUndefined();          // a miss: middleware fell through to the handler
    expect(calls.count).toBe(2);
    expect(await t2.res.json()).toEqual({ secret: 'tenant-2' });
  });

  it('scopes by user and role too, since report rows are caller-scoped', async () => {
    const calls = { count: 0 };
    const admin = ctx({ userId: 'u1', role: 'admin' });
    await reportCacheMiddleware(admin, handler(admin, { rows: 'all' }, calls));

    const agent = ctx({ userId: 'u2', role: 'agent' });
    await reportCacheMiddleware(agent, handler(agent, { rows: 'own' }, calls));
    expect(calls.count).toBe(2);
    expect(await agent.res.json()).toEqual({ rows: 'own' });
  });

  it('treats a different query string as a different report', async () => {
    const calls = { count: 0 };
    const aug = ctx({ search: '?startDate=2026-08-01' });
    await reportCacheMiddleware(aug, handler(aug, { month: 'aug' }, calls));
    const jul = ctx({ search: '?startDate=2026-07-01' });
    await reportCacheMiddleware(jul, handler(jul, { month: 'jul' }, calls));
    expect(calls.count).toBe(2);
  });

  it('does not cache mutations, live feeds or exports', async () => {
    for (const c of [
      ctx({ method: 'POST' }),
      ctx({ path: '/field-operations/live-locations' }),
      ctx({ path: '/field-ops/reports/export/checkins' }),
      ctx({ path: '/analytics/realtime' }),
      ctx({ path: '/users' }),                       // not a report path at all
    ]) {
      const calls = { count: 0 };
      await reportCacheMiddleware(c, handler(c, { n: 1 }, calls));
      const again = ctx({ method: c.req.method, path: c.req.path });
      await reportCacheMiddleware(again, handler(again, { n: 2 }, calls));
      expect(calls.count, `${c.req.method} ${c.req.path} must not be cached`).toBe(2);
    }
  });

  it('still works when the context has no ExecutionContext (c.executionCtx throws)', async () => {
    const calls = { count: 0 };
    const a = ctx();
    delete a.executionCtx;
    Object.defineProperty(a, 'executionCtx', { get() { throw new Error('This context has no ExecutionContext'); } });
    await reportCacheMiddleware(a, handler(a, { ok: 1 }, calls));
    expect(calls.count).toBe(1);
    expect(await a.res.json()).toEqual({ ok: 1 });
  });

  it('does not cache a failed response, so an outage cannot get pinned for the TTL', async () => {
    const calls = { count: 0 };
    const fail = ctx();
    await reportCacheMiddleware(fail, async () => {
      calls.count++;
      fail.res = new Response(JSON.stringify({ success: false }), { status: 500 });
    });
    const retry = ctx();
    await reportCacheMiddleware(retry, handler(retry, { ok: true }, calls));
    expect(calls.count).toBe(2);
    expect(await retry.res.json()).toEqual({ ok: true });
  });
});
