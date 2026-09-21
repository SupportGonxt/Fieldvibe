import { describe, it, expect, vi } from 'vitest';
import { parseShelfAnalysis, analyzeShelfPhoto, runShelfAnalysis, SHELF_MODEL, MAX_AI_IMAGE_BYTES } from '../../src/services/shelfAnalysis.js';
import { offloadProductAuditPhotos } from '../../src/lib/photoAi.js';

const GOOD_JSON = JSON.stringify({
  shelf_level: 'eye_level',
  visibility_score: 8,
  obstructions: ['partially blocked by promo sign'],
  estimated_facings: 4,
  notes: 'Four facings at eye level, promo sign covering the left edge.',
  confidence: 'high',
});

const bytes = (n = 64) => new Uint8Array(n).fill(7);

// Workers AI double: returns whatever text it was given, or throws.
function ai(response, { throws = false } = {}) {
  return { run: vi.fn(async () => { if (throws) throw new Error('AI unavailable'); return { response }; }) };
}

describe('parseShelfAnalysis', () => {
  it('parses a clean reply into the stored shape', () => {
    const out = parseShelfAnalysis(GOOD_JSON);
    expect(out.status).toBe('complete');
    expect(out.shelf_level).toBe('eye_level');
    expect(out.visibility_score).toBe(8);
    expect(out.obstructions).toEqual(['partially blocked by promo sign']);
    expect(out.estimated_facings).toBe(4);
    expect(out.confidence).toBe('high');
    expect(out.raw_model_response).toBe(GOOD_JSON);
  });

  it('recovers JSON the model wrapped in prose or code fences', () => {
    const fenced = 'Sure! Here you go:\n```json\n' + GOOD_JSON + '\n```\nHope that helps.';
    expect(parseShelfAnalysis(fenced).status).toBe('complete');
    expect(parseShelfAnalysis(fenced).shelf_level).toBe('eye_level');
  });

  it('falls back to analysis_failed and keeps the raw output when the reply is not JSON', () => {
    const junk = 'I am unable to analyse this image.';
    const out = parseShelfAnalysis(junk);
    expect(out.status).toBe('analysis_failed');
    expect(out.raw_model_response).toBe(junk);
    expect(out.shelf_level).toBeUndefined();
  });

  it('does not throw on truncated JSON, and keeps it for debugging', () => {
    const truncated = '{"shelf_level":"top","visibility_score":';
    const out = parseShelfAnalysis(truncated);
    expect(out.status).toBe('analysis_failed');
    expect(out.raw_model_response).toBe(truncated);
  });

  it('normalises an out-of-range score and an unknown shelf level', () => {
    const out = parseShelfAnalysis(JSON.stringify({ shelf_level: 'Middle Shelf', visibility_score: 47, confidence: 'VERY SURE' }));
    expect(out.status).toBe('complete');
    expect(out.shelf_level).toBe('unclear');       // not one of the allowed values
    expect(out.visibility_score).toBe(10);          // clamped into 1-10
    expect(out.confidence).toBe('low');             // unknown confidence is not trusted
  });

  it('accepts "eye level" written with a space', () => {
    expect(parseShelfAnalysis(JSON.stringify({ shelf_level: 'eye level' })).shelf_level).toBe('eye_level');
  });

  it('treats uncountable facings as null rather than a failure', () => {
    const out = parseShelfAnalysis(JSON.stringify({ shelf_level: 'top', estimated_facings: null }));
    expect(out.status).toBe('complete');
    expect(out.estimated_facings).toBeNull();
  });

  it('drops junk entries from obstructions and caps the list', () => {
    const out = parseShelfAnalysis(JSON.stringify({ obstructions: ['sign', '', null, 42, 'box', 'a', 'b', 'c', 'd', 'e'] }));
    expect(out.obstructions.length).toBeLessThanOrEqual(6);
    expect(out.obstructions.every(o => typeof o === 'string' && o)).toBe(true);
  });

  it('rejects a JSON array — the schema is an object', () => {
    expect(parseShelfAnalysis('[1,2,3]').status).toBe('analysis_failed');
  });

  // Regression: the first real analysis on preview failed with raw_model_response
  // recorded as the literal "[object Object]". Workers AI had handed back `response`
  // as an already-parsed object, and String() on it destroyed the reply. The same
  // model behaviour is what makes the older analyzePhotoWithAI die with
  // D1_TYPE_ERROR: Type 'object' not supported.
  it('accepts an already-parsed object from Workers AI, not just a JSON string', () => {
    const out = parseShelfAnalysis({
      shelf_level: 'bottom', visibility_score: 3, obstructions: ['crate in front'],
      estimated_facings: 2, notes: 'Two facings low down behind a crate.', confidence: 'medium',
    });
    expect(out.status).toBe('complete');
    expect(out.shelf_level).toBe('bottom');
    expect(out.visibility_score).toBe(3);
    expect(out.estimated_facings).toBe(2);
  });

  it('never records the string "[object Object]" for an unusable reply', () => {
    for (const reply of [{ unexpected: 'shape' }, ['a'], 42, { nested: { deep: true } }]) {
      const out = parseShelfAnalysis(reply);
      expect(out.raw_model_response).not.toBe('[object Object]');
    }
  });

  it('keeps an object reply readable in raw_model_response', () => {
    const out = parseShelfAnalysis({ shelf_level: 'top', visibility_score: 9 });
    expect(JSON.parse(out.raw_model_response).shelf_level).toBe('top');
  });
});

