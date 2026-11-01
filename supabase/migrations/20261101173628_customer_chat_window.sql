-- Only narrow INSERT privileges; history and existing chat images remain readable.
create or replace function private.customer_chat_open(p_order_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.orders o
    where o.id::text = p_order_id and o.user_id = auth.uid()
      and (o.status in ('pending','preparing','delivering')
        or (o.status = 'completed' and o.completed_at <= now()
          and o.completed_at > now() - interval '5 minutes'))
  );
$$;
revoke all on function private.customer_chat_open(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.customer_chat_open(text) to authenticated;

drop policy if exists customer_message_send_window on public.messages;
create policy customer_message_send_window on public.messages as restrictive
for insert to authenticated
with check (private.customer_chat_open(order_id::text));

drop policy if exists customer_chat_upload_window on storage.objects;
create policy customer_chat_upload_window on storage.objects as restrictive
for insert to authenticated
with check (bucket_id <> 'order-chat' or private.customer_chat_open(split_part(name,'/',1)));
