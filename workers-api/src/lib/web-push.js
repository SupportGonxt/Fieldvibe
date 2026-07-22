/**
 * Web Push over WebCrypto — no npm dep (the `web-push` package assumes Node
 * crypto). Implements VAPID (RFC 8292) auth + aes128gcm payload encryption
 * (RFC 8291). ~120 lines; Cloudflare Workers has the ECDH/HKDF/AES-GCM/ECDSA
 * primitives WebCrypto exposes, so no runtime shims needed.
 *
 * ponytail: hand-rolled because every maintained lib pulls Node `crypto`.
 * If a Workers-native web-push lib appears, swap sendPush's body for it.
 */

const enc = new TextEncoder();

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(bytes) {
  let bin = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...arrs) {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

// --- VAPID JWT (ES256) -------------------------------------------------------
async function vapidToken(audience, subject, publicKeyB64, privateD) {
  const pub = b64urlToBytes(publicKeyB64); // 65-byte 0x04||x||y
  const jwk = {
    kty: 'EC', crv: 'P-256', d: privateD,
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    ext: true,
  };
  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };
  const signingInput =
    bytesToB64url(enc.encode(JSON.stringify(header))) + '.' +
    bytesToB64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(signingInput)
  );
  return signingInput + '.' + bytesToB64url(sig); // sig is raw r||s (64 bytes)
}

// --- aes128gcm payload encryption (RFC 8291) ---------------------------------
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8
  ));
}

async function encryptPayload(plaintext, p256dhB64, authB64) {
  const uaPublicRaw = b64urlToBytes(p256dhB64);   // 65 bytes
  const authSecret = b64urlToBytes(authB64);      // 16 bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const asKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
  );
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaPublicKey = await crypto.subtle.importKey(
    'raw', uaPublicRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaPublicKey }, asKeys.privateKey, 256
  ));

  // ikm = HKDF(salt=authSecret, ikm=ecdhSecret, info="WebPush: info\0"||ua||as, 32)
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublicRaw, asPublicRaw);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);

  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const record = concat(plaintext, new Uint8Array([0x02])); // single-record delimiter
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, record
  ));

  // aes128gcm header: salt(16) || rs(4 = 4096) || idlen(1=65) || keyid(as_public)
  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]);
  const header = concat(salt, rs, new Uint8Array([asPublicRaw.length]), asPublicRaw);
  return concat(header, ct);
}

/**
 * Send one Web Push. Returns true on 2xx, false otherwise (410/404 = expired
 * subscription; caller may prune). Never throws — a failed ring must not break
 * the call-start flow.
 */
export async function sendPush(env, subscription, payloadObj) {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return false;
  try {
    const url = new URL(subscription.endpoint);
    const audience = url.origin;
    const subject = env.VAPID_SUBJECT || 'mailto:admin@fieldvibe.app';
    const jwt = await vapidToken(audience, subject, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    const body = await encryptPayload(
      enc.encode(JSON.stringify(payloadObj)), subscription.p256dh, subscription.auth
    );
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '60',
        Urgency: 'high',
      },
      body,
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

// Exposed for the pure VAPID-shape unit test.
export const _internal = { vapidToken, bytesToB64url, b64urlToBytes };
