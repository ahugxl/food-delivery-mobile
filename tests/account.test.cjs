const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
const {createClient}=require('@supabase/supabase-js');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {profileInput,addressInput,deliveryFromSaved,reconcileDeliveryAddress}=require('../src/features/account/validation.ts');
const {createAccountApi}=require('../src/services/accountApi.ts');
const row={id:'a',user_id:'u',title:'Home',address:'Address A',latitude:0,longitude:0,is_default:true};
function fixture(responses){
 const requests=[];
 const client=createClient('https://account.test.supabase.co','test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{
  requests.push({url:new URL(url),init});const next=responses.shift();return new Response(next.status===204?null:JSON.stringify(next.body),{status:next.status??200,headers:{'content-type':'application/json'}});
 }}});
 return {api:createAccountApi(client),requests};
}
test('profile validation trims names, normalizes phone, and never accepts role/points fields',()=>{
 const result=profileInput(' Nguyễn An ','(+84) 901-234-567','u/photo.jpg');
 assert.deepEqual(result,{p_full_name:'Nguyễn An',p_phone:'+84901234567',p_avatar_url:'u/photo.jpg'});
 assert.equal(profileInput('Name','',null).p_phone,null);
 assert.throws(()=>profileInput('x','',null),/2 đến 100/);
 assert.throws(()=>profileInput('Name','not a phone',null),/điện thoại/);
});
test('address validation requires a real pin including zero coordinates and a usable street',()=>{
 const payload=addressInput('id',{street:' Address A ',label:'Home',latitude:0,longitude:0},true,true);
 assert.equal(payload.p_latitude,0);assert.equal(payload.p_address,'Address A');
 assert.throws(()=>addressInput('id',{street:'Address A',label:'Home'},true,true),/tọa độ/);
 assert.throws(()=>addressInput('id',{street:'short enough',label:'Home',latitude:NaN,longitude:0},true,true),/tọa độ/);
});
test('saved addresses load default after restart without overwriting a manually chosen point',()=>{
 const empty={street:'',label:'Home'};
 assert.equal(reconcileDeliveryAddress(empty,[row]).savedAddressId,'a');
 const manual={street:'Manual address',label:'Other',latitude:1,longitude:2};
 assert.equal(reconcileDeliveryAddress(manual,[row]),manual);
});
test('address edits update checkout, deleted selections fall back, and legacy missing coordinates are not usable',()=>{
 const current=deliveryFromSaved(row);
 assert.equal(reconcileDeliveryAddress(current,[row]),current);
 assert.equal(reconcileDeliveryAddress(current,[{...row,address:'Updated address'}]).street,'Updated address');
 assert.equal(reconcileDeliveryAddress(current,[{...row,id:'b'}]).savedAddressId,'b');
 assert.deepEqual(reconcileDeliveryAddress(current,[]),{street:'',label:'Home'});
 assert.equal(deliveryFromSaved({...row,latitude:null}),null);
});
test('profile and address list queries are explicitly scoped and accept cancellation',async()=>{
 const f=fixture([{body:null},{body:[]}]),controller=new AbortController();
 await f.api.profile('u',controller.signal);await f.api.addresses('u',controller.signal);
 assert.equal(f.requests[0].url.searchParams.get('id'),'eq.u');
 assert.equal(f.requests[1].url.searchParams.get('user_id'),'eq.u');
 assert.equal(f.requests[1].init.signal,controller.signal);
});
test('profile save sends only whitelisted RPC fields and reports server denial',async()=>{
 const f=fixture([{body:{id:'u',full_name:'Name'}},{status:403,body:{message:'permission denied',code:'42501'}}]);
 await f.api.saveProfile('Name','',null);
 assert.match(f.requests[0].url.pathname,/rpc\/update_my_profile$/);
 assert.deepEqual(JSON.parse(f.requests[0].init.body),{p_full_name:'Name',p_phone:null,p_avatar_url:null});
 await assert.rejects(f.api.saveProfile('Name','',null),e=>e.message==='permission denied');
});
test('address creation retries reuse the same ID; deletion uses transactional RPC',async()=>{
 const f=fixture([{body:row},{body:row},{status:204}]);
 const address=deliveryFromSaved(row);
 await f.api.saveAddress('a',address,true,true);await f.api.saveAddress('a',address,true,true);await f.api.removeAddress('a');
 assert.deepEqual(JSON.parse(f.requests[0].init.body),JSON.parse(f.requests[1].init.body));
 assert.match(f.requests[2].url.pathname,/rpc\/delete_my_address$/);
 assert.deepEqual(JSON.parse(f.requests[2].init.body),{p_id:'a'});
});
test('invalid profile/address and oversized avatars never issue a backend request',async()=>{
 const f=fixture([]);
 await assert.rejects(f.api.saveProfile('x','',null));
 await assert.rejects(f.api.saveAddress('a',{street:'Address A',label:'Home'},false,true));
 await assert.rejects(f.api.uploadAvatar('u/x.jpg',new ArrayBuffer(5*1024*1024+1),'image/jpeg'));
 assert.equal(f.requests.length,0);
});
