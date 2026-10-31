-- Requires phase2, phase3 and dynamic_shipping migrations, and user_vouchers.
-- Uses only user_id, voucher_id and is_used; keeps existing rows intact.
begin;

-- Existing UNIQUE(user_id,voucher_id) makes collection idempotent.

-- Ensure PostgREST can resolve vouchers!voucher_id even if the original table
-- was created without a foreign key. Existing constraint names are preserved.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.user_vouchers'::regclass and c.contype = 'f'
      and c.confrelid = 'public.vouchers'::regclass
      and c.conkey = array[(select attnum from pg_attribute where attrelid = 'public.user_vouchers'::regclass and attname = 'voucher_id')]::smallint[]
  ) then
    alter table public.user_vouchers add constraint user_vouchers_voucher_id_fkey
      foreign key(voucher_id) references public.vouchers(id);
  end if;
end $$;

alter table public.user_vouchers enable row level security;
revoke all on public.user_vouchers from public, anon, authenticated;
grant select on public.user_vouchers to authenticated;
drop policy if exists wallet_own_read on public.user_vouchers;
create policy wallet_own_read on public.user_vouchers for select to authenticated using (user_id = auth.uid());
-- Restrictive policy also bounds any older permissive SELECT policy.
drop policy if exists wallet_own_boundary on public.user_vouchers;
create policy wallet_own_boundary on public.user_vouchers as restrictive for select to authenticated using (user_id = auth.uid());

create or replace function public.collect_my_voucher(p_voucher_id uuid)
returns setof public.vouchers
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_voucher public.vouchers%rowtype;
  v_used boolean;
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập để lấy mã.'; end if;
  select * into v_voucher from public.vouchers where id = p_voucher_id for share;
  if not found then raise exception 'Không tìm thấy mã ưu đãi.'; end if;
  if v_voucher.is_active is not true or (v_voucher.expiry_date is not null and v_voucher.expiry_date <= now()) then
    raise exception 'Mã ưu đãi đã hết hạn hoặc ngừng hoạt động.';
  end if;
  if v_voucher.discount_type not in ('fixed','percentage') or v_voucher.discount_type is null
    or v_voucher.discount_value is null or v_voucher.discount_value < 0
    or (v_voucher.discount_type = 'percentage' and v_voucher.discount_value > 100) then
    raise exception 'Mã ưu đãi chưa khả dụng.';
  end if;
  insert into public.user_vouchers(user_id, voucher_id, is_used)
    values(v_user, p_voucher_id, false) on conflict(user_id, voucher_id) do nothing;
  select is_used into v_used from public.user_vouchers
    where user_id = v_user and voucher_id = p_voucher_id for update;
  if not found or v_used is distinct from false then raise exception 'Mã ưu đãi đã sử dụng, không thể thu thập lại.'; end if;
  return next v_voucher;
end $$;
revoke all on function public.collect_my_voucher(uuid) from public, anon;
grant execute on function public.collect_my_voucher(uuid) to authenticated;

create or replace function public.create_food_order(
  p_order_id uuid,
  p_items jsonb,
  p_address text,
  p_voucher_code text,
  p_latitude double precision,
  p_longitude double precision,
  p_delivery_fee numeric
)
returns setof public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_food public.foods%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_voucher public.vouchers%rowtype;
  v_restaurant_id uuid;
  v_item jsonb;
  v_option jsonb;
  v_choice record;
  v_snapshot jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_unit numeric;
  v_quantity integer;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric;
  v_a double precision;
  v_distance double precision;
