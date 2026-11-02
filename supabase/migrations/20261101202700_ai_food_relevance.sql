-- Conservative initial links: menu names/categories only, never restaurant names.
-- Existing curated links remain unchanged. Ambiguous menus stay unclassified.
insert into public.food_discovery_categories(food_id,discovery_category_id)
select f.id,d.id from public.foods f
left join public.categories c on c.id=f.category_id
join public.discovery_categories d on d.kind='food' and d.is_active
where
  (d.id='tra-sua' and (lower(f.name) ~ '(^|[^[:alnum:]])(trà[[:space:]]+sữa|milk[[:space:]]+tea)([^[:alnum:]]|$)'
    or lower(c.name) ~ '^(trà[[:space:]]+sữa|milk[[:space:]]+tea)([^[:alnum:]]|$)'))
  or (d.id='com' and lower(f.name) ~ '^cơm[[:space:]]' and lower(f.name) !~ '^cơm[[:space:]]+(cháy|thêm|trắng|không)([^[:alnum:]]|$)')
  or (d.id='bun-mi-pho' and lower(f.name) ~ '^(bún|mì|mỳ|phở|hủ tiếu)[[:space:]]'
    and lower(f.name) !~ '^(bún|mì|mỳ|phở|hủ tiếu)[[:space:]]+(thêm|không|gói)([^[:alnum:]]|$)')
  or (d.id='mon-chay' and (lower(c.name) ~ '^(món[[:space:]]+chay|đồ[[:space:]]+chay|chay)$'
    or lower(f.name) ~ '(^|[^[:alnum:]])chay([^[:alnum:]]|$)'))
  or (d.id='mon-han' and (lower(c.name) ~ '^(món hàn|món hàn quốc|ẩm thực hàn quốc)$'
    or lower(f.name) ~ '(^|[^[:alnum:]])(tokbokki|tteokbokki|bibimbap|kimbap|gimbap)([^[:alnum:]]|$)'))
on conflict(food_id,discovery_category_id) do nothing;

create or replace function private.ai_groups_match(p_food_id uuid,p_groups text[],p_excluded_groups text[])
returns boolean language sql stable set search_path='' as $$
  select not exists(select 1 from unnest(coalesce(p_groups,'{}'::text[])) g(id)
    where not exists(select 1 from public.food_discovery_categories fd
      join public.discovery_categories d on d.id=fd.discovery_category_id
      where fd.food_id=p_food_id and d.id=g.id and d.kind='food' and d.is_active))
    and not exists(select 1 from public.food_discovery_categories fd
      where fd.food_id=p_food_id and fd.discovery_category_id=any(coalesce(p_excluded_groups,'{}'::text[])));
$$;
revoke all on function private.ai_groups_match(uuid,text[],text[]) from public,anon,authenticated;

create or replace function private.ai_validate_relevance(p_groups text[],p_excluded_groups text[],p_min_similarity double precision)
returns void language plpgsql stable set search_path='' as $$
begin
  if p_min_similarity is null or not(p_min_similarity between 0 and 1)
    or cardinality(p_groups)>6 or cardinality(p_excluded_groups)>6
    or exists(select 1 from unnest(coalesce(p_groups,'{}'::text[])||coalesce(p_excluded_groups,'{}'::text[])) g(id)
      where g.id is null or not exists(select 1 from public.discovery_categories d where d.id=g.id and d.kind='food' and d.is_active))
  then raise exception 'Bộ lọc nhóm món hoặc ngưỡng tương đồng không hợp lệ.'; end if;
end $$;
revoke all on function private.ai_validate_relevance(text[],text[],double precision) from public,anon,authenticated;

-- Versioned RPCs keep earlier deployments working during rollout.
create or replace function public.ai_match_foods_v2(p_embedding extensions.vector,p_model_key text,
  p_latitude double precision,p_longitude double precision,p_max_price numeric default null,p_sweetness text default null,
  p_groups text[] default '{}',p_excluded_groups text[] default '{}',p_min_similarity double precision default 0.60,p_limit integer default 5)
returns table(food_id uuid,restaurant_id uuid,name text,description text,price numeric,original_price numeric,
  image_url text,restaurant_name text,distance_km double precision,option_hint text,similarity double precision)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.ai_validate_search(p_model_key,p_latitude,p_longitude,p_max_price,p_sweetness);
  perform private.ai_validate_relevance(p_groups,p_excluded_groups,p_min_similarity);
  if p_limit is null or p_limit not between 1 and 10 or p_embedding is null or extensions.vector_dims(p_embedding)<>1536 or extensions.vector_norm(p_embedding)<=0 then raise exception 'Vector truy vấn không hợp lệ.'; end if;
  return query select l.*,1-(e.embedding operator(extensions.<=>) p_embedding) score
    from private.ai_live_foods(p_model_key,p_latitude,p_longitude,p_max_price,p_sweetness) l
    join private.ai_food_embeddings e on e.food_id=l.food_id
    where private.ai_groups_match(l.food_id,p_groups,p_excluded_groups)
      and 1-(e.embedding operator(extensions.<=>) p_embedding)>=p_min_similarity
    order by e.embedding operator(extensions.<=>) p_embedding,l.distance_km,l.food_id limit p_limit;
end $$;
revoke all on function public.ai_match_foods_v2(extensions.vector,text,double precision,double precision,numeric,text,text[],text[],double precision,integer) from public,anon;
grant execute on function public.ai_match_foods_v2(extensions.vector,text,double precision,double precision,numeric,text,text[],text[],double precision,integer) to authenticated;

create or replace function public.ai_recheck_foods_v2(p_food_ids uuid[],p_embedding extensions.vector,p_model_key text,
  p_latitude double precision,p_longitude double precision,p_max_price numeric default null,p_sweetness text default null,
  p_groups text[] default '{}',p_excluded_groups text[] default '{}',p_min_similarity double precision default 0.60)
returns table(food_id uuid,restaurant_id uuid,name text,description text,price numeric,original_price numeric,
  image_url text,restaurant_name text,distance_km double precision,option_hint text,similarity double precision)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.ai_validate_search(p_model_key,p_latitude,p_longitude,p_max_price,p_sweetness);
  perform private.ai_validate_relevance(p_groups,p_excluded_groups,p_min_similarity);
  if p_food_ids is null or cardinality(p_food_ids)>10 or p_embedding is null or extensions.vector_dims(p_embedding)<>1536 or extensions.vector_norm(p_embedding)<=0 then raise exception 'Danh sách hoặc vector gợi ý không hợp lệ.'; end if;
  return query select l.*,1-(e.embedding operator(extensions.<=>) p_embedding) score
    from private.ai_live_foods(p_model_key,p_latitude,p_longitude,p_max_price,p_sweetness,p_food_ids) l
    join private.ai_food_embeddings e on e.food_id=l.food_id
    where private.ai_groups_match(l.food_id,p_groups,p_excluded_groups)
      and 1-(e.embedding operator(extensions.<=>) p_embedding)>=p_min_similarity
    order by array_position(p_food_ids,l.food_id) limit 5;
end $$;
revoke all on function public.ai_recheck_foods_v2(uuid[],extensions.vector,text,double precision,double precision,numeric,text,text[],text[],double precision) from public,anon;
grant execute on function public.ai_recheck_foods_v2(uuid[],extensions.vector,text,double precision,double precision,numeric,text,text[],text[],double precision) to authenticated;
notify pgrst,'reload schema';
