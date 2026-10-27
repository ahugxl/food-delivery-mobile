const fs = require('node:fs'), assert = require('node:assert/strict');
const { PGlite } = require('../backups/sql-check/node_modules/@electric-sql/pglite');
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create schema auth; create table auth.users(id uuid primary key); create role anon; create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;`);
    await db.exec(fs.readFileSync('tests/fixtures/schema.sql', 'utf8'));
    const restaurant = '22222222-2222-4222-8222-222222222222';
    await db.query("insert into restaurants(id,name,address) values($1,'Test','Test')", [restaurant]);
    const categories = ['Trà Sữa', 'Bánh Ngọt', 'Mỳ Ý', 'Món Mới', 'Gà Giòn'];
    const foods = [];
    for (const name of categories) {
      const category = (await db.query('insert into categories(name) values($1) returning id', [name])).rows[0].id;
      foods.push((await db.query("insert into foods(restaurant_id,category_id,name,price) values($1,$2,'Bánh xoài đào',10000) returning id", [restaurant, category])).rows[0].id);
    }
    const migration = fs.readFileSync('supabase/migrations/20261028_discovery_categories.sql', 'utf8');
    await db.exec(migration); await db.exec(migration);
    assert.equal((await db.query('select * from discovery_categories')).rows.length, 8);
    assert.equal((await db.query("select * from discovery_categories where kind='food'")).rows.length, 6);
    assert.equal((await db.query("select * from discovery_categories where kind='restaurant_tag'")).rows.length, 2);
    const links = (await db.query('select * from food_discovery_categories')).rows;
    assert.equal(links.length, 3);
    assert.equal(links.find(r => r.food_id === foods[0]).discovery_category_id, 'tra-sua');
    assert.equal(links.find(r => r.food_id === foods[1]).discovery_category_id, 'do-an-vat');
    assert.equal(links.find(r => r.food_id === foods[2]).discovery_category_id, 'bun-mi-pho');
    assert.equal(links.some(r => r.discovery_category_id === 'mon-chay'), false);
    assert.equal(links.some(r => r.food_id === foods[3] || r.food_id === foods[4]), false);
    await db.exec('set role anon');
    assert.equal((await db.query('select * from discovery_categories')).rows.length, 8);
    assert.equal((await db.query('select * from food_discovery_categories')).rows.length, 3);
    await assert.rejects(db.query("update discovery_categories set name='Forged'"), /permission denied/);
    await db.exec('reset role');
    await db.query("update discovery_categories set is_active=false where id='tra-sua'");
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from discovery_categories')).rows.length, 7);
    assert.equal((await db.query('select * from food_discovery_categories')).rows.length, 2);
    await assert.rejects(db.query('insert into food_discovery_categories values($1,$2)', [foods[4], 'mon-chay']), /permission denied/);
    await db.exec('reset role');
    await db.query('insert into food_discovery_categories values($1,$2)', [foods[1], 'mon-chay']);
    assert.equal((await db.query('select * from food_discovery_categories where food_id=$1', [foods[1]])).rows.length, 2);
    console.log('Discovery SQL PASS: 8 categories, repeatable seed, explicit category mapping, no ingredient inference, no automatic vegetarian labels, public read/blocked writes, disabled groups hidden, multi-group food support.');
  } finally { await db.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
