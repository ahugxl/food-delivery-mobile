const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m,file) => m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const { searchRestaurants, matchingMenuFoods } = require('../src/features/search/restaurantSearch.ts');
const { userMessage } = require('../src/utils/userMessage.ts');
const { defaultFilters } = require('../src/features/search/catalog.ts');
const { currency, localizeCurrencyText } = require('../src/features/order/checkout.ts');
const restaurants = [
  { id:'a',name:'Quán Gà',rating:4.3,promo_tags:['Freeship'],latitude:10,longitude:106 },
  { id:'b',name:'Bamsu Restaurant',rating:4.8,promo_tags:[],latitude:null,longitude:null },
  { id:'c',name:'Quán chưa có món',rating:4.1,promo_tags:[],latitude:null,longitude:null },
];
const foods = [{restaurant_id:'a',name:'Fried Chicken'},{restaurant_id:'a',name:'Chicken Salad'},{restaurant_id:'b',name:'Chicken Salad'}];
test('Vietnamese and accent-free dish search returns its restaurant once, never a food result',()=>{
  for(const query of ['gà rán','ga ran']) {
    const result=searchRestaurants(restaurants,foods,query,defaultFilters,[],null);
    assert.deepEqual(result.map(r=>r.id),['a']);
    assert.equal(result[0],restaurants[0]);
  }
  assert.equal(searchRestaurants(restaurants,foods,'gà',defaultFilters,[],null).length,2);
});
test('unfiltered discovery keeps restaurants without menus; category requires a matching menu',()=>{
  assert.equal(searchRestaurants(restaurants,foods,'',defaultFilters,[],null).length,3);
  assert.deepEqual(searchRestaurants(restaurants,[foods[0]],'',defaultFilters,[],null,'category').map(r=>r.id),['a']);
});

test('keyword phrases match a single name with complete words, never prefixes or mixed dishes',()=>{
  const shops=[
    {id:'dessert',name:'Quán ăn'},
    {id:'mixed',name:'Quán khác'},
    {id:'drink',name:'Maycha'},
    {id:'brand',name:'Trà Sữa Ngon'},
    {id:'boundary',name:'Quán trà'},
  ];
  const menu=[
    {restaurant_id:'dessert',name:'Tráng miệng sữa chua'},
    {restaurant_id:'mixed',name:'Trà đào'},
    {restaurant_id:'mixed',name:'Sữa tươi'},
    {restaurant_id:'drink',name:'Trà sữa lài'},
    {restaurant_id:'boundary',name:'Sữa tươi'},
  ];
  for(const query of ['trà sữa','tra sua',' TRÀ   SỮA '])
    assert.deepEqual(searchRestaurants(shops,menu,query,defaultFilters,[],null).map(r=>r.id),['drink','brand']);
  assert.equal(searchRestaurants(shops,[{restaurant_id:'drink',name:'Trà suất đặc biệt'}],'tra sua',defaultFilters,[],null).some(r=>r.id==='drink'),false);
});
test('restaurant filters preserve favorite ownership and reject unknown nearby coordinates',()=>{
  assert.deepEqual(searchRestaurants(restaurants,foods,'',{...defaultFilters,favorite:true},['b'],null).map(r=>r.id),['b']);
  assert.deepEqual(searchRestaurants(restaurants,foods,'',{...defaultFilters,nearby:true},[],null),[]);
  assert.deepEqual(searchRestaurants(restaurants,foods,'',{...defaultFilters,nearby:true},[],{latitude:10,longitude:106}).map(r=>r.id),['a']);
  assert.deepEqual(searchRestaurants(restaurants,foods,'',{...defaultFilters,freeship:true},[],null).map(r=>r.id),['a']);
});
test('sorting restaurants does not reorder the source query cache',()=>{
  assert.deepEqual(searchRestaurants(restaurants,foods,'',{...defaultFilters,sort:'rating'},[],null).map(r=>r.id),['b','a','c']);
  assert.deepEqual(restaurants.map(r=>r.id),['a','b','c']);
});

test('food previews use the same phrase matching and preserve food data and restaurant ownership',()=>{
  const menu=[
    {id:'a',restaurant_id:'shop-a',name:'Cơm Gà Xối Mỡ',price:35000,image_url:'photo-a',original_price:40000},
    {id:'b',restaurant_id:'shop-b',name:'Cơm Gà Luộc',price:30000},
    {id:'c',restaurant_id:'shop-a',name:'Cơm Sườn',price:30000},
    {id:'d',restaurant_id:'shop-a',name:'Gà Rán',price:30000},
  ];
  const matched=matchingMenuFoods(menu,'com ga');
  assert.deepEqual(matched.map(food=>food.id),['a','b']);
  assert.equal(matched[0],menu[0]);
  assert.deepEqual(matchingMenuFoods(menu,''),[]);
  assert.deepEqual(matchingMenuFoods(menu,'',true),menu);
  assert.deepEqual(matchingMenuFoods(menu,'   ',true),menu);
  assert.deepEqual(matchingMenuFoods(menu,'com ga',true).map(food=>food.id),['a','b']);
  assert.deepEqual(menu.map(food=>food.id),['a','b','c','d']);
});
test('SDK errors are localized without exposing raw technical errors',()=>{
  assert.match(userMessage(new Error('Invalid login credentials')),/mật khẩu/);
  assert.match(userMessage({message:'Voucher expired'}),/hết hạn/);
  assert.match(userMessage({message:'permission denied for table favorites'}),/quyền/);
  assert.equal(userMessage({message:'Unrecognized internal diagnostic'}),'Không thực hiện được thao tác. Vui lòng thử lại.');
  assert.equal(userMessage({message:'Món đã hết hàng.'}),'Món đã hết hàng.');
});
test('money uses VND across invoices and promotion text without negative zero',()=>{
  assert.equal(currency(25000).replace(/\s/g,''),'25.000₫');
  assert.equal(localizeCurrencyText('Giảm US$25,000'),`Giảm ${currency(25000)}`);
  assert.equal(localizeCurrencyText('Ưu đãi 1 USD'),`Ưu đãi ${currency(1)}`);
  assert.equal(currency(-0),currency(0));
  assert.ok(!currency(-0).includes('-'));
});
