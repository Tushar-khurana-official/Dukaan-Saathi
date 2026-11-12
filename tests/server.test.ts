import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';

// Test-only settings, set before the app module is loaded.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-test-'));
process.env.DATA_DIR = dataDir;
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = 'admin-test-password';
process.env.SESSION_SECRET = 'test-secret-test-secret-1234';
delete process.env.DATABASE_URL;
delete process.env.GEMINI_API_KEY;

const { hashPassword, verifyPassword, signSession, readSession } = await import('../src/server/auth');
const { computeShopStats } = await import('../src/server/stats');
const { app } = await import('../src/server/app');
const { initialCustomers, initialTransactions, initialProducts, initialShopProfile } = await import('../src/utils/seedData');

let server: Server;
let base = '';

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function call(method: string, url: string, body?: unknown, cookie?: string) {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, json: (await res.json()) as Record<string, any>, cookie: setCookie ? setCookie.split(';')[0] : undefined };
}

test('passwords are hashed and verified', () => {
  const h = hashPassword('secret-pass');
  assert.ok(!h.includes('secret-pass'));
  assert.equal(verifyPassword('secret-pass', h), true);
  assert.equal(verifyPassword('wrong-pass', h), false);
});

test('tampered sessions are rejected', () => {
  const token = signSession({ role: 'shop', sub: 'shop_1' });
  assert.equal(readSession(token)?.sub, 'shop_1');
  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ role: 'admin', sub: 'admin', exp: 9e9 })).toString('base64url');
  assert.equal(readSession(`${forged}.${sig}`), null);
  assert.equal(readSession(`${payload}.x${sig.slice(1)}`), null);
});

test('admin stats contain no customer names or phone numbers', () => {
  const stats = computeShopStats({
    profile: initialShopProfile,
    customers: initialCustomers,
    transactions: initialTransactions,
    reminders: [],
    catalog: initialProducts,
    scans: [],
    reorder: [],
  });
  const text = JSON.stringify(stats);
  for (const c of initialCustomers) {
    assert.ok(!text.includes(c.name), c.name);
    if (c.phone) assert.ok(!text.includes(c.phone), c.phone);
  }
  assert.equal(stats.customers, initialCustomers.length);
});

test('end to end: admin creates a vendor, vendor syncs, admin sees totals only, vendors are isolated', async () => {
  const bad = await call('POST', '/api/auth/login', { email: 'admin@example.test', password: 'nope' });
  assert.equal(bad.status, 401);

  const admin = await call('POST', '/api/auth/login', { email: 'admin@example.test', password: 'admin-test-password' });
  assert.equal(admin.json.role, 'admin');

  const created = await call('POST', '/api/admin/shops', { email: 'v1@example.test', password: 'vendor-pass-1', name: 'Shop One', owner: 'A' }, admin.cookie);
  assert.equal(created.status, 200);
  assert.equal(created.json.shop.password_hash, undefined);

  const v1 = await call('POST', '/api/auth/login', { email: 'v1@example.test', password: 'vendor-pass-1' });
  assert.equal(v1.json.role, 'shop');
  const v2 = await call('POST', '/api/auth/signup', { email: 'v2@example.test', password: 'vendor-pass-2', shopName: 'Shop Two', ownerName: 'B' });
  assert.equal(v2.json.role, 'shop');

  const data = {
    profile: { ...initialShopProfile, name: 'Shop One' },
    customers: initialCustomers,
    transactions: initialTransactions,
    reminders: [],
    catalog: initialProducts,
    scans: [],
    reorder: [],
  };
  assert.equal((await call('PUT', '/api/shop/data', { data }, v1.cookie)).status, 200);

  // v1 gets its own data back; v2 gets nothing of v1's
  const back1 = await call('GET', '/api/shop/data', undefined, v1.cookie);
  assert.equal(back1.json.data.customers.length, initialCustomers.length);
  const back2 = await call('GET', '/api/shop/data', undefined, v2.cookie);
  assert.equal(back2.json.data, null);

  // vendors cannot use admin routes
  assert.equal((await call('GET', '/api/admin/shops', undefined, v1.cookie)).status, 401);

  // admin sees totals but no customer names or phones
  const list = await call('GET', '/api/admin/shops', undefined, admin.cookie);
  const listText = JSON.stringify(list.json);
  assert.ok(listText.includes('Shop One'));
  for (const c of initialCustomers) assert.ok(!listText.includes(c.name), `admin list leaked ${c.name}`);
  const overview = await call('GET', '/api/admin/overview', undefined, admin.cookie);
  assert.equal(overview.json.shops_total, 2);
  assert.equal(overview.json.customers_total, initialCustomers.length);

  // suspend blocks login and sync
  const id = created.json.shop.id;
  await call('PATCH', `/api/admin/shops/${id}`, { status: 'suspended' }, admin.cookie);
  assert.equal((await call('POST', '/api/auth/login', { email: 'v1@example.test', password: 'vendor-pass-1' })).status, 403);
  assert.equal((await call('PUT', '/api/shop/data', { data }, v1.cookie)).status, 403);

  // password reset and delete
  await call('PATCH', `/api/admin/shops/${id}`, { status: 'active' }, admin.cookie);
  await call('POST', `/api/admin/shops/${id}/password`, { password: 'new-pass-123' }, admin.cookie);
  assert.equal((await call('POST', '/api/auth/login', { email: 'v1@example.test', password: 'new-pass-123' })).status, 200);
  await call('DELETE', `/api/admin/shops/${id}`, undefined, admin.cookie);
  assert.equal((await call('POST', '/api/auth/login', { email: 'v1@example.test', password: 'new-pass-123' })).status, 401);
});

