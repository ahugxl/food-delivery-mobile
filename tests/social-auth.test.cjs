const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { createSocialAuthFlow, oauthCode } = require('../src/services/socialAuthFlow.ts');

test('native OAuth exchanges the PKCE code once even when callback and browser both complete', async () => {
  const codes=[],calls=[];
  const flow=createSocialAuthFlow({auth:{signInWithOAuth:async input=>{calls.push(input);return {data:{url:'https://auth.test/authorize'},error:null};},exchangeCodeForSession:async code=>{codes.push(code);return {error:null};}}},
    {redirectTo:'food-delivery://oauth-callback',web:false,ensureEnabled:async()=>{},openSession:async()=>({type:'success',url:'food-delivery://oauth-callback?code=test-code'})});
  await flow.start('google'); await flow.complete('food-delivery://oauth-callback?code=test-code');
  assert.deepEqual(codes,['test-code']);assert.equal(calls[0].options.skipBrowserRedirect,true);
});

test('disabled providers, cancellation and unexpected redirects never create a fake session', async () => {
  let exchanges=0,requests=0;
  const client={auth:{signInWithOAuth:async()=>{requests++;return {data:{url:'https://auth.test'},error:null};},exchangeCodeForSession:async()=>{exchanges++;return {error:null};}}};
  const options={redirectTo:'food-delivery://oauth-callback',web:false,ensureEnabled:async()=>{},openSession:async()=>({type:'cancel'})};
  await createSocialAuthFlow(client,options).start('facebook');assert.equal(exchanges,0);
  await assert.rejects(createSocialAuthFlow(client,{...options,ensureEnabled:async()=>{throw Error('not configured');}}).start('google'),/not configured/);
  assert.equal(requests,1);
  await assert.rejects(createSocialAuthFlow(client,{...options,openSession:async()=>({type:'success',url:'https://other.test/oauth-callback?code=bad'})}).start('google'),/hợp lệ/);
  assert.equal(exchanges,0);assert.throws(()=>oauthCode('food-delivery://oauth-callback?error=access_denied'),/chưa thành công/);
});

test('web OAuth requests a normal browser redirect and leaves completion to the callback page', async () => {
  let args;
  const flow=createSocialAuthFlow({auth:{signInWithOAuth:async input=>{args=input;return {data:{url:'https://auth.test'},error:null};}}},
    {redirectTo:'https://app.test/oauth-callback',web:true,ensureEnabled:async()=>{},openSession:async()=>{throw Error('must not open popup');}});
  await flow.start('facebook');assert.equal(args.options.skipBrowserRedirect,false);assert.equal(args.provider,'facebook');
});
