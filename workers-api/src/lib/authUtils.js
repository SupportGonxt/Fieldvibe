// Moved verbatim from index.js.

// ==================== PHONE NORMALIZATION ====================
function normalizePhone(phone) {
  if (!phone) return null;
  let normalized = phone.replace(/[\s\-]/g, '');
  if (normalized.startsWith('0')) normalized = '+27' + normalized.substring(1);
  else if (normalized.startsWith('27') && !normalized.startsWith('+27')) normalized = '+' + normalized;
  else if (!normalized.startsWith('+')) normalized = '+27' + normalized;
  return normalized;
}

// ==================== JWT HELPERS ====================
async function generateToken(payload, secret, expiresIn = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: now + expiresIn };
  const base64Header = btoa(JSON.stringify(header));
  const base64Payload = btoa(JSON.stringify(tokenPayload));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(base64Header + '.' + base64Payload));
  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64Header + '.' + base64Payload + '.' + base64Signature;
}

export { normalizePhone, generateToken };
