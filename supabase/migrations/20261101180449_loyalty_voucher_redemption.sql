alter table public.vouchers add column if not exists reward_owner_id uuid references auth.users(id) on delete cascade;

create table if not exists public.loyalty_redemptions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  voucher_id uuid not null unique references public.vouchers(id) on delete cascade,
  points_spent integer not null,
  discount_amount integer not null,
  created_at timestamptz not null default now(),
  constraint loyalty_redemption_tier check (
    (discount_amount=10000 and points_spent=10000) or
    (discount_amount=20000 and points_spent=19000) or
    (discount_amount=30000 and points_spent=28000) or
    (discount_amount=50000 and points_spent=47000)
  )
);
create index if not exists loyalty_redemptions_user_time on public.loyalty_redemptions(user_id,created_at desc);
alter table public.loyalty_redemptions enable row level security;
revoke all on public.loyalty_redemptions from public,anon,authenticated;
grant select on public.loyalty_redemptions to authenticated;
drop policy if exists redemption_read_self on public.loyalty_redemptions;
create policy redemption_read_self on public.loyalty_redemptions for select to authenticated
using(user_id=(select auth.uid()));

-- Private rewards are never advertised or readable by other customers.
drop policy if exists reward_voucher_read_boundary on public.vouchers;
create policy reward_voucher_read_boundary on public.vouchers as restrictive
for select to anon,authenticated using(reward_owner_id is null or reward_owner_id=(select auth.uid()));

-- Protect every collection path, including the existing SECURITY DEFINER collect RPC.
create or replace function private.guard_reward_voucher_collection()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_owner uuid;
begin
  select reward_owner_id into v_owner from public.vouchers where id=new.voucher_id;
  if v_owner is not null and (v_owner is distinct from new.user_id or not exists (
    select 1 from public.loyalty_redemptions r where r.voucher_id=new.voucher_id and r.user_id=new.user_id
  )) then raise exception 'Voucher này chỉ dành cho tài khoản đã đổi xu.'; end if;
  return new;
end $$;
revoke all on function private.guard_reward_voucher_collection() from public,anon,authenticated;
drop trigger if exists reward_voucher_collection_guard on public.user_vouchers;
create trigger reward_voucher_collection_guard before insert or update of user_id,voucher_id on public.user_vouchers
for each row execute function private.guard_reward_voucher_collection();

create or replace function public.redeem_loyalty_voucher(
  p_request_id uuid, p_discount_amount integer, p_expected_user_id uuid
) returns table(redemption_id uuid,voucher_id uuid,points_spent integer,discount_amount integer,
  balance integer,code text,expiry_date timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_cost integer; v_balance integer;
  v_previous public.loyalty_redemptions%rowtype;
  v_voucher public.vouchers%rowtype;
begin
  if v_user is null or v_user is distinct from p_expected_user_id then raise exception 'Phiên đăng nhập đã thay đổi. Vui lòng mở lại trang đổi xu.'; end if;
  if p_request_id is null then raise exception 'Thiếu mã yêu cầu đổi xu.'; end if;
  v_cost:=case p_discount_amount when 10000 then 10000 when 20000 then 19000 when 30000 then 28000 when 50000 then 47000 end;
  if v_cost is null then raise exception 'Mức đổi voucher không hợp lệ.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,782));
  select coalesce(p.loyalty_points,0) into v_balance from public.profiles p where p.id=v_user for update;
  if not found then raise exception 'Vui lòng hoàn thiện hồ sơ trước khi đổi xu.'; end if;
  select r.* into v_previous from public.loyalty_redemptions r where r.id=p_request_id;
  if found then
    if v_previous.user_id<>v_user or v_previous.discount_amount<>p_discount_amount then raise exception 'Mã yêu cầu đổi xu không khả dụng.'; end if;
    select v.* into strict v_voucher from public.vouchers v where v.id=v_previous.voucher_id;
    return query select v_previous.id,v_voucher.id,v_previous.points_spent,v_previous.discount_amount,v_balance,v_voucher.code,v_voucher.expiry_date;
    return;
  end if;
  if v_balance<v_cost then raise exception 'Bạn chưa đủ xu để đổi voucher này.'; end if;
  insert into public.vouchers(code,discount_type,discount_value,min_order_value,expiry_date,is_active,applies_to,reward_owner_id)
  values('XU'||(p_discount_amount/1000)::text||'K-'||upper(replace(gen_random_uuid()::text,'-','')),
    'fixed',p_discount_amount,0,now()+interval '30 days',true,'food',v_user) returning * into v_voucher;
  insert into public.loyalty_redemptions(id,user_id,voucher_id,points_spent,discount_amount)
    values(p_request_id,v_user,v_voucher.id,v_cost,p_discount_amount);
  update public.profiles p set loyalty_points=v_balance-v_cost where p.id=v_user;
  insert into public.user_vouchers(user_id,voucher_id,is_used) values(v_user,v_voucher.id,false);
  return query select p_request_id,v_voucher.id,v_cost,p_discount_amount,v_balance-v_cost,v_voucher.code,v_voucher.expiry_date;
end $$;
revoke all on function public.redeem_loyalty_voucher(uuid,integer,uuid) from public,anon;
grant execute on function public.redeem_loyalty_voucher(uuid,integer,uuid) to authenticated;
notify pgrst,'reload schema';
