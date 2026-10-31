begin;

-- Projection APIs only: do not grant access to other customers' orders/profiles/reviews.
create or replace function public.restaurant_review_summary(p_restaurant_id uuid)
returns table(average_rating numeric,review_count bigint,star_5 bigint,star_4 bigint,star_3 bigint,star_2 bigint,star_1 bigint)
language sql stable security definer set search_path='' as $$
  select round(avg(r.restaurant_rating)::numeric,1),count(*),
    count(*) filter(where r.restaurant_rating=5),count(*) filter(where r.restaurant_rating=4),
    count(*) filter(where r.restaurant_rating=3),count(*) filter(where r.restaurant_rating=2),count(*) filter(where r.restaurant_rating=1)
  from public.reviews r join public.orders o on o.id=r.order_id and o.user_id=r.user_id
  join public.restaurants s on s.id=o.restaurant_id
  where auth.uid() is not null and s.id=p_restaurant_id and s.is_active
    and o.status='completed' and r.restaurant_submitted_at is not null and r.restaurant_rating between 1 and 5;
$$;
revoke all on function public.restaurant_review_summary(uuid) from public,anon;
grant execute on function public.restaurant_review_summary(uuid) to authenticated;

create or replace function public.restaurant_review_feed(p_restaurant_id uuid,p_sort text default 'newest',p_rating integer default null,p_with_photos boolean default false,p_mine boolean default false,p_offset integer default 0,p_limit integer default 20)
returns table(review_id uuid,author_name text,rating integer,feedback text,photo_path text,submitted_at timestamptz,ordered_foods text[],is_mine boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Vui lòng đăng nhập.'; end if;
  if p_sort is null or p_sort not in ('newest','highest','lowest')
     or (p_rating is not null and p_rating not between 1 and 5)
     or p_offset is null or p_offset not between 0 and 100000
     or p_limit is null or p_limit not between 1 and 50
     or p_with_photos is null or p_mine is null then raise exception 'Bộ lọc đánh giá không hợp lệ.'; end if;
  return query
  select r.id,
    case when r.user_id=auth.uid() then 'Bạn' else coalesce(nullif(left(btrim(p.full_name),1),''),'K') || '***' end,
    r.restaurant_rating,r.restaurant_feedback,
    case when split_part(r.restaurant_image_path,'/',1)=r.user_id::text and split_part(r.restaurant_image_path,'/',2)=r.order_id::text then r.restaurant_image_path else null end,
    r.restaurant_submitted_at,
    array(select distinct left(coalesce(nullif(i.options_snapshot->>'food_name',''),f.name),200)
      from public.order_items i left join public.foods f on f.id=i.food_id
      where i.order_id=o.id and coalesce(nullif(i.options_snapshot->>'food_name',''),f.name) is not null limit 30),
    r.user_id=auth.uid()
  from public.reviews r join public.orders o on o.id=r.order_id and o.user_id=r.user_id
  join public.restaurants s on s.id=o.restaurant_id left join public.profiles p on p.id=r.user_id
  where s.id=p_restaurant_id and s.is_active and o.status='completed'
    and r.restaurant_submitted_at is not null and r.restaurant_rating between 1 and 5
    and (p_rating is null or r.restaurant_rating=p_rating)
    and (not p_with_photos or (nullif(btrim(r.restaurant_image_path),'') is not null and split_part(r.restaurant_image_path,'/',1)=r.user_id::text and split_part(r.restaurant_image_path,'/',2)=r.order_id::text))
    and (not p_mine or r.user_id=auth.uid())
  order by case when p_sort='highest' then r.restaurant_rating end desc nulls last,
    case when p_sort='lowest' then r.restaurant_rating end asc nulls last,
    r.restaurant_submitted_at desc,r.id desc
  offset p_offset limit p_limit;
end;
$$;
revoke all on function public.restaurant_review_feed(uuid,text,integer,boolean,boolean,integer,integer) from public,anon;
grant execute on function public.restaurant_review_feed(uuid,text,integer,boolean,boolean,integer,integer) to authenticated;

create or replace function private.can_read_restaurant_review_photo(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.reviews r join public.orders o on o.id=r.order_id and o.user_id=r.user_id
    join public.restaurants s on s.id=o.restaurant_id
    where r.restaurant_image_path=p_path and r.restaurant_submitted_at is not null
      and r.restaurant_rating between 1 and 5 and o.status='completed' and s.is_active
      and split_part(p_path,'/',1)=r.user_id::text and split_part(p_path,'/',2)=r.order_id::text
  );
$$;
revoke all on function private.can_read_restaurant_review_photo(text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.can_read_restaurant_review_photo(text) to authenticated;
drop policy if exists restaurant_review_photos_read_published on storage.objects;
create policy restaurant_review_photos_read_published on storage.objects for select to authenticated
  using(bucket_id='review-photos' and private.can_read_restaurant_review_photo(name));

create index if not exists restaurant_reviews_order_idx on public.orders(restaurant_id,id) where status='completed';
create index if not exists restaurant_reviews_published_idx on public.reviews(order_id,restaurant_rating,restaurant_submitted_at) where restaurant_submitted_at is not null;
notify pgrst,'reload schema';
commit;
