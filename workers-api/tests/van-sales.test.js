/**
 * P0 Van Sales Tests - FieldVibe Production Readiness
 * Tests: van loads, van sales, reconciliation
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function getToken() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.com', password: 'admin123' }),
  });
  const data = await res.json();
  return data.data?.token;
}

async function testVanSalesDashboard() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/van-sales/dashboard`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  console.assert(res.status === 200, `Should return 200, got ${res.status}`);
  console.assert(data.success === true, 'Should succeed');
}

async function testListVanLoads() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/van-sales/loads`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  console.assert(res.status === 200, `Should return 200, got ${res.status}`);
}

async function testListReconciliations() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/van-sales/reconciliations`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  console.assert(res.status === 200, `Should return 200, got ${res.status}`);
}

async function runVanSalesTests() {
  console.log('=== P0 Van Sales Tests ===');
  try { await testVanSalesDashboard(); console.log('PASS: Van sales dashboard'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testListVanLoads(); console.log('PASS: List van loads'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testListReconciliations(); console.log('PASS: List reconciliations'); } catch (e) { console.error('FAIL:', e.message); }
  console.log('=== Van Sales Tests Complete ===');
}

runVanSalesTests();
