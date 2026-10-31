-- Two-stage reviews. Rewards and food votes are written only by authenticated RPCs.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;

alter table public.reviews
  add column if not exists driver_submitted_at timestamptz,
  add column if not exists restaurant_submitted_at timestamptz,
  add column if not exists restaurant_image_path text,
  add column if not exists reward_points integer not null default 0 check (reward_points in (0,500));
update public.reviews set driver_submitted_at = coalesce(created_at,now()) where driver_rating is not null and driver_submitted_at is null;
update public.reviews set restaurant_submitted_at = coalesce(created_at,now()) where restaurant_rating is not null and restaurant_submitted_at is null;
alter table public.reviews enable row level security;
drop policy if exists review_flow_read_own on public.reviews;
create policy review_flow_read_own on public.reviews for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;
-- Profile edits already use update_my_profile. Clients must not set their own points or role.
revoke insert, update, delete on public.profiles from anon, authenticated;

create table if not exists public.food_reviews (
  review_id uuid not null references public.reviews(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  is_liked boolean not null,
  created_at timestamptz not null default now(),
  primary key (review_id, food_id)
);
create index if not exists food_reviews_food_idx on public.food_reviews(food_id);
create index if not exists review_stats_order_items_food_idx on public.order_items(food_id,order_id);
alter table public.food_reviews enable row level security;
create policy food_reviews_read_own on public.food_reviews for select to authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id and r.user_id = (select auth.uid())));
revoke all on public.food_reviews from anon, authenticated;
grant select on public.food_reviews to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('review-photos','review-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy review_photos_read_own on storage.objects for select to authenticated
  using (bucket_id='review-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy review_photos_upload_completed on storage.objects for insert to authenticated with check (
  bucket_id='review-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists (select 1 from public.orders o where o.id::text=(storage.foldername(name))[2]
    and o.user_id=(select auth.uid()) and o.status='completed'
    and not exists(select 1 from public.reviews r where r.order_id=o.id and r.restaurant_submitted_at is not null))
);
create policy review_photos_delete_draft on storage.objects for delete to authenticated using (
  bucket_id='review-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists(select 1 from public.reviews r where r.restaurant_image_path=name and r.user_id=(select auth.uid()))
);

