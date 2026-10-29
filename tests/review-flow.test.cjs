const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { reviewStageArgs, reviewCharacterCount, earnsReviewReward } = require('../src/features/reviews/reviewFlow.ts');
const { createReviewFlowApi } = require('../src/services/reviewFlowApi.ts');
const { orderSnapshot } = require('../src/features/order/orderSnapshot.ts');

test('review rewards require trimmed 50 Unicode characters and an uploaded photo', () => {
  assert.equal(earnsReviewReward('x'.repeat(49), true), false);
  assert.equal(earnsReviewReward(' '+ 'x'.repeat(50)+' ', true), true);
  assert.equal(earnsReviewReward('x'.repeat(80), false), false);
  assert.equal(reviewCharacterCount(' 🍲🍲 '), 2);
  assert.equal(earnsReviewReward('🍲'.repeat(25), true), false);
});

test('restaurant payload rejects duplicate votes and foreign photo paths, while driver stage omits food data', () => {
  const input = { stage:'restaurant',rating:5,feedback:' good ',imagePath:'u/o/a.jpg',votes:[{food_id:'f',is_liked:false}] };
  const args = reviewStageArgs('o','u',input);
  assert.equal(args.p_feedback,'good'); assert.equal(args.p_food_votes[0].is_liked,false);
  assert.throws(()=>reviewStageArgs('o','u',{...input,imagePath:'other/o/a.jpg'}),/Ảnh/);
  assert.throws(()=>reviewStageArgs('o','u',{...input,votes:[...input.votes,...input.votes]}),/món/);
  assert.throws(()=>reviewStageArgs('o','u',{...input,rating:0}),/sao/);
  assert.deepEqual(reviewStageArgs('o','u',{...input,stage:'driver'}).p_food_votes,[]);
});

test('new review API sends RPC values without a client-supplied owner or reward amount', async () => {
  const requests=[];
  const client=createClient('https://reviews.test.supabase.co','key',{auth:{persistSession:false},global:{fetch:async(url,init)=>{
    requests.push({url:new URL(url),init});return new Response(JSON.stringify({id:'review',reward_points:500}),{status:200,headers:{'content-type':'application/json'}});
  }}});
  const result=await createReviewFlowApi(client).submit('o','u',{stage:'restaurant',rating:4,feedback:'ok',votes:[]});
  assert.equal(result.reward_points,500);
  assert.equal(requests[0].url.pathname,'/rest/v1/rpc/submit_order_review');
  const body=JSON.parse(requests[0].init.body);
  assert.equal(body.p_user_id,undefined);assert.equal(body.reward_points,undefined);
});

test('receipt text uses the order snapshot rather than current food names and options', () => {
  assert.deepEqual(orderSnapshot({food_name:'Món cũ',options:[{label:'Ít đường'},null],note:'không đá'},'Món mới'),{name:'Món cũ',description:'Ít đường, Ghi chú: không đá',image:null});
  assert.equal(orderSnapshot(null,'Món ăn').name,'Món ăn');
});