test('AI endpoints need a login; shelf photo without an AI key returns an error, not fake results', async () => {
  assert.equal((await call('POST', '/api/gemini/parse-khata', { text: 'Sharma ji ko 500' })).status, 401);
  const v = await call('POST', '/api/auth/signup', { email: 'v3@example.test', password: 'vendor-pass-3', shopName: 'Shop Three', ownerName: 'C' });
  const shelf = await call('POST', '/api/gemini/analyze-shelf', { imageBase64: 'abc' }, v.cookie);
  assert.equal(shelf.status, 503);
  assert.equal(shelf.json.products, undefined);
});

test('statement link: shows one customer their entries and balance, no phone; wrong or removed key -> 404', async () => {
  const { makeStatementToken } = await import('../src/lib/statement');
  const v = await call('POST', '/api/auth/signup', { email: 'v4@example.test', password: 'vendor-pass-4', shopName: 'Shop Four', ownerName: 'D' });
  const shopId = v.json.shop.id;
  const key = 'a'.repeat(36);
  const customers = initialCustomers.map((c) => (c.id === 'c-1' ? { ...c, statement_key: key } : c));
  const data = { profile: { ...initialShopProfile, name: 'Shop Four' }, customers, transactions: initialTransactions, reminders: [], catalog: [], scans: [], reorder: [] };
  assert.equal((await call('PUT', '/api/shop/data', { data }, v.cookie)).status, 200);

  const ok = await call('GET', `/api/statement/${makeStatementToken(shopId, 'c-1', key)}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.customer.name, initialCustomers[0].name);
  assert.equal(ok.json.shop.name, 'Shop Four');
  assert.ok(ok.json.entries.length > 0);
  const text = JSON.stringify(ok.json);
  for (const c of initialCustomers) {
    if (c.phone) assert.ok(!text.includes(c.phone), 'phone leaked');
    if (c.id !== 'c-1') assert.ok(!text.includes(c.name), `other customer leaked: ${c.name}`);
  }

  assert.equal((await call('GET', `/api/statement/${makeStatementToken(shopId, 'c-1', 'b'.repeat(36))}`)).status, 404);
  assert.equal((await call('GET', `/api/statement/${makeStatementToken(shopId, 'c-2', key)}`)).status, 404); // no link for c-2
  // turning the link off
  const off = { ...data, customers: customers.map((c) => ({ ...c, statement_key: null })) };
  await call('PUT', '/api/shop/data', { data: off }, v.cookie);
  assert.equal((await call('GET', `/api/statement/${makeStatementToken(shopId, 'c-1', key)}`)).status, 404);
});
