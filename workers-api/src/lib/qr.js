// QR tracking-step helpers. Pure, portable across Workers and Node (no Buffer/btoa),
// so they unit-test under the node vitest config.

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function bytesToBase64Url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64URL[b0 >> 2];
    out += B64URL[((b0 & 3) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) out += B64URL[((b1 & 15) << 2) | (b2 >> 6)];
    if (i + 2 < bytes.length) out += B64URL[b2 & 63];
  }
  return out;
}

// 128-bit opaque, unguessable scan token (22 base64url chars).
export function generateQrToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

// Open-redirect guard: only absolute http(s) URLs are safe redirect targets.
export function isSafeDestinationUrl(url) {
  if (typeof url !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

// Public scan URL encoded into the QR image. Tolerates a trailing slash on the base.
export function buildScanUrl(token, baseUrl) {
  return `${String(baseUrl).replace(/\/+$/, '')}/s/${token}`;
}
