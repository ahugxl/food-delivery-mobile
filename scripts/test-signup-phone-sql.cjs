const fs = require('node:fs'), assert = require('node:assert/strict');
const { PGlite } = require('../backups/sql-check/node_modules/@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key default gen_random_uuid(), email text, phone text, encrypted_password text, raw_user_meta_data jsonb default '{}');
      create table public.profiles(id uuid primary key references auth.users(id), full_name text, phone text, avatar_url text, role text, loyalty_points integer);`);
    const sql = fs.readFileSync('supabase/migrations/20261030102144_signup_phone.sql', 'utf8');
    await db.exec(sql); await db.exec(sql);
    const signup = (phone, password = 'hash') => db.query('insert into auth.users(encrypted_password, raw_user_meta_data) values($1,$2) returning id', [password, JSON.stringify({ full_name: 'SQL test', phone })]);
    const id = (await signup('0812345678')).rows[0].id;
    await assert.rejects(signup('(+84) 812-345-678'), /profiles_phone_unique/);
    await assert.rejects(signup(''), /số điện thoại/);
    await signup(null, ''); // OAuth accounts can complete their profile later.
    assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 2);
    await db.exec('set role anon');
    assert.equal((await db.query("select public.signup_account_exists('+84812345678','new@example.com') as exists")).rows[0].exists, true);
    assert.equal((await db.query("select public.signup_account_exists('0901234567','new@example.com') as exists")).rows[0].exists, false);
    await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
    await db.exec('reset role');
    await db.query('update auth.users set email=$1 where id=$2', ['existing@example.com', id]);
    assert.equal((await db.query("select public.signup_account_exists('0901234567',' EXISTING@example.com ') as exists")).rows[0].exists, true);
    const other = (await signup('0901234567')).rows[0].id;
    await assert.rejects(db.query('update public.profiles set phone=$1 where id=$2', ['+84812345678', other]), /profiles_phone_unique/);
    assert.equal((await db.query('select phone from public.profiles where id=$1', [id])).rows[0].phone, '0812345678');
    console.log('Signup SQL passed: normalized uniqueness, trigger rollback, OAuth, anon boundary, profile update, rerun.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
