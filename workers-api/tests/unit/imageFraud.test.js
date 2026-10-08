import { describe, it, expect } from 'vitest';
import jpeg from 'jpeg-js';
import {
  bgClass, statusBarFingerprint, fingerprintDistance, fingerprintSignature, signatureMayMatch,
  fpToBase64, fpFromBase64, idFrontier, evaluate, analyzeImage, decodeJpeg, dataUrlToBytes,
  FP_MATCH_THRESHOLD, FAKE_MESSAGE, normaliseClock, statusBarCropDataUrl,
} from '../../src/lib/imageFraud.js';
import { worstVerdict, visitVerdict, tally } from '../../src/routes/field-ops/aiCheck.js';

// Synthetic Goldrush-like page: page colour, a yellow ID card, status-bar "clock" block.
function page({ W = 360, H = 800, bg = [65, 65, 65], clockX = 20 } = {}) {
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; data[i * 4 + 3] = 255; }
  const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; } };
  fill(clockX, 6, clockX + 30, 18, [230, 230, 230]);      // status bar clock
  fill(20, 130, W - 20, 190, [255, 181, 0]);             // ID card
  return { width: W, height: H, data };
}

describe('background classes', () => {
  it('recognises the golden grey, green and navy pages', () => {
    expect(bgClass([65, 65, 65])).toBe('golden grey');
    expect(bgClass([10, 60, 40])).toBe('green');
    expect(bgClass([18, 28, 31])).toBe('navy/teal-black');
    expect(bgClass([30, 30, 30])).toBe('darker grey');
  });
  it('flags a green page as a definite fake', () => {
    const a = analyzeImage(page({ bg: [8, 56, 38] }));
    expect(a.green).toBe(true);
    const ev = evaluate({ analysis: a });
    expect(ev.verdict).toBe('definite');
    expect(ev.isFake).toBe(true);
    expect(ev.flags.map(f => f.code)).toContain('GREEN_THEME');
  });
  it('passes a plain golden-grey page', () => {
    const ev = evaluate({ analysis: analyzeImage(page()) });
    expect(ev.isFake).toBe(false);
  });
});

describe('status-bar fingerprints', () => {
  it('match the same screenshot and differ when the clock moves', () => {
    const a = statusBarFingerprint(page());
    const same = statusBarFingerprint(page());
    const moved = statusBarFingerprint(page({ clockX: 120 }));
    expect(fingerprintDistance(a, same)).toBe(0);
    expect(fingerprintDistance(a, moved)).toBeGreaterThanOrEqual(FP_MATCH_THRESHOLD);
  });
  it('signature prefilter never rejects a true match', () => {
    const a = statusBarFingerprint(page());
    expect(signatureMayMatch(fingerprintSignature(a), fingerprintSignature(statusBarFingerprint(page())))).toBe(true);
  });
  it('round-trips through base64 storage', () => {
    const a = statusBarFingerprint(page());
    expect(Array.from(fpFromBase64(fpToBase64(a)))).toEqual(Array.from(a));
  });
});

