const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { orderHistoryMonths, orderHistoryTime } = require('../src/features/order/history.ts');

test('order history groups and sorts using Vietnam dates across a UTC month boundary', () => {
  const orders = [
    { id: 'old', created_at: '2026-09-30T16:59:00Z' },
    { id: 'boundary', created_at: '2026-09-30T17:00:00Z' },
    { id: 'new', created_at: '2026-10-29T15:32:00Z' },
  ];
  const sections = orderHistoryMonths(orders, new Date('2026-10-30T00:00:00Z'));
  assert.deepEqual(sections.map(s => s.title), ['Tháng này', 'Tháng 9, 2026']);
  assert.deepEqual(sections[0].data.map(o => o.id), ['new', 'boundary']);
  assert.equal(orderHistoryTime(orders[2].created_at), '22:32, 29 thg 10 2026');
  assert.equal(orderHistoryTime(orders[1].created_at), '00:00, 01 thg 10 2026');
  assert.deepEqual(orders.map(o => o.id), ['old', 'boundary', 'new']);
  assert.deepEqual(orderHistoryMonths([]), []);
  assert.equal(orderHistoryTime('invalid'), 'Chưa có thời gian');
});

test('legacy orders without a timestamp stay visible in an unknown-date section', () => {
  const sections = orderHistoryMonths([
    { id: 'legacy', created_at: null },
    { id: 'dated', created_at: '2026-10-29T15:32:00Z' },
  ], new Date('2026-10-30T00:00:00Z'));
  assert.equal(orderHistoryTime(null), 'Chưa có thời gian');
  assert.deepEqual(sections.map(s => s.title), ['Tháng này', 'Đơn hàng khác']);
  assert.equal(sections[1].data[0].id, 'legacy');
});
