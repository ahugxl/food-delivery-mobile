const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { findFoodCollection, matchesRestaurantTag } = require('../src/features/search/foodCollections.ts');
const { searchRestaurants } = require('../src/features/search/restaurantSearch.ts');
const { defaultFilters } = require('../src/features/search/catalog.ts');
const { categoryIconUrl } = require('../src/services/categoryIcons.ts');
const { createCatalogApi } = require('../src/services/catalogApi.ts');

const milkTea = { id: 'tra-sua', name: 'Trà sữa', kind: 'food', restaurant_tag: null, is_active: true };
const newRestaurant = { id: 'quan-moi', name: 'Quán mới', kind: 'restaurant_tag', restaurant_tag: 'Quán mới', is_active: true };

test('collections come from database configuration, including new names and disabled entries', () => {
  assert.equal(findFoodCollection('tra-sua', [milkTea]), milkTea);
  assert.equal(findFoodCollection('old-category', [milkTea]), undefined);
  assert.equal(findFoodCollection('custom', [{ ...milkTea, id: 'custom', name: 'Tên mới' }]).name, 'Tên mới');
});

test('food collection membership uses explicit mapped dishes, never a restaurant name or fruit ingredient', () => {
  const restaurants = [{ id: 'a', name: 'Quán trà sữa', promo_tags: [] }, { id: 'b', name: 'Quán khác', promo_tags: [] }];
  // API provided a mapped item whose arbitrary name contains no category keyword.
  const linkedFoods = [{ restaurant_id: 'b', name: 'Món số 01' }, { restaurant_id: 'b', name: 'Món số 02' }];
  const search = (foods, collection = milkTea) => searchRestaurants(restaurants, foods, '', defaultFilters, [], null, undefined, collection.id, collection);
  assert.deepEqual(search(linkedFoods).map(r => r.id), ['b']);
  assert.deepEqual(search([]), []);
  assert.deepEqual(search(linkedFoods, { ...milkTea, is_active: false }), []);
  assert.deepEqual(searchRestaurants(restaurants, linkedFoods, '', defaultFilters, [], null, undefined, 'missing'), []);
});

test('restaurant-tag categories use complete labels with case/whitespace normalization, independent of menus', () => {
  assert.equal(matchesRestaurantTag(['  QUÁN   MỚI '], 'Quán mới'), true);
  assert.equal(matchesRestaurantTag(['Quán mới mở ưu đãi'], 'Quán mới'), false);
  assert.equal(matchesRestaurantTag([null, {}], 'Quán mới'), false);
  const restaurants = [{ id: 'a', name: 'A', promo_tags: ['Quán mới'] }, { id: 'b', name: 'Quán mới', promo_tags: ['Quán trứ danh'] }];
  assert.deepEqual(searchRestaurants(restaurants, [], '', defaultFilters, [], null, undefined, 'quan-moi', newRestaurant).map(r => r.id), ['a']);
  assert.deepEqual(searchRestaurants(restaurants, [], '', { ...defaultFilters, favorite: true }, ['b'], null, undefined, 'quan-moi', newRestaurant), []);
});

test('discovery API joins explicit food links, filters availability and active restaurants and propagates errors', async () => {
  const requests = [];
  let fail = false;
  const client = createClient('https://example.supabase.co', 'key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async url => {
    requests.push(new URL(url));
    return new Response(JSON.stringify(fail ? { message: 'Link query failed' } : [{ food_id: 'f', foods: { id: 'f', name: 'Món số 01', restaurant_id: 'r', price: 25000, original_price: 30000, image_url: 'https://example.com/food.jpg' } }]), { status: fail ? 500 : 200, headers: { 'content-type': 'application/json' } });
  } } });
  const api = createCatalogApi(client);
  assert.deepEqual(await api.discoveryFoods('mon-chay'), [{ id: 'f', name: 'Món số 01', restaurant_id: 'r', price: 25000, original_price: 30000, image_url: 'https://example.com/food.jpg' }]);
  assert.equal(requests[0].searchParams.get('discovery_category_id'), 'eq.mon-chay');
  assert.equal(requests[0].searchParams.get('foods.is_available'), 'eq.true');
  assert.equal(requests[0].searchParams.get('foods.restaurants.is_active'), 'eq.true');
  fail = true;
  await assert.rejects(api.discoveryFoods('mon-chay'), e => e.message === 'Link query failed');
});

test('public icon URLs default to category-icons and support a safely encoded folder override', () => {
  const keys = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_CATEGORY_ICON_BUCKET', 'EXPO_PUBLIC_CATEGORY_ICON_PREFIX'];
  const old = keys.map(key => process.env[key]);
  try {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co/';
    delete process.env.EXPO_PUBLIC_CATEGORY_ICON_BUCKET; delete process.env.EXPO_PUBLIC_CATEGORY_ICON_PREFIX;
    assert.equal(categoryIconUrl('tra-sua'), 'https://example.supabase.co/storage/v1/object/public/category-icons/tra-sua.png');
    process.env.EXPO_PUBLIC_CATEGORY_ICON_BUCKET = 'photos'; process.env.EXPO_PUBLIC_CATEGORY_ICON_PREFIX = '/food icons/';
    assert.equal(categoryIconUrl('tra-sua'), 'https://example.supabase.co/storage/v1/object/public/photos/food%20icons/tra-sua.png');
    assert.equal(categoryIconUrl('../private'), undefined);
  } finally { keys.forEach((key, index) => { if (old[index] === undefined) delete process.env[key]; else process.env[key] = old[index]; }); }
});
test('catalog foods loads later menu pages and propagates a failed page instead of partial results', async () => {
  const requests = [];
  let fail = false;
  const client = createClient('https://example.supabase.co', 'key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async url => {
    const query = new URL(url); requests.push(query);
    const offset = Number(query.searchParams.get('offset') || '0');
    const body = offset === 0 ? Array.from({ length: 500 }, (_, n) => ({ id: String(n) })) : fail ? { message: 'Page failed' } : [{ id: 'last', name: 'Sinh tố bơ' }];
    return new Response(JSON.stringify(body), { status: offset && fail ? 500 : 200, headers: { 'content-type': 'application/json' } });
  } } });
  const api = createCatalogApi(client);
  assert.equal((await api.foods()).length, 501);
  assert.equal(requests[1].searchParams.get('offset'), '500');
  fail = true;
  await assert.rejects(api.foods(), error => error.message === 'Page failed');
});