describe('analyzeShelfPhoto', () => {
  it('sends the image as an image_url data URI, not a raw byte array', async () => {
    const binding = ai(GOOD_JSON);
    const out = await analyzeShelfPhoto(binding, bytes());

    expect(out.status).toBe('complete');
    const [model, payload] = binding.run.mock.calls[0];
    expect(model).toBe(SHELF_MODEL);
    const content = payload.messages[1].content;
    expect(content[1].type).toBe('image_url');
    expect(content[1].image_url.url.startsWith('data:image/jpeg;base64,')).toBe(true);
    // The shape that blew the 128K context window must not come back.
    expect(payload.image).toBeUndefined();
  });

  it('reports a failure instead of throwing when the AI call fails', async () => {
    const out = await analyzeShelfPhoto(ai(null, { throws: true }), bytes());
    expect(out.status).toBe('analysis_failed');
    expect(out.raw_model_response).toContain('AI unavailable');
  });

  it('reports a failure when no AI binding is present', async () => {
    expect((await analyzeShelfPhoto(undefined, bytes())).status).toBe('analysis_failed');
  });

  it('completes when the binding returns response as an object rather than a string', async () => {
    const binding = { run: async () => ({ response: { shelf_level: 'middle', visibility_score: 5, confidence: 'low' } }) };
    const out = await analyzeShelfPhoto(binding, bytes());
    expect(out.status).toBe('complete');
    expect(out.shelf_level).toBe('middle');
  });

  it('keeps the detail when Workers AI throws a plain object instead of an Error', async () => {
    const binding = { run: async () => { throw { code: 5021, detail: 'context window exceeded' }; } };
    const out = await analyzeShelfPhoto(binding, bytes());
    expect(out.status).toBe('analysis_failed');
    expect(out.raw_model_response).toContain('5021');
    expect(out.raw_model_response).not.toContain('[object Object]');
  });

  it('refuses an image over the size cap without calling the model', async () => {
    const binding = ai(GOOD_JSON);
    const out = await analyzeShelfPhoto(binding, new Uint8Array(MAX_AI_IMAGE_BYTES + 1));
    expect(out.status).toBe('analysis_failed');
    expect(binding.run).not.toHaveBeenCalled();
  });
});

