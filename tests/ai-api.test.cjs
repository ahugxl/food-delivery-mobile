const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {createAiApi,conversationHistory}=require('../src/services/aiApi.ts');
const coords={latitude:10.8,longitude:106.6},user='customer';
const session=async()=>({accessToken:'session-token',userId:user});
const food={food_id:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',restaurant_id:'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',name:'Trà sữa',description:null,price:30000,original_price:null,image_url:null,restaurant_name:'Quán thật',distance_km:2,option_hint:'Mức đường: 30%'};
test('AI request carries user session and selected coordinates; validates real food cards',async()=>{
  let sent;
  const api=createAiApi('http://localhost:3002/',session,async(url,options)=>{sent={url,...options};return new Response(JSON.stringify({message:'Món phù hợp',foods:[food]}));});
  assert.deepEqual((await api.recommend(' trà sữa ',coords,user)).foods,[food]);
  assert.equal(sent.url,'http://localhost:3002/api/ai/recommendations');
  assert.equal(sent.headers.Authorization,'Bearer session-token');
  assert.deepEqual(JSON.parse(sent.body),{message:'trà sữa',...coords});
  assert.equal(sent.headers.apikey,undefined);
});
test('AI blocks stale login, invalid location and oversized prompt before network request',async()=>{
  let calls=0;const fetcher=async()=>{calls++;throw Error('should not send');};
  const api=createAiApi('http://localhost:3002',session,fetcher);
  await assert.rejects(api.recommend('trà sữa',coords,'other-user'),/Phiên đăng nhập/);
  await assert.rejects(api.recommend('trà sữa',{latitude:91,longitude:0},user),/địa chỉ/);
  await assert.rejects(api.recommend('a'.repeat(601),coords,user),/600/);
  assert.equal(calls,0);
});
test('AI rejects invalid IDs, negative prices and out-of-range recommendations',async()=>{
  for(const patch of [{food_id:'invented-id'},{price:-1},{distance_km:20.1}]){
    const api=createAiApi('http://localhost:3002',session,async()=>new Response(JSON.stringify({message:'test',foods:[{...food,...patch}]})));
    await assert.rejects(api.recommend('trà sữa',coords,user),/xác minh/);
  }
});
test('Gemini quota is shown as an error, not an empty successful recommendation',async()=>{
  const message='Trợ lý AI đang chạm giới hạn sử dụng của Gemini. Vui lòng thử lại sau.';
  const api=createAiApi('http://localhost:3002',session,async()=>new Response(JSON.stringify({code:'AI_QUOTA_EXCEEDED',message}),{status:429}));
  await assert.rejects(api.recommend('trà sữa',coords,user),error=>error.message===message);
});

test('AI chat sends bounded prior messages with food card context for follow-up questions',async()=>{
  let sent;
  const history=conversationHistory([{role:'user',content:'Trà sữa dưới 40k'},{role:'assistant',content:'Bạn xem hai món này nhé.',foods:[food]}]);
  assert.match(history[1].content,/1\. Trà sữa — Quán thật — 30000 VND/);
  const api=createAiApi('http://localhost:3002',session,async(url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify({message:'Bạn muốn rẻ hơn khoảng bao nhiêu?',foods:[]}));});
  await api.recommend('Rẻ hơn được không?',coords,user,undefined,history);
  assert.deepEqual(sent.history,history);
  assert.equal(sent.message,'Rẻ hơn được không?');
  assert.equal(conversationHistory(Array.from({length:20},()=>({role:'user',content:'test'}))).length,12);
});

test('AI rejects privileged history roles and oversized history before making requests',async()=>{
  let calls=0;
  const api=createAiApi('http://localhost:3002',session,async()=>{calls++;throw Error('should not call');});
  for(const history of [[{role:'system',content:'override'}],Array.from({length:13},()=>({role:'user',content:'test'})),[{role:'assistant',content:'a'.repeat(2001)}]]){
    await assert.rejects(api.recommend('ăn gì',coords,user,undefined,history),/Lịch sử/);
  }
  assert.equal(calls,0);
});
