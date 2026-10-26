const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { createDriverApi } = require('../src/services/driverApi.ts');
function fixture(order, profile) {
  const requests = [];
  const client = createClient('https://driver.test.supabase.co', 'key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url) => {
    const target = new URL(url); requests.push(target);
    return new Response(JSON.stringify(target.pathname.endsWith('/orders') ? order : profile), { headers: { 'content-type': 'application/json' } });
  } } });
  return { api: createDriverApi(client), requests };
}
test('driver is resolved through the current user order, not an invented profiles foreign key', async () => {
  const profile = { id: 'driver', full_name: 'Nguyễn Văn Tài', phone: '0900000000', avatar_url: null };
  const f = fixture({ id: 'order', driver_id: 'driver' }, profile);
  assert.deepEqual(await f.api.forOrder('order', 'customer'), { driverId: 'driver', profile });
  assert.equal(f.requests[0].searchParams.get('user_id'), 'eq.customer');
  assert.equal(f.requests[0].searchParams.get('id'), 'eq.order');
  assert.equal(f.requests[1].searchParams.get('id'), 'eq.driver');
  assert.equal(f.requests[1].searchParams.get('role'), 'eq.driver');
  assert.equal(f.requests[1].searchParams.get('select'), 'id,full_name,phone,avatar_url');
});
test('unassigned orders never substitute a demo driver or fetch an unrelated profile', async () => {
  const f = fixture({ id: 'order', driver_id: null }, null);
  assert.deepEqual(await f.api.forOrder('order', 'customer'), { driverId: null, profile: null });
  assert.equal(f.requests.length, 1);
});
test('missing orders stop before profile lookup; missing driver profiles remain explicit null', async () => {
  const missing = fixture(null, null);
  await assert.rejects(missing.api.forOrder('order', 'customer'), /Không tìm thấy/);
  assert.equal(missing.requests.length, 1);
  const driverMissing = fixture({ id: 'order', driver_id: 'driver' }, null);
  assert.deepEqual(await driverMissing.api.forOrder('order', 'customer'), { driverId: 'driver', profile: null });
  await assert.rejects(driverMissing.api.forOrder('order', ''), /đăng nhập/);
});
