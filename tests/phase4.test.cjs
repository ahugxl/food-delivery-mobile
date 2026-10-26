const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,file);
const { reviewPayload } = require('../src/features/reviews/review.ts');
const { applyFavorite, rollbackFavorite } = require('../src/features/favorites/optimistic.ts');
const { createEngagementApi } = require('../src/services/engagementApi.ts');
const { orderSection } = require('../src/features/order/history.ts');
const { useFavoritesStore } = require('../src/store/favoritesStore.ts');
const input = { restaurantRating: 5, driverRating: 4, restaurantFeedback: ' Great food ', driverFeedback: ' On time ', tags: ['Friendly','On-time','Friendly'] };
const saved = { id:'review',order_id:'order',user_id:'user',restaurant_rating:5,driver_rating:4,restaurant_feedback:'Great food',driver_feedback:'On time',driver_tags:['Friendly','On-time'],created_at:'2026-10-26T00:00:00Z' };
function fixture(responses) {
  const requests=[];
  const client=createClient('https://phase4.test.supabase.co','test-key',{auth:{persistSession:false},global:{fetch:async(url,init)=>{
    requests.push({url:new URL(url),init}); const next=responses.shift();
    return new Response(next.status===204 ? null : JSON.stringify(next.body),{status:next.status??200,headers:{'content-type':'application/json'}});
  }}});
  return {api:createEngagementApi(client),requests};
}
test('review preserves independent restaurant/driver stars, feedback and deduplicated tags',()=>{
  const row=reviewPayload('order','user',input);
  assert.equal(row.restaurant_rating,5); assert.equal(row.driver_rating,4);
  assert.equal(row.restaurant_feedback,'Great food'); assert.deepEqual(row.driver_tags,['Friendly','On-time']);
});
test('zero, fractional, out-of-range stars, unknown tags and overlong feedback are rejected',()=>{
  for(const rating of [0,1.5,6,NaN]) assert.throws(()=>reviewPayload('order','user',{...input,restaurantRating:rating}),/1 đến 5/);
  assert.throws(()=>reviewPayload('order','user',{...input,tags:['Unrecognized']}),/Nhãn/);
  assert.throws(()=>reviewPayload('order','user',{...input,driverFeedback:'x'.repeat(2001)}),/2.000/);
});
test('review checks authenticated owner and completed status before posting',async()=>{
  const f=fixture([{body:[{id:'order',status:'pending'}]}]);
  await assert.rejects(f.api.submitReview('order','user',input),/hoàn thành/);
  assert.equal(f.requests.length,1); assert.equal(f.requests[0].url.searchParams.get('user_id'),'eq.user');
});
test('completed review inserts real columns and returns the server record',async()=>{
  const f=fixture([{body:[{id:'order',status:'completed'}]},{body:saved}]);
  assert.equal((await f.api.submitReview('order','user',input)).id,'review');
  assert.equal(f.requests[1].url.pathname,'/rest/v1/reviews');
  assert.equal(JSON.parse(f.requests[1].init.body).driver_rating,4);
});
test('duplicate review retry reads the existing review instead of duplicating or overwriting it',async()=>{
  const f=fixture([{body:[{id:'order',status:'completed'}]},{status:409,body:{code:'23505',message:'duplicate'}},{body:[saved]}]);
  assert.equal((await f.api.submitReview('order','user',input)).id,'review');
  assert.equal(f.requests[2].url.searchParams.get('order_id'),'eq.order');
  assert.equal(f.requests[2].url.searchParams.get('user_id'),'eq.user');
});
test('review backend error propagates without marking the order completed',async()=>{
  const f=fixture([{body:[{id:'order',status:'completed'}]},{status:403,body:{code:'42501',message:'permission denied'}}]);
  await assert.rejects(f.api.submitReview('order','user',input),error=>error.message==='permission denied');
  assert.equal(f.requests.some(request=>request.url.pathname==='/rest/v1/orders' && request.init.method==='PATCH'),false);
});
test('favorite insert is idempotent and deletion is scoped to both owner and restaurant',async()=>{
  const f=fixture([{status:204},{status:204}]);
  await f.api.setFavorite('user','restaurant',true); await f.api.setFavorite('user','restaurant',false);
  assert.match(new Headers(f.requests[0].init.headers).get('prefer'),/ignore-duplicates/);
  assert.equal(f.requests[0].url.searchParams.get('on_conflict'),'user_id,restaurant_id');
  assert.equal(f.requests[1].init.method,'DELETE'); assert.equal(f.requests[1].url.searchParams.get('user_id'),'eq.user');
  assert.equal(f.requests[1].url.searchParams.get('restaurant_id'),'eq.restaurant');
});
test('favorite query is scoped and skips null joined restaurants',async()=>{
  const f=fixture([{body:[{restaurants:null}]}]);
  assert.deepEqual(await f.api.favorites('user'),[]); assert.equal(f.requests[0].url.searchParams.get('user_id'),'eq.user');
});
test('optimistic favorite rollback preserves concurrent changes for other restaurants',()=>{
  const a={id:'a'},b={id:'b'},c={id:'c'};
  const previous=[a,b]; const afterRemoval=applyFavorite(previous,a,false); const concurrent=applyFavorite(afterRemoval,c,true);
  const rolled=rollbackFavorite(concurrent,'a',previous);
  assert.deepEqual(new Set(rolled.map(row=>row.id)),new Set(['a','b','c']));
  assert.equal(rollbackFavorite(applyFavorite([b],a,true),'a',[b]).some(row=>row.id==='a'),false);
});
test('same restaurant cannot be toggled simultaneously across Home and Favorites',()=>{
  useFavoritesStore.setState(useFavoritesStore.getInitialState());
  assert.equal(useFavoritesStore.getState().beginUpdate('user:r'),true);
  assert.equal(useFavoritesStore.getState().beginUpdate('user:r'),false);
  assert.equal(useFavoritesStore.getState().beginUpdate('user:other'),true);
  useFavoritesStore.getState().endUpdate('user:r');
  assert.equal(useFavoritesStore.getState().beginUpdate('user:r'),true);
});
test('order sections keep pending/preparing/delivering active and terminal orders in history',()=>{
  for(const status of ['pending','preparing','delivering']) assert.equal(orderSection(status),'active');
  for(const status of ['completed','cancelled']) assert.equal(orderSection(status),'history');
});
