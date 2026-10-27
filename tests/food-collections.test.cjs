const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { foodCollections, findFoodCollection, matchesFoodCollection } = require('../src/features/search/foodCollections.ts');
const { searchRestaurants } = require('../src/features/search/restaurantSearch.ts');
const { defaultFilters } = require('../src/features/search/catalog.ts');
const { categoryIconUrl } = require('../src/services/categoryIcons.ts');
const { createCatalogApi } = require('../src/services/catalogApi.ts');

test('17 stable shortcut IDs match the agreed icon filenames', () => {
  assert.equal(foodCollections.length, 17);
  assert.equal(new Set(foodCollections.map(item => item.id)).size, 17);
  for (const collection of foodCollections) assert.match(collection.id, /^[a-z]+(?:-[a-z]+)*$/);
  assert.equal(foodCollections.at(-1).id, 'trai-cay');
  for (const id of ['hai-san', 'sinh-to', 'pizza', 'mon-nuong']) assert.equal(findFoodCollection(id), undefined);
});
test('collection matches support accent-free Vietnamese, phrases and common English dish names', () => {
  for (const name of ['Sinh tố bơ', 'SINH TO DAU', 'Mango Smoothie']) assert.equal(matchesFoodCollection({ name }, findFoodCollection('do-uong')), true);
  assert.equal(matchesFoodCollection({ name: 'Cheeseburger' }, findFoodCollection('mon-my')), true);
  assert.equal(matchesFoodCollection({ name: 'Hamburger bò' }, findFoodCollection('mon-my')), true);
  assert.equal(matchesFoodCollection({ name: 'Fried Chicken' }, findFoodCollection('ga-ran')), true);
  assert.equal(matchesFoodCollection({ name: 'Mango pudding' }, findFoodCollection('mon-ga')), false);
  assert.equal(matchesFoodCollection({ name: 'Bánh tráng trộn' }, findFoodCollection('tra')), false);
  assert.equal(matchesFoodCollection({ name: 'Bánh mì thịt' }, findFoodCollection('mi')), false);
  assert.equal(matchesFoodCollection({ name: 'Mì xào bò' }, findFoodCollection('mi')), true);
});
test('only actual matching menus qualify a restaurant; duplicate dishes never duplicate the restaurant', () => {
  const restaurants = [
    { id: 'a', name: 'Quán nước', rating: 4, promo_tags: [] },
    { id: 'b', name: 'Quán Sinh Tố', rating: 5, promo_tags: [] },
    { id: 'c', name: 'Quán khác', rating: 3, promo_tags: [] },
  ];
  const foods = [{ restaurant_id: 'a', name: 'Sinh tố bơ' }, { restaurant_id: 'a', name: 'Sinh tố dâu' }, { restaurant_id: 'b', name: 'Cơm gà' }];
  assert.deepEqual(searchRestaurants(restaurants, foods, '', defaultFilters, [], null, undefined, 'do-uong').map(r => r.id), ['a']);
  assert.deepEqual(searchRestaurants(restaurants, foods, '', { ...defaultFilters, favorite: true }, ['b'], null, undefined, 'do-uong'), []);
  assert.deepEqual(searchRestaurants(restaurants, foods, '', defaultFilters, [], null, undefined, 'missing'), []);
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
