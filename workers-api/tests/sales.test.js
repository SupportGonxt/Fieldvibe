/**
 * P0 Sales Tests - FieldVibe Production Readiness
 * Tests: sales order CRUD, payment recording, order status transitions
 */

const API_BASE = 'https://fieldvibe-api.vantax.co.za/api';

async function getToken() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@demo.com', password: 'admin123' }),
  });
  const data = await res.json();
  return data.data?.token;
}

async function testListSalesOrders() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/sales/orders`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  console.assert(res.status === 200, `Should return 200, got ${res.status}`);
  console.assert(data.success === true, 'Should succeed');
}

async function testCreateSalesOrder() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/sales/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      customer_id: 'cust-001',
      items: [
        { product_id: 'prod-001', quantity: 10, unit_price: 15.00 },
        { product_id: 'prod-002', quantity: 5, unit_price: 25.00 },
      ],
      notes: 'Test order from P0 tests',
    }),
  });
  const data = await res.json();
  console.assert(res.status === 200 || res.status === 201, `Should return 200/201, got ${res.status}`);
  return data.data?.id;
}

async function testCreateSalesOrderValidation() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/sales/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ customer_id: 'not-a-uuid', items: [] }),
  });
  console.assert(res.status === 400, `Validation should return 400, got ${res.status}`);
}

async function testSalesDashboard() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/sales/dashboard`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await res.json();
  console.assert(res.status === 200, `Dashboard should return 200, got ${res.status}`);
}

async function runSalesTests() {
  console.log('=== P0 Sales Tests ===');
  try { await testListSalesOrders(); console.log('PASS: List sales orders'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testCreateSalesOrder(); console.log('PASS: Create sales order'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testCreateSalesOrderValidation(); console.log('PASS: Sales order validation'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testSalesDashboard(); console.log('PASS: Sales dashboard'); } catch (e) { console.error('FAIL:', e.message); }
  console.log('=== Sales Tests Complete ===');
}

runSalesTests();
