SET local check_function_bodies = off;

CREATE OR REPLACE FUNCTION private.admin_set_food_discovery_groups (
  p_food_id                uuid,
  p_discovery_category_ids text[],
  p_remove_inactive        boolean DEFAULT false
)
  RETURNS text[]
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_ids text[];
  v_valid integer;
begin
  -- Khóa dòng món: hai lần lưu đồng thời cho cùng món sẽ chạy lần lượt (lần sau cùng thắng).
  perform 1 from public.foods where id = p_food_id for update;
  if not found then
    raise exception 'Không tìm thấy món.' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids
  from unnest(coalesce(p_discovery_category_ids, '{}')) as x
  where x is not null;

  select count(*) into v_valid
  from public.discovery_categories
  where id = any(v_ids) and kind = 'food' and is_active;
  if v_valid <> coalesce(cardinality(v_ids), 0) then
    raise exception 'Có nhóm khám phá không tồn tại, đã tắt hoặc không dành cho món. Hãy tải lại danh sách.' using errcode = 'P0001';
  end if;

  if not p_remove_inactive and exists (
    select 1
    from public.food_discovery_categories l
    where l.food_id = p_food_id
      and not exists (
        select 1 from public.discovery_categories d
        where d.id = l.discovery_category_id and d.kind = 'food' and d.is_active
      )
  ) then
    raise exception 'Món còn liên kết với nhóm đã tắt. Hãy xác nhận loại bỏ các liên kết này rồi lưu lại.' using errcode = 'P0001';
  end if;

  delete from public.food_discovery_categories where food_id = p_food_id;
  insert into public.food_discovery_categories (food_id, discovery_category_id)
  select p_food_id, x from unnest(v_ids) as x;

  return (select coalesce(array_agg(discovery_category_id order by discovery_category_id), '{}')
          from public.food_discovery_categories where food_id = p_food_id);
end;
$function$;

