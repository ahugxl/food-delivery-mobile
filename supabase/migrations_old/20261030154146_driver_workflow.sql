-- STEP 2, after 20261030153047_driver_foundation.sql and a verified backup.
-- Configure payout: 15,000 VND / first 2 km + 5,000 VND / started extra km.
-- Does not approve drivers or migrate/reassign existing orders automatically.
begin;
set local lock_timeout = '5s';
do $$ begin
  if to_regclass('public.delivery_assignments') is null or to_regclass('public.driver_settings') is null then
    raise exception 'Chạy file driver_foundation (bước 1) trước.';
  end if;
end $$;
create schema if not exists private;
alter table public.driver_settings add column if not exists payout_base_fee bigint check(payout_base_fee >= 0);
alter table public.driver_settings add column if not exists payout_base_km double precision check(payout_base_km between 0 and 1000);
alter table public.driver_settings add column if not exists payout_extra_km_fee bigint check(payout_extra_km_fee >= 0);
update public.driver_settings set payout_base_fee=15000,payout_base_km=2,payout_extra_km_fee=5000
  where id=true and payout_base_fee is null and payout_base_km is null and payout_extra_km_fee is null;
comment on column public.driver_settings.payout_per_delivery is 'Cột cũ, không dùng trong luồng tính tiền công theo km.';
alter table public.delivery_assignments add column if not exists distance_km double precision;
alter table public.delivery_assignments add column if not exists payout_rules jsonb;

create or replace function private.driver_require_approved() returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=auth.uid();
begin
  if v_id is null or not exists(select 1 from public.profiles p join public.driver_profiles d on d.user_id=p.id
    where p.id=v_id and p.role='driver' and d.approval_status='approved') then
    raise exception 'Tài khoản chưa được duyệt hoặc không có quyền tài xế.';
  end if;
  return v_id;
end $$;
revoke all on function private.driver_require_approved() from public,anon,authenticated;

create or replace function private.driver_payout_quote(p_restaurant_id uuid,p_latitude double precision,p_longitude double precision)
returns jsonb language plpgsql stable security definer set search_path='' as $$
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
end $$;
revoke all on function private.driver_payout_quote(uuid,double precision,double precision) from public,anon,authenticated;

create or replace function private.driver_cod(p_method text,p_payment_status text,p_total numeric) returns bigint
language plpgsql immutable set search_path='' as $$
begin
  if p_total is null or p_total < 0 or p_total <> round(p_total) then raise exception 'Tổng tiền COD không hợp lệ.'; end if;
  if p_method is null or p_method not in ('cash','e-wallet') then raise exception 'Cần xác minh phương thức thanh toán trước khi phân công.'; end if;
  if p_payment_status='paid' then return 0; end if;
  if p_method='cash' and p_payment_status='unpaid' then return p_total::bigint; end if;
  raise exception 'Cần xác minh trạng thái thanh toán trước khi phân công.';
end $$;
revoke all on function private.driver_cod(text,text,numeric) from public,anon,authenticated;

create or replace function private.driver_log_event() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if TG_OP='INSERT' then
    insert into public.delivery_events(assignment_id,actor_id,to_status,note) values(new.id,auth.uid(),new.status,new.reason);
  elsif old.status is distinct from new.status then
    insert into public.delivery_events(assignment_id,actor_id,from_status,to_status,note) values(new.id,auth.uid(),old.status,new.status,new.reason);
  end if;
  return new;
end $$;
revoke all on function private.driver_log_event() from public,anon,authenticated;
drop trigger if exists driver_assignment_event on public.delivery_assignments;
create trigger driver_assignment_event after insert or update on public.delivery_assignments for each row execute function private.driver_log_event();

create or replace function private.driver_bridge_order() returns trigger
language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function private.driver_bridge_order() from public,anon,authenticated;
drop trigger if exists driver_order_bridge on public.orders;
create trigger driver_order_bridge before update on public.orders for each row execute function private.driver_bridge_order();
create or replace function private.driver_reject_insert_assignment() returns trigger
language plpgsql set search_path='' as $$ begin
  if new.driver_id is not null then raise exception 'Tạo đơn chưa gán tài xế trước, sau đó điều phối bằng UPDATE.'; end if;
  return new;
end $$;
revoke all on function private.driver_reject_insert_assignment() from public,anon,authenticated;
drop trigger if exists driver_order_insert_guard on public.orders;
create trigger driver_order_insert_guard before insert on public.orders for each row execute function private.driver_reject_insert_assignment();

