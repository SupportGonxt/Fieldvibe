import { describe, it, expect } from 'vitest';
import { isLegacyR2PhotoUrl } from '../../src/lib/photoAi.js';

describe('isLegacyR2PhotoUrl (SSRF guard for photo proxy fetch fallback)', () => {
  it('accepts legacy fieldvibe-uploads r2.dev URLs', () => {
    expect(isLegacyR2PhotoUrl('https://fieldvibe-uploads.tenant1.r2.dev/photos/v1/p1.jpg')).toBe(true);
    expect(isLegacyR2PhotoUrl('http://fieldvibe-uploads.abc-123.r2.dev/key')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isLegacyR2PhotoUrl('https://evil.com/steal')).toBe(false);
    expect(isLegacyR2PhotoUrl('https://fieldvibe-uploads.evil.com/x')).toBe(false);
    expect(isLegacyR2PhotoUrl('https://evil.com/fieldvibe-uploads.t.r2.dev/x')).toBe(false);
    expect(isLegacyR2PhotoUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isLegacyR2PhotoUrl('https://fieldvibe-uploads.t.r2.dev.evil.com/x')).toBe(false);
    expect(isLegacyR2PhotoUrl('https://fieldvibe-uploads.t.r2.dev/')).toBe(false); // no key
    expect(isLegacyR2PhotoUrl('/api/uploads/key')).toBe(false); // handled by R2 branch, not fetch
    expect(isLegacyR2PhotoUrl(null)).toBe(false);
    expect(isLegacyR2PhotoUrl(undefined)).toBe(false);
  });
});
