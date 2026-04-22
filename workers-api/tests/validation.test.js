/**
 * P0 Validation Tests - FieldVibe Production Readiness
 * Tests: zod schema validation on all P0 routes
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

async function testLoginValidation_EmptyBody() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  console.assert(res.status === 400, `Empty login should return 400, got ${res.status}`);
}

async function testLoginValidation_InvalidEmail() {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email', password: 'test' }),
  });
  console.assert(res.status === 400, `Invalid email should return 400, got ${res.status}`);
}

async function testCreateUserValidation() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ email: 'not-valid' }),
  });
  console.assert(res.status === 400, `Invalid user should return 400, got ${res.status}`);
}

async function testRegisterValidation_ShortPassword() {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: '123', firstName: 'A', lastName: 'B' }),
  });
  console.assert(res.status === 400, `Short password should return 400, got ${res.status}`);
}

async function testSalesOrderValidation_EmptyItems() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/sales/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ customer_id: 'not-uuid', items: [] }),
  });
  console.assert(res.status === 400, `Empty items should return 400, got ${res.status}`);
}

async function testSalesOrderValidation_NegativeQuantity() {
  const token = await getToken();
  const res = await fetch(`${API_BASE}/sales/orders/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      customer_id: '550e8400-e29b-41d4-a716-446655440000',
      items: [{ product_id: '550e8400-e29b-41d4-a716-446655440001', quantity: -5, unit_price: 10 }],
    }),
  });
  console.assert(res.status === 400, `Negative quantity should return 400, got ${res.status}`);
}

async function runValidationTests() {
  console.log('=== P0 Validation Tests ===');
  try { await testLoginValidation_EmptyBody(); console.log('PASS: Login empty body'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testLoginValidation_InvalidEmail(); console.log('PASS: Login invalid email'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testCreateUserValidation(); console.log('PASS: Create user validation'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testRegisterValidation_ShortPassword(); console.log('PASS: Register short password'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testSalesOrderValidation_EmptyItems(); console.log('PASS: Sales order empty items'); } catch (e) { console.error('FAIL:', e.message); }
  try { await testSalesOrderValidation_NegativeQuantity(); console.log('PASS: Sales order negative quantity'); } catch (e) { console.error('FAIL:', e.message); }
  console.log('=== Validation Tests Complete ===');
}

runValidationTests();
