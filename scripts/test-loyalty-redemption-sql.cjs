const fs=require('node:fs'), assert=require('node:assert/strict');
const {PGlite}=require('../backups/sql-check/node_modules/@electric-sql/pglite');
(async()=>{const db=new PGlite();
const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const request=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    create table profiles(id uuid primary key,loyalty_points integer);
    create table vouchers(id uuid primary key default gen_random_uuid(),code text unique not null,discount_type text not null,
      discount_value numeric not null,min_order_value numeric,expiry_date timestamptz,is_active boolean,applies_to text);
    create table user_vouchers(user_id uuid,voucher_id uuid references vouchers(id),is_used boolean,unique(user_id,voucher_id));
    alter table vouchers enable row level security;
    create policy legacy_voucher_read on vouchers for select to anon,authenticated using(true);
    grant select on vouchers to anon,authenticated;
    create function collect_test(p_voucher uuid) returns void language sql security definer set search_path='' as $$
      insert into public.user_vouchers values(auth.uid(),p_voucher,false) on conflict do nothing;
    $$;
    grant execute on function collect_test(uuid) to authenticated;
    insert into vouchers(code,discount_type,discount_value) values('FREE-CAMPAIGN','fixed',5000);`);
  await db.query('insert into auth.users values($1),($2)',[owner,other]);
  await db.query('insert into profiles values($1,104000),($2,0)',[owner,other]);
  const sql=fs.readFileSync('supabase/migrations/20261101180449_loyalty_voucher_redemption.sql','utf8');
  await db.exec(sql);await db.exec(sql);
  await db.query("select set_config('app.uid',$1,false)",[owner]);await db.exec('set role authenticated');
  const tiers=[[10000,10000],[20000,19000],[30000,28000],[50000,47000]], results=[];
  let remaining=104000;
  for(let i=0;i<tiers.length;i++){
    const [amount,cost]=tiers[i];
    const result=(await db.query('select * from redeem_loyalty_voucher($1,$2,$3)',[request(i),amount,owner])).rows[0];
    remaining-=cost;assert.equal(result.points_spent,cost);assert.equal(result.balance,remaining);assert.equal(result.discount_amount,amount);
    assert.ok(Date.parse(result.expiry_date)>Date.now()+29*86400000);results.push(result);
  }
  // Same request after all points are spent still succeeds without another charge.
  const replay=(await db.query('select * from redeem_loyalty_voucher($1,10000,$2)',[request(0),owner])).rows[0];
  assert.equal(replay.voucher_id,results[0].voucher_id);assert.equal(replay.balance,0);
  await assert.rejects(db.query('select * from redeem_loyalty_voucher($1,20000,$2)',[request(0),owner]),/không khả dụng/);
  await assert.rejects(db.query('select * from redeem_loyalty_voucher($1,10000,$2)',[request(9),owner]),/chưa đủ xu/);
  await assert.rejects(db.query('select * from redeem_loyalty_voucher($1,15000,$2)',[request(9),owner]),/không hợp lệ/);
  await assert.rejects(db.query('select * from redeem_loyalty_voucher($1,10000,$2)',[request(9),other]),/Phiên đăng nhập/);
  assert.equal((await db.query('select count(*)::int n from loyalty_redemptions')).rows[0].n,4);
  await assert.rejects(db.query('update loyalty_redemptions set points_spent=1'),/permission denied/);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int n from user_vouchers')).rows[0].n,4);
  assert.equal((await db.query('select loyalty_points from profiles where id=$1',[owner])).rows[0].loyalty_points,0);
  const privateReward=(await db.query("insert into vouchers(code,discount_type,discount_value,reward_owner_id) values('NOT-PAID','fixed',10000,$1) returning id",[owner])).rows[0].id;
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select collect_test($1)',[privateReward]),/đã đổi xu/);
  await db.exec('reset role');await db.query("select set_config('app.uid',$1,false)",[other]);await db.exec('set role authenticated');
  assert.equal((await db.query('select count(*)::int n from loyalty_redemptions')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int n from vouchers')).rows[0].n,1);
  await assert.rejects(db.query('select collect_test($1)',[results[0].voucher_id]),/đã đổi xu/);
  await assert.rejects(db.query('select * from redeem_loyalty_voucher($1,10000,$2)',[request(0),other]),/không khả dụng/);
  await db.exec('reset role;set role anon');
  assert.equal((await db.query('select count(*)::int n from vouchers')).rows[0].n,1);
  await assert.rejects(db.query('select * from redeem_loyalty_voucher($1,10000,$2)',[request(9),owner]),/permission denied/);
  await db.exec('reset role');
  // Any failure granting the wallet entry must roll back points, voucher and ledger together.
  await db.query('update profiles set loyalty_points=10000 where id=$1',[other]);
  await db.exec(`create function reject_test() returns trigger language plpgsql as $$begin raise exception 'wallet unavailable';end$$;
    create trigger z_test_failure before insert on user_vouchers for each row execute function reject_test();`);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from redeem_loyalty_voucher($1,10000,$2)',[request(10),other]),/wallet unavailable/);
  await db.exec('reset role');
  assert.equal((await db.query('select loyalty_points from profiles where id=$1',[other])).rows[0].loyalty_points,10000);
  assert.equal((await db.query('select count(*)::int n from loyalty_redemptions')).rows[0].n,4);
  assert.equal((await db.query('select count(*)::int n from vouchers')).rows[0].n,6);
  console.log('Loyalty SQL passed: 4 tiers, private rewards, no free collection, replay/no double spend, insufficient points, session binding, rollback, RLS/anon and rerun.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
