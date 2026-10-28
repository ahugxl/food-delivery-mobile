const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { userMessage } = require('../src/utils/userMessage.ts');

test('email quota is distinguished from user request throttling by Supabase code or message', () => {
  assert.match(userMessage({ code: 'over_email_send_rate_limit', message: 'Unexpected server response' }), /giới hạn gửi email xác nhận/);
  assert.match(userMessage({ message: 'email rate limit exceeded' }), /giới hạn gửi email xác nhận/);
  assert.match(userMessage({ code: 'over_request_rate_limit', message: 'Request throttled' }), /thao tác quá nhanh/);
  assert.match(userMessage({ message: 'Too many requests' }), /thao tác quá nhanh/);
});

test('SMTP recipient restriction explains server configuration without exposing raw error details', () => {
  assert.match(userMessage({ code: 'email_address_not_authorized', message: 'secret internal SMTP details' }), /Máy chủ chưa được cấu hình/);
  assert.doesNotMatch(userMessage({ code: 'email_address_not_authorized', message: 'secret internal SMTP details' }), /secret/);
});