CREATE OR REPLACE FUNCTION private.ai_live_foods (
  p_model_key text,
  p_latitude  double precision,
  p_longitude double precision,
  p_max_price numeric,
  p_sweetness text,
  p_food_ids  uuid[]           DEFAULT NULL::uuid[]
)
  RETURNS TABLE (
    food_id         uuid,
    restaurant_id   uuid,
    name            text,
    description     text,
    price           numeric,
    original_price  numeric,
    image_url       text,
    restaurant_name text,
    distance_km     double precision,
    option_hint     text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
select f.id,r.id,f.name,left(f.description,500),f.price,f.original_price,f.image_url,r.name,d.km,s.hint
from public.foods f join public.restaurants r on r.id=f.restaurant_id
join private.ai_food_embeddings e on e.food_id=f.id and e.model_key=p_model_key
cross join lateral (select least(1::double precision,greatest(0::double precision,power(sin(radians(p_latitude-r.latitude)/2),2)+cos(radians(r.latitude))*cos(radians(p_latitude))*power(sin(radians(p_longitude-r.longitude)/2),2))) a) h
cross join lateral (select round((6371*2*atan2(sqrt(h.a),sqrt(1-h.a)))::numeric,9)::double precision km) d
cross join lateral (select private.ai_sweetness_evidence(f.id,p_sweetness) hint) s
where r.is_active is true and r.is_open is true and f.is_available is true and f.is_addon is false
and r.latitude between -90 and 90 and r.longitude between -180 and 180 and d.km<=20
and (p_max_price is null or f.price<=p_max_price) and (p_food_ids is null or f.id=any(p_food_ids))
and e.content_hash=md5(private.ai_food_document(f.id)) and (p_sweetness is null or s.hint is not null);
$function$;

CREATE OR REPLACE FUNCTION private.driver_bridge_order()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_a public.delivery_assignments; v_quote jsonb; v_seconds integer;
begin
  if new.driver_id is distinct from old.driver_id then
    select * into v_a from public.delivery_assignments where order_id=new.id
      and status in ('offered','accepted','at_restaurant','picked_up','at_customer') for update;
    if (found and v_a.status in ('picked_up','at_customer')) or (old.status='delivering' and new.status <> 'cancelled') then
      raise exception 'Đơn đã lấy món cần được quản trị xử lý sự cố trước khi đổi tài xế.';
    end if;
    if new.driver_id is not null then
      if new.status is null or new.status not in ('pending','preparing') then raise exception 'Chỉ phân công đơn đang chờ hoặc chuẩn bị.'; end if;
      perform 1 from public.driver_profiles d join public.profiles p on p.id=d.user_id
        where d.user_id=new.driver_id and d.approval_status='approved' and p.role='driver' for update of d;
      if not found then raise exception 'Tài xế chưa được duyệt.'; end if;
      v_quote:=private.driver_payout_quote(new.restaurant_id,new.latitude,new.longitude);
      perform private.driver_cod(new.payment_method,new.payment_status,new.total);
    end if;
    update public.delivery_assignments set status='cancelled',ended_at=now(),reason='Điều phối thay đổi tài xế'
      where order_id=new.id and status in ('offered','accepted','at_restaurant');
    if new.driver_id is not null then
      select offer_seconds into v_seconds from public.driver_settings where id=true;
      insert into public.delivery_assignments(order_id,driver_id,fee,cod_amount,expires_at,distance_km,payout_rules)
      values(new.id,new.driver_id,(v_quote->>'fee')::bigint,private.driver_cod(new.payment_method,new.payment_status,new.total),
        now()+make_interval(secs=>v_seconds),(v_quote->>'distance_km')::double precision,v_quote->'rules');
      new.status:='preparing';
    end if;
  elsif new.status is distinct from old.status then
    if new.status='delivering' and exists(select 1 from public.delivery_assignments where order_id=new.id and status in ('offered','accepted','at_restaurant')) then
      raise exception 'Tài xế cần xác nhận lấy món trên app trước.';
    end if;
    if new.status='completed' and exists(select 1 from public.delivery_assignments where order_id=new.id and status in ('offered','accepted','at_restaurant','picked_up','at_customer')) then
      raise exception 'Tài xế cần xác nhận giao thành công trên app.';
    end if;
    if new.status='cancelled' then
      if exists(select 1 from public.delivery_assignments where order_id=new.id and status in ('picked_up','at_customer')) then
        raise exception 'Cần xử lý sự cố sau lấy món trước khi hủy.';
      end if;
      update public.delivery_assignments set status='cancelled',ended_at=now(),reason='Đơn hàng đã hủy'
        where order_id=new.id and status in ('offered','accepted','at_restaurant');
    end if;
  end if;
  -- A quote/COD snapshot must not silently become stale after a driver receives an offer.
  if (new.total is distinct from old.total or new.payment_method is distinct from old.payment_method
    or new.payment_status is distinct from old.payment_status
    or new.delivery_address is distinct from old.delivery_address or new.recipient_name is distinct from old.recipient_name
    or new.recipient_phone is distinct from old.recipient_phone or new.restaurant_id is distinct from old.restaurant_id
    or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude)
    and exists(select 1 from public.delivery_assignments where order_id=new.id and status in ('offered','accepted','at_restaurant','picked_up','at_customer')) then
    raise exception 'Cần kết thúc phân công trước khi sửa hóa đơn hoặc điểm giao.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.driver_cod (
  p_method         text,
  p_payment_status text,
  p_total          numeric
)
  RETURNS bigint
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
begin
  if p_total is null or p_total < 0 or p_total <> round(p_total) then raise exception 'Tổng tiền COD không hợp lệ.'; end if;
  if p_method is null or p_method not in ('cash','e-wallet') then raise exception 'Cần xác minh phương thức thanh toán trước khi phân công.'; end if;
  if p_payment_status='paid' then return 0; end if;
  if p_method='cash' and p_payment_status='unpaid' then return p_total::bigint; end if;
  raise exception 'Cần xác minh trạng thái thanh toán trước khi phân công.';
end $function$;

