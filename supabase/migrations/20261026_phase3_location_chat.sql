-- Additive Phase 3 migration. Requires the Phase 2 checkout migration.
begin;

create or replace function public.create_food_order_at_location(
  p_order_id uuid, p_items jsonb, p_address text,
  p_voucher_code text default null,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns setof public.orders
language plpgsql security definer set search_path = ''
as $$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in before ordering.'; end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Please select valid delivery coordinates.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text, 0));
  select * into v_order from public.orders where id = p_order_id;
  if found then
    if v_order.user_id <> auth.uid() then raise exception 'Order identifier unavailable.'; end if;
    return next v_order;
    return;
  end if;
  select * into v_order from public.create_food_order(p_order_id, p_items, p_address, p_voucher_code);
  update public.orders set latitude = p_latitude, longitude = p_longitude
  where id = v_order.id returning * into v_order;
  return next v_order;
end;
$$;
revoke all on function public.create_food_order_at_location(uuid,jsonb,text,text,double precision,double precision) from public, anon;
grant execute on function public.create_food_order_at_location(uuid,jsonb,text,text,double precision,double precision) to authenticated;

alter table public.messages enable row level security;
drop policy if exists phase3_read_order_messages on public.messages;
create policy phase3_read_order_messages on public.messages for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or o.driver_id = auth.uid()))
);
drop policy if exists phase3_send_customer_message on public.messages;
create policy phase3_send_customer_message on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and sender_type = 'user'
  and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  and (
    (message_type = 'text' and image_url is null and length(btrim(content)) between 1 and 2000)
    or (message_type = 'image' and image_url is not null
      and split_part(image_url, '/', 1) = order_id::text
      and split_part(image_url, '/', 2) = auth.uid()::text
      and (content is null or length(content) <= 2000))
  )
);
grant select, insert on public.messages to authenticated;
create index if not exists phase3_messages_order_created_idx on public.messages(order_id, created_at, id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('order-chat','order-chat',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false, file_size_limit=5242880, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists phase3_read_chat_image on storage.objects;
create policy phase3_read_chat_image on storage.objects for select to authenticated using (
  bucket_id = 'order-chat' and exists (
    select 1 from public.orders o where o.id::text = (storage.foldername(name))[1]
    and (o.user_id = auth.uid() or o.driver_id = auth.uid())
  )
);
drop policy if exists phase3_upload_chat_image on storage.objects;
create policy phase3_upload_chat_image on storage.objects for insert to authenticated with check (
  bucket_id = 'order-chat' and (storage.foldername(name))[2] = auth.uid()::text
  and exists (select 1 from public.orders o where o.id::text = (storage.foldername(name))[1] and o.user_id = auth.uid())
);
drop policy if exists phase3_remove_own_chat_upload on storage.objects;
create policy phase3_remove_own_chat_upload on storage.objects for delete to authenticated using (
  bucket_id = 'order-chat' and (storage.foldername(name))[2] = auth.uid()::text
  and exists (select 1 from public.orders o where o.id::text = (storage.foldername(name))[1] and o.user_id = auth.uid())
  and not exists (select 1 from public.messages m where m.image_url = name)
);

do $$
begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
