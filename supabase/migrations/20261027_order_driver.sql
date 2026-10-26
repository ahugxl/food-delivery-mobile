-- Read the assigned driver's real profile/avatar, without making the bucket public.
begin;
drop policy if exists order_driver_profile_read on public.profiles;
create policy order_driver_profile_read on public.profiles for select to authenticated using (
  role = 'driver' and exists (
    select 1 from public.orders o where o.driver_id = profiles.id and o.user_id = auth.uid()
  )
);
drop policy if exists order_driver_avatar_read on storage.objects;
create policy order_driver_avatar_read on storage.objects for select to authenticated using (
  bucket_id = 'profile-avatars' and exists (
    select 1 from public.orders o join public.profiles p on p.id = o.driver_id
    where o.user_id = auth.uid() and p.role = 'driver'
      and p.avatar_url = storage.objects.name
      and p.id::text = (storage.foldername(storage.objects.name))[1]
  )
);
notify pgrst, 'reload schema';
commit;
