const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  module._compile(outputText, filename);
};
const { createAuthStore } = require('../src/store/authState.ts');
const session = { user: { id: 'real-user', email: 'alex@example.com', user_metadata: { full_name: 'Alex' } } };
const result = (session, error = null) => ({ data: { session }, error });
function fixture(overrides = {}) {
  let listener;
  let unsubscribed = false;
  const auth = {
    getSession: async () => result(session),
    onAuthStateChange: (callback) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
    },
    signInWithPassword: async () => result(session),
    signUp: async () => result(null),
    signOut: async () => ({ error: null }),
    ...overrides,
  };
  return { store: createAuthStore({ auth }), emit: (value) => listener('SIGNED_OUT', value), unsubscribed: () => unsubscribed };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('missing configuration initializes signed out and cannot create a demo session', async () => {
  const store = createAuthStore(null);
  store.getState().initialize()();
  await assert.rejects(store.getState().login('a@example.com', 'secret'), /not configured/);
  assert.equal(store.getState().isInitialized, true);
  assert.equal(store.getState().isAuthenticated, false);
  assert.equal(store.getState().isLoading, false);
});

test('restores a persisted session, handles remote sign-out and unsubscribes', async () => {
  const f = fixture();
  const cleanup = f.store.getState().initialize();
  await tick();
  assert.equal(f.store.getState().user.name, 'Alex');
  f.emit(null);
  assert.equal(f.store.getState().isAuthenticated, false);
  cleanup();
  assert.equal(f.unsubscribed(), true);
});

test('a stale storage response cannot restore a session after sign-out', async () => {
  let resolve;
  const f = fixture({ getSession: () => new Promise((done) => { resolve = done; }) });
  f.store.getState().initialize();
  f.emit(null);
  resolve(result(session));
  await tick();
  assert.equal(f.store.getState().user, null);
});

test('unmounted initialization ignores late responses', async () => {
  const f = fixture();
  f.store.getState().initialize()();
  await tick();
  assert.equal(f.store.getState().user, null);
});

test('login normalizes email, preserves password and exposes server failures', async () => {
  const f = fixture({ signInWithPassword: async (credentials) => {
    assert.deepEqual(credentials, { email: 'alex@example.com', password: ' secret ' });
    return result(null, new Error('Invalid login credentials'));
  } });
  await assert.rejects(f.store.getState().login(' Alex@Example.com ', ' secret '), /Invalid login/);
  assert.equal(f.store.getState().isAuthenticated, false);
  assert.equal(f.store.getState().isLoading, false);
});

test('registration sends full_name and waits for email confirmation without a session', async () => {
  const f = fixture({ signUp: async (credentials) => {
    assert.equal(credentials.options.data.full_name, 'Alex');
    return result(null);
  } });
  assert.equal(await f.store.getState().register(' Alex ', 'a@example.com', 'secret'), false);
  assert.equal(f.store.getState().user, null);
});

test('successful registration accepts an immediate session when email confirmation is disabled', async () => {
  const f = fixture({ signUp: async () => result(session) });
  assert.equal(await f.store.getState().register('Alex', 'a@example.com', 'secret'), true);
  assert.equal(f.store.getState().isAuthenticated, true);
});

test('logout failure retains the session, successful logout clears it', async () => {
  let fail = true;
  const f = fixture({ signOut: async () => ({ error: fail ? new Error('Offline') : null }) });
  await f.store.getState().login('a@example.com', 'secret');
  await assert.rejects(f.store.getState().logout(), /Offline/);
  assert.equal(f.store.getState().isAuthenticated, true);
  fail = false;
  await f.store.getState().logout();
  assert.equal(f.store.getState().user, null);
});

test('concurrent submits are rejected until the request completes', async () => {
  let resolve;
  const f = fixture({ signInWithPassword: () => new Promise((done) => { resolve = done; }) });
  const pending = f.store.getState().login('a@example.com', 'secret');
  await assert.rejects(f.store.getState().login('a@example.com', 'secret'), /already in progress/);
  resolve(result(session));
  await pending;
  assert.equal(f.store.getState().isLoading, false);
});
