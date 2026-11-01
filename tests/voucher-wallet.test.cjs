const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { createVoucherApi, collectionError } = require('../src/services/voucherApi.ts');
const voucher = { id: 'voucher', code: 'SAVE', restaurant_id: null, discount_type: 'fixed', discount_value: 5000, min_order_value: 20000, expiry_date: null, is_active: true };
const item = { foodId: 'food', restaurantId: 'restaurant', unitPrice: 40000, quantity: 1, options: [], note: '' };
function fixture(respond, authId = 'user') {
  const requests = [];
  const client = createClient('https://voucher.test.supabase.co', 'key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, init) => {
      const request = { url: new URL(url), body: init.body && JSON.parse(init.body) };
      requests.push(request);
      const result = respond(request);
      return new Response(JSON.stringify(result.body), { status: result.status || 200, headers: { 'content-type': 'application/json' } });
    } },
  });
  client.auth.getUser = async () => ({ data: { user: { id: authId } }, error: null });
  return { api: createVoucherApi(client), requests };
}
test('wallet joins vouchers and filters both owner and unused flag; missing relation is not displayed', async () => {
  const f = fixture(() => ({ body: [{ voucher }, { voucher: null }] }));
  assert.deepEqual(await f.api.wallet('user'), [voucher]);
  const params = f.requests[0].url.searchParams;
  assert.equal(params.get('user_id'), 'eq.user');
  assert.equal(params.get('is_used'), 'eq.false');
  assert.equal(params.get('select'), 'voucher:vouchers!voucher_id(*)');
});
test('collection uses authenticated RPC without a caller-controlled owner or used flag', async () => {
  const f = fixture(() => ({ body: voucher }));
  assert.equal((await f.api.collect('user', voucher.id)).code, 'SAVE');
  assert.equal(f.requests[0].url.pathname, '/rest/v1/rpc/collect_my_voucher');
  assert.deepEqual(f.requests[0].body, { p_voucher_id: voucher.id });
  await assert.rejects(f.api.collect('other', voucher.id), /đăng nhập đã thay đổi/);
  assert.equal(f.requests.length, 1);
});

test('voucher history only reads this customer used wallet entries and propagates errors', async () => {
  const f = fixture(() => ({ body: [{ voucher }, { voucher: null }] }));
  assert.deepEqual(await f.api.usedWallet('user'), [voucher]);
  const params = f.requests[0].url.searchParams;
  assert.equal(params.get('user_id'), 'eq.user');
  assert.equal(params.get('is_used'), 'eq.true');
  const failed = fixture(() => ({ status: 403, body: { message: 'Denied' } }));
  await assert.rejects(failed.api.usedWallet('user'), error => error.message === 'Denied');
});
test('manual code validates before collection and normalizes exact code', async () => {
  const f = fixture(r => ({ body: r.url.pathname.endsWith('/vouchers') ? [voucher] : voucher }));
  assert.equal((await f.api.collectForOrder('user', ' save ', [item])).id, voucher.id);
  assert.equal(f.requests[0].url.searchParams.get('code'), 'eq.SAVE');
  assert.equal(f.requests[1].url.pathname, '/rest/v1/rpc/collect_my_voucher');
  const invalid = fixture(() => ({ body: [{ ...voucher, min_order_value: 90000 }] }));
  await assert.rejects(invalid.api.collectForOrder('user', 'SAVE', [item]), /tối thiểu/);
  assert.equal(invalid.requests.length, 1);
});
test('manual entry propagates used/expired collection rejection and checks changed voucher values', async () => {
  const f = fixture(r => r.url.pathname.endsWith('/vouchers') ? { body: [voucher] } : { status: 400, body: { message: 'Mã đã sử dụng' } });
  await assert.rejects(f.api.collectForOrder('user', 'SAVE', [item]), e => /đã sử dụng/.test(e.message));
  const changed = fixture(r => ({ body: r.url.pathname.endsWith('/vouchers') ? [voucher] : { ...voucher, restaurant_id: 'other' } }));
  await assert.rejects(changed.api.collectForOrder('user', 'SAVE', [item]), /quán khác/);
});
test('campaign treats inactive, expired and invalid dates as exhausted; future and unlimited valid', () => {
  assert.equal(collectionError(voucher), null);
  assert.equal(collectionError({ ...voucher, is_active: false }), 'Cháy hàng');
  assert.equal(collectionError({ ...voucher, expiry_date: '2020-01-01' }), 'Cháy hàng');
  assert.equal(collectionError({ ...voucher, expiry_date: 'bad' }), 'Cháy hàng');
  assert.equal(collectionError({ ...voucher, expiry_date: '2030-01-01' }, Date.parse('2026-10-26')), null);
});