CREATE OR REPLACE FUNCTION private.driver_expire_offers (
  p_driver_id uuid DEFAULT NULL::uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_o record; v_a public.delivery_assignments; v_count integer:=0;
begin
  for v_o in select o.id from public.orders o join public.delivery_assignments a on a.order_id=o.id
    where a.status='offered' and a.expires_at<=now() and (p_driver_id is null or a.driver_id=p_driver_id)
    order by o.id limit 100 for update of o skip locked loop
    select * into v_a from public.delivery_assignments where order_id=v_o.id and status='offered'
      and expires_at<=now() and (p_driver_id is null or driver_id=p_driver_id) for update;
    if not found then continue; end if;
    update public.delivery_assignments set status='expired',ended_at=now(),reason='Hết thời hạn nhận đơn' where id=v_a.id;
    update public.orders set driver_id=null,status='preparing'
      where id=v_a.order_id and driver_id=v_a.driver_id and status in ('pending','preparing');
    v_count:=v_count+1;
  end loop;
  return v_count;
end $function$;

CREATE OR REPLACE FUNCTION private.driver_log_event()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if TG_OP='INSERT' then
    insert into public.delivery_events(assignment_id,actor_id,to_status,note) values(new.id,auth.uid(),new.status,new.reason);
  elsif old.status is distinct from new.status then
    insert into public.delivery_events(assignment_id,actor_id,from_status,to_status,note) values(new.id,auth.uid(),old.status,new.status,new.reason);
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.driver_payout_quote (
  p_restaurant_id uuid,
  p_latitude      double precision,
  p_longitude     double precision
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_r public.restaurants; v_s public.driver_settings; v_a double precision; v_km double precision; v_fee bigint;
begin
  select * into v_r from public.restaurants where id=p_restaurant_id;
  if not found or p_latitude is null or p_longitude is null or v_r.latitude is null or v_r.longitude is null
    or not(p_latitude between -90 and 90) or not(p_longitude between -180 and 180)
    or not(v_r.latitude between -90 and 90) or not(v_r.longitude between -180 and 180) then
    raise exception 'Thiếu tọa độ hợp lệ để tính tiền công tài xế.';
  end if;
  select * into v_s from public.driver_settings where id=true;
  if not found or v_s.payout_base_fee is null or v_s.payout_base_km is null or v_s.payout_extra_km_fee is null then
    raise exception 'Chưa cấu hình tiền công tài xế.';
  end if;
  v_a:=power(sin(radians(p_latitude-v_r.latitude)/2),2)
    +cos(radians(v_r.latitude))*cos(radians(p_latitude))*power(sin(radians(p_longitude-v_r.longitude)/2),2);
  v_a:=greatest(0::double precision,least(1::double precision,v_a));
  v_km:=round((6371*2*atan2(sqrt(v_a),sqrt(1-v_a)))::numeric,9)::double precision;
  v_fee:=v_s.payout_base_fee + ceil(greatest(0::double precision,v_km-v_s.payout_base_km))::bigint*v_s.payout_extra_km_fee;
  return jsonb_build_object('distance_km',v_km,'fee',v_fee,'rules',jsonb_build_object(
    'base_fee',v_s.payout_base_fee,'base_km',v_s.payout_base_km,'extra_km_fee',v_s.payout_extra_km_fee,'distance_method','haversine','currency','VND'));
end $function$;

CREATE OR REPLACE FUNCTION private.driver_reject_insert_assignment()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$ begin
  if new.driver_id is not null then raise exception 'Tạo đơn chưa gán tài xế trước, sau đó điều phối bằng UPDATE.'; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.driver_require_approved()
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid:=auth.uid();
begin
  if v_id is null or not exists(select 1 from public.profiles p join public.driver_profiles d on d.user_id=p.id
    where p.id=v_id and p.role='driver' and d.approval_status='approved') then
    raise exception 'Tài khoản chưa được duyệt hoặc không có quyền tài xế.';
  end if;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_driver_assign (
  p_order_id  uuid,
  p_driver_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_o public.orders; v_id uuid;
begin
  if p_driver_id is null then raise exception 'Thiếu tài xế cần phân công.'; end if;
  select * into v_o from public.orders where id=p_order_id for update;
  if not found or v_o.status is null or v_o.status not in ('pending','preparing') then raise exception 'Chỉ phân công đơn chờ hoặc chuẩn bị.'; end if;
  if v_o.driver_id=p_driver_id then return public.admin_driver_migrate_order(p_order_id,false); end if;
  update public.orders set driver_id=p_driver_id where id=p_order_id;
  select id into v_id from public.delivery_assignments where order_id=p_order_id and driver_id=p_driver_id and status='offered';
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_driver_migrate_order (
  p_order_id          uuid,
  p_confirm_picked_up boolean DEFAULT false
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_o public.orders; v_a public.delivery_assignments; v_q jsonb; v_id uuid; v_seconds integer;
begin
  select * into v_o from public.orders where id=p_order_id for update;
  if not found or v_o.driver_id is null or v_o.status is null or v_o.status not in ('pending','preparing','delivering') then
    raise exception 'Chỉ chuyển đơn đang hoạt động, đã có tài xế.';
  end if;
  select * into v_a from public.delivery_assignments where order_id=p_order_id and status in ('offered','accepted','at_restaurant','picked_up','at_customer') for update;
  if found then
    if v_a.driver_id<>v_o.driver_id then raise exception 'Phân công hiện tại không khớp tài xế.'; end if;
    return v_a.id;
  end if;
  perform 1 from public.driver_profiles d join public.profiles p on p.id=d.user_id where d.user_id=v_o.driver_id
    and p.role='driver' and d.approval_status='approved' for update of d;
  if not found then raise exception 'Cần duyệt tài xế trước khi chuyển đơn cũ.'; end if;
  if v_o.status='delivering' and not coalesce(p_confirm_picked_up,false) then
    raise exception 'Cần quản trị xác minh tài xế đã lấy món.';
  end if;
  v_q:=private.driver_payout_quote(v_o.restaurant_id,v_o.latitude,v_o.longitude);
  select offer_seconds into v_seconds from public.driver_settings where id=true;
  insert into public.delivery_assignments(order_id,driver_id,status,fee,cod_amount,expires_at,distance_km,payout_rules,picked_up_at,reason)
    values(v_o.id,v_o.driver_id,case when v_o.status='delivering' then 'picked_up' else 'offered' end,
      (v_q->>'fee')::bigint,private.driver_cod(v_o.payment_method,v_o.payment_status,v_o.total),
      now()+make_interval(secs=>v_seconds),(v_q->>'distance_km')::double precision,v_q->'rules',
      null,'Chuyển từ luồng cũ sau xác minh; không suy đoán thời gian lấy món lịch sử') returning id into v_id;
  if v_o.status='pending' then update public.orders set status='preparing' where id=v_o.id; end if;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.admin_driver_resolve (
  p_assignment_id  uuid,
  p_outcome        text,
  p_reason         text,
  p_goods_returned boolean DEFAULT false
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_o public.orders; v_a public.delivery_assignments;
begin
  if p_outcome is null or p_outcome not in ('cancel','return_to_dispatch') or p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'Nhập hướng xử lý cancel/return_to_dispatch và lý do 10–1000 ký tự.';
  end if;
  select o.* into v_o from public.orders o join public.delivery_assignments a on a.order_id=o.id where a.id=p_assignment_id for update of o;
  if not found then raise exception 'Không tìm thấy chuyến.'; end if;
  select * into v_a from public.delivery_assignments where id=p_assignment_id for update;
  if v_a.status not in ('offered','accepted','at_restaurant','picked_up','at_customer','failed')
    or v_o.driver_id is distinct from v_a.driver_id or v_o.status is null or v_o.status in ('completed','cancelled') then
    raise exception 'Chuyến không còn phù hợp để xử lý sự cố.';
  end if;
  if p_outcome='return_to_dispatch' and (v_o.status='delivering' or v_a.picked_up_at is not null)
    and not coalesce(p_goods_returned,false) then raise exception 'Cần xác nhận món đã hoàn về quán trước khi phân công lại.'; end if;
  update public.delivery_assignments set status='failed',ended_at=coalesce(ended_at,now()),reason=btrim(p_reason) where id=v_a.id;
  -- Retain an operator note even if it was already failed (no status transition).
  insert into public.delivery_events(assignment_id,actor_id,from_status,to_status,note)
    values(v_a.id,auth.uid(),v_a.status,'failed','Quản trị: '||p_outcome||' — '||btrim(p_reason));
  if p_outcome='cancel' then
    update public.orders set status='cancelled',driver_id=null where id=v_o.id;
  else
    update public.orders set status='preparing' where id=v_o.id;
    update public.orders set driver_id=null where id=v_o.id;
  end if;
  -- Never infer payment/refund/earnings from an incident resolution.
end $function$;

CREATE OR REPLACE FUNCTION public.admin_set_food_discovery_groups (
  p_food_id                uuid,
  p_discovery_category_ids text[],
  p_remove_inactive        boolean DEFAULT false
)
  RETURNS text[]
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  select private.admin_set_food_discovery_groups(p_food_id, p_discovery_category_ids, p_remove_inactive);
$function$;

REVOKE ALL ON FUNCTION "public"."admin_set_food_discovery_groups"(uuid, text[], boolean) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.collect_my_voucher (
  p_voucher_id uuid
)
  RETURNS SETOF public.vouchers
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.create_food_order (
  p_order_id     uuid,
  p_items        jsonb,
  p_address      text,
  p_voucher_code text  DEFAULT NULL::text
)
  RETURNS SETOF public.orders
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.create_food_order (
  p_order_id     uuid,
  p_items        jsonb,
  p_address      text,
  p_voucher_code text,
  p_latitude     double precision,
  p_longitude    double precision,
  p_delivery_fee numeric
)
  RETURNS SETOF public.orders
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.create_food_order (
  p_order_id        uuid,
  p_items           jsonb,
  p_address         text,
  p_voucher_code    text,
  p_latitude        double precision,
  p_longitude       double precision,
  p_delivery_fee    numeric,
  p_recipient_name  text,
  p_recipient_phone text
)
  RETURNS SETOF public.orders
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end; $function$;

CREATE OR REPLACE FUNCTION public.create_food_order (
  p_order_id              uuid,
  p_items                 jsonb,
  p_address               text,
  p_voucher_code          text,
  p_latitude              double precision,
  p_longitude             double precision,
  p_delivery_fee          numeric,
  p_recipient_name        text,
  p_recipient_phone       text,
  p_shipping_voucher_code text
)
  RETURNS SETOF public.orders
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end; $function$;

CREATE OR REPLACE FUNCTION public.create_food_order_at_location (
  p_order_id     uuid,
  p_items        jsonb,
  p_address      text,
  p_voucher_code text             DEFAULT NULL::text,
  p_latitude     double precision DEFAULT NULL::double precision,
  p_longitude    double precision DEFAULT NULL::double precision
)
  RETURNS SETOF public.orders
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.delete_my_address (
  p_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,117));
  if exists(select 1 from public.user_addresses where id=p_id and user_id<>v_user) then raise exception 'Địa chỉ không thuộc tài khoản của bạn.'; end if;
  delete from public.user_addresses where id=p_id and user_id=v_user;
  if not exists(select 1 from public.user_addresses where user_id=v_user and is_default is true) then
    update public.user_addresses set is_default=true where id=(select id from public.user_addresses where user_id=v_user order by id limit 1);
  end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.driver_dashboard()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid:=private.driver_require_approved(); v_result jsonb;
begin
  perform private.driver_expire_offers(v_id);
  update public.driver_presence set last_seen_at=now() where driver_id=v_id;
  select jsonb_build_object(
    'profile',(select jsonb_build_object('full_name',p.full_name,'phone',p.phone,'approval_status',d.approval_status,'vehicle_type',d.vehicle_type,'plate_number',d.plate_number)
      from public.profiles p join public.driver_profiles d on d.user_id=p.id where p.id=v_id),
    'online',coalesce((select is_online from public.driver_presence where driver_id=v_id),false),
    'trips',coalesce((select jsonb_agg(x.payload order by x.created_at desc) from (
      select a.created_at,jsonb_build_object('id',a.id,'order_id',a.order_id,'status',a.status,'expires_at',a.expires_at,'created_at',a.created_at,
        'fee',a.fee,'cod_amount',a.cod_amount,'completed_at',a.completed_at,'distance_km',a.distance_km,'payout_rules',a.payout_rules,
        'restaurant_name',r.name,'restaurant_address',r.address,'pickup_latitude',r.latitude,'pickup_longitude',r.longitude,
        'delivery_area',null, -- No reliable coarse district column yet; do not leak the full address as a substitute.
        'delivery_address',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then o.delivery_address end,
        'latitude',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then o.latitude end,
        'longitude',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then o.longitude end,
        'recipient_name',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then o.recipient_name end,
        'recipient_phone',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then o.recipient_phone end,
        'items',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then
          coalesce((select jsonb_agg(jsonb_build_object('name',f.name,'quantity',i.quantity,'options',i.options_snapshot))
            from public.order_items i join public.foods f on f.id=i.food_id where i.order_id=o.id),'[]'::jsonb) else '[]'::jsonb end) payload
      from public.delivery_assignments a join public.orders o on o.id=a.order_id join public.restaurants r on r.id=o.restaurant_id
      where a.driver_id=v_id order by a.created_at desc limit 100) x),'[]'::jsonb),
    'ledger',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from
      (select * from public.driver_ledger_entries where driver_id=v_id order by created_at desc limit 200) l),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(to_jsonb(q)) from (select r.driver_rating,r.driver_feedback from public.reviews r
      where exists(select 1 from public.delivery_assignments a where a.order_id=r.order_id and a.driver_id=v_id and a.status='delivered')
      order by r.created_at desc limit 100) q),'[]'::jsonb)) into v_result;
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.driver_messages (
  p_assignment_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid := private.driver_require_approved(); v_order uuid;
begin
  select a.order_id into v_order from public.delivery_assignments a join public.orders o on o.id=a.order_id
    where a.id=p_assignment_id and a.driver_id=v_id and o.driver_id=v_id
    and o.status in ('preparing','delivering') and a.status in ('accepted','at_restaurant','picked_up','at_customer');
  if not found then raise exception 'Chat chỉ mở trong chuyến đang thực hiện.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from (
    select id,sender_type,content,message_type,created_at from public.messages where order_id=v_order
    order by created_at desc limit 100) m),'[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.driver_save_profile (
  p_full_name    text,
  p_phone        text,
  p_vehicle_type text,
  p_plate_number text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid:=private.driver_require_approved(); v_phone text:=nullif(regexp_replace(btrim(p_phone),'[[:space:]().-]','','g'),'');
