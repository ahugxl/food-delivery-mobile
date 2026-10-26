-- Profile editor and address book. Keeps existing tables/data and public profile reads.
begin;
alter table public.profiles enable row level security;
drop policy if exists profile_read_self on public.profiles;
create policy profile_read_self on public.profiles for select to authenticated using (id = auth.uid());
grant select on public.profiles to authenticated;
-- Profile writes go through a whitelist RPC, never client-supplied role/loyalty_points.
revoke insert, update on public.profiles from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists avatar_read_self on storage.objects;
create policy avatar_read_self on storage.objects for select to authenticated using (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists avatar_upload_self on storage.objects;
create policy avatar_upload_self on storage.objects for insert to authenticated with check (bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists avatar_delete_unused on storage.objects;
create policy avatar_delete_unused on storage.objects for delete to authenticated using (
  bucket_id='profile-avatars' and (storage.foldername(name))[1]=auth.uid()::text
  and not exists (select 1 from public.profiles p where p.id=auth.uid() and p.avatar_url=name)
);

create or replace function public.update_my_profile(p_full_name text, p_phone text, p_avatar_url text)
returns setof public.profiles language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_profile public.profiles; v_phone text := nullif(btrim(p_phone),'');
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  if p_full_name is null or length(btrim(p_full_name)) not between 2 and 100 then raise exception 'Họ tên cần từ 2 đến 100 ký tự.'; end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'Số điện thoại không hợp lệ.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,118));
  select * into v_profile from public.profiles where id=v_user for update;
  if not found then
    -- Accounts registered before handle_new_user existed can create their own profile.
    insert into public.profiles(id,full_name,role,loyalty_points)
      values(v_user,btrim(p_full_name),'user',0) returning * into v_profile;
  end if;
  if p_avatar_url is distinct from v_profile.avatar_url and p_avatar_url is not null then
    if split_part(p_avatar_url,'/',1)<>v_user::text
       or not exists (select 1 from storage.objects where bucket_id='profile-avatars' and name=p_avatar_url) then
      raise exception 'Ảnh đại diện không thuộc tài khoản của bạn hoặc chưa được tải lên.';
    end if;
  end if;
  return query update public.profiles set full_name=btrim(p_full_name), phone=v_phone, avatar_url=p_avatar_url where id=v_user returning *;
end; $$;
revoke all on function public.update_my_profile(text,text,text) from public, anon;
grant execute on function public.update_my_profile(text,text,text) to authenticated;

alter table public.user_addresses enable row level security;
drop policy if exists address_read_self on public.user_addresses;
create policy address_read_self on public.user_addresses for select to authenticated using (user_id=auth.uid());
grant select on public.user_addresses to authenticated;
revoke insert, update, delete on public.user_addresses from anon, authenticated;

-- Repair only default flags of legacy rows; retain all addresses.
with ranked as (
  select id, row_number() over(partition by user_id order by is_default desc nulls last,id) as position from public.user_addresses
)
update public.user_addresses a set is_default=(r.position=1) from ranked r where a.id=r.id;
create unique index if not exists address_one_default_per_user on public.user_addresses(user_id) where is_default is true;
create index if not exists addresses_user_idx on public.user_addresses(user_id);

create or replace function public.save_my_address(p_id uuid, p_title text, p_address text, p_latitude double precision, p_longitude double precision, p_is_default boolean, p_create boolean default false)
returns setof public.user_addresses language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid(); v_existing public.user_addresses; v_default boolean;
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 117));
  if p_id is null or p_title is null or p_title not in ('Home','Work','Other') then raise exception 'Loại địa chỉ không hợp lệ.'; end if;
  if p_address is null or length(btrim(p_address)) not between 5 and 500 then raise exception 'Địa chỉ cần từ 5 đến 500 ký tự.'; end if;
  if p_latitude is null or p_longitude is null or not (p_latitude between -90 and 90 and p_longitude between -180 and 180) then raise exception 'Vui lòng chọn tọa độ giao hàng hợp lệ.'; end if;
  select * into v_existing from public.user_addresses where id=p_id;
  if found and v_existing.user_id<>v_user then raise exception 'Địa chỉ không thuộc tài khoản của bạn.'; end if;
  if v_existing.id is null and p_create is not true then raise exception 'Địa chỉ đã bị xóa. Vui lòng tải lại.'; end if;
  v_default := coalesce(p_is_default,false) or coalesce(v_existing.is_default,false)
    or not exists (select 1 from public.user_addresses where user_id=v_user and is_default is true);
  if v_default then update public.user_addresses set is_default=false where user_id=v_user and is_default is true; end if;
  if v_existing.id is null then
    return query insert into public.user_addresses(id,user_id,title,address,latitude,longitude,is_default)
      values(p_id,v_user,p_title,btrim(p_address),p_latitude,p_longitude,v_default) returning *;
  else
    return query update public.user_addresses set title=p_title,address=btrim(p_address),latitude=p_latitude,longitude=p_longitude,is_default=v_default
      where id=p_id and user_id=v_user returning *;
  end if;
end; $$;
revoke all on function public.save_my_address(uuid,text,text,double precision,double precision,boolean,boolean) from public, anon;
grant execute on function public.save_my_address(uuid,text,text,double precision,double precision,boolean,boolean) to authenticated;

create or replace function public.delete_my_address(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,117));
  if exists(select 1 from public.user_addresses where id=p_id and user_id<>v_user) then raise exception 'Địa chỉ không thuộc tài khoản của bạn.'; end if;
  delete from public.user_addresses where id=p_id and user_id=v_user;
  if not exists(select 1 from public.user_addresses where user_id=v_user and is_default is true) then
    update public.user_addresses set is_default=true where id=(select id from public.user_addresses where user_id=v_user order by id limit 1);
  end if;
end; $$;
revoke all on function public.delete_my_address(uuid) from public, anon;
grant execute on function public.delete_my_address(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
