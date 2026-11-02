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

test('password recovery sends email without a redirect and verifies a recovery OTP before updating the same user', async () => {
  const calls = [];
  const recovery = createPasswordRecovery({ auth: {
    resetPasswordForEmail: async (...args) => { calls.push(args); return { error: null }; },
    verifyOtp: async value => { calls.push(value); return { data: { session: {}, user: { id: 'user-a' } }, error: null }; },
    getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }),
    updateUser: async value => { calls.push(value); return { error: null }; },
  } });
  await recovery.request(' An@Example.com ');
  assert.deepEqual(calls[0], ['an@example.com']);
  assert.equal(await recovery.verify(' An@Example.com ', '12 345678'), 'user-a');
  assert.deepEqual(calls[1], { email: 'an@example.com', token: '12345678', type: 'recovery' });
  await assert.rejects(recovery.update('123', '123', 'user-a'), /6 ký tự/);
  await assert.rejects(recovery.update('secret1', 'secret2', 'user-a'), /không khớp/);
  await assert.rejects(recovery.update('secret1', 'secret1', ''), /xác nhận mã/);
  await recovery.update(' secret ', ' secret ', 'user-a');
  assert.deepEqual(calls.at(-1), { password: ' secret ' });
});

test('recovery rejects invalid input, expired OTPs and missing sessions without changing a password', async () => {
  let verifies=0,updates=0;
  const auth={
    resetPasswordForEmail: async () => ({ error: Error('rate limit') }),
    verifyOtp: async () => { verifies++;return { data: {}, error: { code:'otp_expired' } }; },
    updateUser: async () => { updates++;return { error:null }; },
  };
  const recovery=createPasswordRecovery({auth});
  await assert.rejects(recovery.request('invalid'),/email hợp lệ/);
  await assert.rejects(recovery.request('an@example.com'),/rate limit/);
  for(const code of ['', '123', 'abcdef', '12345678901'])await assert.rejects(recovery.verify('an@example.com',code),/6–10/);
  assert.equal(verifies,0);
  await assert.rejects(recovery.verify('an@example.com','123456'),/không đúng hoặc đã hết hạn/);
  auth.verifyOtp=async()=>({data:{user:{id:'user-a'},session:null},error:null});
  await assert.rejects(recovery.verify('an@example.com','123456'),/Chưa xác minh/);
  assert.equal(updates,0);
});

test('a changed recovery session never updates another account password and provider errors remain visible', async () => {
  let updates=0;
  const auth={getUser:async()=>({data:{user:{id:'other'}},error:null}),updateUser:async()=>{updates++;return {error:Error('weak password')};}};
  const recovery=createPasswordRecovery({auth});
  await assert.rejects(recovery.update('secret1','secret1','user-a'),/Phiên khôi phục/);
  assert.equal(updates,0);
  auth.getUser=async()=>({data:{user:{id:'user-a'}},error:null});
  await assert.rejects(recovery.update('secret1','secret1','user-a'),/weak password/);
  assert.equal(updates,1);
});
