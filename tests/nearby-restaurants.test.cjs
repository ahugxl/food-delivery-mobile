const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {nearestRestaurants}=require('../src/features/home/nearbyRestaurants.ts');
test('home nearest-first list responds to the chosen address without mutating shared catalog order',()=>{
  const catalog=Object.freeze([
    {id:'far',latitude:0.06,longitude:0},
    {id:'near',latitude:0.03,longitude:0},
    {id:'unknown',latitude:null,longitude:null},
    {id:'invalid',latitude:91,longitude:0},
  ]);
  assert.deepEqual(nearestRestaurants(catalog,{latitude:0,longitude:0}).map(r=>r.id),['near','far','unknown','invalid']);
  assert.deepEqual(nearestRestaurants(catalog,{latitude:0.07,longitude:0}).map(r=>r.id),['far','near','unknown','invalid']);
  assert.deepEqual(catalog.map(r=>r.id),['far','near','unknown','invalid']);
});
test('missing delivery coordinates keep catalog order; equal distances keep a stable order',()=>{
  const catalog=[{id:'a',latitude:0,longitude:0},{id:'b',latitude:0,longitude:0}];
  assert.deepEqual(nearestRestaurants(catalog,{}),catalog);
  assert.deepEqual(nearestRestaurants(catalog,{latitude:0,longitude:0}).map(r=>r.id),['a','b']);
});
