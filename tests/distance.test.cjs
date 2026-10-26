const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {haversineDistance,calculateShippingFee}=require('../src/utils/distance.ts');
const {purchaseSignature}=require('../src/features/order/purchase.ts');
const {createPurchaseApi}=require('../src/services/purchaseApi.ts');
test('Haversine is symmetric, handles zero coordinates and antipodes, and rejects invalid points',()=>{
  const origin={latitude:0,longitude:0},next={latitude:0,longitude:1};
  assert.equal(haversineDistance(origin,origin),0);
  assert.ok(Math.abs(haversineDistance(origin,next)-111.1949266)<.000001);
  assert.equal(haversineDistance(origin,next),haversineDistance(next,origin));
  assert.ok(Number.isFinite(haversineDistance(origin,{latitude:0,longitude:180})));
  for(const point of [{latitude:NaN,longitude:0},{latitude:91,longitude:0},{latitude:0,longitude:null}])assert.throws(()=>haversineDistance(origin,point),/Tọa độ/);
});
test('VND shipping rounds only extra kilometres upward, including fractional boundary crossings',()=>{
  for(const [km,fee]of [[0,15000],[1.99,15000],[2,15000],[2.00001,20000],[2.9,20000],[3,20000],[3.00001,25000],[3.5,25000],[5,30000]]) assert.equal(calculateShippingFee(km),fee);
  for(const km of [-1,NaN,Infinity])assert.throws(()=>calculateShippingFee(km));
});
test('a new destination changes intent; pricing never uses the one-decimal display distance',()=>{
  const first=purchaseSignature([],'Address',null,{latitude:0,longitude:0});
  assert.notEqual(first,purchaseSignature([],'Address',null,{latitude:1,longitude:0}));
  assert.equal(calculateShippingFee(3.01),25000);
  assert.equal(calculateShippingFee(Number((3.01).toFixed(1))),20000);
});
test('createOrder rejects missing coordinates or invalid shipping before contacting Supabase',async()=>{
  const api=createPurchaseApi(null),items=[{restaurantId:'r',quantity:1,note:'',unitPrice:40000}];
  await assert.rejects(api.createOrder({items,address:'Test address',deliveryFee:15000}),/Tọa độ/);
  for(const fee of [undefined,2,15000.5,NaN,16000])await assert.rejects(api.createOrder({items,address:'Test address',coordinates:{latitude:0,longitude:0},deliveryFee:fee}),/Phí giao hàng/);
});
