const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {restaurantRatingLabel}=require('../src/utils/restaurantRating.ts');
const {toRestaurantCard}=require('../src/features/home/adapters.ts');
test('unrated restaurants stay unrated through favorites/card adapters and labels',()=>{
  for(const value of [null,undefined,0,NaN,Infinity,6])assert.equal(restaurantRatingLabel(value),'Chưa có đánh giá');
  assert.equal(restaurantRatingLabel(4.2),'4.2');
  assert.equal(toRestaurantCard({id:'r',name:'Quán',rating:null,promo_tags:[]}).rating,null);
  assert.equal(toRestaurantCard({id:'r',name:'Quán',rating:3.7,promo_tags:[]}).rating,3.7);
});
