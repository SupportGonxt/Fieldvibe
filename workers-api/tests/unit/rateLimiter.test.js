import { describe, it, expect } from 'vitest';
import { rateLimiter } from '../../src/lib/middleware.js';

// Guards the bucket-isolation fix: distinct limiter instances (different route/
// limit) must never share a rate_limits counter. The global 100/min limiter was
// polluting the 60s login/refresh buckets and 429-locking active users.
function fakeCtx(path, keysSeen) {
  const db = {
    prepare: (sql) => ({
      bind: (...args) => {
        if (sql.startsWith('SELECT')) keysSeen.push(args[0]);
        return { first: async () => null, run: async () => ({}) };
      },
      run: async () => ({}),
    }),
  };
  return {
    req: { path, header: () => '1.2.3.4' },
    env: { DB: db },
    header: () => {},
    json: (body, status) => ({ body, status }),
  };
}

describe('rateLimiter bucket isolation', () => {
  it('different paths and limits get different buckets for the same ip+window', async () => {
    const keys = [];
    await rateLimiter(100, 60000)(fakeCtx('/api/anything', keys), async () => {});
    await rateLimiter(5, 60000)(fakeCtx('/api/field-ops/company-auth/login', keys), async () => {});
    await rateLimiter(10, 60000)(fakeCtx('/api/auth/refresh', keys), async () => {});
    expect(new Set(keys).size).toBe(3);
    for (const k of keys) expect(k).toContain('1.2.3.4');
  });
});