begin
  if p_full_name is null or length(btrim(p_full_name)) not between 2 and 100 or p_vehicle_type is null
    or length(btrim(p_vehicle_type)) not between 2 and 50 or coalesce(length(p_plate_number),0)>30
    or (v_phone is not null and v_phone !~ '^[+]?[0-9]{9,15}$') then raise exception 'Thông tin hồ sơ không hợp lệ.'; end if;
  begin
    update public.profiles set full_name=btrim(p_full_name),phone=v_phone where id=v_id;
  exception when unique_violation then raise exception 'Số điện thoại đã được đăng ký.';
  end;
  update public.driver_profiles set vehicle_type=btrim(p_vehicle_type),plate_number=nullif(btrim(p_plate_number),''),updated_at=now() where user_id=v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.driver_send_message (
  p_assignment_id uuid,
  p_content       text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid := private.driver_require_approved(); v_order uuid;
begin
  if p_content is null or length(btrim(p_content)) not between 1 and 2000 then raise exception 'Tin nhắn cần từ 1 đến 2000 ký tự.'; end if;
  select o.id into v_order from public.orders o join public.delivery_assignments a on a.order_id=o.id
    where a.id=p_assignment_id and a.driver_id=v_id and o.driver_id=v_id
    and o.status in ('preparing','delivering') and a.status in ('accepted','at_restaurant','picked_up','at_customer') for update of o;
  if not found then raise exception 'Chat chỉ mở trong chuyến đang thực hiện.'; end if;
  insert into public.messages(order_id,sender_id,sender_type,message_type,content) values(v_order,v_id,'driver','text',btrim(p_content));
end $function$;

CREATE OR REPLACE FUNCTION public.driver_set_online (
  p_online boolean
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid:=private.driver_require_approved();
begin
  if p_online is null then raise exception 'Thiếu trạng thái làm việc.'; end if;
  perform 1 from public.driver_profiles where user_id=v_id for update;
  if not p_online and exists(select 1 from public.delivery_assignments where driver_id=v_id and status in ('accepted','at_restaurant','picked_up','at_customer')) then
    raise exception 'Hãy hoàn thành chuyến hiện tại trước khi tắt nhận đơn.';
  end if;
  insert into public.driver_presence(driver_id,is_online,last_seen_at) values(v_id,p_online,now())
    on conflict(driver_id) do update set is_online=excluded.is_online,last_seen_at=now();
end $function$;

CREATE OR REPLACE FUNCTION public.driver_step (
  p_assignment_id uuid,
  p_action        text,
  p_reason        text    DEFAULT NULL::text,
  p_cod_confirmed boolean DEFAULT false
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid := private.driver_require_approved(); v_a public.delivery_assignments; v_next text; v_order public.orders;
begin
  -- Always lock order before assignment: same order as admin bridge.
  select o.* into v_order from public.orders o join public.delivery_assignments a on a.order_id=o.id
    where a.id=p_assignment_id and a.driver_id=v_id for update of o;
  if not found then raise exception 'Không tìm thấy chuyến của bạn.'; end if;
  select * into v_a from public.delivery_assignments where id=p_assignment_id and driver_id=v_id for update;
  if (p_action='reject' and v_a.status='rejected') or (p_action='fail' and v_a.status='failed')
    or (p_action='arrive_restaurant' and v_a.status='at_restaurant') or (p_action='pickup' and v_a.status='picked_up')
    or (p_action='arrive_customer' and v_a.status='at_customer') then return; end if;
  if v_order.driver_id is distinct from v_id or v_order.status in ('completed','cancelled') then
    if v_a.status='delivered' and p_action='deliver' then return; end if;
    raise exception 'Đơn đã kết thúc hoặc đã được điều phối lại.';
  end if;
  if p_action='accept' and v_a.status='accepted' then return; end if;
  if p_action='accept' and v_a.status='offered' then
    if v_a.expires_at <= now() then raise exception 'Đề nghị đã hết hạn. Hãy tải lại.'; end if;
    perform 1 from public.driver_profiles where user_id=v_id for update;
    if not exists(select 1 from public.driver_presence where driver_id=v_id and is_online) then raise exception 'Hãy bật nhận đơn trước.'; end if;
    v_next := 'accepted';
  elsif p_action='reject' and v_a.status='offered' then v_next := 'rejected';
  elsif p_action='arrive_restaurant' and v_a.status='accepted' then v_next := 'at_restaurant';
  elsif p_action='pickup' and v_a.status='at_restaurant' then v_next := 'picked_up';
  elsif p_action='arrive_customer' and v_a.status='picked_up' then v_next := 'at_customer';
  elsif p_action='deliver' and v_a.status='at_customer' then
    if v_a.cod_amount > 0 and not coalesce(p_cod_confirmed,false) then raise exception 'Cần xác nhận đã thu đủ COD.'; end if;
    v_next := 'delivered';
  elsif p_action='fail' and v_a.status in ('accepted','at_restaurant','picked_up','at_customer') then v_next := 'failed';
  else raise exception 'Thao tác không phù hợp với trạng thái hiện tại.'; end if;
  if v_next in ('rejected','failed') and (p_reason is null or length(btrim(p_reason)) not between 5 and 1000) then
    raise exception 'Nhập lý do từ 5 đến 1000 ký tự.';
  end if;
  update public.delivery_assignments set status=v_next,reason=case when v_next in ('rejected','failed') then btrim(p_reason) else null end,
    accepted_at=case when v_next='accepted' then now() else accepted_at end,
    picked_up_at=case when v_next='picked_up' then now() else picked_up_at end,
    completed_at=case when v_next='delivered' then now() else completed_at end,
    ended_at=case when v_next in ('rejected','failed','delivered') then now() else ended_at end
    where id=v_a.id;
  if v_next='picked_up' then update public.orders set status='delivering' where id=v_a.order_id; end if;
  if v_next in ('accepted','picked_up','delivered') then
    insert into public.notifications(user_id,title,content,type)
    values(v_order.user_id,
      case v_next when 'accepted' then 'Tài xế đã nhận chuyến' when 'picked_up' then 'Tài xế đang giao hàng' else 'Giao hàng thành công' end,
      'Đơn #' || left(v_a.order_id::text,8) || ': ' || case v_next when 'accepted' then 'Tài xế đang đến quán.' when 'picked_up' then 'Tài xế đã lấy món và đang đến bạn.' else 'Đã giao hàng. Cảm ơn bạn!' end,
      'order_status');
  end if;
  if v_next='delivered' then
    update public.orders set status='completed',completed_at=now(),payment_status='paid' where id=v_a.order_id;
    insert into public.driver_ledger_entries(driver_id,order_id,assignment_id,entry_type,amount)
      values(v_id,v_a.order_id,v_a.id,'earning',v_a.fee) on conflict do nothing;
    if v_a.cod_amount>0 then
      insert into public.driver_ledger_entries(driver_id,order_id,assignment_id,entry_type,amount)
        values(v_id,v_a.order_id,v_a.id,'cod_collected',v_a.cod_amount) on conflict do nothing;
    end if;
  elsif v_next='rejected' then
    update public.orders set driver_id=null,status='preparing' where id=v_a.order_id;
  end if;
  -- failed keeps the order/driver attached for operator review; no automatic payment/cancel.
end $function$;

CREATE OR REPLACE FUNCTION public.driver_update_location (
  p_latitude  double precision,
  p_longitude double precision,
  p_accuracy  double precision DEFAULT NULL::double precision
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid:=private.driver_require_approved();
begin
  if p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90) or not(p_longitude between -180 and 180)
    or (p_accuracy is not null and not(p_accuracy between 0 and 100000)) then raise exception 'Tọa độ không hợp lệ.'; end if;
  if not exists(select 1 from public.driver_presence where driver_id=v_id and is_online) then raise exception 'Hãy bật nhận đơn.'; end if;
  insert into public.driver_locations(driver_id,latitude,longitude,accuracy) values(v_id,p_latitude,p_longitude,p_accuracy)
    on conflict(driver_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,received_at=now();
  update public.driver_presence set last_seen_at=now() where driver_id=v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.order_driver_location (
  p_order_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null then raise exception 'Bạn cần đăng nhập.'; end if;
  return (select jsonb_build_object('latitude',l.latitude,'longitude',l.longitude,'received_at',l.received_at,
    'is_stale',l.received_at < now()-interval '2 minutes')
    from public.orders o join public.driver_locations l on l.driver_id=o.driver_id
    where o.id=p_order_id and o.user_id=auth.uid() and o.status in ('preparing','delivering')
    and exists(select 1 from public.delivery_assignments a where a.order_id=o.id and a.driver_id=o.driver_id and a.status in ('accepted','at_restaurant','picked_up','at_customer')));
end $function$;

CREATE OR REPLACE FUNCTION public.save_my_address (
  p_id         uuid,
  p_title      text,
  p_address    text,
  p_latitude   double precision,
  p_longitude  double precision,
  p_is_default boolean,
  p_create     boolean          DEFAULT false
)
  RETURNS SETOF public.user_addresses
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_user uuid := auth.uid(); v_existing public.user_addresses; v_default boolean;
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 117));
  if p_id is null or p_title is null or p_title not in ('Home','Work','Other') then raise exception 'Loại địa chỉ không hợp lệ.'; end if;
  if p_address is null or length(btrim(p_address)) not between 5 and 500 then raise exception 'Địa chỉ cần từ 5 đến 500 ký tự.'; end if;
  if p_latitude is null or p_longitude is null or not (p_latitude between -90 and 90 and p_longitude between -180 and 180) then raise exception 'Vui lòng chọn tọa độ giao hàng hợp lệ.'; end if;
  select * into v_existing from public.user_addresses where id=p_id;
  if found and v_existing.user_id<>v_user then raise exception 'Địa chỉ không thuộc tài khoản của bạn.'; end if;
  if v_existing.id is null and p_create is not true then raise exception 'Địa chỉ đã bị xóa. Vui lòng tải lại.'; end if;
  v_default := coalesce(p_is_default,false) or coalesce(v_existing.is_default,false)
    or not exists (select 1 from public.user_addresses where user_id=v_user and is_default is true);
  if v_default then update public.user_addresses set is_default=false where user_id=v_user and is_default is true; end if;
  if v_existing.id is null then
    return query insert into public.user_addresses(id,user_id,title,address,latitude,longitude,is_default)
      values(p_id,v_user,p_title,btrim(p_address),p_latitude,p_longitude,v_default) returning *;
  else
    return query update public.user_addresses set title=p_title,address=btrim(p_address),latitude=p_latitude,longitude=p_longitude,is_default=v_default
      where id=p_id and user_id=v_user returning *;
  end if;
end; $function$;

CREATE OR REPLACE FUNCTION public.save_my_address (
  p_id              uuid,
  p_title           text,
  p_address         text,
  p_latitude        double precision,
  p_longitude       double precision,
  p_is_default      boolean,
  p_create          boolean,
  p_recipient_name  text,
  p_recipient_phone text
)
  RETURNS SETOF public.user_addresses
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end; $function$;

CREATE OR REPLACE FUNCTION public.update_my_profile (
  p_full_name  text,
  p_phone      text,
  p_avatar_url text
)
  RETURNS SETOF public.profiles
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_user uuid := auth.uid(); v_profile public.profiles; v_phone text := nullif(btrim(p_phone),'');
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  if p_full_name is null or length(btrim(p_full_name)) not between 2 and 100 then raise exception 'Họ tên cần từ 2 đến 100 ký tự.'; end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'Số điện thoại không hợp lệ.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,118));
  select * into v_profile from public.profiles where id=v_user for update;
  if not found then
    -- Accounts registered before handle_new_user existed can create their own profile.
    insert into public.profiles(id,full_name,role,loyalty_points)
      values(v_user,btrim(p_full_name),'user',0) returning * into v_profile;
  end if;
  if p_avatar_url is distinct from v_profile.avatar_url and p_avatar_url is not null then
    if split_part(p_avatar_url,'/',1)<>v_user::text
       or not exists (select 1 from storage.objects where bucket_id='profile-avatars' and name=p_avatar_url) then
      raise exception 'Ảnh đại diện không thuộc tài khoản của bạn hoặc chưa được tải lên.';
    end if;
  end if;
  return query update public.profiles set full_name=btrim(p_full_name), phone=v_phone, avatar_url=p_avatar_url where id=v_user returning *;
end; $function$;

REVOKE ALL ON FUNCTION "private"."admin_set_food_discovery_groups"(uuid, text[], boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."admin_set_food_discovery_groups"(uuid, text[], boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_set_food_discovery_groups"(uuid, text[], boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_set_food_discovery_groups"(uuid, text[], boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_set_food_discovery_groups"(uuid, text[], boolean) TO "service_role";

REVOKE ALL ON SCHEMA "private" FROM "service_role";

GRANT USAGE ON SCHEMA "private" TO "service_role";

REVOKE ALL ON TABLE "public"."discovery_categories" FROM "service_role";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."discovery_categories" TO "service_role";

REVOKE ALL ON TABLE "public"."food_discovery_categories" FROM "service_role";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."food_discovery_categories" TO "service_role";

