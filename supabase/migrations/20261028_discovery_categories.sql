begin;
create table if not exists public.discovery_categories (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 100),
  kind text not null check (kind in ('food','restaurant_tag')),
  restaurant_tag text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  constraint discovery_category_kind check (
    (kind='food' and restaurant_tag is null) or
    (kind='restaurant_tag' and restaurant_tag is not null and length(btrim(restaurant_tag))>0)
  )
);
create table if not exists public.food_discovery_categories (
  food_id uuid not null references public.foods(id) on delete cascade,
  discovery_category_id text not null references public.discovery_categories(id) on delete cascade,
  primary key(food_id,discovery_category_id)
);
create index if not exists food_discovery_category_idx on public.food_discovery_categories(discovery_category_id,food_id);

insert into public.discovery_categories(id,name,kind,restaurant_tag,sort_order) values
  ('tra-sua','Trà sữa','food',null,1),
  ('do-an-vat','Ăn vặt','food',null,2),
  ('mon-chay','Món chay','food',null,3),
  ('com','Cơm','food',null,4),
  ('bun-mi-pho','Bún mì phở','food',null,5),
  ('mon-han','Món Hàn','food',null,6),
  ('quan-moi','Quán mới','restaurant_tag','Quán mới',7),
  ('quan-tru-danh','Quán trứ danh','restaurant_tag','Quán trứ danh',8)
on conflict (id) do nothing;

-- Initial classification uses explicit menu CATEGORY names, never food-name
-- ingredients. Mixed categories such as Drinks/Món Mới/Món Đang Giảm stay unmapped.
-- Món chay must be assigned manually after checking the actual dish.
insert into public.food_discovery_categories(food_id,discovery_category_id)
select f.id,m.discovery_id from public.foods f
join public.categories c on c.id=f.category_id
join (values
  ('tra-sua','Trà Sữa'),('tra-sua','Milk Tea'),
  ('do-an-vat','Ăn Vặt'),('do-an-vat','Đồ Ăn Vặt'),('do-an-vat','Bánh Mặn'),('do-an-vat','Bánh Ngọt'),
  ('com','Cơm'),('com','Cơm Gà'),('com','Cơm Tấm'),('com','Rice'),
  ('bun-mi-pho','Bún'),('bun-mi-pho','Mì'),('bun-mi-pho','Mỳ'),('bun-mi-pho','Phở'),('bun-mi-pho','Mỳ Ý'),('bun-mi-pho','Mì Ý'),
  ('mon-han','Món Hàn'),('mon-han','Món Hàn Quốc')
) as m(discovery_id,category_name) on lower(btrim(c.name))=lower(m.category_name)
on conflict do nothing;

alter table public.discovery_categories enable row level security;
alter table public.food_discovery_categories enable row level security;
drop policy if exists discovery_categories_read on public.discovery_categories;
create policy discovery_categories_read on public.discovery_categories for select to anon,authenticated using(is_active);
drop policy if exists food_discovery_categories_read on public.food_discovery_categories;
create policy food_discovery_categories_read on public.food_discovery_categories for select to anon,authenticated using (
  exists(select 1 from public.discovery_categories d where d.id=discovery_category_id and d.kind='food' and d.is_active)
);
revoke all on public.discovery_categories,public.food_discovery_categories from public,anon,authenticated;
grant select on public.discovery_categories,public.food_discovery_categories to anon,authenticated;
notify pgrst, 'reload schema';
commit;
