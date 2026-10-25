-- Run once in the Supabase SQL Editor. No tables or existing records are dropped.
-- One RPC transaction creates the order and every item; any error rolls it all back.
begin;

create or replace function public.create_food_order(
  p_order_id uuid,
  p_items jsonb,
  p_address text,
  p_voucher_code text default null
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
  v_delivery numeric := 2;
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

  if nullif(btrim(p_voucher_code), '') is not null then
    select * into v_voucher from public.vouchers where code = upper(btrim(p_voucher_code)) for share;
    if not found or v_voucher.is_active is not true then raise exception 'Voucher is invalid or inactive.'; end if;
    if v_voucher.expiry_date is not null and v_voucher.expiry_date <= now() then raise exception 'Voucher has expired.'; end if;
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
    discount_amount, total, payment_method, delivery_address)
  values (p_order_id, v_user, v_restaurant_id, 'pending', v_subtotal, v_delivery, v_voucher.id,
    v_discount, v_subtotal + v_delivery - v_discount, 'cash', btrim(p_address)) returning * into v_order;

  insert into public.order_items (order_id, food_id, quantity, unit_price, options_snapshot)
  select p_order_id, (line->>'food_id')::uuid, (line->>'quantity')::integer,
    (line->>'unit_price')::numeric, line->'options_snapshot'
  from jsonb_array_elements(v_lines) as items(line);
  return next v_order;
end;
$$;

-- The function validates auth.uid(), catalog prices and ownership before any write.
revoke all on function public.create_food_order(uuid, jsonb, text, text) from public, anon;
grant execute on function public.create_food_order(uuid, jsonb, text, text) to authenticated;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
drop policy if exists "phase2_read_own_orders" on public.orders;
create policy "phase2_read_own_orders" on public.orders for select to authenticated using (auth.uid() = user_id);
drop policy if exists "phase2_read_own_order_items" on public.order_items;
create policy "phase2_read_own_order_items" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
grant select on public.orders, public.order_items to authenticated;
notify pgrst, 'reload schema';
commit;
