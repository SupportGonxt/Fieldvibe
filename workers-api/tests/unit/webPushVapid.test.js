import { describe, it, expect } from 'vitest';
import { _internal } from '../../src/lib/web-push.js';

const { vapidToken, bytesToB64url, b64urlToBytes } = _internal;

function b64urlDecodeJson(seg) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(seg)));
}

// Generate an ephemeral P-256 keypair so the test never touches the real VAPID
// secret. Returns { publicB64 (raw 65-byte 0x04||x||y), d } as vapidToken expects.
async function ephemeralKeys() {
  const kp = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
  );
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { publicB64: bytesToB64url(raw), d: jwk.d };
}

describe('b64url', () => {
  it('roundtrips bytes without padding', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255]);
    const s = bytesToB64url(bytes);
    expect(s).not.toMatch(/[+/=]/); // url-safe, unpadded
    expect(Array.from(b64urlToBytes(s))).toEqual(Array.from(bytes));
  });
});

describe('vapidToken', () => {
  it('produces a 3-segment ES256 JWT with aud/exp/sub claims', async () => {
    const { publicB64, d } = await ephemeralKeys();
    const jwt = await vapidToken('https://push.example.com', 'mailto:a@b.co', publicB64, d);

    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);

    const header = b64urlDecodeJson(parts[0]);
    expect(header).toEqual({ typ: 'JWT', alg: 'ES256' });

    const claims = b64urlDecodeJson(parts[1]);
    expect(claims.aud).toBe('https://push.example.com');
    expect(claims.sub).toBe('mailto:a@b.co');
    expect(typeof claims.exp).toBe('number');
    expect(claims.exp).toBeGreaterThan(claims.exp - 1); // exp present & numeric

    // Raw ECDSA P-256 signature is r||s = 64 bytes.
    expect(b64urlToBytes(parts[2]).length).toBe(64);
  });
});
