-- SubiFood / driver integration, STEP 1: schema only.
-- Run in SQL Editor as postgres AFTER a verified backup.
-- Do NOT run soopi_driver_import.sql afterwards: its workflow needs P1-P6 fixes.
-- No order reassignment, automatic approval, payment inference, or workflow triggers.
begin;
set local lock_timeout = '5s';

do $$ begin
  if to_regclass('public.orders') is null or to_regclass('public.profiles') is null
    or to_regclass('auth.users') is null then
    raise exception 'Thiếu schema SubiFood hiện tại. Dừng cài đặt.';
  end if;
  if exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='driver_order_bridge')
    or to_regprocedure('public.driver_step(uuid,text,text,boolean)') is not null then
    raise exception 'Đã có luồng tài xế trên database. Cần đối chiếu trước khi chạy bước 1.';
  end if;
end $$;

-- Old rows stay NULL (unknown). Only future inserts default to unpaid.
alter table public.orders add column if not exists payment_status text;
alter table public.orders alter column payment_status set default 'unpaid';
alter table public.orders add column if not exists completed_at timestamptz;
comment on column public.orders.payment_status is 'NULL: trạng thái thanh toán lịch sử chưa xác minh; đơn mới mặc định unpaid. Không suy ra thanh toán từ status đơn.';

create table if not exists public.driver_profiles (
  user_id uuid primary key references public.profiles(id),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','suspended')),
  vehicle_type text not null default 'Xe máy',
  plate_number text,
  updated_at timestamptz not null default now()
);
create table if not exists public.driver_presence (
  driver_id uuid primary key references public.driver_profiles(user_id),
  is_online boolean not null default false,
  last_seen_at timestamptz not null default now()
);
create table if not exists public.driver_locations (
  driver_id uuid primary key references public.driver_profiles(user_id),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision check (accuracy between 0 and 100000),
  received_at timestamptz not null default now()
);
create table if not exists public.driver_settings (
  id boolean primary key default true check (id),
  payout_per_delivery bigint check (payout_per_delivery >= 0),
  offer_seconds integer not null default 300 check (offer_seconds between 30 and 3600)
);
comment on column public.driver_settings.payout_per_delivery is 'VND; NULL = chưa cấu hình. RPC phân công phải chặn nếu NULL. Không lấy từ delivery_fee của khách.';
insert into public.driver_settings(id) values(true) on conflict do nothing;

create table if not exists public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  driver_id uuid not null references public.driver_profiles(user_id),
  status text not null default 'offered' check (status in ('offered','accepted','at_restaurant','picked_up','at_customer','delivered','rejected','expired','cancelled','failed')),
  fee bigint not null check (fee >= 0),
  cod_amount bigint not null check (cod_amount >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  completed_at timestamptz,
  ended_at timestamptz,
  reason text
);
create unique index if not exists driver_one_active_order on public.delivery_assignments(order_id)
  where status in ('offered','accepted','at_restaurant','picked_up','at_customer');
create unique index if not exists driver_one_active_trip on public.delivery_assignments(driver_id)
  where status in ('offered','accepted','at_restaurant','picked_up','at_customer');
create index if not exists driver_trip_history on public.delivery_assignments(driver_id,created_at desc);
create index if not exists driver_offer_expiry on public.delivery_assignments(expires_at) where status='offered';

create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.delivery_assignments(id),
  actor_id uuid references auth.users(id),
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists driver_event_history on public.delivery_events(assignment_id,created_at);
create table if not exists public.driver_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.driver_profiles(user_id),
  order_id uuid not null references public.orders(id),
  assignment_id uuid not null references public.delivery_assignments(id),
  entry_type text not null check (entry_type in ('earning','cod_collected','cod_remitted','earning_paid')),
  amount bigint not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique(assignment_id,entry_type)
);
create index if not exists driver_ledger_history on public.driver_ledger_entries(driver_id,created_at desc);

-- Transfer existing driver identities only; approval and active order migration are separate.
insert into public.driver_profiles(user_id,approval_status)
select id,'pending' from public.profiles where role='driver' on conflict do nothing;
insert into public.driver_presence(driver_id)
select user_id from public.driver_profiles on conflict do nothing;

alter table public.driver_profiles enable row level security;
alter table public.driver_presence enable row level security;
alter table public.driver_locations enable row level security;
alter table public.driver_settings enable row level security;
alter table public.delivery_assignments enable row level security;
alter table public.delivery_events enable row level security;
alter table public.driver_ledger_entries enable row level security;
revoke all on public.driver_profiles, public.driver_presence, public.driver_locations, public.driver_settings,
  public.delivery_assignments, public.delivery_events, public.driver_ledger_entries from public, anon, authenticated;
grant all on public.driver_profiles, public.driver_presence, public.driver_locations, public.driver_settings,
  public.delivery_assignments, public.delivery_events, public.driver_ledger_entries to service_role;

notify pgrst, 'reload schema';
commit;
