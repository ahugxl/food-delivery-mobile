const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { isDiscountedFood, foodDiscountPercent } = require('../src/features/catalog/foodPricing.ts');

test('food offers require a valid original price above the selling price', () => {
  assert.equal(isDiscountedFood({ price: 12250, original_price: 24500 }), true);
  assert.equal(isDiscountedFood({ price: 0, original_price: 10000 }), true);
  for (const original_price of [null, 0, 10000, 12250, NaN, Infinity]) {
    assert.equal(isDiscountedFood({ price: 12250, original_price }), false);
  }
  for (const price of [-1, NaN, Infinity]) {
    assert.equal(isDiscountedFood({ price, original_price: 24500 }), false);
  }
});

test('discount badge rounds the saving from original and selling prices and hides absent promotions', () => {
  assert.equal(foodDiscountPercent({ price: 38000, original_price: 54800 }), 31);
  assert.equal(foodDiscountPercent({ price: 12250, original_price: 24500 }), 50);
  assert.equal(foodDiscountPercent({ price: 0, original_price: 24500 }), 100);
  for (const original_price of [null, 0, 38000, 10000]) {
    assert.equal(foodDiscountPercent({ price: 38000, original_price }), null);
  }
});
