import { describe, it, expect } from 'vitest';
import { generateQrToken, isSafeDestinationUrl, buildScanUrl } from '../../src/lib/qr.js';

describe('generateQrToken', () => {
  it('returns a URL-safe token of stable length', () => {
    const t = generateQrToken();
    expect(typeof t).toBe('string');
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/); // base64url charset, no padding
    expect(t.length).toBeGreaterThanOrEqual(22); // 16 random bytes -> 22 base64url chars
  });
  it('is unique across many calls', () => {
    const seen = new Set();
    for (let i = 0; i < 1000; i++) seen.add(generateQrToken());
    expect(seen.size).toBe(1000);
  });
});

describe('isSafeDestinationUrl (open-redirect guard)', () => {
  it('accepts absolute http and https URLs', () => {
    expect(isSafeDestinationUrl('https://promo.example.com/signup')).toBe(true);
    expect(isSafeDestinationUrl('http://example.com')).toBe(true);
    expect(isSafeDestinationUrl('https://example.com/path?q=1#frag')).toBe(true);
  });
  it('rejects dangerous schemes, relative, and non-strings', () => {
    expect(isSafeDestinationUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeDestinationUrl('data:text/html,<script>')).toBe(false);
    expect(isSafeDestinationUrl('  javascript:alert(1)')).toBe(false); // leading space
    expect(isSafeDestinationUrl('JavaScript:alert(1)')).toBe(false); // case
    expect(isSafeDestinationUrl('/relative/path')).toBe(false);
    expect(isSafeDestinationUrl('promo.example.com')).toBe(false); // no scheme
    expect(isSafeDestinationUrl('ftp://example.com')).toBe(false);
    expect(isSafeDestinationUrl('')).toBe(false);
    expect(isSafeDestinationUrl(null)).toBe(false);
    expect(isSafeDestinationUrl(undefined)).toBe(false);
    expect(isSafeDestinationUrl(123)).toBe(false);
  });
});

describe('buildScanUrl', () => {
  it('joins base and token, tolerating a trailing slash on the base', () => {
    expect(buildScanUrl('abc', 'https://api.example.com')).toBe('https://api.example.com/s/abc');
    expect(buildScanUrl('abc', 'https://api.example.com/')).toBe('https://api.example.com/s/abc');
  });
});
