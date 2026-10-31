// Local disposable PostgreSQL only. pg_cron registration is stubbed; its scheduler
// must be verified on Supabase after installation. Never run fixture SQL remotely.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { PGlite } = require('../backups/sql-check/node_modules/@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key default gen_random_uuid());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      create schema cron; create table cron.job(jobid bigint generated always as identity, jobname text unique, schedule text, command text);
      create function cron.schedule(text,text,text) returns bigint language sql as $$
        insert into cron.job(jobname,schedule,command) values($1,$2,$3) on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command returning jobid $$;`);
    await db.exec(fs.readFileSync('tests/fixtures/schema.sql', 'utf8'));
    await db.exec(`alter table orders add column recipient_name text, add column recipient_phone text;
      alter table reviews add column if not exists driver_feedback text;`);
    const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
    const ids = {};
    for (const role of ['customer','otherCustomer','driver','otherDriver','pending']) {
      const id = (await one('insert into auth.users default values returning id')).id;
      ids[role] = id;
      await db.query('insert into profiles(id,full_name,role) values($1,$2,$3)', [id, role, role.includes('river') || role==='pending' ? 'driver' : 'user']);
    }
    const restaurant = (await one("insert into restaurants(name,address,latitude,longitude) values('Quán SQL','Điểm lấy món',0,0) returning id")).id;
    const makeOrder = async (km = 3.5, extra = {}) => {
      const value = { status:'pending', payment:'cash', total:10000, driver:null, ...extra };
      return (await one(`insert into orders(user_id,restaurant_id,driver_id,status,subtotal,total,payment_method,delivery_address,latitude,longitude,recipient_name,recipient_phone)
        values($1,$2,$3,$4,50000,$5,$6,'Địa chỉ khách cần bảo vệ',0,$7,'Khách SQL','0901234567') returning id`,
      [ids.customer,restaurant,value.driver,value.status,value.total,value.payment,km/(6371*Math.PI/180)])).id;
    };
    const legacy = await makeOrder(3.5, { driver:ids.driver, status:'delivering' });
    await db.exec(fs.readFileSync('supabase/migrations/20261030153047_driver_foundation.sql', 'utf8'));
    const raw = fs.readFileSync('supabase/migrations/20261030154146_driver_workflow.sql', 'utf8');
    assert(raw.includes('create extension if not exists pg_cron with schema pg_catalog;'));
    const sql = raw.replace('create extension if not exists pg_cron with schema pg_catalog;', '-- Cron scheduler unavailable in PGlite: registration stub above.');
    await db.exec(sql); await db.exec(sql);
    assert.equal((await one('select count(*)::int n from cron.job')).n, 1);
    assert.equal((await one('select count(*)::int n from delivery_assignments')).n, 0);
    assert.equal((await one('select payment_status from orders where id=$1', [legacy])).payment_status, null);
    const admin = () => db.exec("reset role; select set_config('app.user_id','',false)");
    const actor = async id => { await db.exec('reset role'); await db.query("select set_config('app.user_id',$1,false)", [id]); await db.exec('set role authenticated'); };
    const step = (a, action, cod = false) => db.query('select public.driver_step($1,$2,null,$3)', [a, action, cod]);
    const dash = async () => (await one('select public.driver_dashboard() payload')).payload;
    const assign = async (order, driver = ids.driver) => {
      await admin(); return (await one('select public.admin_driver_assign($1,$2) id', [order, driver])).id;
    };
    await actor(ids.pending);
    await assert.rejects(dash(), /chưa được duyệt/);
    await admin();
    await db.query("update driver_profiles set approval_status='approved' where user_id=any($1::uuid[])", [[ids.driver,ids.otherDriver]]);
    for (const [km, fee] of [[0,15000],[2,15000],[2.01,20000],[3,20000],[3.5,25000]]) {
      const quote = (await one('select private.driver_payout_quote($1,0,$2) q', [restaurant,km/(6371*Math.PI/180)])).q;
      assert.equal(quote.fee, fee);
    }
    const order = await makeOrder();
    const a = await assign(order);
    assert.deepEqual(await one('select fee,cod_amount from delivery_assignments where id=$1', [a]), { fee:25000, cod_amount:10000 });
    await actor(ids.driver);
    const offered = (await dash()).trips.find(x=>x.id===a);
    for (const key of ['delivery_address','latitude','longitude','recipient_name','recipient_phone']) assert.equal(offered[key], null);
    await assert.rejects(step(a,'accept'), /bật nhận đơn/);
    await db.query('select public.driver_set_online(true)');
    await step(a,'accept'); await step(a,'accept');
    assert.equal((await dash()).trips.find(x=>x.id===a).recipient_phone, '0901234567');
    await assert.rejects(step(a,'pickup'), /không phù hợp/);
    await assert.rejects(db.query('select public.driver_set_online(false)'), /hoàn thành chuyến/);
    await db.query('select public.driver_send_message($1,$2)', [a,'Tin tài xế SQL']);
    assert.equal((await one('select public.driver_messages($1) m', [a])).m.length, 1);
    await actor(ids.otherDriver);
    await assert.rejects(step(a,'arrive_restaurant'), /chuyến của bạn/);
    await assert.rejects(db.query('select * from delivery_assignments'), /permission denied/);
    await assert.rejects(db.query('select public.admin_driver_assign($1,$2)', [order,ids.otherDriver]), /permission denied/);
    await actor(ids.driver);
    await db.query('select public.driver_update_location(0,0,10)');
    await assert.rejects(db.query('select public.driver_update_location(91,0,10)'), /Tọa độ/);
    await actor(ids.customer);
    assert.equal((await one('select public.order_driver_location($1) loc',[order])).loc.latitude, 0);
    await actor(ids.otherCustomer);
    assert.equal((await one('select public.order_driver_location($1) loc',[order])).loc, null);
    await admin();
    await db.query("update driver_locations set received_at=now()-interval '3 minutes'");
    await assert.rejects(db.query('update orders set total=total+1 where id=$1', [order]), /kết thúc phân công/);
    await db.exec('update driver_settings set payout_base_fee=20000');
    await actor(ids.customer);
    assert.equal((await one('select public.order_driver_location($1) loc',[order])).loc.is_stale, true);
    await actor(ids.driver);
    await step(a,'arrive_restaurant'); await step(a,'pickup'); await step(a,'pickup');
    await admin(); assert.equal((await one('select status from orders where id=$1',[order])).status, 'delivering');
    await assert.rejects(db.query("update orders set status='completed' where id=$1",[order]), /xác nhận giao/);
    await actor(ids.driver);
    await step(a,'arrive_customer');
    await assert.rejects(step(a,'deliver'), /thu đủ COD/);
    await step(a,'deliver',true); await step(a,'deliver',true);
    assert.equal((await dash()).trips.find(x=>x.id===a).recipient_phone, null);
    await assert.rejects(db.query('select public.driver_send_message($1,$2)', [a,'Sau khi giao']), /chuyến đang thực hiện/);
    await admin();
    assert.deepEqual(await one('select status,payment_status from orders where id=$1',[order]), { status:'completed',payment_status:'paid' });
    assert.equal((await one("select amount from driver_ledger_entries where assignment_id=$1 and entry_type='earning'",[a])).amount, 25000);
    assert.equal((await one('select count(*)::int n from driver_ledger_entries where assignment_id=$1',[a])).n, 2);
    await db.exec('update driver_settings set payout_base_fee=15000');
    const expireOrder = await makeOrder(); const expired = await assign(expireOrder);
    await db.query("update delivery_assignments set expires_at=now()-interval '1 minute' where id=$1",[expired]);
    await db.query('select private.driver_expire_offers()'); // No dashboard call / driver app needed.
    assert.deepEqual(await one('select status,driver_id from orders where id=$1',[expireOrder]), { status:'preparing',driver_id:null });
    await assert.rejects(db.query('select public.admin_driver_migrate_order($1,true)',[legacy]), /thanh toán/);
    await db.query("update orders set payment_status='unpaid' where id=$1",[legacy]);
    await assert.rejects(db.query('select public.admin_driver_migrate_order($1,false)',[legacy]), /xác minh/);
    const migrated = (await one('select public.admin_driver_migrate_order($1,true) id',[legacy])).id;
    assert.equal((await one('select public.admin_driver_migrate_order($1,true) id',[legacy])).id, migrated);
    assert.equal((await one('select status from orders where id=$1',[legacy])).status, 'delivering');
    await assert.rejects(db.query('select public.admin_driver_resolve($1,$2,$3,false)',[migrated,'return_to_dispatch','Quán xác nhận nhận lại hàng']), /hoàn về quán/);
    await db.query('select public.admin_driver_resolve($1,$2,$3,true)',[migrated,'return_to_dispatch','Quán xác nhận nhận lại hàng']);
    assert.deepEqual(await one('select status,driver_id,payment_status from orders where id=$1',[legacy]), { status:'preparing',driver_id:null,payment_status:'unpaid' });
    const toSwap = await makeOrder(); const old = await assign(toSwap); await actor(ids.driver);
    await step(old,'accept'); await assign(toSwap,ids.otherDriver); await actor(ids.driver);
    const former = (await dash()).trips.find(x=>x.id===old); assert.equal(former.recipient_phone, null); assert.equal(former.delivery_address, null);
    await assert.rejects(db.query('select public.driver_messages($1)',[old]), /chuyến đang thực hiện/);
    await admin();
    await db.query('update driver_settings set payout_base_fee=null');
    const unconfigured = await makeOrder(); await assert.rejects(assign(unconfigured), /Chưa cấu hình/);
    await db.query('update driver_settings set payout_base_fee=15000');
    const nullMethod = await makeOrder(1,{payment:null}); await assert.rejects(assign(nullMethod), /phương thức/);
    await db.exec('set role anon'); await assert.rejects(db.query('select public.driver_dashboard()'), /permission denied/);
    console.log('Driver workflow SQL passed: payout boundaries and snapshot, approval, privacy, actions/retries, COD/ledger, chat/GPS ownership, stale GPS, expiry without app, legacy transfer, incidents, reassignment, cron registration rerun and grants. Real cron execution/concurrent sessions still require staging verification.');
  } finally { await db.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; });
