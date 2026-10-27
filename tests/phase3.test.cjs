const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { validCoordinates, interpolateTrip, formatAddress } = require('../src/features/location/coordinates.ts');
const { mergeMessages, parseMessage } = require('../src/features/chat/messages.ts');
const { imageFromBase64 } = require('../src/features/chat/imageData.ts');
const { createChatApi } = require('../src/services/chatApi.ts');
const { createPurchaseApi } = require('../src/services/purchaseApi.ts');

test('coordinates accept zero and reject missing/out-of-range/NaN values', () => {
  assert.equal(validCoordinates({ latitude: 0, longitude: 0 }), true);
  for (const value of [null, {}, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: NaN }, { latitude: 0, longitude: 181 }]) assert.equal(validCoordinates(value), false);
});
test('straight-line trip starts at restaurant, reaches destination and clamps progress', () => {
  const start = { latitude: 0, longitude: 0 }, end = { latitude: 10, longitude: 20 };
  assert.deepEqual(interpolateTrip(start, end, 0.5), { latitude: 5, longitude: 10 });
  assert.deepEqual(interpolateTrip(start, end, -1), start);
  assert.deepEqual(interpolateTrip(start, end, 2), end);
});
test('reverse-geocoded address keeps street number and removes duplicate areas', () => {
  assert.equal(formatAddress({ streetNumber: '24', street: 'Đường Văn Chung', district: 'Phường 13', subregion: 'Quận Tân Bình', city: 'Hồ Chí Minh', region: 'Hồ Chí Minh' }), '24 Đường Văn Chung, Phường 13, Quận Tân Bình, Hồ Chí Minh');
  assert.equal(formatAddress({}), '');
});
const message = { id: 'm1', order_id: 'o', sender_id: 'u', sender_type: 'user', message_type: 'text', content: 'hello', image_url: null, created_at: '2026-10-26T00:00:00Z' };
test('history and realtime overlap merge once in stable chronological order', () => {
  const newer = { ...message, id: 'm2', created_at: '2026-10-26T00:00:01Z' };
  assert.deepEqual(mergeMessages([newer], [message, newer]).map(row => row.id), ['m1', 'm2']);
  assert.equal(parseMessage({ ...message, sender_type: 'admin' }), null);
  assert.deepEqual(parseMessage(message), message);
});
test('image upload data validates real signatures and rejects arbitrary file content', () => {
  assert.equal(imageFromBase64(Buffer.from([0xff, 0xd8, 0xff, 0]).toString('base64')).mime, 'image/jpeg');
  assert.throws(() => imageFromBase64(Buffer.from('text-file').toString('base64')), /JPEG/);
});
function fixture(responses) {
  const requests = [];
  const client = createClient('https://phase3.test.supabase.co', 'test-key', { auth: { persistSession: false }, global: { fetch: async (url, init) => {
    requests.push({ url: new URL(url), init }); const next = responses.shift();
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: { 'content-type': 'application/json' } });
  } } });
  return { chat: createChatApi(client), purchase: createPurchaseApi(client), requests };
}
test('message insert sends only the user role and preserves a stable client ID', async () => {
  const f = fixture([{ body: message }]);
  await f.chat.send({ id: 'm1', orderId: 'o', senderId: 'u', content: ' hello ' });
  const body = JSON.parse(f.requests[0].init.body);
  assert.equal(body.sender_type, 'user'); assert.equal(body.id, 'm1'); assert.equal(body.content, 'hello');
});
test('duplicate message retry reads the same message instead of creating another', async () => {
  const f = fixture([{ status: 409, body: { code: '23505', message: 'duplicate' } }, { body: message }]);
  assert.equal((await f.chat.send({ id: 'm1', orderId: 'o', senderId: 'u', content: 'hello' })).id, 'm1');
  assert.equal(f.requests[1].url.searchParams.get('sender_id'), 'eq.u');
});
test('empty messages and an image from another order are rejected before sending', async () => {
  const f = fixture([]);
  await assert.rejects(f.chat.send({ id: 'm', orderId: 'o', senderId: 'u', content: ' ' }), /nội dung/);
  await assert.rejects(f.chat.send({ id: 'm', orderId: 'o', senderId: 'u', content: '', imagePath: 'other/u/a.jpg' }), /không thuộc/);
  assert.equal(f.requests.length, 0);
});
test('private image upload sends ArrayBuffer with an allowed MIME type', async () => {
  const f = fixture([{ body: { Key: 'order-chat/o/u/test.png', Id: 'image-id' } }]);
  const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
  assert.equal(await f.chat.upload('o/u/test.png', buffer, 'image/png'), 'o/u/test.png');
  assert.equal(f.requests[0].init.body, buffer);
  assert.equal(new Headers(f.requests[0].init.headers).get('content-type'), 'image/png');
});
test('location checkout uses the new RPC and includes zero coordinates', async () => {
  const f = fixture([{ body: { id: 'order' } }]);
  const item = { foodId: 'f', restaurantId: 'r', quantity: 1, unitPrice: 10, basePrice: 10, note: '', options: [] };
  await f.purchase.createOrder({ orderId: 'order', items: [item], address: 'Test address', coordinates: { latitude: 0, longitude: 0 }, deliveryFee: 15000, recipientName: 'Nguyễn An', recipientPhone: '0901234567' });
  assert.equal(f.requests[0].url.pathname, '/rest/v1/rpc/create_food_order');
  assert.equal(JSON.parse(f.requests[0].init.body).p_latitude, 0);
});
