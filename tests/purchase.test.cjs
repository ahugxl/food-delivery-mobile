const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { voucherError, purchaseTotals, serializeCart, purchaseSignature } = require('../src/features/order/purchase.ts');
const { createCartStore } = require('../src/store/cartState.ts');
const cart = createCartStore();
const { createPurchaseApi } = require('../src/services/purchaseApi.ts');
const item = { id: 'food', foodId: 'food', name: 'Chicken', price: 15, basePrice: 15, image: '', restaurantId: 'restaurant', restaurantName: 'Restaurant', quantity: 1, unitPrice: 17, lineId: 'unused', note: 'Less salt', options: [{ id: 'corn', groupId: 'topping', groupName: 'Topping', label: 'Corn', price: 2 }] };
const voucher = { id: 'voucher', code: 'SAVE5', restaurant_id: null, discount_type: 'fixed', discount_value: 5, min_order_value: 17, expiry_date: null, is_active: true };

test('voucher accepts the exact minimum and checks active, expiry, restaurant and supported values', () => {
  assert.equal(voucherError(voucher, 17, 'restaurant'), null);
  assert.match(voucherError({ ...voucher, is_active: false }, 17, 'restaurant'), /ngừng hoạt động/);
  assert.match(voucherError({ ...voucher, expiry_date: '2020-01-01' }, 17, 'restaurant'), /hết hạn/);
  assert.match(voucherError({ ...voucher, restaurant_id: 'other' }, 17, 'restaurant'), /quán khác/);
  assert.match(voucherError(voucher, 16.99, 'restaurant'), /tối thiểu/);
  assert.match(voucherError({ ...voucher, discount_type: 'unknown' }, 17, 'restaurant'), /chưa được hỗ trợ/);
  assert.match(voucherError({ ...voucher, discount_type: 'percentage', discount_value: 101 }, 17, 'restaurant'), /không hợp lệ/);
});

test('fixed/percentage totals clamp discounts to food subtotal and preserve delivery fee', () => {
  assert.equal(purchaseTotals([item], voucher).total, 14);
  assert.equal(purchaseTotals([item], { ...voucher, discount_value: 999 }).total, 2);
  assert.equal(purchaseTotals([item], { ...voucher, discount_type: 'percentage', discount_value: 10 }).total, 17.3);
  assert.equal(purchaseTotals([], null).total, 0);
  assert.equal(purchaseTotals([item], { ...voucher, is_active: false }).discount, 0);
});

test('cart merges identical options/notes, keeps differing notes and rejects mixed restaurants', () => {
  cart.setState(cart.getInitialState());
  assert.equal(cart.getState().addToCart(item), null);
  assert.equal(cart.getState().addToCart({ ...item, options: item.options.map(o => ({ ...o })) }), null);
  assert.equal(cart.getState().items[0].quantity, 2);
  cart.getState().addToCart({ ...item, note: 'No salt' });
  assert.equal(cart.getState().items.length, 2);
  assert.match(cart.getState().addToCart({ ...item, restaurantId: 'other' }), /quán khác/);
  assert.equal(cart.getState().items.length, 2);
});

test('note editing can merge identical lines and quantity limits hold', () => {
  cart.setState(cart.getInitialState());
  cart.getState().addToCart(item);
  cart.getState().addToCart({ ...item, note: 'Other note' });
  cart.getState().setNote(cart.getState().items[1].lineId, item.note);
  assert.equal(cart.getState().items.length, 1);
  assert.equal(cart.getState().items[0].quantity, 2);
  assert.match(cart.getState().addToCart({ ...item, quantity: 99 }), /1 đến 99/);
});

test('pending checkout locks edits; retry reuses request ID; successful clear resets pending request', () => {
  cart.setState(cart.getInitialState());
  cart.getState().addToCart(item);
  const signature = purchaseSignature(cart.getState().items, 'Test address', ' save5 ');
  assert.equal(cart.getState().prepareCheckout(signature, 'id1'), 'id1');
  assert.equal(cart.getState().prepareCheckout(signature, 'id2'), 'id1');
  cart.getState().setCheckingOut(true);
  cart.getState().removeFromCart(cart.getState().items[0].lineId);
  assert.equal(cart.getState().items.length, 1);
  assert.match(cart.getState().addToCart(item), /Đang gửi đơn/);
  cart.getState().clearCart();
  assert.equal(cart.getState().items.length, 0);
  assert.equal(cart.getState().checkoutRequest, null);
});

test('JSON serialization retains all option names/prices and note without sharing mutable arrays', () => {
  const snapshot = serializeCart([item]);
  assert.equal(snapshot[0].foodId, item.foodId);
  assert.equal(snapshot[0].options[0].groupName, 'Topping');
  assert.equal(snapshot[0].options[0].label, 'Corn');
  assert.equal(snapshot[0].options[0].price, 2);
  assert.equal(snapshot[0].note, 'Less salt');
  snapshot[0].options[0].label = 'Changed';
  assert.equal(item.options[0].label, 'Corn');
});

function fixture(body, status = 200) {
  const requests = [];
  const client = createClient('https://purchase.test.supabase.co', 'test-key', { auth: { persistSession: false }, global: { fetch: async (url, init) => {
    requests.push({ url: new URL(url), init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  } } });
  return { api: createPurchaseApi(client), requests };
}

test('voucher lookup sends a normalized code with equality, not a wildcard search', async () => {
  const f = fixture([voucher]);
  assert.equal((await f.api.checkVoucher(' save5 ', [item])).id, voucher.id);
  assert.equal(f.requests[0].url.searchParams.get('code'), 'eq.SAVE5');
});

test('createOrder calls the atomic RPC with the supplied idempotency ID and JSON snapshot', async () => {
  const f = fixture({ id: 'order1', total: 14 });
  assert.equal((await f.api.createOrder({ orderId: 'order1', items: [item], address: 'Test address', voucherCode: ' save5 ' })).id, 'order1');
  assert.equal(f.requests[0].url.pathname, '/rest/v1/rpc/create_food_order');
  const body = JSON.parse(f.requests[0].init.body);
  assert.equal(body.p_order_id, 'order1');
  assert.equal(body.p_items[0].options[0].label, 'Corn');
  assert.equal(body.p_voucher_code, 'SAVE5');
});

test('failed RPC never clears the cart; invalid checkout does not issue any request', async () => {
  const f = fixture({ code: 'P0001', message: 'Voucher expired' }, 400);
  cart.setState(cart.getInitialState()); cart.getState().addToCart(item);
  await assert.rejects(f.api.createOrder({ orderId: 'order1', items: cart.getState().items, address: 'Test address' }), e => e.message === 'Voucher expired');
  assert.equal(cart.getState().items.length, 1);
  const before = f.requests.length;
  await assert.rejects(f.api.createOrder({ orderId: 'order2', items: [], address: '' }), /Giỏ hàng/);
  assert.equal(f.requests.length, before);
});
