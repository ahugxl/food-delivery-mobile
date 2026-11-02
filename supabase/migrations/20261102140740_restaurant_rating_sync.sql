-- Preserve imported scores once; all customer-facing rating values now use local reviews.
do $$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='restaurants' and column_name='imported_rating') then
    alter table public.restaurants add column imported_rating numeric;
    update public.restaurants set imported_rating=rating;
  end if;
end $$;
alter table public.restaurants alter column rating drop default;
alter table public.restaurants add column if not exists review_count bigint not null default 0;
alter table public.restaurants add column if not exists comment_count bigint not null default 0;

-- Shared eligibility matches restaurant_review_summary/feed: submitted restaurant review,
-- completed order, same owner. Active/inactive visibility does not erase a shop's history.
create or replace function private.refresh_restaurant_rating(p_ids uuid[])
returns void language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_rating numeric; v_count bigint; v_comments bigint;
begin
  -- Serialize concurrent submissions for the same shop; deterministic lock order for moves.
  for v_id in select s.id from public.restaurants s where s.id=any(p_ids) order by s.id for update loop
    select round(avg(r.restaurant_rating)::numeric,1),count(*),
      count(*) filter(where nullif(btrim(r.restaurant_feedback),'') is not null)
    into v_rating,v_count,v_comments
    from public.reviews r join public.orders o on o.id=r.order_id and o.user_id=r.user_id
    where o.restaurant_id=v_id and o.status='completed'
      and r.restaurant_submitted_at is not null and r.restaurant_rating between 1 and 5;
    update public.restaurants set rating=v_rating,review_count=v_count,comment_count=v_comments
      where id=v_id and (rating,review_count,comment_count) is distinct from (v_rating,v_count,v_comments);
  end loop;
end $$;
revoke all on function private.refresh_restaurant_rating(uuid[]) from public,anon,authenticated,service_role;

create or replace function private.sync_review_restaurant_rating()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_old_order uuid; v_new_order uuid;
begin
  if tg_op<>'INSERT' then v_old_order:=old.order_id; end if;
  if tg_op<>'DELETE' then v_new_order:=new.order_id; end if;
  perform private.refresh_restaurant_rating(array(select o.restaurant_id from public.orders o
    where o.id=v_old_order or o.id=v_new_order));
  return null;
end $$;
revoke all on function private.sync_review_restaurant_rating() from public,anon,authenticated,service_role;
drop trigger if exists sync_review_restaurant_rating on public.reviews;
create trigger sync_review_restaurant_rating after insert or update or delete on public.reviews
for each row execute function private.sync_review_restaurant_rating();

create or replace function private.sync_order_restaurant_rating()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then perform private.refresh_restaurant_rating(array[old.restaurant_id]);
  else perform private.refresh_restaurant_rating(array[old.restaurant_id,new.restaurant_id]); end if;
  return null;
end $$;
revoke all on function private.sync_order_restaurant_rating() from public,anon,authenticated,service_role;
drop trigger if exists sync_order_restaurant_rating_update on public.orders;
create trigger sync_order_restaurant_rating_update after update of restaurant_id,status,user_id on public.orders
for each row when ((old.restaurant_id,old.status,old.user_id) is distinct from (new.restaurant_id,new.status,new.user_id))
execute function private.sync_order_restaurant_rating();
drop trigger if exists sync_order_restaurant_rating_delete on public.orders;
create trigger sync_order_restaurant_rating_delete after delete on public.orders
for each row execute function private.sync_order_restaurant_rating();

-- Backfill every shop, including those with no reviews, without generating fake reviews.
select private.refresh_restaurant_rating(array(select id from public.restaurants));
notify pgrst,'reload schema';
