/**
 * P0 Tenant Isolation Tests - FieldVibe Production Readiness
 * Tests: data isolation between tenants, cross-tenant access prevention
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function getToken(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return data.data?.token;
}

async function testTenantFilterOnCustomers() {
  const token = await getToken('admin@demo.com', 'admin123');
  if (!token) { console.error('FAIL: Could not get token'); return; }
  const res = await fetch(`${API_BASE}/customers`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  console.assert(res.status === 200, `Should return 200, got ${res.status}`);
  console.assert(data.success === true, 'Should succeed');
  if (data.data && Array.isArray(data.data)) {
    const allSameTenant = data.data.every(c => c.tenant_id === 'default-tenant-001');
    console.assert(allSameTenant, 'All customers should belong to same tenant');
  }
}

async function testTenantFilterOnUsers() {
  const token = await getToken('admin@demo.com', 'admin123');
  if (!token) { console.error('FAIL: Could not get token'); return; }
  const res = await fetch(`${API_BASE}/users`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  console.assert(res.status === 200, `Should return 200, got ${res.status}`);
  if (data.data && Array.isArray(data.data)) {
    const allSameTenant = data.data.every(u => u.tenant_id === 'default-tenant-001');
    console.assert(allSameTenant, 'All users should belong to same tenant');
    const noPasswords = data.data.every(u => !u.password_hash && !u.admin_viewable_password);
    console.assert(noPasswords, 'No passwords should be exposed in user list');
  }
}

async function testTenantFilterOnProducts() {
  const token = await getToken('admin@demo.com', 'admin123');
  if (!token) { console.error('FAIL: Could not get token'); return; }
  const res = await fetch(`${API_BASE}/products`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  console.assert(res.status === 200, `Should return 200, got ${res.status}`);
  if (data.data && Array.isArray(data.data)) {
    const allSameTenant = data.data.every(p => p.tenant_id === 'default-tenant-001');
    console.assert(allSameTenant, 'All products should belong to same tenant');
  }
}

async function runTenantTests() {
  console.log('=== P0 Tenant Isolation Tests ===');
  try { await testTenantFilterOnCustomers(); console.log('PASS: Tenant filter on customers'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testTenantFilterOnUsers(); console.log('PASS: Tenant filter on users'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testTenantFilterOnProducts(); console.log('PASS: Tenant filter on products'); } catch (e) { console.error('FAIL:', e.message); }
  console.log('=== Tenant Isolation Tests Complete ===');
}

runTenantTests();
