const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { recipientInput, hasRecipient } = require('../src/features/order/recipient.ts');
const { addressInput, deliveryFromSaved, reconcileDeliveryAddress } = require('../src/features/account/validation.ts');
const { purchaseSignature } = require('../src/features/order/purchase.ts');
const { createPurchaseApi } = require('../src/services/purchaseApi.ts');
const recipient = { recipientName: ' Nguyễn An ', recipientPhone: '(+84) 901-234-567' };
const saved = { id: 'a', title: 'Home', address: 'Address A', latitude: 0, longitude: 0, is_default: true, recipient_name: 'Nguyễn An', recipient_phone: '0901234567' };

test('recipient validation requires a name and phone, normalizes phone without dropping its prefix', () => {
  assert.deepEqual(recipientInput(recipient), { recipientName: 'Nguyễn An', recipientPhone: '+84901234567' });
  assert.equal(hasRecipient({}), false);
  for (const recipientPhone of ['', 'abc', '123', '+840901234567890123']) assert.equal(hasRecipient({ ...recipient, recipientPhone }), false);
  assert.equal(hasRecipient({ ...recipient, recipientName: 'a' }), false);
  assert.equal(recipientInput({ ...recipient, recipientPhone: '0901234567' }).recipientPhone, '0901234567');
});

test('each address sends its own recipient; editing only a recipient updates the checkout selection', () => {
  const address = deliveryFromSaved(saved);
  const args = addressInput('a', { ...address, ...recipient }, false, false);
  assert.equal(args.p_recipient_name, 'Nguyễn An');
  assert.equal(args.p_recipient_phone, '+84901234567');
  const next = reconcileDeliveryAddress(address, [{ ...saved, recipient_name: 'Nguyễn Bình', recipient_phone: '0912345678' }]);
  assert.equal(next.recipientName, 'Nguyễn Bình');
  assert.equal(next.recipientPhone, '0912345678');
  assert.equal(deliveryFromSaved({ ...saved, recipient_name: null, recipient_phone: null }).recipientName, '');
  assert.throws(() => addressInput('a', { ...address, recipientPhone: '' }, true, false), /điện thoại/);
});

test('recipient changes create a new order intent, while equivalent formatting reuses it', () => {
  const signature = value => purchaseSignature([], 'Address A', undefined, { latitude: 0, longitude: 0 }, value);
  assert.equal(signature(recipient), signature(recipientInput(recipient)));
  assert.notEqual(signature(recipient), signature({ ...recipient, recipientPhone: '0901234567' }));
});

test('checkout sends normalized recipient fields and rejects missing recipients before network access', async () => {
  const requests = [];
  const client = createClient('https://recipient.test.supabase.co', 'test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
    requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'order' }), { status: 200, headers: { 'content-type': 'application/json' } });
  } } });
  const api = createPurchaseApi(client);
  const input = { orderId: 'order', items: [{ foodId: 'f', restaurantId: 'r', quantity: 1, unitPrice: 40000, basePrice: 40000, options: [], note: '' }], address: 'Address A', coordinates: { latitude: 0, longitude: 0 }, deliveryFee: 15000 };
  await assert.rejects(api.createOrder(input), /người nhận/);
  assert.equal(requests.length, 0);
  await api.createOrder({ ...input, ...recipient });
  assert.equal(requests[0].p_recipient_name, 'Nguyễn An');
  assert.equal(requests[0].p_recipient_phone, '+84901234567');
});
