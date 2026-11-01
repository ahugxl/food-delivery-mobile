const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../backups/sql-check/node_modules/@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema private; create role anon; create role authenticated;
      create table restaurants(id int primary key, latitude float8, longitude float8);
      create table orders(id int primary key, restaurant_id int, latitude float8, longitude float8, status text);
      insert into restaurants values (1,0,0), (2,null,null);
      insert into orders values (99,1,50,50,'delivering');
      create table voucher_test(is_used boolean); insert into voucher_test values(false);
      create function checkout_test(p_lat float8) returns void language plpgsql as $$begin
        update voucher_test set is_used=true;
        insert into orders values(100,1,p_lat,0,'pending');
      end$$;`);
    const sql = fs.readFileSync('supabase/migrations/20261101172522_enforce_delivery_range.sql', 'utf8');
    await db.exec(sql); await db.exec(sql);
    const latitude = km => km / 6371 * 180 / Math.PI;
    for (const [id, km] of [[1,0], [2,19.999], [3,20]]) {
      await db.query("insert into orders values($1,1,$2,0,'pending')", [id, latitude(km)]);
    }
    for (const km of [20.001, 1145]) {
      await assert.rejects(db.query('select checkout_test($1)', [latitude(km)]), /Ngoài phạm vi/);
      assert.equal((await db.query('select is_used from voucher_test')).rows[0].is_used, false);
      assert.equal((await db.query('select count(*)::int n from orders where id=100')).rows[0].n, 0);
    }
    await assert.rejects(db.query('update orders set latitude=$1 where id=1', [latitude(21)]), /Ngoài phạm vi/);
    await assert.rejects(db.exec("insert into orders values(7,2,0,0,'pending')"), /tọa độ/);
    for (const invalid of [null, 91, NaN, Infinity]) {
      await assert.rejects(db.query("insert into orders values(8,1,$1,0,'pending')", [invalid]), /tọa độ/);
    }
    // Old out-of-range trips still support status updates and unchanged-coordinate writes.
    await db.exec("update orders set status='completed' where id=99; update orders set latitude=latitude where id=99;");
    assert.equal((await db.query('select status from orders where id=99')).rows[0].status, 'completed');
    assert.equal((await db.query("select has_function_privilege('authenticated','private.enforce_order_delivery_range()','EXECUTE') allowed")).rows[0].allowed, false);
    console.log('Delivery range SQL passed: 0/20 km allowed, >20 blocked, invalid pins blocked, checkout rolls back voucher/order, old trip status unaffected, rerun and grants verified.');
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
