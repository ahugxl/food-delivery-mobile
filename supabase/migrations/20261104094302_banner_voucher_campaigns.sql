create table public.banner_vouchers (
  banner_id uuid not null references public.banners(id) on delete cascade,
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  primary key (banner_id,voucher_id)
);
create index banner_vouchers_voucher_id_idx on public.banner_vouchers(voucher_id);
alter table public.banner_vouchers enable row level security;
revoke all on public.banner_vouchers from public,anon,authenticated;
grant select on public.banner_vouchers to anon,authenticated;
grant all on public.banner_vouchers to service_role;
create policy banner_vouchers_public_read on public.banner_vouchers
for select to anon,authenticated using (
  exists(select 1 from public.banners b where b.id=banner_id and b.is_active is true)
  and exists(select 1 from public.vouchers v where v.id=voucher_id and v.reward_owner_id is null)
);

-- Prepare inactive banners. Upload the four PNGs to the existing B2 images/ prefix,
-- then activate the matching banners. Existing campaigns and wallet entries remain intact.
do $$
declare
  campaign record; offer record; target_restaurant uuid; banner_uuid uuid; voucher_uuid uuid;
  deadline timestamptz := (((current_timestamp at time zone 'Asia/Ho_Chi_Minh')::date + 30)
    + time '23:59:59') at time zone 'Asia/Ho_Chi_Minh';
begin
  for campaign in select * from (values
    ('phuc-long','Phúc Long Cộng Hoà','voucher-phuc-long.png',10),
    ('haidilao','Haidilao - Giga Mall','voucher-haidilao.png',11),
    ('tat-ca-quan',null,'voucher-tat-ca-quan.png',12),
    ('giam-phi-ship',null,'voucher-giam-phi-ship.png',13)
  ) as c(slug,restaurant_name,filename,sort_order)
  loop
    target_restaurant := null;
    if campaign.restaurant_name is not null then
      if (select count(*) from public.restaurants where name=campaign.restaurant_name) <> 1 then
        raise exception 'Không xác định duy nhất quán %',campaign.restaurant_name;
      end if;
      select id into strict target_restaurant from public.restaurants where name=campaign.restaurant_name;
    end if;
    select id into banner_uuid from public.banners
      where link_url='/campaign?collection='||campaign.slug order by id limit 1;
    if banner_uuid is null then
      insert into public.banners(image_url,link_url,is_active,position)
      values('https://data.linknhanh.io.vn/file/foodapp-assets/images/'||campaign.filename,
        '/campaign?collection='||campaign.slug,false,campaign.sort_order)
      returning id into banner_uuid;
    end if;
    for offer in select * from (values
      ('phuc-long','PHUCLONG10K','food',10000,40000,0),
      ('phuc-long','PHUCLONG20K','food',20000,80000,1),
      ('haidilao','HAIDILAO50K','food',50000,250000,0),
      ('haidilao','HAIDILAO100K','food',100000,500000,1),
      ('tat-ca-quan','SOOPIFOOD10K','food',10000,50000,0),
      ('tat-ca-quan','SOOPIFOOD20K','food',20000,100000,1),
      ('giam-phi-ship','SOOPISHIP10K','shipping',10000,30000,0),
      ('giam-phi-ship','SOOPISHIP20K','shipping',20000,80000,1)
    ) as o(slug,code,target,amount,minimum,sort_order) where o.slug=campaign.slug
    loop
      insert into public.vouchers(code,restaurant_id,applies_to,discount_type,discount_value,min_order_value,expiry_date,is_active)
      values(offer.code,target_restaurant,offer.target,'fixed',offer.amount,offer.minimum,deadline,true)
      on conflict(code) do nothing;
      select id into strict voucher_uuid from public.vouchers
      where code=offer.code and restaurant_id is not distinct from target_restaurant
        and applies_to=offer.target and discount_type='fixed' and discount_value=offer.amount
        and min_order_value=offer.minimum and reward_owner_id is null;
      insert into public.banner_vouchers(banner_id,voucher_id,position)
      values(banner_uuid,voucher_uuid,offer.sort_order) on conflict do nothing;
    end loop;
  end loop;
end $$;
notify pgrst,'reload schema';
