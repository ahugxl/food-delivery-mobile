-- A final write guard covers every checkout overload, including legacy RPCs.
-- Existing orders are not rewritten; status/driver/payment updates are unaffected.
create or replace function private.enforce_order_delivery_range()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_a double precision;
  v_km double precision;
begin
  if TG_OP = 'UPDATE' then
    if new.restaurant_id is not distinct from old.restaurant_id
       and new.latitude is not distinct from old.latitude
       and new.longitude is not distinct from old.longitude then return new; end if;
  end if;
  select latitude, longitude into v_lat, v_lng
  from public.restaurants where id = new.restaurant_id;
  if not found or v_lat is null or v_lng is null or new.latitude is null or new.longitude is null
    or not (v_lat between -90 and 90) or not (v_lng between -180 and 180)
    or not (new.latitude between -90 and 90) or not (new.longitude between -180 and 180) then
    raise exception 'Vui lòng chọn điểm giao và tọa độ quán hợp lệ trước khi đặt hàng.';
  end if;
  v_a := power(sin(radians(new.latitude-v_lat)/2),2)
    + cos(radians(v_lat))*cos(radians(new.latitude))*power(sin(radians(new.longitude-v_lng)/2),2);
  v_a := greatest(0::double precision, least(1::double precision, v_a));
  v_km := round((6371*2*atan2(sqrt(v_a),sqrt(1-v_a)))::numeric,9)::double precision;
  if v_km > 20 then
    raise exception 'Ngoài phạm vi giao hàng 20 km. Vui lòng chọn quán gần hơn hoặc thay đổi địa chỉ.';
  end if;
  return new;
end $$;
revoke all on function private.enforce_order_delivery_range() from public, anon, authenticated;
drop trigger if exists enforce_order_delivery_range on public.orders;
create trigger enforce_order_delivery_range
before insert or update of restaurant_id, latitude, longitude on public.orders
for each row execute function private.enforce_order_delivery_range();
