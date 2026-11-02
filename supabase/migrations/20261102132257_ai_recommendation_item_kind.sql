-- Explicit AI catalog classification; menu/cart behavior is unchanged.
alter table public.foods add column if not exists is_addon boolean not null default false;
comment on column public.foods.is_addon is 'Món bán thêm/topping riêng; không gợi ý thay cho món hoặc đồ uống hoàn chỉnh.';
-- Initial classification uses clear menu categories and standalone topping names only.
update public.foods f set is_addon=true
where not f.is_addon and (
  exists(select 1 from public.categories c where c.id=f.category_id
    and lower(btrim(c.name)) ~ '^(topping|topping thêm|thêm topping|thêm sốt|món thêm|đồ thêm)$')
  or lower(btrim(f.name)) ~ '^(mix[[:space:]]+|full[[:space:]]+)?topping([^[:alnum:]]|$)'
);
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
    and f.is_addon is false
    and r.latitude between -90 and 90 and r.longitude between -180 and 180 and d.km<=20
    and (p_max_price is null or f.price<=p_max_price)
    and (p_food_ids is null or f.id=any(p_food_ids))
    and e.content_hash=md5(private.ai_food_document(f.id))
    and (p_sweetness is null or s.hint is not null);
$$;
revoke all on function private.ai_live_foods(text,double precision,double precision,numeric,text,uuid[]) from public,anon,authenticated;

notify pgrst,'reload schema';
