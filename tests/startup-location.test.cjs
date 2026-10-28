const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { detectedDelivery, withLocationDeadline, acquireCoordinates, resolveStartupDelivery } = require('../src/features/location/startupLocation.ts');
const { reconcileDeliveryAddress } = require('../src/features/account/validation.ts');
const { hasRecipient } = require('../src/features/order/recipient.ts');
const { useOrderStore } = require('../src/store/orderStore.ts');

test('GPS delivery uses coordinates and recipient from profile without a fabricated phone or saved ID', () => {
  const address = detectedDelivery({ latitude: 0, longitude: 106 }, ' 26 Văn Chung ', { full_name: ' Nguyễn An ', phone: '(+84) 901-234-567' });
  assert.deepEqual(address, { latitude: 0, longitude: 106, street: '26 Văn Chung', label: 'Other', recipientName: 'Nguyễn An', recipientPhone: '+84901234567' });
  assert.equal(hasRecipient(address), true);
  assert.equal(hasRecipient(detectedDelivery(address, address.street, null)), false);
  assert.throws(() => detectedDelivery({ latitude: 91, longitude: 0 }, 'Địa chỉ', null));
  assert.throws(() => detectedDelivery(address, ' ', null));
});

test('saved address refresh cannot replace GPS; explicit user selection advances its revision', () => {
  const gps = detectedDelivery({ latitude: 10, longitude: 106 }, 'Vị trí mới', null);
  const saved = { id: 'a', title: 'Home', address: 'Địa chỉ cũ', latitude: 11, longitude: 107, is_default: true };
  assert.equal(reconcileDeliveryAddress(gps, [saved]), gps);
  useOrderStore.setState(useOrderStore.getInitialState());
  const revision = useOrderStore.getState().deliverySelectionVersion;
  useOrderStore.setState({ deliveryAddress: { ...gps, savedAddressId: 'a' } });
  assert.equal(useOrderStore.getState().deliverySelectionVersion, revision);
  useOrderStore.getState().setDeliveryAddress(gps);
  assert.equal(useOrderStore.getState().deliverySelectionVersion, revision + 1);
});

test('startup GPS has a deadline and a late result cannot become a second successful completion', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  await assert.rejects(withLocationDeadline(pending, 5), /bật GPS/);
  finish('late address');
  assert.equal(await withLocationDeadline(Promise.resolve('địa chỉ thật'), 50), 'địa chỉ thật');
  await assert.rejects(withLocationDeadline(Promise.reject(new Error('Quyền bị từ chối')), 50), /từ chối/);
});

test('fresh Android last-known fix avoids waiting for a new GPS update', async () => {
  let calls = 0;
  assert.deepEqual(await acquireCoordinates({ servicesEnabled: async () => true,
    lastKnown: async () => ({ coords: { latitude: 0, longitude: 106 } }),
    current: async () => { calls++; throw new Error('must not wait for another fix'); },
  }), { latitude: 0, longitude: 106 });
  assert.equal(calls, 0);
});

test('missing or invalid last-known fix requests GPS; disabled services report the cause', async () => {
  const provider = { servicesEnabled: async () => true, lastKnown: async () => null, current: async () => ({ coords: { latitude: 10, longitude: 106 } }) };
  assert.deepEqual(await acquireCoordinates(provider), { latitude: 10, longitude: 106 });
  assert.deepEqual(await acquireCoordinates({ ...provider, lastKnown: async () => ({ coords: { latitude: NaN, longitude: 0 } }) }), { latitude: 10, longitude: 106 });
  await assert.rejects(acquireCoordinates({ ...provider, servicesEnabled: async () => false }), /Dịch vụ vị trí đang tắt/);
});

test('profile loading does not block coordinates/geocoding and failed profiles do not discard GPS', async () => {
  let releaseProfile;
  const profile = new Promise(resolve => { releaseProfile = resolve; });
  const seen = [];
  const point = { latitude: 10, longitude: 106 };
  const resolving = resolveStartupDelivery({ coordinates: async () => point,
    profile: () => profile, onCoordinates: p => seen.push(p),
    address: async p => { assert.deepEqual(seen, [point]); assert.equal(p, point); releaseProfile({ full_name: 'Nguyễn An', phone: '0901234567' }); return '26 Văn Chung'; },
  });
  assert.equal((await resolving).recipientName, 'Nguyễn An');
  const result = await resolveStartupDelivery({ coordinates: async () => point, address: async () => '26 Văn Chung', profile: async () => { throw new Error('offline'); } });
  assert.equal(result.latitude, 10);
  assert.equal(result.recipientPhone, '');
});

test('reverse-geocoding failure preserves the successful coordinates for manual address entry', async () => {
  let known;
  const point = { latitude: 10, longitude: 106 };
  await assert.rejects(resolveStartupDelivery({ coordinates: async () => point, profile: async () => null,
    onCoordinates: value => { known = value; }, address: async () => { throw new Error('Dịch vụ địa chỉ chưa phản hồi'); },
  }), /Dịch vụ địa chỉ/);
  assert.equal(known, point);
});
