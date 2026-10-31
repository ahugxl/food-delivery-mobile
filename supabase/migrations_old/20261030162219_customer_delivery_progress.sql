-- Customer-only projection of delivery progress. No table access is added.
begin;
create or replace function public.order_delivery_progress(p_order_id uuid)
returns table(order_status text,driver_id uuid,assignment_id uuid,delivery_status text,updated_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Bạn cần đăng nhập.'; end if;
  return query
    select o.status,o.driver_id,a.id,a.status,
      coalesce((select max(e.created_at) from public.delivery_events e where e.assignment_id=a.id),
        a.completed_at,a.ended_at,a.picked_up_at,a.accepted_at,a.created_at)
    from public.orders o
    left join lateral (
      select d.* from public.delivery_assignments d
      where d.order_id=o.id and d.driver_id=o.driver_id
      order by (d.status in ('offered','accepted','at_restaurant','picked_up','at_customer')) desc,
        d.created_at desc,d.id desc limit 1
    ) a on true
    where o.id=p_order_id and o.user_id=v_user;
end $$;
revoke all on function public.order_delivery_progress(uuid) from public,anon,authenticated;
grant execute on function public.order_delivery_progress(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
