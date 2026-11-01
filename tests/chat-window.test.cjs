const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { canSendCustomerMessage, CUSTOMER_CHAT_GRACE_MS } = require('../src/features/chat/chatWindow.ts');

test('customer chat closes exactly five minutes after server completion time', () => {
  const completed = Date.parse('2026-11-02T10:00:00Z');
  const order = { status: 'completed', completed_at: new Date(completed).toISOString() };
  assert.equal(canSendCustomerMessage(order, completed), true);
  assert.equal(canSendCustomerMessage(order, completed + CUSTOMER_CHAT_GRACE_MS - 1), true);
  assert.equal(canSendCustomerMessage(order, completed + CUSTOMER_CHAT_GRACE_MS), false);
  assert.equal(canSendCustomerMessage(order, completed + 86400000), false);
  assert.equal(canSendCustomerMessage(order, completed - 1), false);
});
test('only active orders or completed orders with a valid timestamp allow sending', () => {
  for (const status of ['pending', 'preparing', 'delivering']) assert.equal(canSendCustomerMessage({ status, completed_at: null }), true);
  for (const status of ['cancelled', null, 'unknown']) assert.equal(canSendCustomerMessage({ status, completed_at: null }), false);
  for (const completed_at of [null, '', 'invalid']) assert.equal(canSendCustomerMessage({ status: 'completed', completed_at }), false);
  assert.equal(canSendCustomerMessage(null), false);
  assert.equal(canSendCustomerMessage({ status: 'delivering', completed_at: null }, NaN), false);
});
