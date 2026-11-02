const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require('../.tools/sql-check/node_modules/@electric-sql/pglite');
const {vector}=require('../.tools/sql-check/node_modules/@electric-sql/pglite/dist/vector/index.cjs');
const uuid=n=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12,'0')}`;
const embedding=(a=1,b=0)=>JSON.stringify([a,b,...Array(1534).fill(0)]);
(async()=>{const db=new PGlite({extensions:{vector}});try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema private;create schema extensions;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.uid',true),'')::uuid$$;
    grant usage on schema auth,extensions to authenticated,service_role;
    create table categories(id uuid primary key,name text);
    create table discovery_categories(id text primary key,name text,kind text,is_active boolean);
    create table food_discovery_categories(food_id uuid,discovery_category_id text,primary key(food_id,discovery_category_id));
    insert into discovery_categories values('tra-sua','Trà sữa','food',true),('com','Cơm','food',true),('mon-chay','Món chay','food',true),('quan-moi','Quán mới','restaurant_tag',true);
    create table restaurants(id uuid primary key,name text,latitude float8,longitude float8,is_active boolean,is_open boolean);
    create table foods(id uuid primary key,restaurant_id uuid,category_id uuid,name text,description text,price numeric,original_price numeric,image_url text,is_available boolean);
    create table food_option_groups(id uuid primary key,food_id uuid,name text,is_required boolean,allow_multiple boolean);
    create table food_option_items(id uuid primary key,group_id uuid,name text,extra_price numeric);`);
  const sql=fs.readFileSync('supabase/migrations/20261101194052_ai_food_vector_search.sql','utf8');
  await db.exec(sql);await db.exec(sql);
  for(const [n,lat,open,active] of [[100,0,true,true],[101,1,true,true],[102,0,false,true],[103,0,true,false]]){
    await db.query('insert into restaurants values($1,$2,$3,0,$4,$5)',[uuid(n),'Quán '+n,lat,active,open]);
  }
  for(let n=1;n<=8;n++){
    const restaurant=n===3?101:n===5?102:n===7?103:100;
    await db.query("insert into foods values($1,$2,null,$3,'Mô tả món thật',$4,null,null,true)",[uuid(n),uuid(restaurant),'Trà sữa '+n,n===2?60000:30000]);
  }
  for(const [n,choice] of [[1,'30%'],[6,'100%'],[8,'0%']]){
    await db.query("insert into food_option_groups values($1,$2,'Mức đường',true,false)",[uuid(n+200),uuid(n)]);
    await db.query('insert into food_option_items values($1,$2,$3,0)',[uuid(n+300),uuid(n+200),choice]);
  }
  await db.query("select set_config('app.uid',$1,false)",[uuid(900)]);
  await db.exec('set role authenticated');
  assert.equal((await db.query("select ai_food_search_status('gemini:test') s")).rows[0].s.indexed,0);
  await assert.rejects(db.query("select * from ai_food_index_batch('gemini:test',20)"),/permission denied/);
  await assert.rejects(db.query('select * from private.ai_food_embeddings'),/permission denied/);
  await db.exec('reset role;set role service_role');
  const sources=(await db.query("select * from ai_food_index_batch('gemini:test',20)")).rows;
  assert.equal(sources.length,7);
  for(const source of sources){
    await db.query('select ai_store_food_embedding($1,$2,$3,$4::extensions.vector)',[source.food_id,source.content_hash,'gemini:test',embedding(source.food_id===uuid(1)?1:.8,source.food_id===uuid(1)?0:.2)]);
  }
  assert.equal((await db.query("select * from ai_food_index_batch('gemini:test',20)")).rows.length,0);
  await db.exec('reset role');await db.query('update foods set is_available=false where id=$1',[uuid(4)]);await db.exec('set role authenticated');
  const search=async(sweet=null,max=40000,model='gemini:test')=>(await db.query('select * from ai_match_foods($1::extensions.vector,$2,0,0,$3,$4,5)',[embedding(),model,max,sweet])).rows;
  const matches=await search('light');assert.deepEqual(matches.map(r=>r.food_id),[uuid(1),uuid(8)]);
  assert.ok(matches[0].option_hint.includes('30%'));assert.equal(matches[0].price,'30000');
  assert.deepEqual((await search('none')).map(r=>r.food_id),[uuid(8)]);
  assert.equal((await search(null,10000)).length,0);assert.equal((await search(null,40000,'other:model')).length,0);
  const all=await search();for(const bad of [2,3,4,5,7])assert.ok(!all.some(r=>r.food_id===uuid(bad)));
  await assert.rejects(db.query("select * from ai_match_foods('[1,0]'::extensions.vector,'gemini:test',0,0)"),/Vector/);
  await assert.rejects(db.query("select * from ai_match_foods($1::extensions.vector,'gemini:test',91,0)",[embedding()]),/không hợp lệ/);
  await db.exec('reset role');await db.query("update foods set price=45000 where id=$1",[uuid(1)]);await db.exec('set role authenticated');
  const fresh=(await db.query("select * from ai_recheck_foods($1::uuid[],'gemini:test',0,0,40000,'light')",[[uuid(1),uuid(8)]])).rows;
  assert.deepEqual(fresh.map(r=>r.food_id),[uuid(8)]);
  await db.exec('reset role');await db.query("update foods set name='Tên món đã thay đổi',price=30000 where id=$1",[uuid(1)]);await db.exec('set role authenticated');
  assert.deepEqual((await search('light')).map(r=>r.food_id),[uuid(8)]);
  await db.exec('reset role;set role service_role');
  assert.equal((await db.query('select ai_store_food_embedding($1,$2,$3,$4::extensions.vector) stored',[uuid(1),sources.find(s=>s.food_id===uuid(1)).content_hash,'gemini:test',embedding()])).rows[0].stored,false);
  assert.equal((await db.query("select * from ai_food_index_batch('gemini:test',20)")).rows.length,1);
  await db.exec('reset role;set role anon');await assert.rejects(search(),/permission denied/);
  await db.exec('reset role');
  const relevance=fs.readFileSync('supabase/migrations/20261101202700_ai_food_relevance.sql','utf8');
  // A fruit tea at a milk-tea restaurant must not inherit the restaurant's identity.
  await db.query("update restaurants set name='Quán Trà Sữa' where id=$1",[uuid(100)]);
  await db.query("update foods set name='Trà sữa 1' where id=$1",[uuid(1)]);
  await db.query("update foods set name='Trà trái cây' where id=$1",[uuid(6)]);
  await db.exec(relevance);await db.exec(relevance);
  assert.equal((await db.query("select count(*)::int n from food_discovery_categories where food_id=$1 and discovery_category_id='tra-sua'",[uuid(6)])).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int n from food_discovery_categories where food_id=$1 and discovery_category_id='tra-sua'",[uuid(8)])).rows[0].n,1);
  await db.exec('set role service_role');
  for(const source of (await db.query("select * from ai_food_index_batch('gemini:test',20)")).rows)
    await db.query('select ai_store_food_embedding($1,$2,$3,$4::extensions.vector)',[source.food_id,source.content_hash,'gemini:test',embedding()]);
  await db.exec('reset role');
  // Perfect group membership is insufficient when the vector is unrelated.
  await db.query("update private.ai_food_embeddings set embedding=$2::extensions.vector where food_id=$1",[uuid(8),embedding(0,1)]);
  await db.exec('set role authenticated');
  const relevant=async(groups=['tra-sua'],excluded=[],threshold=.6)=>(await db.query("select * from ai_match_foods_v2($1::extensions.vector,'gemini:test',0,0,40000,null,$2::text[],$3::text[],$4,5)",[embedding(),groups,excluded,threshold])).rows;
  const selected=await relevant();assert.deepEqual(selected.map(r=>r.food_id),[uuid(1)]);assert.equal(selected[0].similarity,1);
  assert.equal((await relevant(['com'])).length,0);
  assert.equal((await relevant([],['tra-sua'])).some(r=>r.food_id===uuid(1)),false);
  await assert.rejects(relevant(['quan-moi']),/không hợp lệ/);
  await assert.rejects(relevant([],[],1.1),/không hợp lệ/);
  await db.exec('reset role');await db.query("delete from food_discovery_categories where food_id=$1",[uuid(1)]);await db.exec('set role authenticated');
  assert.equal((await db.query("select * from ai_recheck_foods_v2($1::uuid[],$2::extensions.vector,'gemini:test',0,0,40000,null,array['tra-sua'],'{}',.6)",[[uuid(1)],embedding()])).rows.length,0);
  await db.exec('reset role;set role anon');await assert.rejects(relevant(),/permission denied/);
  await db.exec('reset role');
  await db.query("update foods set name='Mix Topping trà sữa' where id=$1",[uuid(6)]);
  await db.query("update foods set name='Trà sữa full topping' where id=$1",[uuid(8)]);
  const kinds=fs.readFileSync('supabase/migrations/20261102132257_ai_recommendation_item_kind.sql','utf8');
  await db.exec(kinds);await db.exec(kinds);
  assert.equal((await db.query('select is_addon from foods where id=$1',[uuid(6)])).rows[0].is_addon,true);
  assert.equal((await db.query('select is_addon from foods where id=$1',[uuid(8)])).rows[0].is_addon,false);
  // A fresh, perfectly matching addon must be rejected at both retrieval and recheck.
  await db.exec('set role service_role');
  for(const source of (await db.query("select * from ai_food_index_batch('gemini:test',20)")).rows)
    await db.query('select ai_store_food_embedding($1,$2,$3,$4::extensions.vector)',[source.food_id,source.content_hash,'gemini:test',embedding()]);
  await db.exec('reset role;set role authenticated');
  assert.equal((await relevant([])).some(r=>r.food_id===uuid(6)),false);
  assert.equal((await relevant([])).some(r=>r.food_id===uuid(8)),true);
  assert.equal((await db.query("select * from ai_recheck_foods_v2($1::uuid[],$2::extensions.vector,'gemini:test',0,0,40000,null,'{}','{}',.6)",[[uuid(6)],embedding()])).rows.length,0);
  console.log('AI vector SQL passed: cosine retrieval, price/distance/open/available filters, sweetness evidence, fresh recheck, stale content exclusion, model isolation, indexer permissions, anon denial and rerun.');
}finally{await db.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
