const fs = require('node:fs'), assert = require('node:assert/strict');
const { PGlite } = require('../backups/sql-check/node_modules/@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key);
      create table public.profiles(id uuid primary key references auth.users(id), role text);
      create table public.orders(id uuid primary key default gen_random_uuid(), status text, driver_id uuid references public.profiles(id));
      insert into auth.users values('11111111-1111-4111-8111-111111111111');
      insert into public.profiles values('11111111-1111-4111-8111-111111111111','driver');
      insert into public.orders(status,driver_id) values('delivering','11111111-1111-4111-8111-111111111111');`);
    const sql = fs.readFileSync('supabase/migrations/20261030153047_driver_foundation.sql', 'utf8');
    await db.exec(sql); await db.exec(sql);
    assert.deepEqual((await db.query('select status,payment_status,driver_id::text from public.orders')).rows[0], {
      status: 'delivering', payment_status: null, driver_id: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal((await db.query('select approval_status from public.driver_profiles')).rows[0].approval_status, 'pending');
    assert.equal((await db.query('select count(*)::int n from public.delivery_assignments')).rows[0].n, 0);
    assert.equal((await db.query('select payout_per_delivery from public.driver_settings')).rows[0].payout_per_delivery, null);
    assert.equal((await db.query("insert into public.orders(status) values('pending') returning payment_status")).rows[0].payment_status, 'unpaid');
    const tables = ['driver_profiles','driver_presence','driver_locations','driver_settings','delivery_assignments','delivery_events','driver_ledger_entries'];
    for (const table of tables) {
      assert.equal((await db.query('select relrowsecurity from pg_class where oid=$1::regclass', [`public.${table}`])).rows[0].relrowsecurity, true);
      for (const role of ['anon','authenticated']) {
        for (const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE']) {
          assert.equal((await db.query('select has_table_privilege($1,$2,$3) allowed', [role, `public.${table}`, privilege])).rows[0].allowed, false);
        }
      }
    }
    console.log('Driver foundation SQL passed: rerun, pending approval, no order/assignment changes, historical unknown payment, new payment default, unconfigured payout, RLS and grants.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
