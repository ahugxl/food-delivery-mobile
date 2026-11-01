const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {createClient}=require('@supabase/supabase-js');
const {REWARD_TIERS,parseRewardRequest,rewardRequestKey}=require('../src/features/offers/rewards.ts');
const {createRewardsApi}=require('../src/services/rewardsApi.ts');
const id='11111111-1111-4111-8111-111111111111';
test('reward tiers match the requested amounts and pending requests cannot inject a price',()=>{
  assert.deepEqual(REWARD_TIERS.map(t=>[t.points,t.amount]),[[10000,10000],[19000,20000],[28000,30000],[47000,50000]]);
  assert.equal(parseRewardRequest({id,amount:15000}),null);assert.equal(parseRewardRequest({id:'bad',amount:10000}),null);
  assert.deepEqual(parseRewardRequest({id,amount:10000,points:1,userId:'other'}),{id,amount:10000});
  assert.notEqual(rewardRequestKey('a'),rewardRequestKey('b'));
});
test('redemption sends a request ID, amount and expected session user; costs are server-owned',async()=>{
  const calls=[];const db=createClient('https://rewards.test.supabase.co','key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{
    calls.push({url:new URL(url),body:init.body?JSON.parse(init.body):null});
    return new Response(JSON.stringify(init.method==='POST'?{redemption_id:id,balance:0}:[]),{headers:{'content-type':'application/json'}});
  }}});
  const api=createRewardsApi(db);await api.redeem(id,{id,amount:20000});
  assert.equal(calls[0].url.pathname,'/rest/v1/rpc/redeem_loyalty_voucher');
  assert.deepEqual(calls[0].body,{p_request_id:id,p_discount_amount:20000,p_expected_user_id:id});
  await api.history(id);assert.equal(calls[1].url.searchParams.get('user_id'),`eq.${id}`);
  await assert.rejects(api.redeem(id,{id,amount:1}));assert.equal(calls.length,2);
});
