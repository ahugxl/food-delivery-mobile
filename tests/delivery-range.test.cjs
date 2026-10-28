const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { deliveryRange } = require('../src/features/location/deliveryRange.ts');

test('delivery warning uses strictly more than 20 km, including valid zero coordinates', () => {
  const origin = { latitude: 0, longitude: 0 };
  const pointAtKm = km => ({ latitude: km / 6371 * 180 / Math.PI, longitude: 0 });
  assert.equal(deliveryRange(origin, pointAtKm(19.999)).outsideRange, false);
  assert.equal(deliveryRange(origin, pointAtKm(20)).outsideRange, false);
  assert.equal(deliveryRange(origin, pointAtKm(20.001)).outsideRange, true);
  assert.equal(deliveryRange(origin, origin).distanceKm, 0);
});

test('unknown or invalid coordinates never invent a far-away customer location', () => {
  const point = { latitude: 10.8, longitude: 106.7 };
  for (const missing of [null, undefined, {}, { latitude: null, longitude: 106 }, { latitude: 91, longitude: 0 }]) {
    assert.deepEqual(deliveryRange(point, missing), { distanceKm: null, outsideRange: false });
    assert.deepEqual(deliveryRange(missing, point), { distanceKm: null, outsideRange: false });
  }
});
