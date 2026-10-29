const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { menuSections } = require('../src/features/catalog/menuSections.ts');

test('menu grouping keeps odd rows within their category and preserves every food once', () => {
  const foods = [
    { id: '1', name: 'Trà đào', category_id: 'tea' },
    { id: '2', name: 'Bánh mì', category_id: 'bread' },
    { id: '3', name: 'Trà chanh', category_id: 'tea' },
    { id: '4', name: 'Trà sen', category_id: 'tea' },
    { id: '5', name: 'Món chưa phân loại', category_id: null },
    { id: '6', name: 'Danh mục bị thiếu', category_id: 'missing' },
  ];
  const categories = [{ id: 'tea', name: 'Trà' }, { id: 'bread', name: 'Bánh' }, { id: 'empty', name: 'Không có món' }];
  const sections = menuSections(foods, categories);
  assert.deepEqual(sections.map(s => s.title), ['Bánh', 'Trà', 'Món khác']);
  assert.deepEqual(sections.find(s => s.key === 'tea').data.map(row => row.length), [2, 1]);
  assert.deepEqual(sections.flatMap(s => s.data.flat()).map(f => f.id).sort(), foods.map(f => f.id).sort());
  assert.deepEqual(menuSections([], categories), []);
  assert.equal(menuSections([foods[1]], categories)[0].count, 1);
  assert.deepEqual(foods.map(f => f.id), ['1', '2', '3', '4', '5', '6']);
});
