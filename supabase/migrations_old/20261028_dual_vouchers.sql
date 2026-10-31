-- Separate food/shipping vouchers. Requires the wallet and recipient migrations.
begin;
alter table public.vouchers add column if not exists applies_to text not null default 'food';
do $$ begin
  if not exists(select 1 from pg_constraint where conname='voucher_applies_to_check' and conrelid='public.vouchers'::regclass) then
    alter table public.vouchers add constraint voucher_applies_to_check check(applies_to in ('food','shipping'));
  end if;
end $$;
-- Only this explicitly confirmed existing code is reclassified.
update public.vouchers set applies_to='shipping' where code='FREESHIPALL';

alter table public.orders
  add column if not exists shipping_voucher_id uuid references public.vouchers(id),
  add column if not exists food_discount_amount numeric not null default 0,
  add column if not exists shipping_discount_amount numeric not null default 0;
-- Historical orders used food discounts, including old codes named FREESHIP.
-- Preserve their original totals and discount semantics.
update public.orders set food_discount_amount=discount_amount
where shipping_voucher_id is null and shipping_discount_amount=0 and food_discount_amount=0 and discount_amount<>0;

create or replace function public.create_food_order(
  p_order_id uuid, p_items jsonb, p_address text, p_voucher_code text,
  p_latitude double precision, p_longitude double precision, p_delivery_fee numeric,
  p_recipient_name text, p_recipient_phone text, p_shipping_voucher_code text
)
returns setof public.orders language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_food_voucher public.vouchers%rowtype;
  v_shipping_voucher public.vouchers%rowtype;
  v_food_code text := nullif(upper(btrim(p_voucher_code)),'');
  v_shipping_code text := nullif(upper(btrim(p_shipping_voucher_code)),'');
  v_shipping_discount numeric := 0;
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  if p_order_id is null then raise exception 'Thiếu mã yêu cầu đặt hàng.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text,0));
  select * into v_order from public.orders where id=p_order_id;
  if found then
    if v_order.user_id<>v_user then raise exception 'Mã đơn hàng không khả dụng.'; end if;
    return next v_order; return;
  end if;
  -- Serialize a customer's wallet consumption across simultaneous checkouts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,119));
  if v_food_code is not null then
    select * into v_food_voucher from public.vouchers where code=v_food_code for share;
    if not found or v_food_voucher.applies_to<>'food' then raise exception 'Vui lòng chọn đúng voucher giảm tiền món.'; end if;
    if v_food_voucher.discount_value::text in ('NaN','Infinity','-Infinity') then raise exception 'Giá trị voucher tiền món không hợp lệ.'; end if;
  end if;
  if v_shipping_code is not null then
    select * into v_shipping_voucher from public.vouchers where code=v_shipping_code for share;
    if not found or v_shipping_voucher.applies_to<>'shipping' then raise exception 'Vui lòng chọn đúng voucher giảm phí giao hàng.'; end if;
    if v_shipping_voucher.is_active is not true then raise exception 'Voucher phí giao hàng đã ngừng hoạt động.'; end if;
    if v_shipping_voucher.expiry_date is not null and v_shipping_voucher.expiry_date<=now() then raise exception 'Voucher phí giao hàng đã hết hạn.'; end if;
    if v_shipping_voucher.discount_value is null or v_shipping_voucher.discount_value<0 or v_shipping_voucher.discount_value::text in ('NaN','Infinity','-Infinity') or
       v_shipping_voucher.discount_type not in ('fixed','percentage') or v_shipping_voucher.discount_type is null or
       (v_shipping_voucher.discount_type='percentage' and v_shipping_voucher.discount_value>100) then
      raise exception 'Giá trị voucher phí giao hàng không hợp lệ.';
    end if;
  end if;
  perform 1 from public.user_vouchers
    where user_id=v_user and voucher_id in (v_food_voucher.id,v_shipping_voucher.id)
    order by voucher_id for update;
  if v_shipping_code is not null and not exists(select 1 from public.user_vouchers where user_id=v_user and voucher_id=v_shipping_voucher.id and is_used=false) then
    raise exception 'Voucher phí giao hàng chưa được thu thập hoặc đã sử dụng.';
  end if;

  -- Reuse all existing price/option/location/recipient/food-voucher validation.
  -- The helper's writes and both voucher consumptions share THIS transaction.
  select * into strict v_order from public.create_food_order(p_order_id,p_items,p_address,v_food_code,p_latitude,p_longitude,p_delivery_fee,p_recipient_name,p_recipient_phone);
  if v_shipping_code is not null then
    if v_shipping_voucher.restaurant_id is not null and v_shipping_voucher.restaurant_id<>v_order.restaurant_id then
      raise exception 'Voucher phí giao hàng chỉ áp dụng tại quán khác.';
    end if;
    if v_order.subtotal<coalesce(v_shipping_voucher.min_order_value,0) then raise exception 'Tiền món chưa đạt mức tối thiểu của voucher phí giao hàng.'; end if;
    v_shipping_discount := least(v_order.delivery_fee,case when v_shipping_voucher.discount_type='percentage'
      then round(v_order.delivery_fee*v_shipping_voucher.discount_value/100,2)
      else round(v_shipping_voucher.discount_value,2) end);
    update public.user_vouchers set is_used=true where user_id=v_user and voucher_id=v_shipping_voucher.id and is_used=false;
    if not found then raise exception 'Voucher phí giao hàng đã sử dụng.'; end if;
  end if;
  return query update public.orders set
    food_discount_amount=v_order.discount_amount,
    shipping_discount_amount=v_shipping_discount,
    shipping_voucher_id=v_shipping_voucher.id,
    discount_amount=v_order.discount_amount+v_shipping_discount,
    total=v_order.subtotal+v_order.delivery_fee-v_order.discount_amount-v_shipping_discount
    where id=p_order_id and user_id=v_user returning *;
end; $$;

-- Clients cannot bypass target checks by calling an older overload.
revoke all on function public.create_food_order(uuid,jsonb,text,text,double precision,double precision,numeric,text,text) from public,anon,authenticated;
revoke all on function public.create_food_order(uuid,jsonb,text,text,double precision,double precision,numeric) from public,anon,authenticated;
revoke all on function public.create_food_order(uuid,jsonb,text,text,double precision,double precision,numeric,text,text,text) from public,anon;
grant execute on function public.create_food_order(uuid,jsonb,text,text,double precision,double precision,numeric,text,text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
