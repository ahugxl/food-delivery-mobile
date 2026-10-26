const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require('../backups/sql-check/node_modules/@electric-sql/pglite');
(async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user_id',true),'')::uuid$$;
   grant usage on schema auth to authenticated; create schema storage;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
   create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
   alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;`);
  await db.exec(fs.readFileSync('tests/fixtures/schema.sql','utf8'));
  await db.exec('grant all on public.profiles, public.user_addresses to authenticated');
  const migration=fs.readFileSync('supabase/migrations/20261026_profile_addresses.sql','utf8');
  await db.exec(migration); await db.exec(migration);
  const user='11111111-1111-4111-8111-111111111111',other='99999999-9999-4999-8999-999999999999';
  const a='aaaaaaaa-aaaa-4aaa-8aaa-000000000001',b='aaaaaaaa-aaaa-4aaa-8aaa-000000000002';
  await db.exec(`insert into auth.users values('${user}'),('${other}'); insert into public.profiles(id,full_name) values('${user}','Original'),('${other}','Other'); select set_config('app.user_id','${user}',false); set role authenticated;`);
  const save=(id,def=false,create=true,lat=0,lng=0)=>db.query('select * from public.save_my_address($1,$2,$3,$4,$5,$6,$7)',[id,'Home','Test address KHONG GIAO HANG',lat,lng,def,create]);
  const rows=()=>db.query('select * from public.user_addresses order by id');
  assert.equal((await save(a)).rows[0].is_default,true);
  await save(b,true); assert.equal((await rows()).rows.filter(r=>r.is_default).length,1);
  assert.equal((await save(b,true)).rows[0].id,b); // retry keeps a single row
  assert.equal((await rows()).rows.length,2);
  await assert.rejects(save(a,true,false,100,0),/tọa độ/);
  await assert.rejects(save(a,true,false,NaN,0),/tọa độ/);
  await assert.rejects(db.query("insert into public.user_addresses(user_id,title,address) values($1,'Home','forged')",[user]),/permission denied/);
  await db.query('select public.delete_my_address($1)',[b]); assert.equal((await rows()).rows[0].is_default,true);
  await assert.rejects(save(b,false,false),/đã bị xóa/);
  await db.query("select set_config('app.user_id',$1,false)",[other]);
  assert.equal((await rows()).rows.length,0);
  await assert.rejects(save(a),/không thuộc/); await assert.rejects(db.query('select public.delete_my_address($1)',[a]),/không thuộc/);
  await db.query("select set_config('app.user_id',$1,false)",[user]);
  await assert.rejects(db.query("update public.profiles set role='merchant' where id=$1",[user]),/permission denied/);
  const profile=(name,phone,avatar)=>db.query('select * from public.update_my_profile($1,$2,$3)',[name,phone,avatar]);
  assert.equal((await profile('Updated','0901234567',null)).rows[0].full_name,'Updated');
  assert.equal((await profile('Updated','+84901234567',null)).rows[0].phone,'+84901234567');
  await assert.rejects(profile('X','invalid',null),/Họ tên/);
  await assert.rejects(profile('Name','invalid',null),/điện thoại/);
  await assert.rejects(profile('Name',null,other+'/photo.jpg'),/Ảnh đại diện/);
  const avatar=user+'/test.jpg'; await db.query("insert into storage.objects(bucket_id,name) values('profile-avatars',$1)",[avatar]);
  await db.query("select set_config('app.user_id',$1,false)",[other]);
  assert.equal((await db.query('select * from storage.objects where name=$1',[avatar])).rows.length,0);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('profile-avatars',$1)",[user+'/forged.jpg']),/row-level security/);
  await db.query("select set_config('app.user_id',$1,false)",[user]);
  await profile('Updated','0901234567',avatar);
  await db.query('delete from storage.objects where name=$1',[avatar]);
  assert.equal((await db.query('select * from storage.objects where name=$1',[avatar])).rows.length,1); // in-use image survives delete
  await profile('Updated',null,null); await db.query('delete from storage.objects where name=$1',[avatar]);
  assert.equal((await db.query('select * from storage.objects where name=$1',[avatar])).rows.length,0);
  await db.exec(`reset role; delete from public.profiles where id='${user}'; set role authenticated;`);
  const initialized=(await profile('Legacy account',null,null)).rows[0];
  assert.equal(initialized.id,user);assert.equal(initialized.role,'user');assert.equal(Number(initialized.loyalty_points),0);
  await db.exec("reset role; select set_config('app.user_id','',false); set role anon;");
  await assert.rejects(profile('No user',null,null),/permission denied/);
  console.log('Profile/address SQL PASS: ownership, CRUD, one default, idempotency, stale edits, coordinates, profile whitelist, private avatar and in-use image protection.');
 }finally{await db.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
