const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Exercise the TypeScript domain modules without adding a test runtime dependency.
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};

const { calculateTotals, vouchers } = require('../src/features/order/checkout.ts');
const { searchCatalog, defaultFilters, catalog } = require('../src/features/search/catalog.ts');
const { useOrderStore } = require('../src/store/orderStore.ts');
const voucher = (id) => vouchers.find((entry) => entry.id === id);

test('percentage discounts apply to food, leaving the delivery fee intact', () => {
  assert.deepEqual(calculateTotals(25, voucher('meal10')), {
    subtotal: 25, deliveryFee: 2, discount: 2.5, total: 24.5, voucherEligible: true,
  });
});

test('shipping offers subtract $1 or the full shipping fee', () => {
  assert.equal(calculateTotals(25, voucher('ship1')).total, 26);
  assert.equal(calculateTotals(25, voucher('freeship')).total, 25);
});

test('30% offer requires a subtotal strictly over $50 and stops applying if the cart shrinks', () => {
  assert.equal(calculateTotals(49.99, voucher('meal30')).discount, 0);
  assert.equal(calculateTotals(50, voucher('meal30')).voucherEligible, false);
  assert.equal(calculateTotals(50.00000000001, voucher('meal30')).voucherEligible, false);
  assert.equal(calculateTotals(50.01, voucher('meal30')).discount, 15);
  assert.equal(calculateTotals(60, voucher('meal30')).total, 44);
  assert.equal(calculateTotals(45, voucher('meal30')).discount, 0);
});

test('an empty cart has no shipping fee, discount or total', () => {
  for (const offer of [null, ...vouchers]) {
    const totals = calculateTotals(0, offer);
    assert.equal(totals.deliveryFee, 0);
    assert.equal(totals.discount, 0);
    assert.equal(totals.total, 0);
  }
});

test('cent rounding produces an exact displayed breakdown', () => {
  const totals = calculateTotals(12.55, voucher('meal10'));
  assert.equal(totals.discount, 1.26);
  assert.equal(totals.total, 13.29);
  assert.equal(calculateTotals(0.1 + 0.2, null).total, 2.3);
});

test('shipping savings cannot exceed the delivery fee', () => {
  assert.equal(calculateTotals(10, { ...voucher('ship1'), value: 99 }).total, 10);
});

test('search matches all words, ignores case and extra spaces, and finds restaurants', () => {
  const results = searchCatalog('  fRiEd   CHICKEN  ', undefined, defaultFilters);
  assert.equal(results.length, 3);
  assert.ok(results.every((item) => item.food.name.toLowerCase().includes('fried chicken')));
  assert.equal(searchCatalog('Daily Coffee', undefined, defaultFilters)[0].food.id, 'iced-latte');
});

test('category, keyword and multiple filters intersect', () => {
  assert.equal(searchCatalog('chicken', 'drink', defaultFilters).length, 0);
  const results = searchCatalog('chicken', 'fastfood', { ...defaultFilters, freeship: true, favorite: true, nearby: true });
  assert.deepEqual(results.map((item) => item.food.id), ['1']);
  assert.equal(searchCatalog('', 'unknown', defaultFilters).length, 0);
  assert.equal(searchCatalog('no such dish', undefined, defaultFilters).length, 0);
});

test('sorting preserves the catalog and nearby limits results to 2 km', () => {
  const original = catalog.map((item) => item.food.id);
  const rated = searchCatalog('', undefined, { ...defaultFilters, sort: 'rating' });
  assert.ok(rated.every((item, index) => index === 0 || rated[index - 1].rating >= item.rating));
  const nearby = searchCatalog('', undefined, { ...defaultFilters, sort: 'distance', nearby: true });
  assert.ok(nearby.every((item, index) => item.distanceKm <= 2 && (index === 0 || nearby[index - 1].distanceKm <= item.distanceKm)));
  assert.deepEqual(catalog.map((item) => item.food.id), original);
});

test('order selections replace the previous voucher and retain the delivery address', () => {
  const address = { street: '42 New Street', label: 'Work' };
  useOrderStore.getState().setDeliveryAddress(address);
  useOrderStore.getState().setAppliedVoucher(voucher('meal10'));
  useOrderStore.getState().setAppliedVoucher(voucher('freeship'));
  assert.equal(useOrderStore.getState().appliedVoucher.id, 'freeship');
  useOrderStore.getState().setAppliedVoucher(null);
  assert.equal(useOrderStore.getState().appliedVoucher, null);
  assert.deepEqual(useOrderStore.getState().deliveryAddress, address);
});

test('favorites start empty, stay unique, and can return to the empty state', () => {
  const { useFavoritesStore } = require('../src/store/favoritesStore.ts');
  const { recommendedRestaurants } = require('../src/features/home/restaurants.ts');
  const store = useFavoritesStore;
  assert.deepEqual(store.getState().favorites, []);
  store.getState().toggleFavorite(recommendedRestaurants[0]);
  assert.equal(store.getState().favorites.length, 1);
  store.getState().toggleFavorite(recommendedRestaurants[0]);
  assert.deepEqual(store.getState().favorites, []);
  store.getState().toggleFavorite(recommendedRestaurants[1]);
  store.getState().removeFavorite(recommendedRestaurants[1].id);
  assert.deepEqual(store.getState().favorites, []);
});

test('the Favorite search filter uses the same saved restaurants as the Favorites tab', () => {
  const filters = { ...defaultFilters, favorite: true };
  assert.deepEqual(searchCatalog('', undefined, filters, []), []);
  assert.deepEqual(searchCatalog('', undefined, filters, ['The Green Fork']).map((item) => item.restaurant), ['The Green Fork']);
});

test('orders start empty and keep the submitted snapshot after checkout', () => {
  assert.deepEqual(useOrderStore.getState().orders, []);
  const order = { restaurant: 'Crispy House', total: '$17.00', image: 'test.png' };
  useOrderStore.getState().addOrder(order);
  useOrderStore.getState().addOrder(order);
  const orders = useOrderStore.getState().orders;
  assert.equal(orders.length, 2);
  assert.notEqual(orders[0].id, orders[1].id);
  assert.equal(orders[0].total, '$17.00');
  assert.equal(orders[0].status, 'On the way');
  useOrderStore.getState().completeLatestOrder();
  assert.equal(useOrderStore.getState().orders[0].status, 'Delivered');
  assert.equal(useOrderStore.getState().orders[1].status, 'On the way');
});

test('React Query exposes loading then resolves the simulated response', async () => {
  const { QueryClient, QueryObserver } = require('@tanstack/react-query');
  const { loadMockData } = require('../src/features/mockApi.ts');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const options = { queryKey: ['skeleton-test'], queryFn: ({ signal }) => loadMockData('ready', signal, 15) };
  const observer = new QueryObserver(client, options);
  const states = [];
  const unsubscribe = observer.subscribe((result) => states.push(result.isLoading));
  assert.equal(observer.getCurrentResult().isLoading, true);
  assert.equal(await client.fetchQuery(options), 'ready');
  assert.equal(observer.getCurrentResult().isLoading, false);
  assert.ok(states.includes(true));
  unsubscribe();
  client.clear();
});

test('mock loading can be cancelled when navigating away and missing dishes resolve as null', async () => {
  const { loadMockData, fetchFood } = require('../src/features/mockApi.ts');
  const controller = new AbortController();
  const pending = loadMockData('unused', controller.signal, 1000);
  controller.abort();
  await assert.rejects(pending, /Request aborted/);
  assert.equal(await fetchFood('not-a-dish'), null);
});
