// Isolated PostgreSQL instance in memory: never connects to the live project.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('../backups/sql-check/node_modules/@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.user_id',true),'')::uuid $$;`);
    await db.exec(fs.readFileSync('tests/fixtures/schema.sql', 'utf8'));
    await db.exec(fs.readFileSync('supabase/migrations/20261026_phase2_checkout.sql', 'utf8'));
    const user = '11111111-1111-4111-8111-111111111111';
    const restaurant = '22222222-2222-4222-8222-222222222222';
    const food = '33333333-3333-4333-8333-333333333333';
    const group = '44444444-4444-4444-8444-444444444444';
    const option = '55555555-5555-4555-8555-555555555555';
    await db.exec(`insert into auth.users values ('${user}'); select set_config('app.user_id','${user}',false);
      insert into public.restaurants(id,name,address) values ('${restaurant}','SQL test','Test address');
      insert into public.foods(id,restaurant_id,name,price) values ('${food}','${restaurant}','Chicken',15);
      insert into public.food_option_groups(id,food_id,name,is_required) values ('${group}','${food}','Size',true);
      insert into public.food_option_items(id,group_id,name,extra_price) values ('${option}','${group}','Large',5);
      insert into public.vouchers(code,discount_type,discount_value,min_order_value) values ('TEST5','fixed',5,20);`);
    const line = { foodId: food, quantity: 1, unitPrice: 20, options: [{ id: option, groupId: group }], note: 'Less salt' };
    let serial = 0;
    const nextId = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++serial).padStart(12, '0')}`;
    const place = (id, items = [line], code = null) => db.query('select * from public.create_food_order($1,$2::jsonb,$3,$4)', [id, JSON.stringify(items), 'Test delivery address', code]);
    const id = nextId();
    const result = await place(id, [line], ' test5 ');
    assert.equal(Number(result.rows[0].total), 17);
    const snapshot = (await db.query('select options_snapshot from public.order_items where order_id=$1', [id])).rows[0].options_snapshot;
    assert.equal(snapshot.note, 'Less salt');
    assert.equal(snapshot.options[0].label, 'Large');
    assert.equal(snapshot.options[0].groupName, 'Size');
    assert.equal(snapshot.options[0].price, 5);
    await place(id);
    assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n, 1);
    await assert.rejects(place(nextId(), [{ ...line, unitPrice: 1 }]), /price has changed/);
    await assert.rejects(place(nextId(), [{ ...line, options: [] }]), /required option/);
    await assert.rejects(place(nextId(), [{ ...line, quantity: 0 }]), /Quantity/);
    await assert.rejects(place(nextId(), [line], 'UNKNOWN'), /invalid or inactive/);
    await db.exec("update public.vouchers set expiry_date=now()-interval '1 day'");
    await assert.rejects(place(nextId(), [line], 'TEST5'), /expired/);
    await db.exec("update public.vouchers set expiry_date=null,min_order_value=21");
    await assert.rejects(place(nextId(), [line], 'TEST5'), /minimum/);
    await db.exec(`create function public.test_fail_item() returns trigger language plpgsql as $$ begin raise exception 'forced item failure'; end $$;
      create trigger test_fail_item before insert on public.order_items for each row execute function public.test_fail_item();`);
    await assert.rejects(place(nextId()), /forced item failure/);
    assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int n from public.order_items')).rows[0].n, 1);
    await db.exec("select set_config('app.user_id','',false)");
    await assert.rejects(place(nextId()), /sign in/);
    console.log('SQL PASS: migration, server totals, snapshots, idempotency, price/option/voucher/auth validation and full rollback after item failure.');
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
