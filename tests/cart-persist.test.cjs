const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { createPersistedCartStore, CART_STORAGE_KEY } = require('../src/store/cartPersistence.ts');
const item = { id: 'food', foodId: 'food', name: 'Chicken', price: 15, basePrice: 15, image: '', restaurantId: 'r', restaurantName: 'Restaurant', quantity: 2, unitPrice: 17, lineId: 'unused', note: 'Less salt', options: [{ id: 'corn', groupId: 'topping', groupName: 'Topping', label: 'Corn', price: 2 }] };
function memory() { const data = new Map(); return { data, getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, removeItem: async key => { data.delete(key); } }; }
const flush = store => store.persist.getOptions().storage.getItem(CART_STORAGE_KEY);

test('restores quantity, every option and note after creating a fresh store', async () => {
  const disk = memory(); const first = createPersistedCartStore(disk);
  await first.persist.rehydrate(); first.getState().setOwner('alice'); first.getState().addToCart(item); await flush(first);
  const reopened = createPersistedCartStore(disk);
  assert.equal(reopened.getState().items.length, 0);
  await reopened.persist.rehydrate(); reopened.getState().setOwner('alice');
  assert.equal(reopened.getState().items[0].quantity, 2);
  assert.equal(reopened.getState().items[0].options[0].label, 'Corn');
  assert.equal(reopened.getState().items[0].note, 'Less salt');
});
test('pending request/context survives but the in-flight lock never survives restart', async () => {
  const disk = memory(); const first = createPersistedCartStore(disk);
  first.getState().setOwner('alice'); first.getState().addToCart(item);
  first.getState().prepareCheckout('signature', 'request-id', { address: { street: 'Test address', label: 'Home' }, voucher: null });
  first.getState().setCheckingOut(true); await flush(first);
  assert.equal('isCheckingOut' in JSON.parse(disk.data.get(CART_STORAGE_KEY)).state, false);
  const reopened = createPersistedCartStore(disk); await reopened.persist.rehydrate();
  assert.equal(reopened.getState().isCheckingOut, false);
  assert.equal(reopened.getState().prepareCheckout('signature', 'other-id'), 'request-id');
  assert.equal(reopened.getState().checkoutRequest.context.address.street, 'Test address');
});
test('account switch and explicit logout remove the previous owner cart', async () => {
  const disk = memory(); const first = createPersistedCartStore(disk);
  first.getState().setOwner('alice'); first.getState().addToCart(item); await flush(first);
  const next = createPersistedCartStore(disk); await next.persist.rehydrate(); next.getState().setOwner('bob');
  assert.equal(next.getState().items.length, 0);
  next.getState().addToCart(item); next.getState().setOwner(null); await flush(next);
  const reopened = createPersistedCartStore(disk); await reopened.persist.rehydrate();
  assert.equal(reopened.getState().items.length, 0);
});
test('clear cart remains empty on disk even after earlier slow writes', async () => {
  const disk = memory(); const slow = { ...disk, setItem: async (key, value) => { await new Promise(resolve => setTimeout(resolve, JSON.parse(value).state.items.length ? 8 : 1)); await disk.setItem(key, value); } };
  const store = createPersistedCartStore(slow); store.getState().setOwner('alice'); store.getState().addToCart(item); store.getState().clearCart(); await flush(store);
  const reopened = createPersistedCartStore(disk); await reopened.persist.rehydrate();
  assert.deepEqual(reopened.getState().items, []); assert.equal(reopened.getState().checkoutRequest, null);
});
test('invalid saved data cannot overwrite actions or restore malformed items', async () => {
  const disk = memory(); disk.data.set(CART_STORAGE_KEY, JSON.stringify({ version: 1, state: { ownerId: 'alice', items: [{ ...item, quantity: -1 }], checkoutRequest: null, clearCart: 'bad' } }));
  const store = createPersistedCartStore(disk); await store.persist.rehydrate();
  assert.deepEqual(store.getState().items, []); assert.equal(typeof store.getState().clearCart, 'function');
});
