const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, f);
const { signupPhone, isDuplicateAccount } = require('../src/features/account/signup.ts');
const { createAuthStore } = require('../src/store/authState.ts');
const { createPasswordRecovery } = require('../src/services/passwordRecovery.ts');

test('Vietnamese local and international phone formats have the same signup identity', () => {
  assert.equal(signupPhone('081 234 5678'), '+84812345678');
  assert.equal(signupPhone('(+84) 812-345-678'), '+84812345678');
  for (const phone of ['', '123', 'abc0901234567']) assert.throws(() => signupPhone(phone), /điện thoại/);
});

test('duplicate phone stops signup and duplicate email/obfuscated user produces recovery actions', async () => {
  let calls = 0;
  const client = { auth: { signUp: async () => { calls++; return { data: { session: null }, error: null }; } } };
  const store = createAuthStore(client, async phone => { assert.equal(phone, '+84901234567'); return true; });
  await assert.rejects(store.getState().register('An', 'an@example.com', 'secret', '0901234567'), isDuplicateAccount);
  assert.equal(calls, 0);
  for (const response of [
    { data: null, error: { code: 'user_already_exists', message: 'User already registered' } },
    { data: { session: null, user: { identities: [] } }, error: null },
  ]) {
    const f = createAuthStore({ auth: { signUp: async () => response } }, async () => false);
    await assert.rejects(f.getState().register('An', 'an@example.com', 'secret', '0901234567'), isDuplicateAccount);
    assert.equal(f.getState().isAuthenticated, false);
  }
});

test('missing/invalid phone and a failed availability check never call signup', async () => {
  let calls = 0;
  const store = createAuthStore({ auth: { signUp: async () => { calls++; } } }, async () => { throw Error('offline'); });
  await assert.rejects(store.getState().register('An', 'an@example.com', 'secret', ''), /điện thoại/);
  await assert.rejects(store.getState().register('An', 'an@example.com', 'secret', '0901234567'), /offline/);
  assert.equal(calls, 0);
});

test('password recovery normalizes email, exchanges the link code, validates passwords and propagates errors', async () => {
  const calls = [];
  const recovery = createPasswordRecovery({ auth: {
    resetPasswordForEmail: async (...args) => { calls.push(args); return { error: null }; },
    exchangeCodeForSession: async code => { calls.push(code); return { data: { session: {} }, error: null }; },
    updateUser: async value => { calls.push(value); return { error: null }; },
  } });
  await recovery.request(' An@Example.com ', 'fooddelivery://reset-password');
  assert.deepEqual(calls[0], ['an@example.com', { redirectTo: 'fooddelivery://reset-password' }]);
  await assert.rejects(recovery.verify(''), /không hợp lệ/);
  await recovery.verify('recovery-code');
  await assert.rejects(recovery.update('123', '123'), /6 ký tự/);
  await assert.rejects(recovery.update('secret1', 'secret2'), /không khớp/);
  await recovery.update(' secret ', ' secret ');
  assert.deepEqual(calls.at(-1), { password: ' secret ' });
  await assert.rejects(createPasswordRecovery({ auth: { resetPasswordForEmail: async () => ({ error: Error('rate limit') }) } }).request('an@example.com', 'url'), /rate limit/);
});
