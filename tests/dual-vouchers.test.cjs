const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { purchaseTotals, purchaseSignature, voucherError } = require('../src/features/order/purchase.ts');
const { useOrderStore } = require('../src/store/orderStore.ts');
const { createPurchaseApi } = require('../src/services/purchaseApi.ts');
const { createClient } = require('@supabase/supabase-js');
const item = { foodId: 'f', restaurantId: 'r', unitPrice: 40000, basePrice: 40000, quantity: 1, options: [], note: '' };
const food = { id: 'food', code: 'FOOD', applies_to: 'food', discount_type: 'fixed', discount_value: 10000, min_order_value: 40000, expiry_date: null, restaurant_id: null, is_active: true };
const shipping = { ...food, id: 'ship', code: 'SHIP', applies_to: 'shipping', discount_value: 15000 };

test('combining food and shipping vouchers discounts separate bases, including exact minimum before discount', () => {
  const totals = purchaseTotals([item], food, Date.now(), 15000, shipping);
  assert.equal(totals.foodDiscount, 10000);
  assert.equal(totals.shippingDiscount, 15000);
  assert.equal(totals.discount, 25000);
  assert.equal(totals.total, 30000);
  assert.equal(totals.voucherError, null);
  const shippingOnly = purchaseTotals([item], null, Date.now(), 25000, shipping);
  assert.equal(shippingOnly.foodDiscount, 0);
  assert.equal(shippingOnly.shippingDiscount, 15000);
  assert.equal(shippingOnly.total, 50000);
});

test('discount caps are independent and percentages use the correct base', () => {
  const totals = purchaseTotals([item], { ...food, discount_value: 999999 }, Date.now(), 15000, { ...shipping, discount_value: 999999 });
  assert.equal(totals.foodDiscount, 40000);
  assert.equal(totals.shippingDiscount, 15000);
  assert.equal(totals.total, 0);
  const percentage = purchaseTotals([item], { ...food, discount_type: 'percentage', discount_value: 25 }, Date.now(), 15000, { ...shipping, discount_type: 'percentage', discount_value: 50 });
  assert.equal(percentage.foodDiscount, 10000);
  assert.equal(percentage.shippingDiscount, 7500);
  assert.equal(percentage.total, 37500);
});

test('wrong target, expired shipping code and minimum violations cannot discount the order', () => {
  const swapped = purchaseTotals([item], shipping, Date.now(), 15000, food);
  assert.equal(swapped.discount, 0);
  assert.ok(swapped.foodError);
  assert.ok(swapped.shippingError);
  assert.match(voucherError(shipping, 40000, 'r', Date.now(), 'food'), /tiền món/);
  assert.equal(purchaseTotals([item], null, Date.now(), 15000, { ...shipping, expiry_date: '2020-01-01' }).shippingDiscount, 0);
  assert.equal(purchaseTotals([item], null, Date.now(), 15000, { ...shipping, min_order_value: 40001 }).shippingDiscount, 0);
  assert.equal(purchaseTotals([item], null, Date.now(), 15000, { ...shipping, restaurant_id: 'other' }).shippingDiscount, 0);
});

test('selecting one voucher never overwrites the other type; clearing both is explicit', () => {
  useOrderStore.setState(useOrderStore.getInitialState());
  useOrderStore.getState().setCheckoutVoucher(food);
  useOrderStore.getState().setCheckoutVoucher(shipping);
  assert.equal(useOrderStore.getState().checkoutVoucher.id, 'food');
  assert.equal(useOrderStore.getState().shippingVoucher.id, 'ship');
  useOrderStore.getState().setCheckoutVouchers(null, shipping);
  assert.equal(useOrderStore.getState().checkoutVoucher, null);
  assert.equal(useOrderStore.getState().shippingVoucher.id, 'ship');
  useOrderStore.getState().setCheckoutVouchers(null, null);
  assert.equal(useOrderStore.getState().shippingVoucher, null);
});

test('request signatures include the shipping code and the atomic RPC sends both normalized codes', async () => {
  const signature = code => purchaseSignature([item], 'Address', 'food', { latitude: 0, longitude: 0 }, undefined, code);
  assert.equal(signature(' ship '), signature('SHIP'));
  assert.notEqual(signature('SHIP'), signature('OTHER'));
  assert.notEqual(signature('SHIP'), signature(undefined));
  let body;
  const client = createClient('https://dual.test.supabase.co', 'key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({ id: 'o' }), { status: 200, headers: { 'content-type': 'application/json' } });
  } } });
  await createPurchaseApi(client).createOrder({ orderId: 'o', items: [item], address: 'Address A', recipientName: 'Nguyễn An', recipientPhone: '0901234567', coordinates: { latitude: 0, longitude: 0 }, deliveryFee: 15000, voucherCode: ' food ', shippingVoucherCode: ' ship ' });
  assert.equal(body.p_voucher_code, 'FOOD');
  assert.equal(body.p_shipping_voucher_code, 'SHIP');
});
