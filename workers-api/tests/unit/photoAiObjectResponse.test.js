import { describe, it, expect } from 'vitest';
import { analyzePhotoWithAI } from '../../src/lib/photoAi.js';

// Workers AI returns `response` as an already-parsed object when the model emits JSON.
// Binding that object to D1 threw D1_TYPE_ERROR, so every analysis was marked failed.
function fakeEnv(response) {
  const log = [];
  const db = {
    prepare(sql) {
      const binds = [];
      return {
        bind(...a) { binds.push(...a); return this; },
        async first() { return null; },
        async all() { return { results: [] }; },
        async run() {
          if (binds.some(v => v !== null && typeof v === 'object')) throw new Error("D1_TYPE_ERROR: Type 'object' not supported");
          log.push({ sql, binds }); return { success: true };
        },
      };
    },
  };
  const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
  return {
    log,
    DB: db,
    UPLOADS: { async get() { return { arrayBuffer: async () => bytes.buffer, httpMetadata: { contentType: 'image/jpeg' } }; } },
    AI: { async run() { return { response }; } },
  };
}

describe('analyzePhotoWithAI', () => {
  for (const [name, response] of [
    ['object response', { compliance_score: 80, brands: [] }],
    ['string response', '{"compliance_score": 80, "brands": []}'],
  ]) {
    it(`stores a completed analysis for a ${name}`, async () => {
      const env = fakeEnv(response);
      await analyzePhotoWithAI(env, 'p1', 'k1', 't1', 'v1', 'general');
      const done = env.log.find(e => e.sql.includes("ai_analysis_status = 'completed'"));
      expect(done, JSON.stringify(env.log.map(e => e.sql))).toBeTruthy();
      expect(done.binds).toContain(80);
    });
  }
});
