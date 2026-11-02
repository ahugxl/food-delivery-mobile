create extension if not exists vector with schema extensions;

create table if not exists private.ai_food_embeddings (
  food_id uuid primary key references public.foods(id) on delete cascade,
  model_key text not null check(length(model_key) between 1 and 160),
  content_hash text not null,
  embedding extensions.vector(1536) not null,
  indexed_at timestamptz not null default now()
);
alter table private.ai_food_embeddings enable row level security;
revoke all on private.ai_food_embeddings from public,anon,authenticated;
create index if not exists ai_food_embedding_model on private.ai_food_embeddings(model_key);

-- Only menu data is sent for embedding. No customer, address, order or chat data.
create or replace function private.ai_food_document(p_food_id uuid)
returns text language sql stable set search_path='' as $$
  select concat_ws(E'\n','Món: '||f.name,'Mô tả: '||left(coalesce(f.description,''),1600),
    'Quán: '||r.name,'Danh mục: '||coalesce(c.name,''),
    (select string_agg(x.line,E'\n' order by x.id) from (
      select g.id, left(g.name,150)||': '||coalesce((select string_agg(left(i.name,150),', ' order by i.id)
        from public.food_option_items i where i.group_id=g.id),'') line
      from public.food_option_groups g where g.food_id=f.id order by g.id limit 30
    ) x))
  from public.foods f join public.restaurants r on r.id=f.restaurant_id
  left join public.categories c on c.id=f.category_id where f.id=p_food_id;
$$;
revoke all on function private.ai_food_document(uuid) from public,anon,authenticated;

create or replace function private.ai_sweetness_evidence(p_food_id uuid,p_sweetness text)
returns text language sql stable set search_path='' as $$
  select left(g.name||': '||i.name,220)
  from public.food_option_groups g join public.food_option_items i on i.group_id=g.id
  where g.food_id=p_food_id and lower(g.name) ~ '(đường|sugar|ngọt)'
    and ((p_sweetness='light' and lower(i.name) ~ '(^|[^0-9])(0|25|30|50)[[:space:]]*%|ít đường|ít ngọt|ngọt nhẹ|không đường|không ngọt|no sugar|less sugar')
      or (p_sweetness='none' and lower(i.name) ~ '(^|[^0-9])0[[:space:]]*%|không đường|không ngọt|no sugar|zero sugar'))
  order by g.id,i.id limit 1;
$$;
revoke all on function private.ai_sweetness_evidence(uuid,text) from public,anon,authenticated;

-- Incremental indexing: unchanged documents are never re-embedded.
create or replace function public.ai_food_index_batch(p_model_key text,p_limit integer default 25)
returns table(food_id uuid,document text,content_hash text) language plpgsql security definer set search_path='' as $$
begin
  if p_model_key is null or length(p_model_key) not between 1 and 160 or p_limit is null or p_limit not between 1 and 100 then raise exception 'Thông số lập chỉ mục không hợp lệ.'; end if;
  return query select f.id,d.document,md5(d.document)
    from public.foods f join public.restaurants r on r.id=f.restaurant_id
    cross join lateral (select private.ai_food_document(f.id) as document) d
    left join private.ai_food_embeddings e on e.food_id=f.id
    where r.is_active is true and f.is_available is true
      and (e.food_id is null or e.model_key<>p_model_key or e.content_hash<>md5(d.document))
    order by e.indexed_at nulls first,f.id limit p_limit;
end $$;
revoke all on function public.ai_food_index_batch(text,integer) from public,anon,authenticated;
grant execute on function public.ai_food_index_batch(text,integer) to service_role;

create or replace function public.ai_store_food_embedding(p_food_id uuid,p_content_hash text,p_model_key text,p_embedding extensions.vector)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_document text;
begin
  if p_embedding is null or extensions.vector_dims(p_embedding)<>1536 or extensions.vector_norm(p_embedding)<=0
    or p_model_key is null or length(p_model_key) not between 1 and 160 then raise exception 'Vector hoặc model không hợp lệ.'; end if;
  v_document:=private.ai_food_document(p_food_id);
  if v_document is null or md5(v_document) is distinct from p_content_hash then return false; end if;
  insert into private.ai_food_embeddings(food_id,model_key,content_hash,embedding)
    values(p_food_id,p_model_key,p_content_hash,p_embedding)
    on conflict(food_id) do update set model_key=excluded.model_key,content_hash=excluded.content_hash,embedding=excluded.embedding,indexed_at=now();
  return true;
end $$;
revoke all on function public.ai_store_food_embedding(uuid,text,text,extensions.vector) from public,anon,authenticated;
grant execute on function public.ai_store_food_embedding(uuid,text,text,extensions.vector) to service_role;

create or replace function private.ai_live_foods(p_model_key text,p_latitude double precision,p_longitude double precision,
  p_max_price numeric,p_sweetness text,p_food_ids uuid[] default null)
returns table(food_id uuid,restaurant_id uuid,name text,description text,price numeric,original_price numeric,
  image_url text,restaurant_name text,distance_km double precision,option_hint text)
