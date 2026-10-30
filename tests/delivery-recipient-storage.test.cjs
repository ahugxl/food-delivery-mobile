const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { createRecipientStorage } = require('../src/features/location/recipientStorage.ts');
const { detectedDelivery } = require('../src/features/location/startupLocation.ts');

test('recipient survives a fresh storage instance after reload and stays isolated by account', async () => {
  const data = new Map();
  const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); } };
  await createRecipientStorage(storage).save('google-user', { recipientName: ' Nguyễn An ', recipientPhone: '090 123 4567', latitude: 10 });
  const reloaded = createRecipientStorage(storage);
  const restored = await reloaded.read('google-user');
  assert.deepEqual(restored, { recipientName: 'Nguyễn An', recipientPhone: '0901234567' });
  assert.equal(await reloaded.read('other-user'), null);
  const newGps = detectedDelivery({ latitude: 11, longitude: 106 }, 'Địa chỉ mới', { full_name: 'Nguyễn An', phone: null });
  const address = { ...newGps, ...restored };
  assert.equal(address.latitude, 11);
  assert.equal(address.recipientPhone, '0901234567');
});

test('invalid or unavailable storage never supplies a fabricated recipient; write failures are reported', async () => {
  for (const raw of ['not-json', '{}', '{"recipientName":"An","recipientPhone":"123"}', '{"recipientName":12,"recipientPhone":"0901234567"}']) {
    assert.equal(await createRecipientStorage({ getItem: async () => raw, setItem: async () => {} }).read('user'), null);
  }
  const unavailable = createRecipientStorage({ getItem: async () => { throw Error('offline'); }, setItem: async () => { throw Error('disk full'); } });
  assert.equal(await unavailable.read('user'), null);
  await assert.rejects(unavailable.save('user', { recipientName: 'An', recipientPhone: '0901234567' }), /Chưa lưu được/);
  await assert.rejects(unavailable.save('', { recipientName: 'An', recipientPhone: '0901234567' }), /đăng nhập/);
});
