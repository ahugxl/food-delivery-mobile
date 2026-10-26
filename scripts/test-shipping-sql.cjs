const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const {PGlite}=require('../backups/sql-check/node_modules/@electric-sql/pglite');
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {haversineDistance,calculateShippingFee}=require('../src/utils/distance.ts');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;
   grant usage on schema auth to authenticated;
   create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key,bucket_id text,name text);
   create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  for(const file of ['tests/fixtures/schema.sql','supabase/migrations/20261026_phase2_checkout.sql','supabase/migrations/20261026_phase3_location_chat.sql','supabase/migrations/20261026_dynamic_shipping.sql','supabase/migrations/20261026_dynamic_shipping.sql'])await db.exec(fs.readFileSync(file,'utf8'));
  const user='11111111-1111-4111-8111-111111111111',other='99999999-9999-4999-8999-999999999999',restaurant='22222222-2222-4222-8222-222222222222',food='33333333-3333-4333-8333-333333333333';
  await db.exec(`insert into auth.users values('${user}'),('${other}'); select set_config('app.user_id','${user}',false);
   insert into public.restaurants(id,name,address,latitude,longitude)values('${restaurant}','Shipping test','Test',0,0);
   insert into public.foods(id,restaurant_id,name,price)values('${food}','${restaurant}','Food',40000);`);
  await db.exec("insert into public.vouchers(code,discount_type,discount_value,min_order_value)values('SAVE','fixed',10000,40000); set role authenticated;");
  let serial=0;const next=()=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(++serial).padStart(12,'0')}`;
  const items=JSON.stringify([{foodId:food,quantity:1,unitPrice:40000,options:[],note:'KHONG GIAO HANG'}]);
  const place=(id,lat,lng,fee,code=null)=>db.query('select * from public.create_food_order($1,$2::jsonb,$3,$4,$5::double precision,$6::double precision,$7::numeric)',[id,items,'Test delivery KHONG GIAO HANG',code,lat,lng,fee]);
  for(const km of [0,1.9,2.1,3,3.5,5.1]){
   const lat=km/6371*180/Math.PI,fee=calculateShippingFee(haversineDistance({latitude:0,longitude:0},{latitude:lat,longitude:0}));
   const id=next(),order=(await place(id,lat,0,fee)).rows[0];
   assert.equal(Number(order.delivery_fee),fee);assert.equal(Number(order.total),40000+fee);assert.equal(order.latitude,lat);
   const retry=(await place(id,100,0,1)).rows[0];assert.equal(retry.id,id);assert.equal(Number(retry.delivery_fee),fee);
  }
  assert.equal(Number((await place(next(),0,0,15000,'SAVE')).rows[0].total),45000);
  const existing=(await db.query('select id from public.orders limit 1')).rows[0].id;
  await db.query("select set_config('app.user_id',$1,false)",[other]);
  await assert.rejects(place(existing,0,0,15000),/identifier unavailable/);
  await db.query("select set_config('app.user_id',$1,false)",[user]);
  const rejected=next();await assert.rejects(place(rejected,0,0,2),/Phí giao hàng/);
  assert.equal((await db.query('select id from public.orders where id=$1',[rejected])).rows.length,0);
  await assert.rejects(place(next(),null,0,15000),/tọa độ/);
  await assert.rejects(db.query('select * from public.create_food_order($1,$2::jsonb,$3,null)',[next(),items,'Address']),/permission denied/);
  await assert.rejects(db.query('select * from public.create_food_order_at_location($1,$2::jsonb,$3,null,0,0)',[next(),items,'Address']),/permission denied/);
  await db.exec(`reset role; update public.restaurants set latitude=null where id='${restaurant}'; set role authenticated;`);
  await assert.rejects(place(next(),0,0,15000),/Quán chưa có tọa độ/);
  await db.exec(`reset role; update public.restaurants set latitude=0 where id='${restaurant}';
   create function public.fail_shipping_item()returns trigger language plpgsql as $$begin raise exception 'Item failure';end$$;
   create trigger fail_shipping before insert on public.order_items for each row execute function public.fail_shipping_item(); set role authenticated;`);
  const rollback=next();await assert.rejects(place(rollback,0,0,15000),/Item failure/);
  assert.equal((await db.query('select id from public.orders where id=$1',[rollback])).rows.length,0);
  console.log('Shipping SQL PASS: client/server distance parity, VND totals, voucher, idempotency, fee tampering, missing coordinates, legacy RPC blocked and atomic rollback.');
 }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