language sql stable set search_path='' as $$
  select f.id,r.id,f.name,left(f.description,500),f.price,f.original_price,f.image_url,r.name,d.km,s.hint
  from public.foods f join public.restaurants r on r.id=f.restaurant_id
  join private.ai_food_embeddings e on e.food_id=f.id and e.model_key=p_model_key
  cross join lateral (select least(1::double precision,greatest(0::double precision,
    power(sin(radians(p_latitude-r.latitude)/2),2)+cos(radians(r.latitude))*cos(radians(p_latitude))*power(sin(radians(p_longitude-r.longitude)/2),2))) a) h
  cross join lateral (select round((6371*2*atan2(sqrt(h.a),sqrt(1-h.a)))::numeric,9)::double precision km) d
  cross join lateral (select private.ai_sweetness_evidence(f.id,p_sweetness) hint) s
  where r.is_active is true and r.is_open is true and f.is_available is true
    and r.latitude between -90 and 90 and r.longitude between -180 and 180 and d.km<=20
    and (p_max_price is null or f.price<=p_max_price)
    and (p_food_ids is null or f.id=any(p_food_ids))
    and e.content_hash=md5(private.ai_food_document(f.id))
    and (p_sweetness is null or s.hint is not null);
$$;
revoke all on function private.ai_live_foods(text,double precision,double precision,numeric,text,uuid[]) from public,anon,authenticated;

create or replace function private.ai_validate_search(p_model_key text,p_latitude double precision,p_longitude double precision,p_max_price numeric,p_sweetness text)
returns void language plpgsql stable set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Vui lòng đăng nhập để dùng trợ lý.'; end if;
  if p_model_key is null or length(p_model_key) not between 1 and 160
    or p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90) or not(p_longitude between -180 and 180)
    or (p_max_price is not null and (p_max_price<0 or p_max_price>10000000))
    or (p_sweetness is not null and p_sweetness not in ('light','none')) then raise exception 'Bộ lọc gợi ý món không hợp lệ.'; end if;
end $$;
revoke all on function private.ai_validate_search(text,double precision,double precision,numeric,text) from public,anon,authenticated;

create or replace function public.ai_match_foods(p_embedding extensions.vector,p_model_key text,
  p_latitude double precision,p_longitude double precision,p_max_price numeric default null,p_sweetness text default null,p_limit integer default 5)
returns table(food_id uuid,restaurant_id uuid,name text,description text,price numeric,original_price numeric,
  image_url text,restaurant_name text,distance_km double precision,option_hint text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.ai_validate_search(p_model_key,p_latitude,p_longitude,p_max_price,p_sweetness);
  if p_limit is null or p_limit not between 1 and 10 or p_embedding is null or extensions.vector_dims(p_embedding)<>1536 or extensions.vector_norm(p_embedding)<=0 then raise exception 'Vector truy vấn không hợp lệ.'; end if;
  return query select l.* from private.ai_live_foods(p_model_key,p_latitude,p_longitude,p_max_price,p_sweetness) l
    join private.ai_food_embeddings e on e.food_id=l.food_id
    order by e.embedding operator(extensions.<=>) p_embedding,l.distance_km,l.food_id limit p_limit;
end $$;
revoke all on function public.ai_match_foods(extensions.vector,text,double precision,double precision,numeric,text,integer) from public,anon;
grant execute on function public.ai_match_foods(extensions.vector,text,double precision,double precision,numeric,text,integer) to authenticated;

create or replace function public.ai_recheck_foods(p_food_ids uuid[],p_model_key text,p_latitude double precision,p_longitude double precision,
  p_max_price numeric default null,p_sweetness text default null)
returns table(food_id uuid,restaurant_id uuid,name text,description text,price numeric,original_price numeric,
  image_url text,restaurant_name text,distance_km double precision,option_hint text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.ai_validate_search(p_model_key,p_latitude,p_longitude,p_max_price,p_sweetness);
  if p_food_ids is null or cardinality(p_food_ids)>10 then raise exception 'Danh sách món gợi ý không hợp lệ.'; end if;
  return query select l.* from private.ai_live_foods(p_model_key,p_latitude,p_longitude,p_max_price,p_sweetness,p_food_ids) l
    order by array_position(p_food_ids,l.food_id) limit 5;
end $$;
revoke all on function public.ai_recheck_foods(uuid[],text,double precision,double precision,numeric,text) from public,anon;
grant execute on function public.ai_recheck_foods(uuid[],text,double precision,double precision,numeric,text) to authenticated;
create or replace function public.ai_food_search_status(p_model_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Vui lòng đăng nhập để dùng trợ lý.'; end if;
  return (select jsonb_build_object('total',count(*),'indexed',count(e.food_id))
    from public.foods f join public.restaurants r on r.id=f.restaurant_id
    left join private.ai_food_embeddings e on e.food_id=f.id and e.model_key=p_model_key and e.content_hash=md5(private.ai_food_document(f.id))
    where f.is_available is true and r.is_active is true);
end $$;
revoke all on function public.ai_food_search_status(text) from public,anon;
grant execute on function public.ai_food_search_status(text) to authenticated;
notify pgrst,'reload schema';
