-- Recipient details belong to each saved address and are snapshotted on orders.
-- Nullable for compatibility with existing addresses, orders and RPCs.
begin;

alter table public.user_addresses
  add column if not exists recipient_name text,
  add column if not exists recipient_phone text;

alter table public.orders
  add column if not exists recipient_name text,
  add column if not exists recipient_phone text;

comment on column public.user_addresses.recipient_name is 'Name of the recipient at this saved address.';
comment on column public.user_addresses.recipient_phone is 'Recipient phone number, stored as text to retain leading zero or country prefix.';
comment on column public.orders.recipient_name is 'Recipient name captured when placing this order.';
comment on column public.orders.recipient_phone is 'Recipient phone captured when placing this order.';

notify pgrst, 'reload schema';
commit;
