const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { UsageAnalytics, usageScreen } = require('../src/features/analytics/usage.ts');
function fixture() {
  const calls = [];
  const analytics = new UsageAnalytics({
    capture: (...args) => calls.push(['capture', ...args]),
    identify: id => calls.push(['identify', id]), reset: () => calls.push(['reset']),
    flush: async () => calls.push(['flush']),
  }, { app: 'soopifood-customer', environment: 'test', platform: 'web' });
  return { analytics, calls, events: name => calls.filter(c => c[0] === 'capture' && c[1] === name) };
}
test('routes only report static screen labels, never IDs, tokens or URLs', () => {
  assert.equal(usageScreen(['food', '[id]']), 'food_detail');
  assert.equal(usageScreen(['(tabs)', 'index']), 'home');
  assert.equal(usageScreen(['oauth-callback']), 'oauth_callback');
  assert.equal(usageScreen(['secret@example.com?access_token=private']), 'other');
});
test('restored identities reset once; logout and account switches are isolated', () => {
  const { analytics: a, calls, events } = fixture();
  a.syncUser('user-a'); a.syncUser('user-a'); a.screenViewed('home'); a.screenViewed('home');
  assert.deepEqual(calls.slice(0, 2), [['reset'], ['identify', 'user-a']]);
  assert.equal(events('screen_viewed').length, 1);
  a.syncUser(null); a.screenViewed('welcome');
  assert.equal(events('screen_viewed').at(-1)[2].authenticated, false);
  a.syncUser('user-b');
  assert.deepEqual(calls.at(-1), ['identify', 'user-b']);
  a.syncUser('user-c');
  assert.deepEqual(calls.slice(-2), [['reset'], ['identify', 'user-c']]);
});
test('open counts ignore rerenders and short background trips, allow a new 30-minute session', () => {
  const { analytics: a, events } = fixture();
  a.foreground(0); a.foreground(1); a.background(10); a.foreground(100);
  assert.equal(events('app_opened').length, 1);
  a.background(200); a.background(300); a.foreground(200 + 30 * 60_000);
  assert.equal(events('app_opened').length, 2);
  assert.equal(events('app_opened')[1][2].launch_type, 'resume');
});
test('a long-background resume records screen activity even without navigation', () => {
  const { analytics: a, events } = fixture();
  a.syncUser('user'); a.foreground(0); a.screenViewed('home');
  a.background(100); a.foreground(100 + 24 * 60 * 60_000);
  assert.equal(events('screen_viewed').length, 2);
});
test('search records counts and source without free text or customer details', () => {
  const { analytics: a, events } = fixture();
  a.searchSubmitted('home', 7, 3); a.searchSubmitted('home', 0, 3);
  const p = events('search_submitted')[0][2];
  assert.equal(events('search_submitted').length, 1);
  assert.equal(p.query_length, 7);
  assert.equal(p.result_count, 3);
  for (const key of ['keyword', 'email', 'phone', 'address', 'token', 'note', 'options']) assert.equal(key in p, false);
});
test('checkout counts once per visit; persisted cart restoration is not an add-to-cart event', () => {
  const { analytics: a, events } = fixture();
  a.screenViewed('checkout'); a.checkoutStarted(0, 0); a.checkoutStarted(2, 60000); a.checkoutStarted(3, 90000);
  assert.equal(events('checkout_started').length, 1);
  a.screenViewed('cart'); a.screenViewed('checkout'); a.checkoutStarted(3, 90000);
  assert.equal(events('checkout_started').length, 2);
  assert.equal(events('food_added_to_cart').length, 0);
});
test('confirmed order retries are deduplicated and use a stable event UUID across reloads', () => {
  const { analytics: a, events } = fixture();
  const id = 'a1b2c3d4-1234-4567-89ab-123456789abc';
  a.orderCreated(id, 2, 65000, true, false); a.orderCreated(id, 2, 65000, true, false);
  assert.equal(events('order_created').length, 1);
  assert.equal(events('order_created')[0][3].uuid, id);
  const fresh = fixture(); fresh.analytics.orderCreated(id, 2, 65000, true, false);
  assert.equal(fresh.events('order_created')[0][3].uuid, id);
});
test('missing configuration and SDK/network failures never fail the shopping flow', async () => {
  const disabled = new UsageAnalytics(null, {});
  const broken = new UsageAnalytics({ capture() { throw Error('offline'); }, identify() { throw Error(); },
    reset() { throw Error(); }, flush: () => Promise.reject(Error('offline')) }, {});
  for (const a of [disabled, broken]) {
    assert.doesNotThrow(() => {
      a.syncUser('user'); a.foreground(); a.screenViewed('home');
      a.foodAdded('food', 'restaurant', 1, 20000); a.orderCreated('order', 1, 20000, false, false); a.background();
    });
  }
  await new Promise(resolve => setImmediate(resolve));
});
test('dashboard isolates environment and distinguishes unique people from event totals', async () => {
  const { usageDashboard } = await import('../scripts/posthog-dashboard.mjs');
  const dashboard = usageDashboard('development');
  assert.equal(dashboard.insights.length, 7);
  for (const insight of dashboard.insights) {
    assert.ok(insight.query.source.properties.some(p => p.key === 'environment' && p.value[0] === 'development'));
  }
  assert.equal(dashboard.insights[1].query.source.series[0].math, 'dau');
  assert.equal(dashboard.insights[2].query.source.interval, 'month');
  assert.equal(dashboard.insights.at(-1).query.source.kind, 'FunnelsQuery');
});
