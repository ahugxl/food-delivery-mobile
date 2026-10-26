const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../backups/sql-check/node_modules/@electric-sql/pglite');
async function main() {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key,bucket_id text,name text);
      create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`);
    await db.exec(fs.readFileSync('tests/fixtures/schema.sql','utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261026_phase2_checkout.sql','utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261026_phase3_location_chat.sql','utf8'));
    const user = '11111111-1111-4111-8111-111111111111', other = '99999999-9999-4999-8999-999999999999';
    const restaurant = '22222222-2222-4222-8222-222222222222', food = '33333333-3333-4333-8333-333333333333';
    const order = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
    await db.exec(`insert into auth.users values ('${user}'),('${other}'); select set_config('app.user_id','${user}',false);
      insert into public.restaurants(id,name,address,latitude,longitude) values ('${restaurant}','SQL test','Test address',0,0);
      insert into public.foods(id,restaurant_id,name,price) values ('${food}','${restaurant}','Chicken',15);`);
    const place = (id, lat, lng) => db.query('select * from public.create_food_order_at_location($1,$2::jsonb,$3,null,$4,$5)', [id, JSON.stringify([{ foodId: food, unitPrice: 15, quantity: 1, options: [] }]), 'Test delivery address', lat, lng]);
    assert.equal(Number((await place(order, 0, 0)).rows[0].latitude), 0);
    assert.equal(Number((await place(order, 10, 20)).rows[0].latitude), 0);
    await assert.rejects(place('aaaaaaaa-aaaa-4aaa-8aaa-000000000002', 100, 0), /coordinates/);
    await db.exec('set role authenticated');
    await db.query("insert into public.messages(order_id,sender_id,sender_type,content) values ($1,$2,'user','hello')", [order,user]);
    await assert.rejects(db.query("insert into public.messages(order_id,sender_id,sender_type,content) values ($1,$2,'driver','forged')", [order,user]), /row-level security/);
    await db.query("select set_config('app.user_id',$1,false)", [other]);
    assert.equal((await db.query('select count(*)::int n from public.messages')).rows[0].n, 0);
    await assert.rejects(db.query("insert into public.messages(order_id,sender_id,sender_type,content) values ($1,$2,'user','other order')", [order,other]), /row-level security/);
    await db.exec('reset role');
    assert.equal((await db.query("select public from storage.buckets where id='order-chat'")).rows[0].public, false);
    assert.equal((await db.query("select count(*)::int n from pg_publication_tables where pubname='supabase_realtime' and tablename in ('orders','messages')")).rows[0].n, 2);
    console.log('Phase 3 SQL PASS: coordinates, idempotency, bounds, message ownership/role protection, private bucket, publications.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
