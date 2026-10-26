const fs = require('node:fs'), assert = require('node:assert/strict');
const { PGlite } = require('../backups/sql-check/node_modules/@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;
      grant usage on schema auth to authenticated;
      create table public.profiles(id uuid primary key,role text,avatar_url text);
      create table public.orders(id uuid primary key,user_id uuid,driver_id uuid);
      create schema storage; create table storage.objects(id uuid primary key,bucket_id text,name text);
      create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
      grant usage on schema storage to authenticated;
      grant select on public.profiles,public.orders,storage.objects to authenticated;
      alter table public.profiles enable row level security; alter table public.orders enable row level security; alter table storage.objects enable row level security;
      create policy own_order on public.orders for select to authenticated using(user_id=auth.uid());
      create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());`);
    const sql = fs.readFileSync('supabase/migrations/20261027_order_driver.sql', 'utf8');
    await db.exec(sql); await db.exec(sql);
    const user='11111111-1111-4111-8111-111111111111', driver='22222222-2222-4222-8222-222222222222', other='33333333-3333-4333-8333-333333333333';
    await db.exec(`insert into profiles values('${driver}','driver','${driver}/avatar.jpg'),('${other}','driver','${other}/avatar.jpg');
      insert into orders values(gen_random_uuid(),'${user}','${driver}');
      insert into storage.objects values(gen_random_uuid(),'profile-avatars','${driver}/avatar.jpg'),(gen_random_uuid(),'profile-avatars','${other}/avatar.jpg'),(gen_random_uuid(),'profile-avatars','${driver}/old.jpg');
      select set_config('app.user_id','${user}',false); set role authenticated;`);
    assert.deepEqual((await db.query('select id from profiles')).rows.map(r=>r.id),[driver]);
    assert.deepEqual((await db.query('select name from storage.objects')).rows.map(r=>r.name),[`${driver}/avatar.jpg`]);
    await db.query("select set_config('app.user_id',$1,false)",[other]);
    assert.equal((await db.query('select name from storage.objects')).rows.length,0);
    await db.exec(`reset role; update orders set driver_id=null; select set_config('app.user_id','${user}',false); set role authenticated;`);
    assert.equal((await db.query('select id from profiles')).rows.length,0);
    assert.equal((await db.query('select name from storage.objects')).rows.length,0);
    console.log('Driver SQL PASS: migration repeatable; only assigned driver profile and current avatar readable; unrelated drivers, old images and removed assignments denied.');
  } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
