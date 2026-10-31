-- Phase 4: ownership and completed-order validation. No records are deleted.
begin;
alter table public.favorites enable row level security;
drop policy if exists phase4_read_own_favorites on public.favorites;
create policy phase4_read_own_favorites on public.favorites for select to authenticated using (user_id = auth.uid());
drop policy if exists phase4_add_own_favorite on public.favorites;
create policy phase4_add_own_favorite on public.favorites for insert to authenticated with check (
  user_id = auth.uid() and restaurant_id is not null
  and exists (select 1 from public.restaurants r where r.id = restaurant_id and r.is_active is true)
);
drop policy if exists phase4_remove_own_favorite on public.favorites;
create policy phase4_remove_own_favorite on public.favorites for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.favorites to authenticated;

alter table public.reviews enable row level security;
drop policy if exists phase4_read_own_reviews on public.reviews;
create policy phase4_read_own_reviews on public.reviews for select to authenticated using (user_id = auth.uid());
drop policy if exists phase4_review_completed_order on public.reviews;
create policy phase4_review_completed_order on public.reviews for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid() and o.status = 'completed')
  and restaurant_rating is not null and restaurant_rating between 1 and 5
  and driver_rating is not null and driver_rating between 1 and 5
  and length(coalesce(restaurant_feedback, '')) <= 2000
  and length(coalesce(driver_feedback, '')) <= 2000
  and jsonb_typeof(driver_tags) = 'array'
  and jsonb_array_length(driver_tags) <= 3
  and driver_tags <@ '["Friendly","Supportive","On-time"]'::jsonb
);
grant select, insert on public.reviews to authenticated;
create index if not exists phase4_reviews_user_idx on public.reviews(user_id, created_at desc);
create index if not exists phase4_orders_user_created_idx on public.orders(user_id, created_at desc);
notify pgrst, 'reload schema';
commit;
