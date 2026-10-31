const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require('../backups/sql-check/node_modules/@electric-sql/pglite');
(async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;
      create table orders(id uuid primary key,user_id uuid,driver_id uuid,status text);
      create table delivery_assignments(id uuid primary key,order_id uuid,driver_id uuid,status text,created_at timestamptz default now(),completed_at timestamptz,ended_at timestamptz,picked_up_at timestamptz,accepted_at timestamptz);
      create table delivery_events(assignment_id uuid,created_at timestamptz default now());
      alter table delivery_assignments enable row level security;`);
    const sql=fs.readFileSync('supabase/migrations/20261030162219_customer_delivery_progress.sql','utf8');
    await db.exec(sql);await db.exec(sql);
    const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222', driver='33333333-3333-4333-8333-333333333333';
    const order='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', assignment='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await db.query("insert into orders values($1,$2,$3,'preparing')",[order,owner,driver]);
    await db.query("insert into delivery_assignments(id,order_id,driver_id,status) values($1,$2,$3,'offered')",[assignment,order,driver]);
    const query=()=>db.query('select * from public.order_delivery_progress($1)',[order]);
    const actor=async id=>{await db.exec('reset role');await db.query("select set_config('app.user_id',$1,false)",[id]);await db.exec('set role authenticated');};
    for(const [stage,status] of [['offered','preparing'],['accepted','preparing'],['at_restaurant','preparing'],['picked_up','delivering'],['at_customer','delivering'],['delivered','completed']]){
      await db.exec('reset role');
      await db.query('update delivery_assignments set status=$1 where id=$2',[stage,assignment]);
      await db.query('update orders set status=$1 where id=$2',[status,order]);
      await actor(owner);
      const row=(await query()).rows[0];assert.equal(row.delivery_status,stage);assert.equal(row.order_status,status);
      assert.deepEqual(Object.keys(row).sort(),['order_status','driver_id','assignment_id','delivery_status','updated_at'].sort());
    }
    await assert.rejects(db.query('select * from delivery_assignments'),/permission denied/);
    await actor(other);assert.equal((await query()).rows.length,0);
    await actor(driver);assert.equal((await query()).rows.length,0);
    await db.exec('reset role');
    await db.query('update orders set driver_id=null where id=$1',[order]);
    await actor(owner);assert.equal((await query()).rows[0].delivery_status,null);
    await actor('');await assert.rejects(query(),/đăng nhập/);
    await db.exec('reset role;set role anon');await assert.rejects(query(),/permission denied/);
    console.log('Customer progress SQL passed: all 6 stages, owner-only access, no direct table grant, no financial/recipient leakage, unassigned/anonymous denial and rerun.');
  }finally{await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
