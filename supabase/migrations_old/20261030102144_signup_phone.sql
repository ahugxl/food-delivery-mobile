begin;

create schema if not exists private;
create or replace function private.account_phone_key(p_phone text)
returns text language sql immutable set search_path = '' as $$
  select case when cleaned ~ '^0[0-9]{9}$' then '84' || substring(cleaned from 2)
    else nullif(ltrim(cleaned, '+'), '') end
  from (select regexp_replace(btrim(coalesce(p_phone,'')), '[[:space:]().-]', '', 'g') cleaned) s;
$$;
revoke all on function private.account_phone_key(text) from public, anon, authenticated;

-- Null phones remain allowed for OAuth and existing accounts. A unique index also
-- prevents two concurrent signups or profile updates from taking the same number.
create unique index if not exists profiles_phone_unique
  on public.profiles (private.account_phone_key(phone));

create or replace function public.signup_account_exists(p_phone text, p_email text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_phone text := private.account_phone_key(p_phone);
begin
  if v_phone is null or v_phone !~ '^[1-9][0-9]{8,14}$' then
    raise exception 'Số điện thoại không hợp lệ.';
  end if;
  if p_email is null or length(p_email)>254 or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Email không hợp lệ.';
  end if;
  -- Return only existence: never expose profiles, account IDs, email, or names.
  return exists(select 1 from public.profiles where private.account_phone_key(phone)=v_phone)
    or exists(select 1 from auth.users where lower(email)=lower(btrim(p_email)));
end;
$$;
revoke all on function public.signup_account_exists(text,text) from public;
grant execute on function public.signup_account_exists(text,text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_phone text := nullif(btrim(coalesce(nullif(new.phone,''), new.raw_user_meta_data->>'phone')), '');
begin
  if coalesce(new.encrypted_password,'') <> '' then
    if v_phone is null or private.account_phone_key(v_phone) !~ '^[1-9][0-9]{8,14}$' then
      raise exception 'Vui lòng nhập số điện thoại hợp lệ khi đăng ký.';
    end if;
  end if;
  insert into public.profiles(id,full_name,avatar_url,phone,role,loyalty_points)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name','Người dùng mới'),
    coalesce(new.raw_user_meta_data->>'avatar_url','https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200'),
    v_phone,'user',0);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
