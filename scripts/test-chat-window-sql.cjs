const fs = require('node:fs'), assert = require('node:assert/strict');
const { PGlite } = require('../backups/sql-check/node_modules/@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  const owner = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
  const id = n => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create schema private; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
      grant usage on schema auth,storage to authenticated;
      create table public.orders(id uuid primary key,user_id uuid,status text,completed_at timestamptz);
      create table public.messages(order_id uuid,content text);
      create table storage.objects(bucket_id text,name text);
      alter table messages enable row level security; alter table storage.objects enable row level security;
      grant select,insert on messages,storage.objects to authenticated;
      -- Broad legacy grants deliberately exercise the restrictive boundary.
      create policy old_message_insert on messages for insert to authenticated with check(true);
      create policy old_message_read on messages for select to authenticated using(true);
      create policy old_image_insert on storage.objects for insert to authenticated with check(true);
      create policy old_image_read on storage.objects for select to authenticated using(true);`);
    const migration = fs.readFileSync('supabase/migrations/20261101173628_customer_chat_window.sql','utf8');
    await db.exec(migration); await db.exec(migration);
    for (const [n, status, minutes] of [[1,'delivering',null],[2,'completed',4],[3,'completed',5],[4,'completed',6],[5,'completed',null],[6,'cancelled',null],[7,'completed',-1]]) {
      await db.query("insert into orders values($1,$2,$3,case when $4::int is null then null else now()-make_interval(mins=>$4::int) end)", [id(n),owner,status,minutes]);
    }
    await db.query("insert into orders values($1,$2,'delivering',null)", [id(8),other]);
    await db.query("select set_config('app.uid',$1,false)",[owner]);
    await db.exec('set role authenticated');
    for (const n of [1,2]) {
      await db.query("insert into messages values($1,'Hello')",[id(n)]);
      await db.query("insert into storage.objects values('order-chat',$1)",[`${id(n)}/${owner}/photo.jpg`]);
    }
    for (const n of [3,4,5,6,7,8]) {
      await assert.rejects(db.query("insert into messages values($1,'Denied')",[id(n)]),/row-level security/);
      await assert.rejects(db.query("insert into storage.objects values('order-chat',$1)",[`${id(n)}/${owner}/photo.jpg`]),/row-level security/);
    }
    // Other buckets keep their existing permission checks, unaffected by this policy.
    await db.exec("insert into storage.objects values('avatars','example.jpg')");
    await db.exec('reset role');
    await db.query("update orders set completed_at=now()-interval '6 minutes' where id=$1",[id(2)]);
    await db.exec('set role authenticated');
    await assert.rejects(db.query("insert into messages values($1,'Too late')",[id(2)]),/row-level security/);
    assert.equal((await db.query('select count(*)::int n from messages')).rows[0].n,2);
    assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='order-chat'")).rows[0].n,2);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select private.customer_chat_open($1)',[id(1)]),/permission denied/);
    console.log('Chat window SQL passed: active + grace allowed; >=5 minutes, missing/future time, cancelled and other owner blocked; history/images retained; unrelated buckets unchanged; rerun and anon denial.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