// Minimal D1 double that records the statements it was given.
function db(log = []) {
  return {
    prepare(sql) {
      const binds = [];
      return {
        bind(...args) { binds.push(...args); return this; },
        async first() { return null; },
        async run() { log.push({ sql, binds }); return { success: true, meta: { changes: 1 } }; },
      };
    },
  };
}

describe('runShelfAnalysis', () => {
  const r2 = (obj) => ({ get: async () => obj });
  const photo = { arrayBuffer: async () => bytes().buffer, httpMetadata: { contentType: 'image/jpeg' } };

  it('records a completed analysis', async () => {
    const log = [];
    const status = await runShelfAnalysis(
      { DB: db(log), UPLOADS: r2(photo), AI: ai(GOOD_JSON) },
      { analysisId: 'a1', photoId: 'p1', r2Key: 'photos/t/v/p1.jpg' }
    );
    expect(status).toBe('complete');
    const update = log.find(l => l.sql.includes('SET status = ?'));
    expect(update.binds[0]).toBe('complete');
    expect(update.binds[1]).toBe('eye_level');
  });

  it('records failed — with the raw reply — when the model returns junk', async () => {
    const log = [];
    const status = await runShelfAnalysis(
      { DB: db(log), UPLOADS: r2(photo), AI: ai('no idea, sorry') },
      { analysisId: 'a1', photoId: 'p1', r2Key: 'k' }
    );
    expect(status).toBe('failed');
    const update = log.find(l => l.sql.includes('SET status = ?'));
    expect(update.binds[0]).toBe('failed');
    expect(update.binds).toContain('no idea, sorry');
  });

  it('records failed rather than throwing when the photo is missing from R2', async () => {
    const status = await runShelfAnalysis(
      { DB: db(), UPLOADS: r2(null), AI: ai(GOOD_JSON) },
      { analysisId: 'a1', photoId: 'p1', r2Key: 'gone' }
    );
    expect(status).toBe('failed');
  });

  it('never throws even when D1 itself is broken', async () => {
    const brokenDb = { prepare() { throw new Error('D1 down'); } };
    await expect(runShelfAnalysis({ DB: brokenDb, UPLOADS: r2(photo), AI: ai(GOOD_JSON) }, { analysisId: 'a1', photoId: 'p1', r2Key: 'k' }))
      .resolves.toBe('failed');
  });
});

// The upload must survive anything the analysis step does — the photo matters, the
// analysis is a bonus.
describe('photo upload when analysis fails', () => {
  const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const CTX = { tenantId: 't1', visitId: 'v1', userId: 'u1', reqUrl: 'https://api.test/api/visits' };
  const bucket = () => ({ put: async () => {} });
  const okDb = () => ({
    prepare() {
      return { bind() { return this; }, async first() { return null; }, async run() { return { success: true, meta: { changes: 1 } }; } };
    },
  });

  it('still stores the photo and returns its URL when queueing analysis throws', async () => {
    const value = JSON.stringify([{ product: 'Cola 500ml', stock: 'Yes', photo: GIF }]);
    const out = await offloadProductAuditPhotos(okDb(), bucket(), value, {
      ...CTX,
      onPhotoStored: async () => { throw new Error('shelf analysis queue exploded'); },
    });
    const parsed = JSON.parse(out);
    expect(parsed[0].photo).toContain('/api/uploads/');
    expect(parsed[0].photo).not.toContain('data:image');
  });

  it('passes the product name to the analysis hook so the row says which product it is', async () => {
    const seen = [];
    const value = JSON.stringify([{ product: 'Cola 1L', stock: 'Yes', photo: GIF }]);
    await offloadProductAuditPhotos(okDb(), bucket(), value, {
      ...CTX,
      onPhotoStored: async (info) => { seen.push(info); },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].product).toBe('Cola 1L');
    expect(seen[0].r2Key).toMatch(/^photos\/t1\/v1\/[0-9a-f-]+\.jpg$/);
  });
});
