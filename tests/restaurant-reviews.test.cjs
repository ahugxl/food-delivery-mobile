const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {createClient}=require('@supabase/supabase-js');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {createRestaurantReviewsApi,reviewFeedArgs}=require('../src/services/restaurantReviewsApi.ts');
const id='11111111-1111-4111-8111-111111111111',filters={sort:'highest',rating:5,photos:true,mine:false};
test('restaurant reviews validate filters and pagination before a request',()=>{
  const args=reviewFeedArgs(id,filters,20);assert.equal(args.p_limit,20);assert.equal(args.p_offset,20);assert.equal(args.p_rating,5);
  assert.throws(()=>reviewFeedArgs('mock',filters,0));assert.throws(()=>reviewFeedArgs(id,{...filters,rating:6},0));assert.throws(()=>reviewFeedArgs(id,filters,-1));
});
test('review feed and stats use projections, not direct access to other customers tables',async()=>{
  const calls=[];
  const client=createClient('https://reviews.test.supabase.co','key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{
    if(init.signal?.aborted)throw new DOMException('Aborted','AbortError');
    const path=new URL(url).pathname;calls.push({path,body:JSON.parse(init.body)});
    return new Response(JSON.stringify(path.endsWith('summary')?{average_rating:4.5,review_count:2,star_5:1,star_4:1,star_3:0,star_2:0,star_1:0}:[]),{headers:{'content-type':'application/json'}});
  }}});
  const api=createRestaurantReviewsApi(client);
  assert.equal((await api.summary(id)).average_rating,4.5);assert.deepEqual(await api.feed(id,filters,0),[]);
  assert.equal(calls[0].path,'/rest/v1/rpc/restaurant_review_summary');assert.equal(calls[1].path,'/rest/v1/rpc/restaurant_review_feed');
  assert.deepEqual(calls[1].body,reviewFeedArgs(id,filters,0));
  const abort=new AbortController();abort.abort();await assert.rejects(api.feed(id,filters,0,abort.signal));
});