create or replace function private.driver_expire_offers(p_driver_id uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function private.driver_expire_offers(uuid) from public,anon,authenticated;

create or replace function public.driver_set_online(p_online boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=private.driver_require_approved();
begin
  if p_online is null then raise exception 'Thiếu trạng thái làm việc.'; end if;
  perform 1 from public.driver_profiles where user_id=v_id for update;
  if not p_online and exists(select 1 from public.delivery_assignments where driver_id=v_id and status in ('accepted','at_restaurant','picked_up','at_customer')) then
    raise exception 'Hãy hoàn thành chuyến hiện tại trước khi tắt nhận đơn.';
  end if;
  insert into public.driver_presence(driver_id,is_online,last_seen_at) values(v_id,p_online,now())
    on conflict(driver_id) do update set is_online=excluded.is_online,last_seen_at=now();
end $$;
create or replace function public.driver_update_location(p_latitude double precision,p_longitude double precision,p_accuracy double precision default null) returns void
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=private.driver_require_approved();
begin
  if p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90) or not(p_longitude between -180 and 180)
    or (p_accuracy is not null and not(p_accuracy between 0 and 100000)) then raise exception 'Tọa độ không hợp lệ.'; end if;
  if not exists(select 1 from public.driver_presence where driver_id=v_id and is_online) then raise exception 'Hãy bật nhận đơn.'; end if;
  insert into public.driver_locations(driver_id,latitude,longitude,accuracy) values(v_id,p_latitude,p_longitude,p_accuracy)
    on conflict(driver_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,received_at=now();
  update public.driver_presence set last_seen_at=now() where driver_id=v_id;
end $$;

create or replace function public.driver_dashboard() returns jsonb
language plpgsql security definer set search_path='' as $$
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
end $$;

create or replace function public.driver_save_profile(p_full_name text,p_phone text,p_vehicle_type text,p_plate_number text) returns void
language plpgsql security definer set search_path='' as $$
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
end $$;

create or replace function public.order_driver_location(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Bạn cần đăng nhập.'; end if;
  return (select jsonb_build_object('latitude',l.latitude,'longitude',l.longitude,'received_at',l.received_at,
    'is_stale',l.received_at < now()-interval '2 minutes')
    from public.orders o join public.driver_locations l on l.driver_id=o.driver_id
    where o.id=p_order_id and o.user_id=auth.uid() and o.status in ('preparing','delivering')
    and exists(select 1 from public.delivery_assignments a where a.order_id=o.id and a.driver_id=o.driver_id and a.status in ('accepted','at_restaurant','picked_up','at_customer')));
end $$;

create or replace function public.driver_step(p_assignment_id uuid,p_action text,p_reason text default null,p_cod_confirmed boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
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
end $$;


create or replace function public.driver_messages(p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := private.driver_require_approved(); v_order uuid;
begin
  select a.order_id into v_order from public.delivery_assignments a join public.orders o on o.id=a.order_id
    where a.id=p_assignment_id and a.driver_id=v_id and o.driver_id=v_id
    and o.status in ('preparing','delivering') and a.status in ('accepted','at_restaurant','picked_up','at_customer');
  if not found then raise exception 'Chat chỉ mở trong chuyến đang thực hiện.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from (
    select id,sender_type,content,message_type,created_at from public.messages where order_id=v_order
    order by created_at desc limit 100) m),'[]'::jsonb);
end $$;
create or replace function public.driver_send_message(p_assignment_id uuid,p_content text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := private.driver_require_approved(); v_order uuid;
begin
  if p_content is null or length(btrim(p_content)) not between 1 and 2000 then raise exception 'Tin nhắn cần từ 1 đến 2000 ký tự.'; end if;
  select o.id into v_order from public.orders o join public.delivery_assignments a on a.order_id=o.id
    where a.id=p_assignment_id and a.driver_id=v_id and o.driver_id=v_id
    and o.status in ('preparing','delivering') and a.status in ('accepted','at_restaurant','picked_up','at_customer') for update of o;
  if not found then raise exception 'Chat chỉ mở trong chuyến đang thực hiện.'; end if;
  insert into public.messages(order_id,sender_id,sender_type,message_type,content) values(v_order,v_id,'driver','text',btrim(p_content));
end $$;

-- Operator-only: convert ONE reviewed legacy order, never a bulk backfill.
-- Existing NULL payment_status must be verified separately before calling this.
create or replace function public.admin_driver_migrate_order(p_order_id uuid,p_confirm_picked_up boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
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
end $$;

create or replace function public.admin_driver_assign(p_order_id uuid,p_driver_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_o public.orders; v_id uuid;
begin
  if p_driver_id is null then raise exception 'Thiếu tài xế cần phân công.'; end if;
  select * into v_o from public.orders where id=p_order_id for update;
  if not found or v_o.status is null or v_o.status not in ('pending','preparing') then raise exception 'Chỉ phân công đơn chờ hoặc chuẩn bị.'; end if;
  if v_o.driver_id=p_driver_id then return public.admin_driver_migrate_order(p_order_id,false); end if;
  update public.orders set driver_id=p_driver_id where id=p_order_id;
  select id into v_id from public.delivery_assignments where order_id=p_order_id and driver_id=p_driver_id and status='offered';
  return v_id;
end $$;

create or replace function public.admin_driver_resolve(p_assignment_id uuid,p_outcome text,p_reason text,p_goods_returned boolean default false) returns void
language plpgsql security definer set search_path='' as $$
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
end $$;

revoke all on function public.driver_set_online(boolean),public.driver_update_location(double precision,double precision,double precision),
  public.driver_step(uuid,text,text,boolean),public.driver_dashboard(),public.driver_save_profile(text,text,text,text),
  public.driver_messages(uuid),public.driver_send_message(uuid,text),public.order_driver_location(uuid)
  from public,anon,authenticated;
grant execute on function public.driver_set_online(boolean),public.driver_update_location(double precision,double precision,double precision),
  public.driver_step(uuid,text,text,boolean),public.driver_dashboard(),public.driver_save_profile(text,text,text,text),
  public.driver_messages(uuid),public.driver_send_message(uuid,text),public.order_driver_location(uuid) to authenticated;
revoke all on function public.admin_driver_migrate_order(uuid,boolean),public.admin_driver_assign(uuid,uuid),
  public.admin_driver_resolve(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.admin_driver_migrate_order(uuid,boolean),public.admin_driver_assign(uuid,uuid),
  public.admin_driver_resolve(uuid,text,text,boolean) to service_role;

-- Requires Supabase Cron; fail atomically if the server cannot enable it.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('subifood-driver-expire-offers','* * * * *','select private.driver_expire_offers();');
notify pgrst,'reload schema';
commit;