begin
  if v_user is null then raise exception 'Please sign in before ordering.'; end if;
  if p_order_id is null then raise exception 'Missing order identifier.'; end if;
  -- Same request ID is reused after a timeout. Serialize duplicate submissions.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text, 0));
  select * into v_order from public.orders where id = p_order_id;
  if found then
    if v_order.user_id <> v_user then raise exception 'Order identifier unavailable.'; end if;
    return next v_order;
    return;
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Vui lòng chọn tọa độ giao hàng hợp lệ.';
  end if;
  if p_address is null or length(btrim(p_address)) < 5 or length(p_address) > 500 then
    raise exception 'Enter a delivery address between 5 and 500 characters.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid cart.'; end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then raise exception 'Cart must contain 1 to 100 lines.'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item->'quantity') <> 'number'
       or (v_item->>'quantity')::numeric <> trunc((v_item->>'quantity')::numeric) then
      raise exception 'Invalid quantity.';
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity < 1 or v_quantity > 99 then raise exception 'Quantity must be from 1 to 99.'; end if;
    if jsonb_typeof(v_item->'options') is distinct from 'array' then raise exception 'Invalid options.'; end if;
    if jsonb_array_length(v_item->'options') > 100 then raise exception 'Too many options.'; end if;
    if length(coalesce(v_item->>'note', '')) > 500 then raise exception 'Note is too long.'; end if;

    select * into v_food from public.foods where id = (v_item->>'foodId')::uuid for share;
    if not found or v_food.is_available is not true then raise exception 'A dish is no longer available. Please update your cart.'; end if;
    select * into v_restaurant from public.restaurants where id = v_food.restaurant_id for share;
    if not found or v_restaurant.is_active is not true or v_restaurant.is_open is not true then raise exception 'The restaurant is currently unavailable.'; end if;
    if v_restaurant_id is not null and v_restaurant_id <> v_food.restaurant_id then raise exception 'Each order must belong to one restaurant.'; end if;
    v_restaurant_id := v_food.restaurant_id;
    v_unit := v_food.price;
    v_snapshot := '[]'::jsonb;

    for v_option in select value from jsonb_array_elements(v_item->'options') loop
      select i.id, i.name, i.extra_price, g.id as group_id, g.name as group_name, g.allow_multiple
      into v_choice
      from public.food_option_items i join public.food_option_groups g on g.id = i.group_id
      where i.id = (v_option->>'id')::uuid and g.id = (v_option->>'groupId')::uuid and g.food_id = v_food.id
      for share of i, g;
      if not found then raise exception 'An option has changed. Please select your dish again.'; end if;
      if v_snapshot @> jsonb_build_array(jsonb_build_object('id', v_choice.id)) then raise exception 'Duplicate option.'; end if;
      if v_choice.allow_multiple is not true and v_snapshot @> jsonb_build_array(jsonb_build_object('groupId', v_choice.group_id)) then
        raise exception 'Only one option is allowed in this group.';
      end if;
      v_unit := v_unit + coalesce(v_choice.extra_price, 0);
      v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
        'groupId', v_choice.group_id, 'groupName', v_choice.group_name,
        'id', v_choice.id, 'label', v_choice.name, 'price', coalesce(v_choice.extra_price, 0)
      ));
    end loop;
    if exists (
      select 1 from public.food_option_groups g where g.food_id = v_food.id and g.is_required is true
      and not (v_snapshot @> jsonb_build_array(jsonb_build_object('groupId', g.id)))
    ) then raise exception 'Please select all required option groups.'; end if;
    v_unit := round(v_unit, 2);
    if v_unit < 0 or v_item->>'unitPrice' is null or v_unit <> round((v_item->>'unitPrice')::numeric, 2) then
      raise exception 'The price has changed. Please update your cart before ordering.';
    end if;
    v_subtotal := v_subtotal + v_unit * v_quantity;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'food_id', v_food.id, 'quantity', v_quantity, 'unit_price', v_unit,
      'options_snapshot', jsonb_build_object('options', v_snapshot, 'note', coalesce(v_item->>'note', ''),
        'food_name', v_food.name, 'base_price', v_food.price)
    ));
  end loop;

  if v_restaurant.latitude is null or v_restaurant.longitude is null
     or v_restaurant.latitude not between -90 and 90 or v_restaurant.longitude not between -180 and 180 then
    raise exception 'Quán chưa có tọa độ hợp lệ để tính phí giao hàng.';
  end if;
  -- Same Haversine formula and micrometre normalization as the client.
  v_a := power(sin(radians(p_latitude-v_restaurant.latitude)/2),2)
    + cos(radians(v_restaurant.latitude))*cos(radians(p_latitude))
      * power(sin(radians(p_longitude-v_restaurant.longitude)/2),2);
  v_a := least(1::double precision,greatest(0::double precision,v_a));
  v_distance := 6371*2*atan2(sqrt(v_a),sqrt(1-v_a));
  v_distance := round(v_distance::numeric,9)::double precision;
  v_delivery := 15000 + 5000*ceil(greatest(0::double precision,v_distance-2));
  if p_delivery_fee is null or p_delivery_fee <> v_delivery then
    raise exception 'Phí giao hàng đã thay đổi. Vui lòng tính lại trước khi đặt hàng.';
  end if;

  if nullif(btrim(p_voucher_code), '') is not null then
    select * into v_voucher from public.vouchers where code = upper(btrim(p_voucher_code)) for share;
    if not found or v_voucher.is_active is not true then raise exception 'Voucher is invalid or inactive.'; end if;
    if v_voucher.expiry_date is not null and v_voucher.expiry_date <= now() then raise exception 'Voucher has expired.'; end if;
    perform 1 from public.user_vouchers where user_id = v_user and voucher_id = v_voucher.id and is_used = false for update;
    if not found then raise exception 'Mã chưa được thu thập hoặc đã sử dụng. Vui lòng chọn lại trong ví.'; end if;
    if v_voucher.restaurant_id is not null and v_voucher.restaurant_id <> v_restaurant_id then raise exception 'Voucher belongs to another restaurant.'; end if;
    if v_subtotal < coalesce(v_voucher.min_order_value, 0) then raise exception 'The order does not meet the voucher minimum.'; end if;
    if v_voucher.discount_value is null or v_voucher.discount_value < 0 then raise exception 'Invalid voucher value.'; end if;
    if v_voucher.discount_type = 'percentage' then
      if v_voucher.discount_value > 100 then raise exception 'Invalid percentage discount.'; end if;
      v_discount := least(v_subtotal, round(v_subtotal * v_voucher.discount_value / 100, 2));
    elsif v_voucher.discount_type = 'fixed' then
      v_discount := least(v_subtotal, round(v_voucher.discount_value, 2));
    else raise exception 'Unsupported voucher type.';
    end if;
  end if;

  insert into public.orders (id, user_id, restaurant_id, status, subtotal, delivery_fee, voucher_id,
    discount_amount, total, payment_method, delivery_address, latitude, longitude)
  values (p_order_id, v_user, v_restaurant_id, 'pending', v_subtotal, v_delivery, v_voucher.id,
    v_discount, v_subtotal + v_delivery - v_discount, 'cash', btrim(p_address), p_latitude, p_longitude) returning * into v_order;

  insert into public.order_items (order_id, food_id, quantity, unit_price, options_snapshot)
  select p_order_id, (line->>'food_id')::uuid, (line->>'quantity')::integer,
    (line->>'unit_price')::numeric, line->'options_snapshot'
  from jsonb_array_elements(v_lines) as items(line);
  if v_voucher.id is not null then
    update public.user_vouchers set is_used = true where user_id = v_user and voucher_id = v_voucher.id;
  end if;
  return next v_order;
end;
$$;


-- Retire legacy entry points so clients cannot keep using the old fixed shipping fee.
revoke all on function public.create_food_order(uuid,jsonb,text,text) from public,anon,authenticated;
revoke all on function public.create_food_order_at_location(uuid,jsonb,text,text,double precision,double precision) from public,anon,authenticated;
revoke all on function public.create_food_order(uuid,jsonb,text,text,double precision,double precision,numeric) from public,anon;
grant execute on function public.create_food_order(uuid,jsonb,text,text,double precision,double precision,numeric) to authenticated;
revoke insert,update on public.orders,public.order_items from anon,authenticated;
notify pgrst, 'reload schema';
commit;
