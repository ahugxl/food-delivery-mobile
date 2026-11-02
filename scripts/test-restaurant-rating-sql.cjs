const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require('../.tools/sql-check/node_modules/@electric-sql/pglite');
const id=n=>`bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12,'0')}`;
(async()=>{const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
    create table restaurants(id uuid primary key,rating numeric default 5.0);
    create table orders(id uuid primary key,restaurant_id uuid references restaurants(id),user_id uuid,status text);
    create table reviews(id uuid primary key,order_id uuid references orders(id) on delete cascade,user_id uuid,
      restaurant_rating integer,restaurant_submitted_at timestamptz,restaurant_feedback text,driver_rating integer);`);
  await db.query('insert into restaurants values($1,4.8),($2,4.9)',[id(1),id(2)]);
  const migration=fs.readFileSync('supabase/migrations/20261102140740_restaurant_rating_sync.sql','utf8');
  await db.exec(migration);await db.exec(migration);
  const stats=async(n=1)=>(await db.query('select * from restaurants where id=$1',[id(n)])).rows[0];
  assert.equal((await stats()).rating,null);assert.equal(Number((await stats()).imported_rating),4.8);
  await db.query("insert into orders values($1,$2,$3,'pending'),($4,$2,$3,'completed'),($5,$2,$3,'completed')",[id(10),id(1),id(99),id(11),id(12)]);
  await db.query('insert into reviews values($1,$2,$3,5,null,null,1)',[id(20),id(10),id(99)]);
  assert.equal((await stats()).rating,null);
  await db.query('update reviews set restaurant_submitted_at=now() where id=$1',[id(20)]);
  assert.equal((await stats()).rating,null); // Pending orders are excluded.
  await db.query("update orders set status='completed' where id=$1",[id(10)]);
  assert.equal(Number((await stats()).rating),5);
  await db.query("insert into reviews values($1,$2,$3,1,now(),'Bình luận',5)",[id(21),id(11),id(99)]);
  assert.equal(Number((await stats()).rating),3);assert.equal(Number((await stats()).review_count),2);
  assert.equal(Number((await stats()).comment_count),1);
  await db.query('insert into reviews values($1,$2,$3,null,null,null,5)',[id(22),id(12),id(99)]);
  assert.equal(Number((await stats()).rating),3); // Driver-only review must not count.
  await db.query("update reviews set restaurant_rating=3,restaurant_feedback='  ' where id=$1",[id(21)]);
  assert.equal(Number((await stats()).rating),4);assert.equal(Number((await stats()).comment_count),0);
  await db.query('update reviews set user_id=$1 where id=$2',[id(98),id(21)]);
  assert.equal(Number((await stats()).rating),5); // Mismatched ownership excluded.
  await db.query('update reviews set user_id=$1 where id=$2',[id(99),id(21)]);
  await db.query('update orders set restaurant_id=$1 where id=$2',[id(2),id(11)]);
  assert.equal(Number((await stats()).rating),5);assert.equal(Number((await stats(2)).rating),3);
  await db.query('delete from orders where id=$1',[id(11)]);
  assert.equal((await stats(2)).rating,null); // Cascade deletion recalculates old shop.
  await db.query("update orders set status='cancelled' where id=$1",[id(10)]);
  assert.equal((await stats()).rating,null);
  await db.query("update orders set status='completed' where id=$1",[id(10)]);
  await db.query('delete from reviews where id=$1',[id(20)]);
  assert.equal((await stats()).rating,null);assert.equal(Number((await stats()).review_count),0);
  await db.exec(migration);assert.equal(Number((await stats()).imported_rating),4.8);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select private.refresh_restaurant_rating(array[$1::uuid])',[id(1)]),/permission denied/);
  console.log('Restaurant rating SQL passed: backfill, insert/update/delete, driver-only/draft exclusion, order status/moves/cascade, owner match, counts, rerun and private permissions.');
}finally{await db.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
