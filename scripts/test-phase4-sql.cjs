const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../backups/sql-check/node_modules/@electric-sql/pglite');
async function main() {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$; grant usage on schema auth to authenticated;`);
    await db.exec(fs.readFileSync('tests/fixtures/schema.sql','utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261026_phase2_checkout.sql','utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261026_phase4_reviews_favorites.sql','utf8'));
    const user='11111111-1111-4111-8111-111111111111', other='99999999-9999-4999-8999-999999999999', restaurant='22222222-2222-4222-8222-222222222222', order='aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
    await db.exec(`insert into auth.users values ('${user}'),('${other}'); select set_config('app.user_id','${user}',false);
      insert into public.restaurants(id,name,address) values ('${restaurant}','Test','Test address');
      insert into public.orders(id,user_id,restaurant_id,subtotal,total,delivery_address) values ('${order}','${user}','${restaurant}',10,12,'Test address');
      grant select on public.restaurants to authenticated; set role authenticated;`);
    await db.query('insert into public.favorites(user_id,restaurant_id) values($1,$2) on conflict(user_id,restaurant_id) do nothing',[user,restaurant]);
    await db.query('insert into public.favorites(user_id,restaurant_id) values($1,$2) on conflict(user_id,restaurant_id) do nothing',[user,restaurant]);
    assert.equal((await db.query('select count(*)::int n from public.favorites')).rows[0].n,1);
    const review = (stars=5) => db.query("insert into public.reviews(order_id,user_id,restaurant_rating,driver_rating,driver_tags) values($1,$2,$3,4,'[\"Friendly\",\"On-time\"]')",[order,user,stars]);
    await assert.rejects(review(), /row-level security/);
    await db.exec(`reset role; update public.orders set status='completed' where id='${order}'; set role authenticated;`);
    await assert.rejects(review(6), /row-level security|check constraint/);
    await review();
    await assert.rejects(review(), /duplicate key/);
    await db.query("select set_config('app.user_id',$1,false)",[other]);
    assert.equal((await db.query('select count(*)::int n from public.favorites')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int n from public.reviews')).rows[0].n,0);
    await assert.rejects(db.query('insert into public.favorites(user_id,restaurant_id) values($1,$2)',[user,restaurant]), /row-level security/);
    await assert.rejects(review(), /row-level security/);
    await db.query("select set_config('app.user_id',$1,false)",[user]);
    await db.query('delete from public.favorites where restaurant_id=$1',[restaurant]);
    assert.equal((await db.query('select count(*)::int n from public.favorites')).rows[0].n,0);
    console.log('Phase 4 SQL PASS: favorite uniqueness/add/remove, review completion/stars/uniqueness and per-account isolation.');
  } finally { await db.close(); }
}
main().catch(error=>{ console.error(error); process.exitCode=1; });
