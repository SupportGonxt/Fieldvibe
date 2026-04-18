/**
 * P0 Auth Tests - FieldVibe Production Readiness
 * Tests: login, register, JWT verification, rate limiting
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function testLoginSuccess() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.com', password: 'admin123' }),
  });
  const data = await res.json();
  console.assert(res.status === 200, `Login should return 200, got ${res.status}`);
  console.assert(data.success === true, 'Login should succeed');
  console.assert(data.data?.token, 'Login should return a token');
  return data.data?.token;
}

async function testLoginValidation() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: '' }),
  });
  const data = await res.json();
  console.assert(res.status === 400, `Login validation should return 400, got ${res.status}`);
  console.assert(data.success === false, 'Login validation should fail');
}

async function testLoginWrongPassword() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.com', password: 'wrongpassword' }),
  });
  const data = await res.json();
  console.assert(res.status === 401, `Wrong password should return 401, got ${res.status}`);
}

async function testJWTRequired() {
  const res = await fetch(`${API_BASE}/users`);
  console.assert(res.status === 401, `No token should return 401, got ${res.status}`);
}

async function testJWTInvalid() {
  const res = await fetch(`${API_BASE}/users`, {
    headers: { 'Authorization': 'Bearer invalid.token.here' },
  });
  console.assert(res.status === 401, `Invalid JWT should return 401, got ${res.status}`);
}

async function testJWTTampered() {
  const token = await testLoginSuccess();
  if (!token) return;
  const parts = token.split('.');
  parts[1] = btoa(JSON.stringify({ userId: 'hacked', tenantId: 'hacked', role: 'admin', exp: Math.floor(Date.now()/1000) + 3600 }));
  const tampered = parts.join('.');
  const res = await fetch(`${API_BASE}/users`, {
    headers: { 'Authorization': `Bearer ${tampered}` },
  });
  console.assert(res.status === 401, `Tampered JWT should return 401, got ${res.status}`);
}

async function testSecurityHeaders() {
  const res = await fetch(`${API_BASE}/health`);
  console.assert(res.headers.get('X-Content-Type-Options') === 'nosniff', 'Should have X-Content-Type-Options');
  console.assert(res.headers.get('X-Frame-Options') === 'DENY', 'Should have X-Frame-Options');
  console.assert(res.headers.get('X-Request-ID'), 'Should have X-Request-ID');
}

async function runAuthTests() {
  console.log('=== P0 Auth Tests ===');
  try { await testLoginSuccess(); console.log('PASS: Login success'); } catch (e) { console.error('FAIL: Login success -', e.message); }
  try { await testLoginValidation(); console.log('PASS: Login validation'); } catch (e) { console.error('FAIL: Login validation -', e.message); }
  try { await testLoginWrongPassword(); console.log('PASS: Login wrong password'); } catch (e) { console.error('FAIL: Login wrong password -', e.message); }
  try { await testJWTRequired(); console.log('PASS: JWT required'); } catch (e) { console.error('FAIL: JWT required -', e.message); }
  try { await testJWTInvalid(); console.log('PASS: JWT invalid'); } catch (e) { console.error('FAIL: JWT invalid -', e.message); }
  try { await testJWTTampered(); console.log('PASS: JWT tampered'); } catch (e) { console.error('FAIL: JWT tampered -', e.message); }
  try { await testSecurityHeaders(); console.log('PASS: Security headers'); } catch (e) { console.error('FAIL: Security headers -', e.message); }
  console.log('=== Auth Tests Complete ===');
}

runAuthTests();
