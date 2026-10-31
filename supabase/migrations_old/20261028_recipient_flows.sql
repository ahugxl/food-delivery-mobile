-- Run after 20261028_delivery_recipients.sql and the existing address/wallet migrations.
-- Keep the validated address/checkout implementations as internal helpers.
begin;

create or replace function public.save_my_address(
  p_id uuid, p_title text, p_address text, p_latitude double precision,
  p_longitude double precision, p_is_default boolean, p_create boolean,
  p_recipient_name text, p_recipient_phone text
)
returns setof public.user_addresses language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(p_recipient_name);
  v_phone text := regexp_replace(btrim(p_recipient_phone),'[[:space:]().-]','','g');
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  if v_name is null or length(v_name) not between 2 and 100 then raise exception 'Tên người nhận cần từ 2 đến 100 ký tự.'; end if;
  if v_phone is null or v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'Số điện thoại người nhận cần từ 9 đến 15 chữ số.'; end if;
  -- The original RPC serializes address/default changes and validates ownership.
  perform public.save_my_address(p_id,p_title,p_address,p_latitude,p_longitude,p_is_default,p_create);
  return query update public.user_addresses
    set recipient_name=v_name, recipient_phone=v_phone
    where id=p_id and user_id=v_user returning *;
end; $$;

revoke all on function public.save_my_address(uuid,text,text,double precision,double precision,boolean,boolean) from public,anon,authenticated;
revoke all on function public.save_my_address(uuid,text,text,double precision,double precision,boolean,boolean,text,text) from public,anon;
grant execute on function public.save_my_address(uuid,text,text,double precision,double precision,boolean,boolean,text,text) to authenticated;

create or replace function public.create_food_order(
  p_order_id uuid, p_items jsonb, p_address text, p_voucher_code text,
  p_latitude double precision, p_longitude double precision, p_delivery_fee numeric,
  p_recipient_name text, p_recipient_phone text
)
returns setof public.orders language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_name text := btrim(p_recipient_name);
  v_phone text := regexp_replace(btrim(p_recipient_phone),'[[:space:]().-]','','g');
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  if p_order_id is null then raise exception 'Thiếu mã yêu cầu đặt hàng.'; end if;
  -- Same lock as the internal checkout. Retries return the original snapshot.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text,0));
  select * into v_order from public.orders where id=p_order_id;
  if found then
    if v_order.user_id<>v_user then raise exception 'Mã đơn hàng không khả dụng.'; end if;
    return next v_order;
    return;
  end if;
  if v_name is null or length(v_name) not between 2 and 100 then raise exception 'Tên người nhận cần từ 2 đến 100 ký tự.'; end if;
  if v_phone is null or v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'Số điện thoại người nhận cần từ 9 đến 15 chữ số.'; end if;
  -- Prices, options, shipping and wallet consumption remain in the same transaction.
  perform public.create_food_order(p_order_id,p_items,p_address,p_voucher_code,p_latitude,p_longitude,p_delivery_fee);
  return query update public.orders set recipient_name=v_name, recipient_phone=v_phone
    where id=p_order_id and user_id=v_user returning *;
end; $$;

revoke all on function public.create_food_order(uuid,jsonb,text,text,double precision,double precision,numeric) from public,anon,authenticated;
revoke all on function public.create_food_order(uuid,jsonb,text,text,double precision,double precision,numeric,text,text) from public,anon;
grant execute on function public.create_food_order(uuid,jsonb,text,text,double precision,double precision,numeric,text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
