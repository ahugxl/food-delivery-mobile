-- Verification only: all review, photo-metadata and point changes are rolled back.
begin;
do $$
declare
  o public.orders%rowtype;
  r public.reviews%rowtype;
  f uuid;
  path text;
  before_points integer;
  after_points integer;
  before_likes bigint;
  after_likes bigint;
begin
  select * into o from public.orders x where status='completed'
    and not exists(select 1 from public.reviews existing where existing.order_id=x.id)
    and exists(select 1 from public.order_items i where i.order_id=x.id)
    order by (x.driver_id is not null) desc limit 1;
  if not found then raise exception 'Need an unreviewed completed order for rollback verification.'; end if;
  select food_id into f from public.order_items where order_id=o.id limit 1;
  before_points:=coalesce((select loyalty_points from public.profiles where id=o.user_id),0);
  select like_count into before_likes from public.food_review_stats(array[f]);
  path:=o.user_id::text||'/'||o.id::text||'/'||gen_random_uuid()::text||'.jpg';
  -- Fixture metadata exists only within this rollback transaction, no actual photo is published.
  insert into storage.objects(bucket_id,name,metadata) values('review-photos',path,'{"size":1024,"mimetype":"image/jpeg"}');
  perform set_config('request.jwt.claims',jsonb_build_object('sub',o.user_id,'role','authenticated')::text,true);
  if has_table_privilege('authenticated','public.profiles','UPDATE') or has_table_privilege('authenticated','public.reviews','INSERT') then raise exception 'Direct reward/review writes must be denied.'; end if;
  if has_function_privilege('anon','public.submit_order_review(uuid,text,integer,text,text,jsonb)','EXECUTE') then raise exception 'Anonymous submit must be denied.'; end if;
  execute 'set local role authenticated';
  if o.driver_id is not null then
    select * into r from public.submit_order_review(o.id,'driver',4,'Kiểm thử trong giao dịch rollback',null,'[]');
    if r.driver_rating<>4 or r.driver_submitted_at is null or r.restaurant_rating is not null then raise exception 'Driver stage mixed with restaurant stage'; end if;
  end if;
  begin
    perform public.submit_order_review(o.id,'restaurant',5,repeat('x',50),path,jsonb_build_array(jsonb_build_object('food_id',gen_random_uuid(),'is_liked',true)));
    raise exception 'Invalid food vote accepted';
  exception when others then if sqlerrm='Invalid food vote accepted' then raise; end if; end;
  begin
    select * into r from public.submit_order_review(o.id,'restaurant',5,repeat('x',49),path,'[]');
    if r.reward_points<>0 then raise exception '49 chars incorrectly rewarded'; end if;
    raise exception 'rollback_49';
  exception when others then if sqlerrm<>'rollback_49' then raise; end if; end;
  begin
    select * into r from public.submit_order_review(o.id,'restaurant',5,repeat('x',50),null,'[]');
    if r.reward_points<>0 then raise exception 'Missing photo incorrectly rewarded'; end if;
    raise exception 'rollback_no_photo';
  exception when others then if sqlerrm<>'rollback_no_photo' then raise; end if; end;
  select * into r from public.submit_order_review(o.id,'restaurant',5,repeat('x',50),path,jsonb_build_array(jsonb_build_object('food_id',f,'is_liked',true)));
  if r.reward_points<>500 or r.restaurant_submitted_at is null then raise exception 'Eligible reward was not applied'; end if;
  select loyalty_points into after_points from public.profiles where id=o.user_id;
  if after_points<>before_points+500 then raise exception 'Points balance incorrect'; end if;
  perform public.submit_order_review(o.id,'restaurant',1,'retry',null,'[]');
  if (select loyalty_points from public.profiles where id=o.user_id)<>after_points then raise exception 'Retry rewarded twice'; end if;
  if (select restaurant_rating from public.reviews where id=r.id)<>5 then raise exception 'Retry overwrote immutable review'; end if;
  select like_count into after_likes from public.food_review_stats(array[f]);
  if after_likes<>before_likes+1 then raise exception 'Like stats incorrect'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',gen_random_uuid(),'role','authenticated')::text,true);
  begin
    perform public.submit_order_review(o.id,'restaurant',5,'forged',null,'[]');
    raise exception 'Wrong owner accepted';
  exception when others then if sqlerrm='Wrong owner accepted' then raise; end if; end;
end $$;
rollback;
