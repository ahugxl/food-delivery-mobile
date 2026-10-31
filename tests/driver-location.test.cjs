const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, f);
const { parseDriverFix, canTrackDriver, driverFixState, driverFixTime } = require('../src/features/location/driverLocation.ts');
const { createDriverApi } = require('../src/services/driverApi.ts');
const now = Date.parse('2026-10-30T12:00:00Z');
const fix = { latitude: 0, longitude: 106, received_at: new Date(now).toISOString(), is_stale: false };

test('real GPS payload keeps zero coordinates; no assignment is null and invalid responses are rejected', () => {
  assert.deepEqual(parseDriverFix(fix), fix);
  assert.equal(parseDriverFix(null), null);
  for (const input of [[], {}, { ...fix, latitude: 91 }, { ...fix, longitude: NaN }, { ...fix, received_at: 'bad' }, { ...fix, is_stale: 'false' }]) {
    assert.throws(() => parseDriverFix(input), /không hợp lệ/);
  }
});

test('completed/cancelled/unassigned orders never display a cached live marker', () => {
  for (const status of ['completed','cancelled']) {
    assert.equal(canTrackDriver(status, 'driver'), false);
    assert.equal(driverFixState({ status, driverId: 'driver', fix, loading: false, error: false }, now), 'inactive');
  }
  assert.equal(driverFixState({ status: 'preparing', driverId: null, fix, loading: false, error: false }, now), 'unassigned');
  assert.equal(canTrackDriver('pending','driver'), false);
  assert.equal(canTrackDriver('preparing','driver'), true);
  assert.equal(canTrackDriver('delivering','driver'), true);
});

test('stale server flag or aged cache hides GPS; errors and waiting never become simulated positions', () => {
  const input = { status: 'delivering', driverId: 'driver', fix, loading: false, error: false };
  assert.equal(driverFixState(input,now), 'live');
  assert.equal(driverFixState(input,now+120000), 'stale');
  assert.equal(driverFixState({ ...input, fix: { ...fix, is_stale: true } },now), 'stale');
  assert.equal(driverFixState(input,now-61000), 'stale');
  assert.equal(driverFixState({ ...input, error: true },now), 'error');
  assert.equal(driverFixState({ ...input, fix: null },now), 'waiting');
  assert.equal(driverFixState({ ...input, fix: null, loading: true },now), 'loading');
  assert.match(driverFixTime(fix.received_at), /19.*00.*00/);
});

test('GPS API uses the ownership-checked RPC, sends only the order ID and supports cancellation', async () => {
  const calls = [];
  const client = createClient('https://driver.test.supabase.co','key',{ auth: { persistSession:false,autoRefreshToken:false }, global: { fetch: async (url, init) => {
    calls.push({ url:new URL(url), body:JSON.parse(init.body) });
    if (init.signal?.aborted) throw new DOMException('Aborted','AbortError');
    return new Response(JSON.stringify(fix),{headers:{'content-type':'application/json'}});
  } } });
  const api = createDriverApi(client);
  assert.deepEqual(await api.locationForOrder('order'),fix);
  assert.equal(calls[0].url.pathname,'/rest/v1/rpc/order_driver_location');
  assert.deepEqual(calls[0].body,{p_order_id:'order'});
  const cancel = new AbortController(); cancel.abort();
  await assert.rejects(api.locationForOrder('order',cancel.signal));
  await assert.rejects(api.locationForOrder(''),/chọn đơn/);
});

test('GPS API preserves RPC denial instead of inventing a driver point', async () => {
  const client = createClient('https://driver.test.supabase.co','key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async()=>new Response(JSON.stringify({code:'42501',message:'denied'}),{status:403,headers:{'content-type':'application/json'}})}});
  await assert.rejects(createDriverApi(client).locationForOrder('order'),error=>error.code==='42501');
  await assert.rejects(createDriverApi(null).locationForOrder('order'),/cấu hình/);
});
