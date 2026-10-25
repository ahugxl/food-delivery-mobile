const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};
const { createCatalogApi } = require('../src/services/catalogApi.ts');
const { toggleOption, selectedOptions, missingRequiredGroups, optionUnitPrice, cartLineId } = require('../src/features/food-detail/selection.ts');
const { toRestaurantCard } = require('../src/features/home/adapters.ts');
const { searchLiveCatalog } = require('../src/features/search/liveCatalog.ts');
const { defaultFilters } = require('../src/features/search/catalog.ts');
const id = 'a3bc805a-3b4e-4f0e-b9b3-6eef00000001';
function apiFixture(body = [], status = 200) {
  const requests = [];
  const client = createClient('https://catalog.test.supabase.co', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, init) => {
      requests.push({ url: new URL(url), init });
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    } },
  });
  return { api: createCatalogApi(client), requests };
}

test('home queries keep active filtering and deterministic ordering; empty data stays empty', async () => {
  const { api, requests } = apiFixture();
  assert.deepEqual(await api.banners(), []);
  await api.categories();
  await api.restaurants();
  assert.equal(requests[0].url.searchParams.get('is_active'), 'eq.true');
  assert.equal(requests[0].url.searchParams.get('order'), 'position.asc,id.asc');
  assert.equal(requests[1].url.pathname, '/rest/v1/categories');
  assert.equal(requests[2].url.searchParams.get('is_active'), 'eq.true');
});

test('food uses one nested request for all option groups/items and preserves data', async () => {
  const detail = { id, food_option_groups: [{ id: 'g', food_option_items: [{ id: 'i' }] }] };
  const { api, requests } = apiFixture([detail]);
  assert.deepEqual(await api.food(id), detail);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url.searchParams.get('select'), /food_option_groups\(\*,food_option_items\(\*\)\)/);
  assert.equal(requests[0].url.searchParams.get('id'), `eq.${id}`);
});

test('not found and malformed mock IDs return null without a fallback dish', async () => {
  const { api, requests } = apiFixture();
  assert.equal(await api.food('1'), null);
  assert.equal(requests.length, 0);
  assert.equal(await api.food(id), null);
});

test('category/restaurant filters are sent as UUIDs and cancellation signal is forwarded', async () => {
  const { api, requests } = apiFixture();
  const controller = new AbortController();
  await api.foods({ categoryId: id, restaurantId: id }, controller.signal);
  const { url, init } = requests[0];
  assert.equal(url.searchParams.get('category_id'), `eq.${id}`);
  assert.equal(url.searchParams.get('restaurant_id'), `eq.${id}`);
  assert.equal(url.searchParams.get('is_available'), 'eq.true');
  assert.equal(init.signal, controller.signal);
});

test('backend/configuration errors propagate so React Query can show errors, never mocks', async () => {
  const { api } = apiFixture({ message: 'permission denied', code: '42501' }, 403);
  await assert.rejects(api.categories(), error => error.message === 'permission denied');
  await assert.rejects(createCatalogApi(null).restaurants(), /not configured/);
});

const single = { id: 'size', name: 'Size', is_required: true, allow_multiple: false, food_option_items: [
  { id: 's', name: 'Small', extra_price: 0 }, { id: 'l', name: 'Large', extra_price: 5 },
] };
const multi = { id: 'topping', name: 'Topping', is_required: false, allow_multiple: true, food_option_items: [
  { id: 'corn', name: 'Corn', extra_price: 0.1 }, { id: 'cheese', name: 'Cheese', extra_price: 0.2 },
] };
test('single-choice groups replace choices and required groups reject empty selections', () => {
  let selection = toggleOption({}, single, 's');
  assert.deepEqual(missingRequiredGroups([single], selection), []);
  selection = toggleOption(selection, single, 'l');
  assert.deepEqual(selection.size, ['l']);
  selection = toggleOption(selection, single, 'l');
  assert.equal(missingRequiredGroups([single], selection)[0].id, 'size');
  assert.equal(missingRequiredGroups([{ ...single, food_option_items: [] }], {}).length, 1);
});

test('multiple groups, zero-cost options, removed options and cent rounding are handled', () => {
  let selection = toggleOption({}, single, 's');
  selection = toggleOption(selection, multi, 'corn');
  selection = toggleOption(selection, multi, 'cheese');
  const options = selectedOptions([single, multi], selection);
  assert.equal(options.length, 3);
  assert.equal(optionUnitPrice({ price: 10 }, options), 10.3);
  assert.equal(selectedOptions([single], { size: ['deleted'] }).length, 0);
  assert.equal(toggleOption(selection, single, 'deleted'), selection);
  assert.equal(optionUnitPrice({ price: 10 }, []), 10);
});

test('cart merges only identical food/option combinations regardless of selection order', () => {
  const options = selectedOptions([single, multi], { size: ['s'], topping: ['corn', 'cheese'] });
  assert.equal(cartLineId(id, options), cartLineId(id, [...options].reverse()));
  assert.notEqual(cartLineId(id, options), cartLineId(id, options.slice(0, 1)));
  assert.equal(cartLineId(id, []), `${id}:standard`);
});

test('restaurant cards use real hours/promotions and handle nullable images', () => {
  const card = toRestaurantCard({ id, name: 'Restaurant', image_url: null, opening_hours: '8am - 9pm', promo_tags: ['Freeship', null, {}], rating: 4.8, is_open: false });
  assert.equal(card.image, '');
  assert.equal(card.openingHours, '8am - 9pm');
  assert.deepEqual(card.tags, ['Freeship']);
  assert.equal(card.isOpen, false);
});

test('live filters use real restaurant IDs and require actual coordinates for nearby results', () => {
  const row = { id, name: 'Chicken', price: 10, image_url: null, restaurant_id: 'r', restaurants: {
    name: 'Hana', rating: 4.8, opening_hours: '8am - 9pm', promo_tags: ['Freeship'], is_open: true, latitude: 10, longitude: 106,
  } };
  assert.equal(searchLiveCatalog([row], 'HANA chicken', { ...defaultFilters, favorite: true }, ['r'], null).length, 1);
  assert.equal(searchLiveCatalog([row], '', { ...defaultFilters, favorite: true }, [], null).length, 0);
  assert.equal(searchLiveCatalog([row], '', { ...defaultFilters, nearby: true }, [], null).length, 0);
  assert.equal(searchLiveCatalog([row], '', { ...defaultFilters, nearby: true }, [], { latitude: 10, longitude: 106 }).length, 1);
});