create or replace function private.submit_order_review(p_order_id uuid,p_stage text,p_rating integer,p_feedback text,p_image_path text,p_food_votes jsonb)
returns setof public.reviews language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_review public.reviews%rowtype;
  v_feedback text := btrim(coalesce(p_feedback,''));
  v_photo text := nullif(btrim(p_image_path),'');
  v_vote jsonb;
  v_reward integer := 0;
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập.'; end if;
  select * into v_order from public.orders where id=p_order_id and user_id=v_user for update;
  if not found or v_order.status is distinct from 'completed' then raise exception 'Chỉ được đánh giá đơn hàng của bạn đã hoàn thành.'; end if;
  if p_stage not in ('driver','restaurant') or p_stage is null then raise exception 'Loại đánh giá không hợp lệ.'; end if;
  select * into v_review from public.reviews where order_id=p_order_id for update;
  if found then
    if v_review.user_id<>v_user then raise exception 'Không có quyền đánh giá đơn này.'; end if;
    if (p_stage='driver' and v_review.driver_submitted_at is not null) or (p_stage='restaurant' and v_review.restaurant_submitted_at is not null) then
      return next v_review; return; -- Safe retry after a network timeout; never award twice.
    end if;
  end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Vui lòng chọn từ 1 đến 5 sao.'; end if;
  if char_length(v_feedback)>2000 then raise exception 'Nhận xét tối đa 2.000 ký tự.'; end if;
  if p_stage='driver' and v_order.driver_id is null then raise exception 'Đơn hàng chưa có tài xế để đánh giá.'; end if;
  if p_stage='restaurant' then
    if v_photo is not null and not exists (
      select 1 from storage.objects s where s.bucket_id='review-photos' and s.name=v_photo
      and split_part(s.name,'/',1)=v_user::text and split_part(s.name,'/',2)=p_order_id::text
      and coalesce((s.metadata->>'size')::bigint,0) between 1 and 5242880
      and s.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
    ) then raise exception 'Ảnh chưa được tải lên hoặc không thuộc đơn hàng này.'; end if;
    if jsonb_typeof(p_food_votes) is distinct from 'array' or jsonb_array_length(p_food_votes)>100 then raise exception 'Đánh giá món không hợp lệ.'; end if;
    if (select count(*) from jsonb_array_elements(p_food_votes)) <> (select count(distinct value->>'food_id') from jsonb_array_elements(p_food_votes)) then raise exception 'Mỗi món chỉ được đánh giá một lần.'; end if;
    for v_vote in select value from jsonb_array_elements(p_food_votes) loop
      if jsonb_typeof(v_vote->'is_liked') is distinct from 'boolean' or not exists (
        select 1 from public.order_items i where i.order_id=p_order_id and i.food_id::text=v_vote->>'food_id'
      ) then raise exception 'Chỉ được đánh giá các món thuộc đơn hàng.'; end if;
    end loop;
    if char_length(v_feedback)>=50 and v_photo is not null then v_reward:=500; end if;
  end if;
  if v_review.id is null then
    insert into public.reviews(order_id,user_id) values(p_order_id,v_user) returning * into v_review;
  end if;
  if p_stage='driver' then
    update public.reviews set driver_rating=p_rating,driver_feedback=nullif(v_feedback,''),driver_submitted_at=now() where id=v_review.id returning * into v_review;
  else
    update public.reviews set restaurant_rating=p_rating,restaurant_feedback=nullif(v_feedback,''),restaurant_image_path=v_photo,
      restaurant_submitted_at=now(),reward_points=v_reward where id=v_review.id returning * into v_review;
    insert into public.food_reviews(review_id,food_id,is_liked)
      select v_review.id,(value->>'food_id')::uuid,(value->>'is_liked')::boolean from jsonb_array_elements(p_food_votes);
    if v_reward>0 then
      insert into public.profiles(id,full_name,role,loyalty_points)
      values(v_user,coalesce(nullif(btrim(auth.jwt()->'user_metadata'->>'full_name'),''),'Người dùng SubiFood'),'user',500)
      on conflict(id) do update set loyalty_points=coalesce(public.profiles.loyalty_points,0)+500;
    end if;
  end if;
  return next v_review;
end $$;
revoke all on function private.submit_order_review(uuid,text,integer,text,text,jsonb) from public,anon;
grant execute on function private.submit_order_review(uuid,text,integer,text,text,jsonb) to authenticated;
create or replace function public.submit_order_review(p_order_id uuid,p_stage text,p_rating integer,p_feedback text,p_image_path text default null,p_food_votes jsonb default '[]')
returns setof public.reviews language sql security invoker set search_path='' as $$
  select * from private.submit_order_review(p_order_id,p_stage,p_rating,p_feedback,p_image_path,p_food_votes);
$$;
revoke all on function public.submit_order_review(uuid,text,integer,text,text,jsonb) from public,anon;
grant execute on function public.submit_order_review(uuid,text,integer,text,text,jsonb) to authenticated;

create or replace function private.food_review_stats(p_food_ids uuid[])
returns table(food_id uuid,sold_count bigint,like_count bigint) language sql stable security definer set search_path='' as $$
  select f.id,
    (select coalesce(sum(i.quantity),0)::bigint from public.order_items i join public.orders o on o.id=i.order_id where i.food_id=f.id and o.status='completed'),
    (select count(*) from public.food_reviews r where r.food_id=f.id and r.is_liked)
  from public.foods f where f.id=any(p_food_ids[1:100]);
$$;
revoke all on function private.food_review_stats(uuid[]) from public;
grant execute on function private.food_review_stats(uuid[]) to anon,authenticated;
create or replace function public.food_review_stats(p_food_ids uuid[])
returns table(food_id uuid,sold_count bigint,like_count bigint) language sql stable security invoker set search_path='' as $$
  select * from private.food_review_stats(p_food_ids);
$$;
revoke all on function public.food_review_stats(uuid[]) from public;
grant execute on function public.food_review_stats(uuid[]) to anon,authenticated;
notify pgrst,'reload schema';
commit;
