const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { differsFromDefault } = require('../src/features/location/addressReminder.ts');
const saved = { street: '26 Văn Chung', label: 'Home', latitude: 10.8, longitude: 106.65 };

test('address reminder ignores GPS drift and geocoder wording but flags a different destination', () => {
  assert.equal(differsFromDefault({ ...saved, street: '26 Đường Văn Chung, TP. Hồ Chí Minh', latitude: 10.8002 }, saved), false);
  assert.equal(differsFromDefault({ ...saved, latitude: 10.81 }, saved), true);
});

test('no reminder without a default or a detected address; old addresses use normalized text', () => {
  assert.equal(differsFromDefault(null, saved), false);
  assert.equal(differsFromDefault(saved, null), false);
  assert.equal(differsFromDefault({ street: ' ', label: 'Other' }, saved), false);
  const old = { street: '26 Văn Chung', label: 'Home' };
  assert.equal(differsFromDefault({ street: ' 26  VĂN CHUNG, ', label: 'Other' }, old), false);
  assert.equal(differsFromDefault({ street: '400 Nguyễn Xí', label: 'Other' }, old), true);
});
