-- Run in Supabase SQL Editor as postgres. No rows, tables or columns are deleted.
-- Customer app only: catalog administration/status updates remain server-side.
-- Requires existing checkout, profile/address and review RPC migrations.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';

-- Remove table AND column grants, including TRUNCATE and inherited PUBLIC access.
-- This does not revoke privileges from postgres/service_role or change RPC owners.
do $$
declare t text; columns_sql text;
begin
  foreach t in array array[
    'banners','categories','food_option_groups','food_option_items','foods',
    'restaurants','vouchers','profiles','orders','order_items','favorites',
    'calls','notifications'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all privileges on table public.%I from public,anon,authenticated',t);
    select string_agg(format('%I',a.attname),', ' order by a.attnum)
      into columns_sql from pg_catalog.pg_attribute a
      where a.attrelid=format('public.%I',t)::regclass
        and a.attnum>0 and not a.attisdropped;
    if columns_sql is not null then
      execute format('revoke all privileges (%s) on table public.%I from public,anon,authenticated',columns_sql,t);
    end if;
  end loop;
end $$;

-- Catalog is intentionally readable, but never writable by the customer client.
drop policy if exists admin_insert_foods on public.foods;
drop policy if exists admin_insert_restaurants on public.restaurants;
do $$
declare t text;
begin
  foreach t in array array[
    'banners','categories','food_option_groups','food_option_items',
    'foods','restaurants','vouchers'
  ] loop
    execute format('drop policy if exists customer_catalog_read on public.%I',t);
    execute format('create policy customer_catalog_read on public.%I for select to anon,authenticated using (true)',t);
    execute format('grant select on table public.%I to anon,authenticated',t);
  end loop;
end $$;

-- Profiles: own row or the real driver assigned to an order belonging to caller.
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists profile_read_self on public.profiles;
create policy profile_read_self on public.profiles for select to authenticated
  using (id=(select auth.uid()));
drop policy if exists order_driver_profile_read on public.profiles;
create policy order_driver_profile_read on public.profiles for select to authenticated
  using (role='driver' and exists (
    select 1 from public.orders o
    where o.user_id=(select auth.uid()) and o.driver_id=profiles.id
  ));
-- Also bounds any differently named old permissive policy.
drop policy if exists customer_profile_read_boundary on public.profiles;
create policy customer_profile_read_boundary on public.profiles as restrictive
  for select to authenticated using (
    id=(select auth.uid()) or (role='driver' and exists (
      select 1 from public.orders o
      where o.user_id=(select auth.uid()) and o.driver_id=profiles.id
    ))
  );
grant select on public.profiles to authenticated;

-- Orders: remove blanket reads/updates; all writes go through trusted RPCs.
drop policy if exists admin_read_all_orders on public.orders;
drop policy if exists admin_update_order_status on public.orders;
drop policy if exists "Users can insert own orders" on public.orders;
drop policy if exists phase2_read_own_orders on public.orders;
create policy phase2_read_own_orders on public.orders for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists customer_order_read_boundary on public.orders;
create policy customer_order_read_boundary on public.orders as restrictive
  for select to authenticated using (user_id=(select auth.uid()));
grant select on public.orders to authenticated;

drop policy if exists admin_read_all_order_items on public.order_items;
drop policy if exists "Users can insert order items" on public.order_items;
drop policy if exists phase2_read_own_order_items on public.order_items;
create policy phase2_read_own_order_items on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o
    where o.id=order_items.order_id and o.user_id=(select auth.uid())));
drop policy if exists customer_order_item_read_boundary on public.order_items;
create policy customer_order_item_read_boundary on public.order_items as restrictive
  for select to authenticated using (exists (select 1 from public.orders o
    where o.id=order_items.order_id and o.user_id=(select auth.uid())));
grant select on public.order_items to authenticated;

-- Favorites use direct INSERT (ON CONFLICT DO NOTHING) / DELETE in this app.
drop policy if exists phase4_read_own_favorites on public.favorites;
create policy phase4_read_own_favorites on public.favorites for select to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists phase4_add_own_favorite on public.favorites;
create policy phase4_add_own_favorite on public.favorites for insert to authenticated
  with check (user_id=(select auth.uid()) and restaurant_id is not null
    and exists(select 1 from public.restaurants r
      where r.id=favorites.restaurant_id and r.is_active is true));
drop policy if exists phase4_remove_own_favorite on public.favorites;
create policy phase4_remove_own_favorite on public.favorites for delete to authenticated
  using (user_id=(select auth.uid()));
drop policy if exists customer_favorite_boundary on public.favorites;
create policy customer_favorite_boundary on public.favorites as restrictive
  for all to authenticated using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));
grant select,insert,delete on public.favorites to authenticated;

-- Other disabled private tables from the supplied RLS export: read-only to customer.
drop policy if exists customer_call_read on public.calls;
create policy customer_call_read on public.calls for select to authenticated
  using (caller_id=(select auth.uid()) or receiver_id=(select auth.uid()));
drop policy if exists customer_call_read_boundary on public.calls;
create policy customer_call_read_boundary on public.calls as restrictive
  for select to authenticated
  using (caller_id=(select auth.uid()) or receiver_id=(select auth.uid()));
grant select on public.calls to authenticated;

drop policy if exists customer_notification_read on public.notifications;
create policy customer_notification_read on public.notifications for select to authenticated
  using (user_id=(select auth.uid()) or user_id is null);
drop policy if exists customer_notification_read_boundary on public.notifications;
create policy customer_notification_read_boundary on public.notifications as restrictive
  for select to authenticated using (user_id=(select auth.uid()) or user_id is null);
grant select on public.notifications to authenticated;

-- Fail transaction if effective client rights still contradict this access model,
-- e.g. privileges granted through a custom role inherited by anon/authenticated.
do $$
declare t text; r text;
begin
  foreach t in array array[
    'banners','categories','food_option_groups','food_option_items','foods',
    'restaurants','vouchers','profiles','orders','order_items','calls','notifications'
  ] loop
    foreach r in array array['anon','authenticated'] loop
      if has_table_privilege(r,format('public.%I',t),'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        or has_any_column_privilege(r,format('public.%I',t),'INSERT,UPDATE,REFERENCES') then
        raise exception 'Unexpected remaining write authority on % for %. Transaction rolled back.',t,r;
      end if;
    end loop;
  end loop;
  foreach t in array array['profiles','orders','order_items','favorites','calls','notifications'] loop
    if has_table_privilege('anon',format('public.%I',t),'SELECT')
      or has_any_column_privilege('anon',format('public.%I',t),'SELECT') then
      raise exception 'Unexpected anonymous read on %. Transaction rolled back.',t;
    end if;
  end loop;
end $$;

notify pgrst,'reload schema';
commit;
