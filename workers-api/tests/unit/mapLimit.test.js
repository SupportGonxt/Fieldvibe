import { describe, it, expect } from 'vitest';
import { mapLimit } from '../../src/lib/aggregates.js';

describe('mapLimit', () => {
  it('preserves input order regardless of completion order', async () => {
    const out = await mapLimit([50, 10, 30, 0, 20], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(out).toEqual([50, 10, 30, 0, 20]);
  });

  it('never exceeds the concurrency cap', async () => {
    let live = 0, peak = 0;
    await mapLimit(Array.from({ length: 25 }, (_, i) => i), 4, async () => {
      live++; peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
    });
    expect(peak).toBe(4);
  });

  it('runs every item exactly once', async () => {
    const seen = [];
    await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => { seen.push(n); });
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('handles an empty list and a cap larger than the list', async () => {
    expect(await mapLimit([], 5, async () => 1)).toEqual([]);
    expect(await mapLimit([1, 2], 99, async (n) => n * 2)).toEqual([2, 4]);
  });

  it('rejects if a task rejects, rather than resolving with a hole', async () => {
    await expect(mapLimit([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    })).rejects.toThrow('boom');
  });
});