describe('evaluate', () => {
  const analysis = { green: false, fpContrast: 200, fullScreen: true, indicators: [], bgClass: 'golden grey' };
  it('flags a status bar frozen across two earlier days', () => {
    const ev = evaluate({ analysis, now: '2026-10-06T10:00:00Z', statusMatches: [{ visit_date: '2026-10-01', captured_at: '2026-10-01T09:00:00Z' }, { visit_date: '2026-10-03', captured_at: '2026-10-03T12:00:00Z' }] });
    expect(ev.verdict).toBe('definite');
    expect(ev.flags[0].code).toBe('REUSED_STATUS_BAR');
  });
  it('needs at least two earlier matches', () => {
    const ev = evaluate({ analysis, now: '2026-10-06T10:00:00Z', statusMatches: [{ visit_date: '2026-10-01', captured_at: '2026-10-01T09:00:00Z' }] });
    expect(ev.verdict).toBe('pass');
  });
  it('ignores matches minutes apart on the same day (one sitting is plausible)', () => {
    const ev = evaluate({ analysis, now: '2026-10-06T10:05:00Z', statusMatches: [{ visit_date: '2026-10-06', captured_at: '2026-10-06T10:00:00Z' }, { visit_date: '2026-10-06', captured_at: '2026-10-06T10:02:00Z' }] });
    expect(ev.verdict).toBe('pass');
  });
  it('treats an impossible ID shown in the photo as definite, a typed one as review', () => {
    expect(evaluate({ analysis, typedId: '670549137', extractedId: '670549137', frontier: 496000000 }).verdict).toBe('definite');
    expect(evaluate({ analysis, typedId: '670549137', extractedId: '496000001', frontier: 496000000 }).verdict).toBe('review');
    expect(evaluate({ analysis, typedId: '496100000', extractedId: '496100000', frontier: 496000000 }).verdict).toBe('pass');
  });
  it('rates 4+ typography failures definite (0 of 5,305 golden in the back-test)', () => {
    const four = [1, 2, 3, 4].map(n => ({ code: 'C' + n, detail: 'd' + n }));
    expect(evaluate({ analysis: { ...analysis, indicators: four } }).verdict).toBe('definite');
  });
  it('ignores a frozen status bar on a cropped (not full-screen) image', () => {
    const ev = evaluate({ analysis: { ...analysis, fullScreen: false }, now: '2026-10-06T10:00:00Z', statusMatches: [{ visit_date: '2026-10-01', captured_at: '2026-10-01T09:00:00Z' }, { visit_date: '2026-10-03', captured_at: '2026-10-03T12:00:00Z' }] });
    expect(ev.verdict).toBe('pass');
  });
  it('rates 3 typography failures likely, not definite', () => {
    const ev = evaluate({ analysis: { ...analysis, indicators: [{ code: 'A', detail: 'a' }, { code: 'B', detail: 'b' }, { code: 'C', detail: 'c' }] } });
    expect(ev.verdict).toBe('likely');
    expect(ev.isFake).toBe(false);
  });
  it('uses the exact agent-facing message', () => {
    expect(FAKE_MESSAGE).toBe('This image has been detected as fake and fraudulent. You have been flagged.');
  });
});

describe('status bar clock', () => {
  it('normalises clock readings', () => {
    expect(normaliseClock('09:27')).toBe('9:27');
    expect(normaliseClock('13.08')).toBe('13:08');
    expect(normaliseClock('25:00')).toBeNull();
    expect(normaliseClock(null)).toBeNull();
  });
  it('crops the status bar into a decodable JPEG', () => {
    const url = statusBarCropDataUrl(page());
    const img = decodeJpeg(dataUrlToBytes(url));
    expect(img.width).toBe(360);
    expect(img.height).toBe(27);
  });
});

describe('idFrontier', () => {
  it('is the 95th percentile of recent IDs, ignoring junk', () => {
    const ids = Array.from({ length: 100 }, (_, i) => String(496000000 + i * 1000)).concat(['123', 'abc']);
    expect(idFrontier(ids)).toBe(496094000);
    expect(idFrontier(['496000000'])).toBeNull();
  });
});

describe('jpeg decode path', () => {
  it('decodes a data URL produced by an encoder', () => {
    const raw = page({ W: 64, H: 128 });
    const enc = jpeg.encode({ data: raw.data, width: 64, height: 128 }, 90);
    let bin = ''; for (const b of enc.data) bin += String.fromCharCode(b);
    const img = decodeJpeg(dataUrlToBytes('data:image/jpeg;base64,' + btoa(bin)));
    expect(img.width).toBe(64);
    expect(img.height).toBe(128);
  });
});

describe('AI Check aggregation', () => {
  it('picks the most severe verdict per check-in', () => {
    expect(worstVerdict(['review', 'definite', 'likely'])).toBe('definite');
    expect(worstVerdict([])).toBe('pass');
  });
  it('lets the latest manual review override the rule verdict', () => {
    const rule = { source: 'ruleset', verdict: 'definite', created_at: '2026-10-01 08:00:00' };
    expect(visitVerdict([rule])).toBe('definite');
    expect(visitVerdict([rule, { source: 'manual', verdict: 'pass', created_at: '2026-10-02 08:00:00' }])).toBe('pass');
    expect(visitVerdict([
      { source: 'ruleset', verdict: 'likely', created_at: '2026-10-01 08:00:00' },
      { source: 'manual', verdict: 'pass', created_at: '2026-10-02 08:00:00' },
      { source: 'manual', verdict: 'definite', created_at: '2026-10-03 08:00:00' },
    ])).toBe('definite');
  });
  it('counts definite fakes out of the reportable total', () => {
    const rows = [{ a: 'x', verdict: 'definite' }, { a: 'x', verdict: 'likely' }, { a: 'x', verdict: 'pass' }, { a: 'x', verdict: 'pass' }];
    const [t] = tally(rows, r => r.a);
    expect(t.total).toBe(4);
    expect(t.counted).toBe(3);
    expect(t.flagged_pct).toBe(50);
  });
});
