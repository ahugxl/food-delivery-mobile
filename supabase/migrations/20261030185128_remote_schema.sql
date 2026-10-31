SET local check_function_bodies = off;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

CREATE SCHEMA "private";

CREATE EXTENSION "pg_cron";

CREATE TABLE "public"."banners" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "image_url"  text                     NOT NULL,
  "link_url"   text,
  "is_active"  boolean                  DEFAULT true,
  "position"   integer                  DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "banners_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."banners"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."calls" (
  "id"               uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "order_id"         uuid                     NOT NULL,
  "caller_id"        uuid                     NOT NULL,
  "receiver_id"      uuid                     NOT NULL,
  "duration_seconds" integer                  DEFAULT 0,
  "created_at"       timestamp with time zone DEFAULT now(),
  CONSTRAINT "calls_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."calls"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."calls" FROM "anon";

CREATE TABLE "public"."categories" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"       text                     NOT NULL,
  "icon_url"   text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "categories_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."categories"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."delivery_assignments" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "order_id"     uuid                     NOT NULL,
  "driver_id"    uuid                     NOT NULL,
  "status"       text                     NOT NULL DEFAULT 'offered'::text,
  "fee"          bigint                   NOT NULL,
  "cod_amount"   bigint                   NOT NULL,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at"   timestamp with time zone NOT NULL,
  "accepted_at"  timestamp with time zone,
  "picked_up_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "ended_at"     timestamp with time zone,
  "reason"       text,
  "distance_km"  double precision,
  "payout_rules" jsonb,
  CONSTRAINT "delivery_assignments_cod_amount_check" CHECK ((cod_amount >= 0)),
  CONSTRAINT "delivery_assignments_fee_check" CHECK ((fee >= 0)),
  CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY (id),
  CONSTRAINT "delivery_assignments_status_check"
    CHECK
    ((status = ANY (ARRAY['offered'::text, 'accepted'::text, 'at_restaurant'::text, 'picked_up'::text, 'at_customer'::text, 'delivered'::text, 'rejected'::text, 'expired'::text,
    'cancelled'::text, 'failed'::text])))
);

ALTER TABLE "public"."delivery_assignments"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."delivery_assignments" FROM "anon", "authenticated";

CREATE TABLE "public"."delivery_events" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "assignment_id" uuid                     NOT NULL,
  "actor_id"      uuid,
  "from_status"   text,
  "to_status"     text                     NOT NULL,
  "note"          text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "delivery_events_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."delivery_events"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."delivery_events" FROM "anon", "authenticated";

CREATE TABLE "public"."discovery_categories" (
  "id"             text    NOT NULL,
  "name"           text    NOT NULL,
  "kind"           text    NOT NULL,
  "restaurant_tag" text,
  "image_url"      text,
  "sort_order"     integer NOT NULL DEFAULT 0,
  "is_active"      boolean NOT NULL DEFAULT true,
  CONSTRAINT "discovery_categories_id_check" CHECK ((id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
  CONSTRAINT "discovery_categories_kind_check" CHECK ((kind = ANY (ARRAY['food'::text, 'restaurant_tag'::text]))),
  CONSTRAINT "discovery_categories_name_check" CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 100))),
  CONSTRAINT "discovery_categories_pkey" PRIMARY KEY (id),
  CONSTRAINT "discovery_category_kind" CHECK ((((kind = 'food'::text) AND (restaurant_tag IS NULL)) OR ((kind = 'restaurant_tag'::text) AND (restaurant_tag IS
    NOT NULL) AND (length(btrim(restaurant_tag)) > 0))))
);

ALTER TABLE "public"."discovery_categories"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."driver_ledger_entries" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "driver_id"     uuid                     NOT NULL,
  "order_id"      uuid                     NOT NULL,
  "assignment_id" uuid                     NOT NULL,
  "entry_type"    text                     NOT NULL,
  "amount"        bigint                   NOT NULL,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "driver_ledger_entries_amount_check" CHECK ((amount >= 0)),
  CONSTRAINT "driver_ledger_entries_assignment_id_entry_type_key" UNIQUE (assignment_id, entry_type),
  CONSTRAINT "driver_ledger_entries_entry_type_check" CHECK ((entry_type = ANY (ARRAY['earning'::text, 'cod_collected'::text, 'cod_remitted'::text, 'earning_paid'::text]))),
  CONSTRAINT "driver_ledger_entries_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."driver_ledger_entries"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."driver_ledger_entries" FROM "anon", "authenticated";

CREATE TABLE "public"."driver_locations" (
  "driver_id"   uuid                     NOT NULL,
  "latitude"    double precision         NOT NULL,
  "longitude"   double precision         NOT NULL,
  "accuracy"    double precision,
  "received_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "driver_locations_accuracy_check" CHECK (((accuracy >= (0)::double precision) AND (accuracy <= (100000)::double precision))),
  CONSTRAINT "driver_locations_latitude_check" CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))),
  CONSTRAINT "driver_locations_longitude_check" CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision))),
  CONSTRAINT "driver_locations_pkey" PRIMARY KEY (driver_id)
);

ALTER TABLE "public"."driver_locations"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."driver_locations" FROM "anon", "authenticated";

CREATE TABLE "public"."driver_presence" (
  "driver_id"    uuid                     NOT NULL,
  "is_online"    boolean                  NOT NULL DEFAULT false,
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "driver_presence_pkey" PRIMARY KEY (driver_id)
);

ALTER TABLE "public"."driver_presence"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."driver_presence" FROM "anon", "authenticated";

CREATE TABLE "public"."driver_profiles" (
  "user_id"         uuid                     NOT NULL,
  "approval_status" text                     NOT NULL DEFAULT 'pending'::text,
  "vehicle_type"    text                     NOT NULL DEFAULT 'Xe máy'::text,
  "plate_number"    text,
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "driver_profiles_approval_status_check" CHECK ((approval_status = ANY (ARRAY['pending'::text, 'approved'::text, 'suspended'::text]))),
  CONSTRAINT "driver_profiles_pkey" PRIMARY KEY (user_id)
);

ALTER TABLE "public"."driver_profiles"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."driver_profiles" FROM "anon", "authenticated";

CREATE TABLE "public"."driver_settings" (
  "id"                  boolean          NOT NULL DEFAULT true,
  "payout_per_delivery" bigint,
  "offer_seconds"       integer          NOT NULL DEFAULT 300,
  "payout_base_fee"     bigint,
  "payout_base_km"      double precision,
  "payout_extra_km_fee" bigint,
  CONSTRAINT "driver_settings_id_check" CHECK (id),
  CONSTRAINT "driver_settings_offer_seconds_check" CHECK (((offer_seconds >= 30) AND (offer_seconds <= 3600))),
  CONSTRAINT "driver_settings_payout_base_fee_check" CHECK ((payout_base_fee >= 0)),
  CONSTRAINT "driver_settings_payout_base_km_check" CHECK (((payout_base_km >= (0)::double precision) AND (payout_base_km <= (1000)::double precision))),
  CONSTRAINT "driver_settings_payout_extra_km_fee_check" CHECK ((payout_extra_km_fee >= 0)),
  CONSTRAINT "driver_settings_payout_per_delivery_check" CHECK ((payout_per_delivery >= 0)),
  CONSTRAINT "driver_settings_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."driver_settings"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."driver_settings" FROM "anon", "authenticated";

CREATE TABLE "public"."favorites" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       uuid                     NOT NULL,
  "restaurant_id" uuid,
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "favorites_pkey" PRIMARY KEY (id),
  CONSTRAINT "favorites_user_id_restaurant_id_key" UNIQUE (user_id, restaurant_id)
);

ALTER TABLE "public"."favorites"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."favorites" FROM "anon";

CREATE TABLE "public"."food_discovery_categories" (
  "food_id"               uuid NOT NULL,
  "discovery_category_id" text NOT NULL,
  CONSTRAINT "food_discovery_categories_pkey" PRIMARY KEY (food_id, discovery_category_id)
);

ALTER TABLE "public"."food_discovery_categories"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."food_option_groups" (
  "id"             uuid    NOT NULL DEFAULT gen_random_uuid(),
  "food_id"        uuid    NOT NULL,
  "name"           text    NOT NULL,
  "is_required"    boolean DEFAULT false,
  "allow_multiple" boolean DEFAULT false,
  CONSTRAINT "food_option_groups_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."food_option_groups"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."food_option_items" (
  "id"          uuid          NOT NULL DEFAULT gen_random_uuid(),
  "group_id"    uuid          NOT NULL,
  "name"        text          NOT NULL,
  "extra_price" numeric(10,2) DEFAULT 0.0,
  CONSTRAINT "food_option_items_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."food_option_items"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."food_reviews" (
  "review_id"  uuid                     NOT NULL,
  "food_id"    uuid                     NOT NULL,
  "is_liked"   boolean                  NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "food_reviews_pkey" PRIMARY KEY (review_id, food_id)
);

ALTER TABLE "public"."food_reviews"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."food_reviews" FROM "anon";

CREATE TABLE "public"."foods" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id"  uuid                     NOT NULL,
  "category_id"    uuid,
  "name"           text                     NOT NULL,
  "description"    text,
  "price"          numeric(10,2)            NOT NULL,
  "original_price" numeric(10,2),
  "image_url"      text,
  "is_available"   boolean                  DEFAULT true,
  "created_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "foods_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."foods"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."messages" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "order_id"     uuid                     NOT NULL,
  "sender_id"    uuid                     NOT NULL,
  "sender_type"  text                     NOT NULL,
  "message_type" text                     DEFAULT 'text'::text,
  "content"      text,
  "image_url"    text,
  "created_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "messages_message_type_check" CHECK ((message_type = ANY (ARRAY['text'::text, 'image'::text]))),
  CONSTRAINT "messages_pkey" PRIMARY KEY (id),
  CONSTRAINT "messages_sender_type_check" CHECK ((sender_type = ANY (ARRAY['user'::text, 'driver'::text])))
);

ALTER TABLE "public"."messages"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."notifications" (
  "id"         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    uuid,
  "title"      text                     NOT NULL,
  "content"    text                     NOT NULL,
  "image_url"  text,
  "type"       text                     DEFAULT 'system'::text,
  "is_read"    boolean                  DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "notifications_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."notifications"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."notifications" FROM "anon";

CREATE TABLE "public"."order_items" (
  "id"               uuid          NOT NULL DEFAULT gen_random_uuid(),
  "order_id"         uuid          NOT NULL,
  "food_id"          uuid          NOT NULL,
  "quantity"         integer       NOT NULL DEFAULT 1,
  "unit_price"       numeric(10,2) NOT NULL,
  "options_snapshot" jsonb         DEFAULT '{}'::jsonb,
  CONSTRAINT "order_items_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."order_items"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."order_items" FROM "anon";

CREATE TABLE "public"."orders" (
  "id"                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"                  uuid                     NOT NULL,
  "restaurant_id"            uuid                     NOT NULL,
  "driver_id"                uuid,
  "status"                   text                     DEFAULT 'pending'::text,
  "subtotal"                 numeric(10,2)            NOT NULL,
  "delivery_fee"             numeric(10,2)            DEFAULT 0.0,
  "voucher_id"               uuid,
  "discount_amount"          numeric(10,2)            DEFAULT 0.0,
  "total"                    numeric(10,2)            NOT NULL,
  "payment_method"           text                     DEFAULT 'cash'::text,
  "delivery_address"         text                     NOT NULL,
  "latitude"                 double precision,
  "longitude"                double precision,
  "created_at"               timestamp with time zone DEFAULT now(),
  "recipient_name"           text,
  "recipient_phone"          text,
  "shipping_voucher_id"      uuid,
  "food_discount_amount"     numeric                  NOT NULL DEFAULT 0,
  "shipping_discount_amount" numeric                  NOT NULL DEFAULT 0,
  "payment_status"           text                     DEFAULT 'unpaid'::text,
  "completed_at"             timestamp with time zone,
  CONSTRAINT "orders_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."orders"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."orders" FROM "anon";

CREATE TABLE "public"."profiles" (
  "id"             uuid                     NOT NULL,
  "full_name"      text                     NOT NULL,
  "phone"          text,
  "avatar_url"     text,
  "role"           text                     DEFAULT 'user'::text,
  "loyalty_points" integer                  DEFAULT 0,
  "created_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "profiles_role_check" CHECK ((role = ANY (ARRAY['user'::text, 'driver'::text, 'merchant'::text])))
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."profiles" FROM "anon";

CREATE TABLE "public"."restaurants" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "name"          text                     NOT NULL,
  "address"       text                     NOT NULL,
  "latitude"      double precision,
  "longitude"     double precision,
  "rating"        numeric(2,1)             DEFAULT 5.0,
  "image_url"     text,
  "is_active"     boolean                  DEFAULT true,
  "is_open"       boolean                  DEFAULT true,
  "opening_hours" text                     DEFAULT '6am - 9pm'::text,
  "price_range"   text                     DEFAULT '$5 - $50'::text,
  "promo_tags"    jsonb                    DEFAULT '[]'::jsonb,
  "created_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "restaurants_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."restaurants"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."reviews" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "order_id"                uuid                     NOT NULL,
  "user_id"                 uuid                     NOT NULL,
  "restaurant_rating"       integer,
  "restaurant_feedback"     text,
  "driver_rating"           integer,
  "driver_tags"             jsonb                    DEFAULT '[]'::jsonb,
  "driver_feedback"         text,
  "created_at"              timestamp with time zone DEFAULT now(),
  "driver_submitted_at"     timestamp with time zone,
  "restaurant_submitted_at" timestamp with time zone,
  "restaurant_image_path"   text,
  "reward_points"           integer                  NOT NULL DEFAULT 0,
  CONSTRAINT "reviews_driver_rating_check" CHECK (((driver_rating >= 1) AND (driver_rating <= 5))),
  CONSTRAINT "reviews_order_id_key" UNIQUE (order_id),
  CONSTRAINT "reviews_pkey" PRIMARY KEY (id),
  CONSTRAINT "reviews_restaurant_rating_check" CHECK (((restaurant_rating >= 1) AND (restaurant_rating <= 5))),
  CONSTRAINT "reviews_reward_points_check" CHECK ((reward_points = ANY (ARRAY[0, 500])))
);

ALTER TABLE "public"."reviews"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."user_addresses" (
  "id"              uuid             NOT NULL DEFAULT gen_random_uuid(),
  "user_id"         uuid             NOT NULL,
  "title"           text             NOT NULL,
  "address"         text             NOT NULL,
  "latitude"        double precision,
  "longitude"       double precision,
  "is_default"      boolean          DEFAULT false,
  "recipient_name"  text,
  "recipient_phone" text,
  CONSTRAINT "user_addresses_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."user_addresses"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."user_vouchers" (
  "id"           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      uuid                     NOT NULL,
  "voucher_id"   uuid                     NOT NULL,
  "is_used"      boolean                  DEFAULT false,
  "collected_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "user_vouchers_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_vouchers_user_id_voucher_id_key" UNIQUE (user_id, voucher_id)
);

ALTER TABLE "public"."user_vouchers"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."user_vouchers" FROM "anon";

CREATE TABLE "public"."vouchers" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "restaurant_id"   uuid,
  "code"            text                     NOT NULL,
  "discount_type"   text                     NOT NULL,
  "discount_value"  numeric(10,2)            NOT NULL,
  "min_order_value" numeric(10,2)            DEFAULT 0.0,
  "expiry_date"     timestamp with time zone,
  "is_active"       boolean                  DEFAULT true,
  "applies_to"      text                     NOT NULL DEFAULT 'food'::text,
  CONSTRAINT "voucher_applies_to_check" CHECK ((applies_to = ANY (ARRAY['food'::text, 'shipping'::text]))),
  CONSTRAINT "vouchers_code_key" UNIQUE (code),
  CONSTRAINT "vouchers_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."vouchers"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.account_phone_key (
  p_phone text
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
  select case when cleaned ~ '^0[0-9]{9}$' then '84' || substring(cleaned from 2)
    else nullif(ltrim(cleaned, '+'), '') end
  from (select regexp_replace(btrim(coalesce(p_phone,'')), '[[:space:]().-]', '', 'g') cleaned) s;
$function$;

CREATE OR REPLACE FUNCTION private.can_read_restaurant_review_photo (
  p_path text
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select auth.uid() is not null and exists(
    select 1 from public.reviews r join public.orders o on o.id=r.order_id and o.user_id=r.user_id
    join public.restaurants s on s.id=o.restaurant_id
    where r.restaurant_image_path=p_path and r.restaurant_submitted_at is not null
      and r.restaurant_rating between 1 and 5 and o.status='completed' and s.is_active
      and split_part(p_path,'/',1)=r.user_id::text and split_part(p_path,'/',2)=r.order_id::text
  );
$function$;

CREATE OR REPLACE FUNCTION private.driver_bridge_order()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_a public.delivery_assignments; v_quote jsonb; v_seconds integer;
begin
  if new.driver_id is distinct from old.driver_id then
    select * into v_a from public.delivery_assignments where order_id=new.id
      and status in ('offered','accepted','at_restaurant','picked_up','at_customer') for update;
    if (found and v_a.status in ('picked_up','at_customer')) or (old.status='delivering' and new.status <> 'cancelled') then
      raise exception 'Đơn đã lấy món cần được quản trị xử lý sự cố trước khi đổi tài xế.';
    end if;
    if new.driver_id is not null then
      if new.status is null or new.status not in ('pending','preparing') then raise exception 'Chỉ phân công đơn đang chờ hoặc chuẩn bị.'; end if;
      perform 1 from public.driver_profiles d join public.profiles p on p.id=d.user_id
        where d.user_id=new.driver_id and d.approval_status='approved' and p.role='driver' for update of d;
      if not found then raise exception 'Tài xế chưa được duyệt.'; end if;
      v_quote:=private.driver_payout_quote(new.restaurant_id,new.latitude,new.longitude);
      perform private.driver_cod(new.payment_method,new.payment_status,new.total);
    end if;
    update public.delivery_assignments set status='cancelled',ended_at=now(),reason='Điều phối thay đổi tài xế'
      where order_id=new.id and status in ('offered','accepted','at_restaurant');
    if new.driver_id is not null then
      select offer_seconds into v_seconds from public.driver_settings where id=true;
      insert into public.delivery_assignments(order_id,driver_id,fee,cod_amount,expires_at,distance_km,payout_rules)
      values(new.id,new.driver_id,(v_quote->>'fee')::bigint,private.driver_cod(new.payment_method,new.payment_status,new.total),
        now()+make_interval(secs=>v_seconds),(v_quote->>'distance_km')::double precision,v_quote->'rules');
      new.status:='preparing';
    end if;
  elsif new.status is distinct from old.status then
    if new.status='delivering' and exists(select 1 from public.delivery_assignments where order_id=new.id and status in ('offered','accepted','at_restaurant')) then
      raise exception 'Tài xế cần xác nhận lấy món trên app trước.';
    end if;
    if new.status='completed' and exists(select 1 from public.delivery_assignments where order_id=new.id and status in ('offered','accepted','at_restaurant','picked_up','at_customer')) then
      raise exception 'Tài xế cần xác nhận giao thành công trên app.';
    end if;
    if new.status='cancelled' then
      if exists(select 1 from public.delivery_assignments where order_id=new.id and status in ('picked_up','at_customer')) then
        raise exception 'Cần xử lý sự cố sau lấy món trước khi hủy.';
      end if;
      update public.delivery_assignments set status='cancelled',ended_at=now(),reason='Đơn hàng đã hủy'
        where order_id=new.id and status in ('offered','accepted','at_restaurant');
    end if;
  end if;
  -- A quote/COD snapshot must not silently become stale after a driver receives an offer.
  if (new.total is distinct from old.total or new.payment_method is distinct from old.payment_method
    or new.payment_status is distinct from old.payment_status
    or new.delivery_address is distinct from old.delivery_address or new.recipient_name is distinct from old.recipient_name
    or new.recipient_phone is distinct from old.recipient_phone or new.restaurant_id is distinct from old.restaurant_id
    or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude)
    and exists(select 1 from public.delivery_assignments where order_id=new.id and status in ('offered','accepted','at_restaurant','picked_up','at_customer')) then
    raise exception 'Cần kết thúc phân công trước khi sửa hóa đơn hoặc điểm giao.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.driver_cod (
  p_method         text,
  p_payment_status text,
  p_total          numeric
)
  RETURNS bigint
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
  AS $function$
begin
  if p_total is null or p_total < 0 or p_total <> round(p_total) then raise exception 'Tổng tiền COD không hợp lệ.'; end if;
  if p_method is null or p_method not in ('cash','e-wallet') then raise exception 'Cần xác minh phương thức thanh toán trước khi phân công.'; end if;
  if p_payment_status='paid' then return 0; end if;
  if p_method='cash' and p_payment_status='unpaid' then return p_total::bigint; end if;
  raise exception 'Cần xác minh trạng thái thanh toán trước khi phân công.';
end $function$;

CREATE OR REPLACE FUNCTION private.driver_expire_offers (
  p_driver_id uuid DEFAULT NULL::uuid
)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_o record; v_a public.delivery_assignments; v_count integer:=0;
begin
  for v_o in select o.id from public.orders o join public.delivery_assignments a on a.order_id=o.id
    where a.status='offered' and a.expires_at<=now() and (p_driver_id is null or a.driver_id=p_driver_id)
    order by o.id limit 100 for update of o skip locked loop
    select * into v_a from public.delivery_assignments where order_id=v_o.id and status='offered'
      and expires_at<=now() and (p_driver_id is null or driver_id=p_driver_id) for update;
    if not found then continue; end if;
    update public.delivery_assignments set status='expired',ended_at=now(),reason='Hết thời hạn nhận đơn' where id=v_a.id;
    update public.orders set driver_id=null,status='preparing'
      where id=v_a.order_id and driver_id=v_a.driver_id and status in ('pending','preparing');
    v_count:=v_count+1;
  end loop;
  return v_count;
end $function$;

CREATE OR REPLACE FUNCTION private.driver_log_event()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if TG_OP='INSERT' then
    insert into public.delivery_events(assignment_id,actor_id,to_status,note) values(new.id,auth.uid(),new.status,new.reason);
  elsif old.status is distinct from new.status then
    insert into public.delivery_events(assignment_id,actor_id,from_status,to_status,note) values(new.id,auth.uid(),old.status,new.status,new.reason);
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.driver_payout_quote (
  p_restaurant_id uuid,
  p_latitude      double precision,
  p_longitude     double precision
)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_r public.restaurants; v_s public.driver_settings; v_a double precision; v_km double precision; v_fee bigint;
begin
  select * into v_r from public.restaurants where id=p_restaurant_id;
  if not found or p_latitude is null or p_longitude is null or v_r.latitude is null or v_r.longitude is null
    or not(p_latitude between -90 and 90) or not(p_longitude between -180 and 180)
    or not(v_r.latitude between -90 and 90) or not(v_r.longitude between -180 and 180) then
    raise exception 'Thiếu tọa độ hợp lệ để tính tiền công tài xế.';
  end if;
  select * into v_s from public.driver_settings where id=true;
  if not found or v_s.payout_base_fee is null or v_s.payout_base_km is null or v_s.payout_extra_km_fee is null then
    raise exception 'Chưa cấu hình tiền công tài xế.';
  end if;
  v_a:=power(sin(radians(p_latitude-v_r.latitude)/2),2)
    +cos(radians(v_r.latitude))*cos(radians(p_latitude))*power(sin(radians(p_longitude-v_r.longitude)/2),2);
  v_a:=greatest(0::double precision,least(1::double precision,v_a));
  v_km:=round((6371*2*atan2(sqrt(v_a),sqrt(1-v_a)))::numeric,9)::double precision;
  v_fee:=v_s.payout_base_fee + ceil(greatest(0::double precision,v_km-v_s.payout_base_km))::bigint*v_s.payout_extra_km_fee;
  return jsonb_build_object('distance_km',v_km,'fee',v_fee,'rules',jsonb_build_object(
    'base_fee',v_s.payout_base_fee,'base_km',v_s.payout_base_km,'extra_km_fee',v_s.payout_extra_km_fee,'distance_method','haversine','currency','VND'));
end $function$;

CREATE OR REPLACE FUNCTION private.driver_reject_insert_assignment()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$ begin
  if new.driver_id is not null then raise exception 'Tạo đơn chưa gán tài xế trước, sau đó điều phối bằng UPDATE.'; end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.driver_require_approved()
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid:=auth.uid();
begin
  if v_id is null or not exists(select 1 from public.profiles p join public.driver_profiles d on d.user_id=p.id
    where p.id=v_id and p.role='driver' and d.approval_status='approved') then
    raise exception 'Tài khoản chưa được duyệt hoặc không có quyền tài xế.';
  end if;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION private.food_review_stats (
  p_food_ids uuid[]
)
  RETURNS TABLE (
    food_id    uuid,
    sold_count bigint,
    like_count bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select f.id,
    (select coalesce(sum(i.quantity),0)::bigint from public.order_items i join public.orders o on o.id=i.order_id where i.food_id=f.id and o.status='completed'),
    (select count(*) from public.food_reviews r where r.food_id=f.id and r.is_liked)
  from public.foods f where f.id=any(p_food_ids[1:100]);
$function$;

CREATE OR REPLACE FUNCTION private.submit_order_review (
  p_order_id   uuid,
  p_stage      text,
  p_rating     integer,
  p_feedback   text,
  p_image_path text,
  p_food_votes jsonb
)
  RETURNS SETOF public.reviews
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.admin_driver_assign (
  p_order_id  uuid,
  p_driver_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_o public.orders; v_id uuid;
begin
  if p_driver_id is null then raise exception 'Thiếu tài xế cần phân công.'; end if;
  select * into v_o from public.orders where id=p_order_id for update;
  if not found or v_o.status is null or v_o.status not in ('pending','preparing') then raise exception 'Chỉ phân công đơn chờ hoặc chuẩn bị.'; end if;
  if v_o.driver_id=p_driver_id then return public.admin_driver_migrate_order(p_order_id,false); end if;
  update public.orders set driver_id=p_driver_id where id=p_order_id;
  select id into v_id from public.delivery_assignments where order_id=p_order_id and driver_id=p_driver_id and status='offered';
  return v_id;
end $function$;

REVOKE ALL ON FUNCTION "public"."admin_driver_assign"(uuid, uuid) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.admin_driver_migrate_order (
  p_order_id          uuid,
  p_confirm_picked_up boolean DEFAULT false
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_o public.orders; v_a public.delivery_assignments; v_q jsonb; v_id uuid; v_seconds integer;
begin
  select * into v_o from public.orders where id=p_order_id for update;
  if not found or v_o.driver_id is null or v_o.status is null or v_o.status not in ('pending','preparing','delivering') then
    raise exception 'Chỉ chuyển đơn đang hoạt động, đã có tài xế.';
  end if;
  select * into v_a from public.delivery_assignments where order_id=p_order_id and status in ('offered','accepted','at_restaurant','picked_up','at_customer') for update;
  if found then
    if v_a.driver_id<>v_o.driver_id then raise exception 'Phân công hiện tại không khớp tài xế.'; end if;
    return v_a.id;
  end if;
  perform 1 from public.driver_profiles d join public.profiles p on p.id=d.user_id where d.user_id=v_o.driver_id
    and p.role='driver' and d.approval_status='approved' for update of d;
  if not found then raise exception 'Cần duyệt tài xế trước khi chuyển đơn cũ.'; end if;
  if v_o.status='delivering' and not coalesce(p_confirm_picked_up,false) then
    raise exception 'Cần quản trị xác minh tài xế đã lấy món.';
  end if;
  v_q:=private.driver_payout_quote(v_o.restaurant_id,v_o.latitude,v_o.longitude);
  select offer_seconds into v_seconds from public.driver_settings where id=true;
  insert into public.delivery_assignments(order_id,driver_id,status,fee,cod_amount,expires_at,distance_km,payout_rules,picked_up_at,reason)
    values(v_o.id,v_o.driver_id,case when v_o.status='delivering' then 'picked_up' else 'offered' end,
      (v_q->>'fee')::bigint,private.driver_cod(v_o.payment_method,v_o.payment_status,v_o.total),
      now()+make_interval(secs=>v_seconds),(v_q->>'distance_km')::double precision,v_q->'rules',
      null,'Chuyển từ luồng cũ sau xác minh; không suy đoán thời gian lấy món lịch sử') returning id into v_id;
  if v_o.status='pending' then update public.orders set status='preparing' where id=v_o.id; end if;
  return v_id;
end $function$;

REVOKE ALL ON FUNCTION "public"."admin_driver_migrate_order"(uuid, boolean) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.admin_driver_resolve (
  p_assignment_id  uuid,
  p_outcome        text,
  p_reason         text,
  p_goods_returned boolean DEFAULT false
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_o public.orders; v_a public.delivery_assignments;
begin
  if p_outcome is null or p_outcome not in ('cancel','return_to_dispatch') or p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'Nhập hướng xử lý cancel/return_to_dispatch và lý do 10–1000 ký tự.';
  end if;
  select o.* into v_o from public.orders o join public.delivery_assignments a on a.order_id=o.id where a.id=p_assignment_id for update of o;
  if not found then raise exception 'Không tìm thấy chuyến.'; end if;
  select * into v_a from public.delivery_assignments where id=p_assignment_id for update;
  if v_a.status not in ('offered','accepted','at_restaurant','picked_up','at_customer','failed')
    or v_o.driver_id is distinct from v_a.driver_id or v_o.status is null or v_o.status in ('completed','cancelled') then
    raise exception 'Chuyến không còn phù hợp để xử lý sự cố.';
  end if;
  if p_outcome='return_to_dispatch' and (v_o.status='delivering' or v_a.picked_up_at is not null)
    and not coalesce(p_goods_returned,false) then raise exception 'Cần xác nhận món đã hoàn về quán trước khi phân công lại.'; end if;
  update public.delivery_assignments set status='failed',ended_at=coalesce(ended_at,now()),reason=btrim(p_reason) where id=v_a.id;
  -- Retain an operator note even if it was already failed (no status transition).
  insert into public.delivery_events(assignment_id,actor_id,from_status,to_status,note)
    values(v_a.id,auth.uid(),v_a.status,'failed','Quản trị: '||p_outcome||' — '||btrim(p_reason));
  if p_outcome='cancel' then
    update public.orders set status='cancelled',driver_id=null where id=v_o.id;
  else
    update public.orders set status='preparing' where id=v_o.id;
    update public.orders set driver_id=null where id=v_o.id;
  end if;
  -- Never infer payment/refund/earnings from an incident resolution.
end $function$;

REVOKE ALL ON FUNCTION "public"."admin_driver_resolve"(uuid, text, text, boolean) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE FUNCTION public.collect_my_voucher (
  p_voucher_id uuid
)
  RETURNS SETOF public.vouchers
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user uuid := auth.uid();
  v_voucher public.vouchers%rowtype;
  v_used boolean;
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập để lấy mã.'; end if;
  select * into v_voucher from public.vouchers where id = p_voucher_id for share;
  if not found then raise exception 'Không tìm thấy mã ưu đãi.'; end if;
  if v_voucher.is_active is not true or (v_voucher.expiry_date is not null and v_voucher.expiry_date <= now()) then
    raise exception 'Mã ưu đãi đã hết hạn hoặc ngừng hoạt động.';
  end if;
  if v_voucher.discount_type not in ('fixed','percentage') or v_voucher.discount_type is null
    or v_voucher.discount_value is null or v_voucher.discount_value < 0
    or (v_voucher.discount_type = 'percentage' and v_voucher.discount_value > 100) then
    raise exception 'Mã ưu đãi chưa khả dụng.';
  end if;
  insert into public.user_vouchers(user_id, voucher_id, is_used)
    values(v_user, p_voucher_id, false) on conflict(user_id, voucher_id) do nothing;
  select is_used into v_used from public.user_vouchers
    where user_id = v_user and voucher_id = p_voucher_id for update;
  if not found or v_used is distinct from false then raise exception 'Mã ưu đãi đã sử dụng, không thể thu thập lại.'; end if;
  return next v_voucher;
end $function$;

REVOKE ALL ON FUNCTION "public"."collect_my_voucher"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.create_food_order (
  p_order_id     uuid,
  p_items        jsonb,
  p_address      text,
  p_voucher_code text  DEFAULT NULL::text
)
  RETURNS SETOF public.orders
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_food public.foods%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_voucher public.vouchers%rowtype;
  v_restaurant_id uuid;
  v_item jsonb;
  v_option jsonb;
  v_choice record;
  v_snapshot jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_unit numeric;
  v_quantity integer;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric := 2;
begin
  if v_user is null then raise exception 'Please sign in before ordering.'; end if;
  if p_order_id is null then raise exception 'Missing order identifier.'; end if;
  -- Same request ID is reused after a timeout. Serialize duplicate submissions.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text, 0));
  select * into v_order from public.orders where id = p_order_id;
  if found then
    if v_order.user_id <> v_user then raise exception 'Order identifier unavailable.'; end if;
    return next v_order;
    return;
  end if;
  if p_address is null or length(btrim(p_address)) < 5 or length(p_address) > 500 then
    raise exception 'Enter a delivery address between 5 and 500 characters.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid cart.'; end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then raise exception 'Cart must contain 1 to 100 lines.'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item->'quantity') <> 'number'
       or (v_item->>'quantity')::numeric <> trunc((v_item->>'quantity')::numeric) then
      raise exception 'Invalid quantity.';
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity < 1 or v_quantity > 99 then raise exception 'Quantity must be from 1 to 99.'; end if;
    if jsonb_typeof(v_item->'options') is distinct from 'array' then raise exception 'Invalid options.'; end if;
    if jsonb_array_length(v_item->'options') > 100 then raise exception 'Too many options.'; end if;
    if length(coalesce(v_item->>'note', '')) > 500 then raise exception 'Note is too long.'; end if;

    select * into v_food from public.foods where id = (v_item->>'foodId')::uuid for share;
    if not found or v_food.is_available is not true then raise exception 'A dish is no longer available. Please update your cart.'; end if;
    select * into v_restaurant from public.restaurants where id = v_food.restaurant_id for share;
    if not found or v_restaurant.is_active is not true or v_restaurant.is_open is not true then raise exception 'The restaurant is currently unavailable.'; end if;
    if v_restaurant_id is not null and v_restaurant_id <> v_food.restaurant_id then raise exception 'Each order must belong to one restaurant.'; end if;
    v_restaurant_id := v_food.restaurant_id;
    v_unit := v_food.price;
    v_snapshot := '[]'::jsonb;

    for v_option in select value from jsonb_array_elements(v_item->'options') loop
      select i.id, i.name, i.extra_price, g.id as group_id, g.name as group_name, g.allow_multiple
      into v_choice
      from public.food_option_items i join public.food_option_groups g on g.id = i.group_id
      where i.id = (v_option->>'id')::uuid and g.id = (v_option->>'groupId')::uuid and g.food_id = v_food.id
      for share of i, g;
      if not found then raise exception 'An option has changed. Please select your dish again.'; end if;
      if v_snapshot @> jsonb_build_array(jsonb_build_object('id', v_choice.id)) then raise exception 'Duplicate option.'; end if;
      if v_choice.allow_multiple is not true and v_snapshot @> jsonb_build_array(jsonb_build_object('groupId', v_choice.group_id)) then
        raise exception 'Only one option is allowed in this group.';
      end if;
      v_unit := v_unit + coalesce(v_choice.extra_price, 0);
      v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
        'groupId', v_choice.group_id, 'groupName', v_choice.group_name,
        'id', v_choice.id, 'label', v_choice.name, 'price', coalesce(v_choice.extra_price, 0)
      ));
    end loop;
    if exists (
      select 1 from public.food_option_groups g where g.food_id = v_food.id and g.is_required is true
      and not (v_snapshot @> jsonb_build_array(jsonb_build_object('groupId', g.id)))
    ) then raise exception 'Please select all required option groups.'; end if;
    v_unit := round(v_unit, 2);
    if v_unit < 0 or v_item->>'unitPrice' is null or v_unit <> round((v_item->>'unitPrice')::numeric, 2) then
      raise exception 'The price has changed. Please update your cart before ordering.';
    end if;
    v_subtotal := v_subtotal + v_unit * v_quantity;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'food_id', v_food.id, 'quantity', v_quantity, 'unit_price', v_unit,
      'options_snapshot', jsonb_build_object('options', v_snapshot, 'note', coalesce(v_item->>'note', ''),
        'food_name', v_food.name, 'base_price', v_food.price)
    ));
  end loop;

  if nullif(btrim(p_voucher_code), '') is not null then
    select * into v_voucher from public.vouchers where code = upper(btrim(p_voucher_code)) for share;
    if not found or v_voucher.is_active is not true then raise exception 'Voucher is invalid or inactive.'; end if;
    if v_voucher.expiry_date is not null and v_voucher.expiry_date <= now() then raise exception 'Voucher has expired.'; end if;
    if v_voucher.restaurant_id is not null and v_voucher.restaurant_id <> v_restaurant_id then raise exception 'Voucher belongs to another restaurant.'; end if;
    if v_subtotal < coalesce(v_voucher.min_order_value, 0) then raise exception 'The order does not meet the voucher minimum.'; end if;
    if v_voucher.discount_value is null or v_voucher.discount_value < 0 then raise exception 'Invalid voucher value.'; end if;
    if v_voucher.discount_type = 'percentage' then
      if v_voucher.discount_value > 100 then raise exception 'Invalid percentage discount.'; end if;
      v_discount := least(v_subtotal, round(v_subtotal * v_voucher.discount_value / 100, 2));
    elsif v_voucher.discount_type = 'fixed' then
      v_discount := least(v_subtotal, round(v_voucher.discount_value, 2));
    else raise exception 'Unsupported voucher type.';
    end if;
  end if;

  insert into public.orders (id, user_id, restaurant_id, status, subtotal, delivery_fee, voucher_id,
    discount_amount, total, payment_method, delivery_address)
  values (p_order_id, v_user, v_restaurant_id, 'pending', v_subtotal, v_delivery, v_voucher.id,
    v_discount, v_subtotal + v_delivery - v_discount, 'cash', btrim(p_address)) returning * into v_order;

  insert into public.order_items (order_id, food_id, quantity, unit_price, options_snapshot)
  select p_order_id, (line->>'food_id')::uuid, (line->>'quantity')::integer,
    (line->>'unit_price')::numeric, line->'options_snapshot'
  from jsonb_array_elements(v_lines) as items(line);
  return next v_order;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text) FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.create_food_order (
  p_order_id     uuid,
  p_items        jsonb,
  p_address      text,
  p_voucher_code text,
  p_latitude     double precision,
  p_longitude    double precision,
  p_delivery_fee numeric
)
  RETURNS SETOF public.orders
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_food public.foods%rowtype;
  v_restaurant public.restaurants%rowtype;
  v_voucher public.vouchers%rowtype;
  v_restaurant_id uuid;
  v_item jsonb;
  v_option jsonb;
  v_choice record;
  v_snapshot jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_unit numeric;
  v_quantity integer;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric;
  v_a double precision;
  v_distance double precision;
begin
  if v_user is null then raise exception 'Please sign in before ordering.'; end if;
  if p_order_id is null then raise exception 'Missing order identifier.'; end if;
  -- Same request ID is reused after a timeout. Serialize duplicate submissions.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text, 0));
  select * into v_order from public.orders where id = p_order_id;
  if found then
    if v_order.user_id <> v_user then raise exception 'Order identifier unavailable.'; end if;
    return next v_order;
    return;
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Vui lòng chọn tọa độ giao hàng hợp lệ.';
  end if;
  if p_address is null or length(btrim(p_address)) < 5 or length(p_address) > 500 then
    raise exception 'Enter a delivery address between 5 and 500 characters.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Invalid cart.'; end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then raise exception 'Cart must contain 1 to 100 lines.'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item->'quantity') <> 'number'
       or (v_item->>'quantity')::numeric <> trunc((v_item->>'quantity')::numeric) then
      raise exception 'Invalid quantity.';
    end if;
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity is null or v_quantity < 1 or v_quantity > 99 then raise exception 'Quantity must be from 1 to 99.'; end if;
    if jsonb_typeof(v_item->'options') is distinct from 'array' then raise exception 'Invalid options.'; end if;
    if jsonb_array_length(v_item->'options') > 100 then raise exception 'Too many options.'; end if;
    if length(coalesce(v_item->>'note', '')) > 500 then raise exception 'Note is too long.'; end if;

    select * into v_food from public.foods where id = (v_item->>'foodId')::uuid for share;
    if not found or v_food.is_available is not true then raise exception 'A dish is no longer available. Please update your cart.'; end if;
    select * into v_restaurant from public.restaurants where id = v_food.restaurant_id for share;
    if not found or v_restaurant.is_active is not true or v_restaurant.is_open is not true then raise exception 'The restaurant is currently unavailable.'; end if;
    if v_restaurant_id is not null and v_restaurant_id <> v_food.restaurant_id then raise exception 'Each order must belong to one restaurant.'; end if;
    v_restaurant_id := v_food.restaurant_id;
    v_unit := v_food.price;
    v_snapshot := '[]'::jsonb;

    for v_option in select value from jsonb_array_elements(v_item->'options') loop
      select i.id, i.name, i.extra_price, g.id as group_id, g.name as group_name, g.allow_multiple
      into v_choice
      from public.food_option_items i join public.food_option_groups g on g.id = i.group_id
      where i.id = (v_option->>'id')::uuid and g.id = (v_option->>'groupId')::uuid and g.food_id = v_food.id
      for share of i, g;
      if not found then raise exception 'An option has changed. Please select your dish again.'; end if;
      if v_snapshot @> jsonb_build_array(jsonb_build_object('id', v_choice.id)) then raise exception 'Duplicate option.'; end if;
      if v_choice.allow_multiple is not true and v_snapshot @> jsonb_build_array(jsonb_build_object('groupId', v_choice.group_id)) then
        raise exception 'Only one option is allowed in this group.';
      end if;
      v_unit := v_unit + coalesce(v_choice.extra_price, 0);
      v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
        'groupId', v_choice.group_id, 'groupName', v_choice.group_name,
        'id', v_choice.id, 'label', v_choice.name, 'price', coalesce(v_choice.extra_price, 0)
      ));
    end loop;
    if exists (
      select 1 from public.food_option_groups g where g.food_id = v_food.id and g.is_required is true
      and not (v_snapshot @> jsonb_build_array(jsonb_build_object('groupId', g.id)))
    ) then raise exception 'Please select all required option groups.'; end if;
    v_unit := round(v_unit, 2);
    if v_unit < 0 or v_item->>'unitPrice' is null or v_unit <> round((v_item->>'unitPrice')::numeric, 2) then
      raise exception 'The price has changed. Please update your cart before ordering.';
    end if;
    v_subtotal := v_subtotal + v_unit * v_quantity;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'food_id', v_food.id, 'quantity', v_quantity, 'unit_price', v_unit,
      'options_snapshot', jsonb_build_object('options', v_snapshot, 'note', coalesce(v_item->>'note', ''),
        'food_name', v_food.name, 'base_price', v_food.price)
    ));
  end loop;

  if v_restaurant.latitude is null or v_restaurant.longitude is null
     or v_restaurant.latitude not between -90 and 90 or v_restaurant.longitude not between -180 and 180 then
    raise exception 'Quán chưa có tọa độ hợp lệ để tính phí giao hàng.';
  end if;
  -- Same Haversine formula and micrometre normalization as the client.
  v_a := power(sin(radians(p_latitude-v_restaurant.latitude)/2),2)
    + cos(radians(v_restaurant.latitude))*cos(radians(p_latitude))
      * power(sin(radians(p_longitude-v_restaurant.longitude)/2),2);
  v_a := least(1::double precision,greatest(0::double precision,v_a));
  v_distance := 6371*2*atan2(sqrt(v_a),sqrt(1-v_a));
  v_distance := round(v_distance::numeric,9)::double precision;
  v_delivery := 15000 + 5000*ceil(greatest(0::double precision,v_distance-2));
  if p_delivery_fee is null or p_delivery_fee <> v_delivery then
    raise exception 'Phí giao hàng đã thay đổi. Vui lòng tính lại trước khi đặt hàng.';
  end if;

  if nullif(btrim(p_voucher_code), '') is not null then
    select * into v_voucher from public.vouchers where code = upper(btrim(p_voucher_code)) for share;
    if not found or v_voucher.is_active is not true then raise exception 'Voucher is invalid or inactive.'; end if;
    if v_voucher.expiry_date is not null and v_voucher.expiry_date <= now() then raise exception 'Voucher has expired.'; end if;
    perform 1 from public.user_vouchers where user_id = v_user and voucher_id = v_voucher.id and is_used = false for update;
    if not found then raise exception 'Mã chưa được thu thập hoặc đã sử dụng. Vui lòng chọn lại trong ví.'; end if;
    if v_voucher.restaurant_id is not null and v_voucher.restaurant_id <> v_restaurant_id then raise exception 'Voucher belongs to another restaurant.'; end if;
    if v_subtotal < coalesce(v_voucher.min_order_value, 0) then raise exception 'The order does not meet the voucher minimum.'; end if;
    if v_voucher.discount_value is null or v_voucher.discount_value < 0 then raise exception 'Invalid voucher value.'; end if;
    if v_voucher.discount_type = 'percentage' then
      if v_voucher.discount_value > 100 then raise exception 'Invalid percentage discount.'; end if;
      v_discount := least(v_subtotal, round(v_subtotal * v_voucher.discount_value / 100, 2));
    elsif v_voucher.discount_type = 'fixed' then
      v_discount := least(v_subtotal, round(v_voucher.discount_value, 2));
    else raise exception 'Unsupported voucher type.';
    end if;
  end if;

  insert into public.orders (id, user_id, restaurant_id, status, subtotal, delivery_fee, voucher_id,
    discount_amount, total, payment_method, delivery_address, latitude, longitude)
  values (p_order_id, v_user, v_restaurant_id, 'pending', v_subtotal, v_delivery, v_voucher.id,
    v_discount, v_subtotal + v_delivery - v_discount, 'cash', btrim(p_address), p_latitude, p_longitude) returning * into v_order;

  insert into public.order_items (order_id, food_id, quantity, unit_price, options_snapshot)
  select p_order_id, (line->>'food_id')::uuid, (line->>'quantity')::integer,
    (line->>'unit_price')::numeric, line->'options_snapshot'
  from jsonb_array_elements(v_lines) as items(line);
  if v_voucher.id is not null then
    update public.user_vouchers set is_used = true where user_id = v_user and voucher_id = v_voucher.id;
  end if;
  return next v_order;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text, double precision, double precision, numeric) FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.create_food_order (
  p_order_id        uuid,
  p_items           jsonb,
  p_address         text,
  p_voucher_code    text,
  p_latitude        double precision,
  p_longitude       double precision,
  p_delivery_fee    numeric,
  p_recipient_name  text,
  p_recipient_phone text
)
  RETURNS SETOF public.orders
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_name text := btrim(p_recipient_name);
  v_phone text := regexp_replace(btrim(p_recipient_phone),'[[:space:]().-]','','g');
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  if p_order_id is null then raise exception 'Thiếu mã yêu cầu đặt hàng.'; end if;
  -- Same lock as the internal checkout. Retries return the original snapshot.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text,0));
  select * into v_order from public.orders where id=p_order_id;
  if found then
    if v_order.user_id<>v_user then raise exception 'Mã đơn hàng không khả dụng.'; end if;
    return next v_order;
    return;
  end if;
  if v_name is null or length(v_name) not between 2 and 100 then raise exception 'Tên người nhận cần từ 2 đến 100 ký tự.'; end if;
  if v_phone is null or v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'Số điện thoại người nhận cần từ 9 đến 15 chữ số.'; end if;
  -- Prices, options, shipping and wallet consumption remain in the same transaction.
  perform public.create_food_order(p_order_id,p_items,p_address,p_voucher_code,p_latitude,p_longitude,p_delivery_fee);
  return query update public.orders set recipient_name=v_name, recipient_phone=v_phone
    where id=p_order_id and user_id=v_user returning *;
end; $function$;

REVOKE ALL
  ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text, double precision, double precision, numeric, text, text)
  FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.create_food_order (
  p_order_id              uuid,
  p_items                 jsonb,
  p_address               text,
  p_voucher_code          text,
  p_latitude              double precision,
  p_longitude             double precision,
  p_delivery_fee          numeric,
  p_recipient_name        text,
  p_recipient_phone       text,
  p_shipping_voucher_code text
)
  RETURNS SETOF public.orders
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_food_voucher public.vouchers%rowtype;
  v_shipping_voucher public.vouchers%rowtype;
  v_food_code text := nullif(upper(btrim(p_voucher_code)),'');
  v_shipping_code text := nullif(upper(btrim(p_shipping_voucher_code)),'');
  v_shipping_discount numeric := 0;
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  if p_order_id is null then raise exception 'Thiếu mã yêu cầu đặt hàng.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text,0));
  select * into v_order from public.orders where id=p_order_id;
  if found then
    if v_order.user_id<>v_user then raise exception 'Mã đơn hàng không khả dụng.'; end if;
    return next v_order; return;
  end if;
  -- Serialize a customer's wallet consumption across simultaneous checkouts.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,119));
  if v_food_code is not null then
    select * into v_food_voucher from public.vouchers where code=v_food_code for share;
    if not found or v_food_voucher.applies_to<>'food' then raise exception 'Vui lòng chọn đúng voucher giảm tiền món.'; end if;
    if v_food_voucher.discount_value::text in ('NaN','Infinity','-Infinity') then raise exception 'Giá trị voucher tiền món không hợp lệ.'; end if;
  end if;
  if v_shipping_code is not null then
    select * into v_shipping_voucher from public.vouchers where code=v_shipping_code for share;
    if not found or v_shipping_voucher.applies_to<>'shipping' then raise exception 'Vui lòng chọn đúng voucher giảm phí giao hàng.'; end if;
    if v_shipping_voucher.is_active is not true then raise exception 'Voucher phí giao hàng đã ngừng hoạt động.'; end if;
    if v_shipping_voucher.expiry_date is not null and v_shipping_voucher.expiry_date<=now() then raise exception 'Voucher phí giao hàng đã hết hạn.'; end if;
    if v_shipping_voucher.discount_value is null or v_shipping_voucher.discount_value<0 or v_shipping_voucher.discount_value::text in ('NaN','Infinity','-Infinity') or
       v_shipping_voucher.discount_type not in ('fixed','percentage') or v_shipping_voucher.discount_type is null or
       (v_shipping_voucher.discount_type='percentage' and v_shipping_voucher.discount_value>100) then
      raise exception 'Giá trị voucher phí giao hàng không hợp lệ.';
    end if;
  end if;
  perform 1 from public.user_vouchers
    where user_id=v_user and voucher_id in (v_food_voucher.id,v_shipping_voucher.id)
    order by voucher_id for update;
  if v_shipping_code is not null and not exists(select 1 from public.user_vouchers where user_id=v_user and voucher_id=v_shipping_voucher.id and is_used=false) then
    raise exception 'Voucher phí giao hàng chưa được thu thập hoặc đã sử dụng.';
  end if;

  -- Reuse all existing price/option/location/recipient/food-voucher validation.
  -- The helper's writes and both voucher consumptions share THIS transaction.
  select * into strict v_order from public.create_food_order(p_order_id,p_items,p_address,v_food_code,p_latitude,p_longitude,p_delivery_fee,p_recipient_name,p_recipient_phone);
  if v_shipping_code is not null then
    if v_shipping_voucher.restaurant_id is not null and v_shipping_voucher.restaurant_id<>v_order.restaurant_id then
      raise exception 'Voucher phí giao hàng chỉ áp dụng tại quán khác.';
    end if;
    if v_order.subtotal<coalesce(v_shipping_voucher.min_order_value,0) then raise exception 'Tiền món chưa đạt mức tối thiểu của voucher phí giao hàng.'; end if;
    v_shipping_discount := least(v_order.delivery_fee,case when v_shipping_voucher.discount_type='percentage'
      then round(v_order.delivery_fee*v_shipping_voucher.discount_value/100,2)
      else round(v_shipping_voucher.discount_value,2) end);
    update public.user_vouchers set is_used=true where user_id=v_user and voucher_id=v_shipping_voucher.id and is_used=false;
    if not found then raise exception 'Voucher phí giao hàng đã sử dụng.'; end if;
  end if;
  return query update public.orders set
    food_discount_amount=v_order.discount_amount,
    shipping_discount_amount=v_shipping_discount,
    shipping_voucher_id=v_shipping_voucher.id,
    discount_amount=v_order.discount_amount+v_shipping_discount,
    total=v_order.subtotal+v_order.delivery_fee-v_order.discount_amount-v_shipping_discount
    where id=p_order_id and user_id=v_user returning *;
end; $function$;

REVOKE ALL ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text, double precision, double precision, numeric, text, text, text) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.create_food_order_at_location (
  p_order_id     uuid,
  p_items        jsonb,
  p_address      text,
  p_voucher_code text             DEFAULT NULL::text,
  p_latitude     double precision DEFAULT NULL::double precision,
  p_longitude    double precision DEFAULT NULL::double precision
)
  RETURNS SETOF public.orders
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null then raise exception 'Please sign in before ordering.'; end if;
  if p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Please select valid delivery coordinates.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_order_id::text, 0));
  select * into v_order from public.orders where id = p_order_id;
  if found then
    if v_order.user_id <> auth.uid() then raise exception 'Order identifier unavailable.'; end if;
    return next v_order;
    return;
  end if;
  select * into v_order from public.create_food_order(p_order_id, p_items, p_address, p_voucher_code);
  update public.orders set latitude = p_latitude, longitude = p_longitude
  where id = v_order.id returning * into v_order;
  return next v_order;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."create_food_order_at_location"(uuid, jsonb, text, text, double precision, double precision) FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.delete_my_address (
  p_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,117));
  if exists(select 1 from public.user_addresses where id=p_id and user_id<>v_user) then raise exception 'Địa chỉ không thuộc tài khoản của bạn.'; end if;
  delete from public.user_addresses where id=p_id and user_id=v_user;
  if not exists(select 1 from public.user_addresses where user_id=v_user and is_default is true) then
    update public.user_addresses set is_default=true where id=(select id from public.user_addresses where user_id=v_user order by id limit 1);
  end if;
end; $function$;

REVOKE ALL ON FUNCTION "public"."delete_my_address"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.driver_dashboard()
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid:=private.driver_require_approved(); v_result jsonb;
begin
  perform private.driver_expire_offers(v_id);
  update public.driver_presence set last_seen_at=now() where driver_id=v_id;
  select jsonb_build_object(
    'profile',(select jsonb_build_object('full_name',p.full_name,'phone',p.phone,'approval_status',d.approval_status,'vehicle_type',d.vehicle_type,'plate_number',d.plate_number)
      from public.profiles p join public.driver_profiles d on d.user_id=p.id where p.id=v_id),
    'online',coalesce((select is_online from public.driver_presence where driver_id=v_id),false),
    'trips',coalesce((select jsonb_agg(x.payload order by x.created_at desc) from (
      select a.created_at,jsonb_build_object('id',a.id,'order_id',a.order_id,'status',a.status,'expires_at',a.expires_at,'created_at',a.created_at,
        'fee',a.fee,'cod_amount',a.cod_amount,'completed_at',a.completed_at,'distance_km',a.distance_km,'payout_rules',a.payout_rules,
        'restaurant_name',r.name,'restaurant_address',r.address,'pickup_latitude',r.latitude,'pickup_longitude',r.longitude,
        'delivery_area',null, -- No reliable coarse district column yet; do not leak the full address as a substitute.
        'delivery_address',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then o.delivery_address end,
        'latitude',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then o.latitude end,
        'longitude',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then o.longitude end,
        'recipient_name',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then o.recipient_name end,
        'recipient_phone',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then o.recipient_phone end,
        'items',case when o.driver_id=v_id and a.status in ('accepted','at_restaurant','picked_up','at_customer') then
          coalesce((select jsonb_agg(jsonb_build_object('name',f.name,'quantity',i.quantity,'options',i.options_snapshot))
            from public.order_items i join public.foods f on f.id=i.food_id where i.order_id=o.id),'[]'::jsonb) else '[]'::jsonb end) payload
      from public.delivery_assignments a join public.orders o on o.id=a.order_id join public.restaurants r on r.id=o.restaurant_id
      where a.driver_id=v_id order by a.created_at desc limit 100) x),'[]'::jsonb),
    'ledger',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from
      (select * from public.driver_ledger_entries where driver_id=v_id order by created_at desc limit 200) l),'[]'::jsonb),
    'reviews',coalesce((select jsonb_agg(to_jsonb(q)) from (select r.driver_rating,r.driver_feedback from public.reviews r
      where exists(select 1 from public.delivery_assignments a where a.order_id=r.order_id and a.driver_id=v_id and a.status='delivered')
      order by r.created_at desc limit 100) q),'[]'::jsonb)) into v_result;
  return v_result;
end $function$;

REVOKE ALL ON FUNCTION "public"."driver_dashboard"() FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.driver_messages (
  p_assignment_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid := private.driver_require_approved(); v_order uuid;
begin
  select a.order_id into v_order from public.delivery_assignments a join public.orders o on o.id=a.order_id
    where a.id=p_assignment_id and a.driver_id=v_id and o.driver_id=v_id
    and o.status in ('preparing','delivering') and a.status in ('accepted','at_restaurant','picked_up','at_customer');
  if not found then raise exception 'Chat chỉ mở trong chuyến đang thực hiện.'; end if;
  return coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from (
    select id,sender_type,content,message_type,created_at from public.messages where order_id=v_order
    order by created_at desc limit 100) m),'[]'::jsonb);
end $function$;

REVOKE ALL ON FUNCTION "public"."driver_messages"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.driver_save_profile (
  p_full_name    text,
  p_phone        text,
  p_vehicle_type text,
  p_plate_number text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid:=private.driver_require_approved(); v_phone text:=nullif(regexp_replace(btrim(p_phone),'[[:space:]().-]','','g'),'');
begin
  if p_full_name is null or length(btrim(p_full_name)) not between 2 and 100 or p_vehicle_type is null
    or length(btrim(p_vehicle_type)) not between 2 and 50 or coalesce(length(p_plate_number),0)>30
    or (v_phone is not null and v_phone !~ '^[+]?[0-9]{9,15}$') then raise exception 'Thông tin hồ sơ không hợp lệ.'; end if;
  begin
    update public.profiles set full_name=btrim(p_full_name),phone=v_phone where id=v_id;
  exception when unique_violation then raise exception 'Số điện thoại đã được đăng ký.';
  end;
  update public.driver_profiles set vehicle_type=btrim(p_vehicle_type),plate_number=nullif(btrim(p_plate_number),''),updated_at=now() where user_id=v_id;
end $function$;

REVOKE ALL ON FUNCTION "public"."driver_save_profile"(text, text, text, text) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.driver_send_message (
  p_assignment_id uuid,
  p_content       text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid := private.driver_require_approved(); v_order uuid;
begin
  if p_content is null or length(btrim(p_content)) not between 1 and 2000 then raise exception 'Tin nhắn cần từ 1 đến 2000 ký tự.'; end if;
  select o.id into v_order from public.orders o join public.delivery_assignments a on a.order_id=o.id
    where a.id=p_assignment_id and a.driver_id=v_id and o.driver_id=v_id
    and o.status in ('preparing','delivering') and a.status in ('accepted','at_restaurant','picked_up','at_customer') for update of o;
  if not found then raise exception 'Chat chỉ mở trong chuyến đang thực hiện.'; end if;
  insert into public.messages(order_id,sender_id,sender_type,message_type,content) values(v_order,v_id,'driver','text',btrim(p_content));
end $function$;

REVOKE ALL ON FUNCTION "public"."driver_send_message"(uuid, text) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.driver_set_online (
  p_online boolean
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid:=private.driver_require_approved();
begin
  if p_online is null then raise exception 'Thiếu trạng thái làm việc.'; end if;
  perform 1 from public.driver_profiles where user_id=v_id for update;
  if not p_online and exists(select 1 from public.delivery_assignments where driver_id=v_id and status in ('accepted','at_restaurant','picked_up','at_customer')) then
    raise exception 'Hãy hoàn thành chuyến hiện tại trước khi tắt nhận đơn.';
  end if;
  insert into public.driver_presence(driver_id,is_online,last_seen_at) values(v_id,p_online,now())
    on conflict(driver_id) do update set is_online=excluded.is_online,last_seen_at=now();
end $function$;

REVOKE ALL ON FUNCTION "public"."driver_set_online"(boolean) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.driver_step (
  p_assignment_id uuid,
  p_action        text,
  p_reason        text    DEFAULT NULL::text,
  p_cod_confirmed boolean DEFAULT false
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid := private.driver_require_approved(); v_a public.delivery_assignments; v_next text; v_order public.orders;
begin
  -- Always lock order before assignment: same order as admin bridge.
  select o.* into v_order from public.orders o join public.delivery_assignments a on a.order_id=o.id
    where a.id=p_assignment_id and a.driver_id=v_id for update of o;
  if not found then raise exception 'Không tìm thấy chuyến của bạn.'; end if;
  select * into v_a from public.delivery_assignments where id=p_assignment_id and driver_id=v_id for update;
  if (p_action='reject' and v_a.status='rejected') or (p_action='fail' and v_a.status='failed')
    or (p_action='arrive_restaurant' and v_a.status='at_restaurant') or (p_action='pickup' and v_a.status='picked_up')
    or (p_action='arrive_customer' and v_a.status='at_customer') then return; end if;
  if v_order.driver_id is distinct from v_id or v_order.status in ('completed','cancelled') then
    if v_a.status='delivered' and p_action='deliver' then return; end if;
    raise exception 'Đơn đã kết thúc hoặc đã được điều phối lại.';
  end if;
  if p_action='accept' and v_a.status='accepted' then return; end if;
  if p_action='accept' and v_a.status='offered' then
    if v_a.expires_at <= now() then raise exception 'Đề nghị đã hết hạn. Hãy tải lại.'; end if;
    perform 1 from public.driver_profiles where user_id=v_id for update;
    if not exists(select 1 from public.driver_presence where driver_id=v_id and is_online) then raise exception 'Hãy bật nhận đơn trước.'; end if;
    v_next := 'accepted';
  elsif p_action='reject' and v_a.status='offered' then v_next := 'rejected';
  elsif p_action='arrive_restaurant' and v_a.status='accepted' then v_next := 'at_restaurant';
  elsif p_action='pickup' and v_a.status='at_restaurant' then v_next := 'picked_up';
  elsif p_action='arrive_customer' and v_a.status='picked_up' then v_next := 'at_customer';
  elsif p_action='deliver' and v_a.status='at_customer' then
    if v_a.cod_amount > 0 and not coalesce(p_cod_confirmed,false) then raise exception 'Cần xác nhận đã thu đủ COD.'; end if;
    v_next := 'delivered';
  elsif p_action='fail' and v_a.status in ('accepted','at_restaurant','picked_up','at_customer') then v_next := 'failed';
  else raise exception 'Thao tác không phù hợp với trạng thái hiện tại.'; end if;
  if v_next in ('rejected','failed') and (p_reason is null or length(btrim(p_reason)) not between 5 and 1000) then
    raise exception 'Nhập lý do từ 5 đến 1000 ký tự.';
  end if;
  update public.delivery_assignments set status=v_next,reason=case when v_next in ('rejected','failed') then btrim(p_reason) else null end,
    accepted_at=case when v_next='accepted' then now() else accepted_at end,
    picked_up_at=case when v_next='picked_up' then now() else picked_up_at end,
    completed_at=case when v_next='delivered' then now() else completed_at end,
    ended_at=case when v_next in ('rejected','failed','delivered') then now() else ended_at end
    where id=v_a.id;
  if v_next='picked_up' then update public.orders set status='delivering' where id=v_a.order_id; end if;
  if v_next in ('accepted','picked_up','delivered') then
    insert into public.notifications(user_id,title,content,type)
    values(v_order.user_id,
      case v_next when 'accepted' then 'Tài xế đã nhận chuyến' when 'picked_up' then 'Tài xế đang giao hàng' else 'Giao hàng thành công' end,
      'Đơn #' || left(v_a.order_id::text,8) || ': ' || case v_next when 'accepted' then 'Tài xế đang đến quán.' when 'picked_up' then 'Tài xế đã lấy món và đang đến bạn.' else 'Đã giao hàng. Cảm ơn bạn!' end,
      'order_status');
  end if;
  if v_next='delivered' then
    update public.orders set status='completed',completed_at=now(),payment_status='paid' where id=v_a.order_id;
    insert into public.driver_ledger_entries(driver_id,order_id,assignment_id,entry_type,amount)
      values(v_id,v_a.order_id,v_a.id,'earning',v_a.fee) on conflict do nothing;
    if v_a.cod_amount>0 then
      insert into public.driver_ledger_entries(driver_id,order_id,assignment_id,entry_type,amount)
        values(v_id,v_a.order_id,v_a.id,'cod_collected',v_a.cod_amount) on conflict do nothing;
    end if;
  elsif v_next='rejected' then
    update public.orders set driver_id=null,status='preparing' where id=v_a.order_id;
  end if;
  -- failed keeps the order/driver attached for operator review; no automatic payment/cancel.
end $function$;

REVOKE ALL ON FUNCTION "public"."driver_step"(uuid, text, text, boolean) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.driver_update_location (
  p_latitude  double precision,
  p_longitude double precision,
  p_accuracy  double precision DEFAULT NULL::double precision
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_id uuid:=private.driver_require_approved();
begin
  if p_latitude is null or p_longitude is null or not(p_latitude between -90 and 90) or not(p_longitude between -180 and 180)
    or (p_accuracy is not null and not(p_accuracy between 0 and 100000)) then raise exception 'Tọa độ không hợp lệ.'; end if;
  if not exists(select 1 from public.driver_presence where driver_id=v_id and is_online) then raise exception 'Hãy bật nhận đơn.'; end if;
  insert into public.driver_locations(driver_id,latitude,longitude,accuracy) values(v_id,p_latitude,p_longitude,p_accuracy)
    on conflict(driver_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,received_at=now();
  update public.driver_presence set last_seen_at=now() where driver_id=v_id;
end $function$;

REVOKE ALL ON FUNCTION "public"."driver_update_location"(double precision, double precision, double precision) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.food_review_stats (
  p_food_ids uuid[]
)
  RETURNS TABLE (
    food_id    uuid,
    sold_count bigint,
    like_count bigint
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select * from private.food_review_stats(p_food_ids);
$function$;

REVOKE ALL ON FUNCTION "public"."food_review_stats"(uuid[]) FROM PUBLIC, "service_role";

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.order_delivery_progress (
  p_order_id uuid
)
  RETURNS TABLE (
    order_status    text,
    driver_id       uuid,
    assignment_id   uuid,
    delivery_status text,
    updated_at      timestamp with time zone
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Bạn cần đăng nhập.'; end if;
  return query
    select o.status,o.driver_id,a.id,a.status,
      coalesce((select max(e.created_at) from public.delivery_events e where e.assignment_id=a.id),
        a.completed_at,a.ended_at,a.picked_up_at,a.accepted_at,a.created_at)
    from public.orders o
    left join lateral (
      select d.* from public.delivery_assignments d
      where d.order_id=o.id and d.driver_id=o.driver_id
      order by (d.status in ('offered','accepted','at_restaurant','picked_up','at_customer')) desc,
        d.created_at desc,d.id desc limit 1
    ) a on true
    where o.id=p_order_id and o.user_id=v_user;
end $function$;

REVOKE ALL ON FUNCTION "public"."order_delivery_progress"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.order_driver_location (
  p_order_id uuid
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null then raise exception 'Bạn cần đăng nhập.'; end if;
  return (select jsonb_build_object('latitude',l.latitude,'longitude',l.longitude,'received_at',l.received_at,
    'is_stale',l.received_at < now()-interval '2 minutes')
    from public.orders o join public.driver_locations l on l.driver_id=o.driver_id
    where o.id=p_order_id and o.user_id=auth.uid() and o.status in ('preparing','delivering')
    and exists(select 1 from public.delivery_assignments a where a.order_id=o.id and a.driver_id=o.driver_id and a.status in ('accepted','at_restaurant','picked_up','at_customer')));
end $function$;

REVOKE ALL ON FUNCTION "public"."order_driver_location"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.restaurant_review_feed (
  p_restaurant_id uuid,
  p_sort          text    DEFAULT 'newest'::text,
  p_rating        integer DEFAULT NULL::integer,
  p_with_photos   boolean DEFAULT false,
  p_mine          boolean DEFAULT false,
  p_offset        integer DEFAULT 0,
  p_limit         integer DEFAULT 20
)
  RETURNS TABLE (
    review_id     uuid,
    author_name   text,
    rating        integer,
    feedback      text,
    photo_path    text,
    submitted_at  timestamp with time zone,
    ordered_foods text[],
    is_mine       boolean
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."restaurant_review_feed"(uuid, text, integer, boolean, boolean, integer, integer) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.restaurant_review_summary (
  p_restaurant_id uuid
)
  RETURNS TABLE (
    average_rating numeric,
    review_count   bigint,
    star_5         bigint,
    star_4         bigint,
    star_3         bigint,
    star_2         bigint,
    star_1         bigint
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select round(avg(r.restaurant_rating)::numeric,1),count(*),
    count(*) filter(where r.restaurant_rating=5),count(*) filter(where r.restaurant_rating=4),
    count(*) filter(where r.restaurant_rating=3),count(*) filter(where r.restaurant_rating=2),count(*) filter(where r.restaurant_rating=1)
  from public.reviews r join public.orders o on o.id=r.order_id and o.user_id=r.user_id
  join public.restaurants s on s.id=o.restaurant_id
  where auth.uid() is not null and s.id=p_restaurant_id and s.is_active
    and o.status='completed' and r.restaurant_submitted_at is not null and r.restaurant_rating between 1 and 5;
$function$;

REVOKE ALL ON FUNCTION "public"."restaurant_review_summary"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.save_my_address (
  p_id         uuid,
  p_title      text,
  p_address    text,
  p_latitude   double precision,
  p_longitude  double precision,
  p_is_default boolean,
  p_create     boolean          DEFAULT false
)
  RETURNS SETOF public.user_addresses
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end; $function$;

REVOKE ALL ON FUNCTION "public"."save_my_address"(uuid, text, text, double precision, double precision, boolean, boolean) FROM PUBLIC, "anon", "authenticated", "service_role";

CREATE OR REPLACE FUNCTION public.save_my_address (
  p_id              uuid,
  p_title           text,
  p_address         text,
  p_latitude        double precision,
  p_longitude       double precision,
  p_is_default      boolean,
  p_create          boolean,
  p_recipient_name  text,
  p_recipient_phone text
)
  RETURNS SETOF public.user_addresses
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(p_recipient_name);
  v_phone text := regexp_replace(btrim(p_recipient_phone),'[[:space:]().-]','','g');
begin
  if v_user is null then raise exception 'Vui lòng đăng nhập lại.'; end if;
  if v_name is null or length(v_name) not between 2 and 100 then raise exception 'Tên người nhận cần từ 2 đến 100 ký tự.'; end if;
  if v_phone is null or v_phone !~ '^\+?[0-9]{9,15}$' then raise exception 'Số điện thoại người nhận cần từ 9 đến 15 chữ số.'; end if;
  -- The original RPC serializes address/default changes and validates ownership.
  perform public.save_my_address(p_id,p_title,p_address,p_latitude,p_longitude,p_is_default,p_create);
  return query update public.user_addresses
    set recipient_name=v_name, recipient_phone=v_phone
    where id=p_id and user_id=v_user returning *;
end; $function$;

REVOKE ALL ON FUNCTION "public"."save_my_address"(uuid, text, text, double precision, double precision, boolean, boolean, text, text) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.signup_account_exists (
  p_phone text,
  p_email text
)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."signup_account_exists"(text, text) FROM PUBLIC, "service_role";

CREATE OR REPLACE FUNCTION public.submit_order_review (
  p_order_id   uuid,
  p_stage      text,
  p_rating     integer,
  p_feedback   text,
  p_image_path text    DEFAULT NULL::text,
  p_food_votes jsonb   DEFAULT '[]'::jsonb
)
  RETURNS SETOF public.reviews
  LANGUAGE sql
  SET search_path TO ''
  AS $function$
  select * from private.submit_order_review(p_order_id,p_stage,p_rating,p_feedback,p_image_path,p_food_votes);
$function$;

REVOKE ALL ON FUNCTION "public"."submit_order_review"(uuid, text, integer, text, text, jsonb) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.update_my_profile (
  p_full_name  text,
  p_phone      text,
  p_avatar_url text
)
  RETURNS SETOF public.profiles
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
end; $function$;

REVOKE ALL ON FUNCTION "public"."update_my_profile"(text, text, text) FROM PUBLIC, "anon", "service_role";

ALTER TABLE "public"."calls"
  ADD CONSTRAINT "calls_caller_id_fkey" FOREIGN KEY (caller_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."calls"
  ADD CONSTRAINT "calls_receiver_id_fkey" FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."delivery_events"
  ADD CONSTRAINT "delivery_events_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id);

ALTER TABLE "public"."delivery_events"
  ADD CONSTRAINT "delivery_events_assignment_id_fkey" FOREIGN KEY (assignment_id) REFERENCES public.delivery_assignments(id);

ALTER TABLE "public"."driver_ledger_entries"
  ADD CONSTRAINT "driver_ledger_entries_assignment_id_fkey" FOREIGN KEY (assignment_id) REFERENCES public.delivery_assignments(id);

ALTER TABLE "public"."delivery_assignments"
  ADD CONSTRAINT "delivery_assignments_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(user_id);

ALTER TABLE "public"."driver_ledger_entries"
  ADD CONSTRAINT "driver_ledger_entries_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(user_id);

ALTER TABLE "public"."driver_locations"
  ADD CONSTRAINT "driver_locations_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(user_id);

ALTER TABLE "public"."driver_presence"
  ADD CONSTRAINT "driver_presence_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES public.driver_profiles(user_id);

ALTER TABLE "public"."favorites"
  ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."food_discovery_categories"
  ADD CONSTRAINT "food_discovery_categories_discovery_category_id_fkey" FOREIGN KEY (discovery_category_id) REFERENCES public.discovery_categories(id) ON DELETE CASCADE;

ALTER TABLE "public"."food_option_items"
  ADD CONSTRAINT "food_option_items_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.food_option_groups(id) ON DELETE CASCADE;

ALTER TABLE "public"."foods"
  ADD CONSTRAINT "foods_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE "public"."food_discovery_categories"
  ADD CONSTRAINT "food_discovery_categories_food_id_fkey" FOREIGN KEY (food_id) REFERENCES public.foods(id) ON DELETE CASCADE;

ALTER TABLE "public"."food_option_groups"
  ADD CONSTRAINT "food_option_groups_food_id_fkey" FOREIGN KEY (food_id) REFERENCES public.foods(id) ON DELETE CASCADE;

ALTER TABLE "public"."food_reviews"
  ADD CONSTRAINT "food_reviews_food_id_fkey" FOREIGN KEY (food_id) REFERENCES public.foods(id) ON DELETE CASCADE;

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."order_items"
  ADD CONSTRAINT "order_items_food_id_fkey" FOREIGN KEY (food_id) REFERENCES public.foods(id);

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_driver_id_fkey" FOREIGN KEY (driver_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE "public"."calls"
  ADD CONSTRAINT "calls_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE "public"."delivery_assignments"
  ADD CONSTRAINT "delivery_assignments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id);

ALTER TABLE "public"."driver_ledger_entries"
  ADD CONSTRAINT "driver_ledger_entries_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id);

ALTER TABLE "public"."messages"
  ADD CONSTRAINT "messages_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE "public"."order_items"
  ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."driver_profiles"
  ADD CONSTRAINT "driver_profiles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE "public"."favorites"
  ADD CONSTRAINT "favorites_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

ALTER TABLE "public"."foods"
  ADD CONSTRAINT "foods_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id);

ALTER TABLE "public"."reviews"
  ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE "public"."food_reviews"
  ADD CONSTRAINT "food_reviews_review_id_fkey" FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;

ALTER TABLE "public"."reviews"
  ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_addresses"
  ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."user_vouchers"
  ADD CONSTRAINT "user_vouchers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_shipping_voucher_id_fkey" FOREIGN KEY (shipping_voucher_id) REFERENCES public.vouchers(id);

ALTER TABLE "public"."orders"
  ADD CONSTRAINT "orders_voucher_id_fkey" FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE SET NULL;

ALTER TABLE "public"."user_vouchers"
  ADD CONSTRAINT "user_vouchers_voucher_id_fkey" FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE CASCADE;

ALTER TABLE "public"."vouchers"
  ADD CONSTRAINT "vouchers_restaurant_id_fkey" FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX address_one_default_per_user ON public.user_addresses USING btree (user_id)
  WHERE (is_default IS TRUE);

CREATE INDEX addresses_user_idx ON public.user_addresses USING btree (user_id);

CREATE INDEX driver_event_history ON public.delivery_events USING btree (assignment_id, created_at);

CREATE INDEX driver_ledger_history ON public.driver_ledger_entries USING btree (driver_id, created_at DESC);

CREATE INDEX driver_offer_expiry ON public.delivery_assignments USING btree (expires_at)
  WHERE (status = 'offered'::text);

CREATE UNIQUE INDEX driver_one_active_order ON public.delivery_assignments USING btree (order_id)
  WHERE (status = ANY (ARRAY['offered'::text, 'accepted'::text, 'at_restaurant'::text, 'picked_up'::text, 'at_customer'::text]));

CREATE UNIQUE INDEX driver_one_active_trip ON public.delivery_assignments USING btree (driver_id)
  WHERE (status = ANY (ARRAY['offered'::text, 'accepted'::text, 'at_restaurant'::text, 'picked_up'::text, 'at_customer'::text]));

CREATE INDEX driver_trip_history ON public.delivery_assignments USING btree (driver_id, created_at DESC);

CREATE INDEX food_discovery_category_idx ON public.food_discovery_categories USING btree (discovery_category_id, food_id);

CREATE INDEX food_reviews_food_idx ON public.food_reviews USING btree (food_id);

CREATE INDEX phase3_messages_order_created_idx ON public.messages USING btree (order_id, created_at, id);

CREATE INDEX restaurant_reviews_order_idx ON public.orders USING btree (restaurant_id, id)
  WHERE (status = 'completed'::text);

CREATE INDEX restaurant_reviews_published_idx ON public.reviews USING btree (order_id, restaurant_rating, restaurant_submitted_at)
  WHERE (restaurant_submitted_at IS NOT NULL);

CREATE INDEX review_stats_order_items_food_idx ON public.order_items USING btree (food_id, order_id);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER driver_assignment_event
  AFTER INSERT OR UPDATE ON public.delivery_assignments
  FOR EACH ROW
  EXECUTE FUNCTION private.driver_log_event();

CREATE TRIGGER driver_order_bridge
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.driver_bridge_order();

CREATE TRIGGER driver_order_insert_guard
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION private.driver_reject_insert_assignment();

CREATE POLICY "customer_catalog_read" ON "public"."banners"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "customer_call_read_boundary" ON "public"."calls"
  AS RESTRICTIVE
  FOR SELECT
  TO "authenticated"
  USING (((caller_id = ( SELECT auth.uid() AS uid)) OR (receiver_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "customer_call_read" ON "public"."calls"
  FOR SELECT
  TO "authenticated"
  USING (((caller_id = ( SELECT auth.uid() AS uid)) OR (receiver_id = ( SELECT auth.uid() AS uid))));

CREATE POLICY "customer_catalog_read" ON "public"."categories"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "discovery_categories_read" ON "public"."discovery_categories"
  FOR SELECT
  TO "anon", "authenticated"
  USING (is_active);

CREATE POLICY "customer_favorite_boundary" ON "public"."favorites"
  AS RESTRICTIVE
  FOR ALL
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "phase4_add_own_favorite" ON "public"."favorites"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (restaurant_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.restaurants r
  WHERE ((r.id = favorites.restaurant_id) AND (r.is_active IS TRUE))))));

CREATE POLICY "phase4_read_own_favorites" ON "public"."favorites"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "phase4_remove_own_favorite" ON "public"."favorites"
  FOR DELETE
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "food_discovery_categories_read" ON "public"."food_discovery_categories"
  FOR SELECT
  TO "anon", "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.discovery_categories d
  WHERE ((d.id = food_discovery_categories.discovery_category_id) AND (d.kind = 'food'::text) AND d.is_active))));

CREATE POLICY "customer_catalog_read" ON "public"."food_option_groups"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "customer_catalog_read" ON "public"."food_option_items"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "food_reviews_read_own" ON "public"."food_reviews"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.reviews r
  WHERE ((r.id = food_reviews.review_id) AND (r.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "customer_catalog_read" ON "public"."foods"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "phase3_read_order_messages" ON "public"."messages"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = messages.order_id) AND ((o.user_id = auth.uid()) OR (o.driver_id = auth.uid()))))));

CREATE POLICY "phase3_send_customer_message" ON "public"."messages"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((sender_id = auth.uid()) AND (sender_type = 'user'::text) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = messages.order_id) AND (o.user_id = auth.uid())))) AND
    (((message_type = 'text'::text) AND (image_url IS NULL) AND ((length(btrim(content)) >= 1) AND (length(btrim(content)) <= 2000))) OR ((message_type = 'image'::text) AND
    (image_url IS
    NOT NULL) AND (split_part(image_url, '/'::text, 1) = (order_id)::text) AND (split_part(image_url, '/'::text, 2) = (auth.uid())::text) AND
    ((content IS NULL) OR (length(content) <= 2000))))));

CREATE POLICY "customer_notification_read_boundary" ON "public"."notifications"
  AS RESTRICTIVE
  FOR SELECT
  TO "authenticated"
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (user_id IS NULL)));

CREATE POLICY "customer_notification_read" ON "public"."notifications"
  FOR SELECT
  TO "authenticated"
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR (user_id IS NULL)));

CREATE POLICY "customer_order_item_read_boundary" ON "public"."order_items"
  AS RESTRICTIVE
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "phase2_read_own_order_items" ON "public"."order_items"
  FOR SELECT
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "customer_order_read_boundary" ON "public"."orders"
  AS RESTRICTIVE
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "phase2_read_own_orders" ON "public"."orders"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "customer_profile_read_boundary" ON "public"."profiles"
  AS RESTRICTIVE
  FOR SELECT
  TO "authenticated"
  USING (((id = ( SELECT auth.uid() AS uid)) OR ((ROLE = 'driver'::text) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.user_id = ( SELECT auth.uid() AS uid)) AND (o.driver_id = profiles.id)))))));

CREATE POLICY "order_driver_profile_read" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (((ROLE = 'driver'::text) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.user_id = ( SELECT auth.uid() AS uid)) AND (o.driver_id = profiles.id))))));

CREATE POLICY "profile_read_self" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "customer_catalog_read" ON "public"."restaurants"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "review_flow_read_own" ON "public"."reviews"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "address_read_self" ON "public"."user_addresses"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "Users can manage their own collected vouchers" ON "public"."user_vouchers"
  FOR ALL
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "wallet_own_boundary" ON "public"."user_vouchers"
  AS RESTRICTIVE
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "wallet_own_read" ON "public"."user_vouchers"
  FOR SELECT
  TO "authenticated"
  USING ((user_id = auth.uid()));

CREATE POLICY "customer_catalog_read" ON "public"."vouchers"
  FOR SELECT
  TO "anon", "authenticated"
  USING (true);

CREATE POLICY "avatar_delete_unused" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'profile-avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (NOT (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.avatar_url = objects.name)))))));

CREATE POLICY "avatar_read_self" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'profile-avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "avatar_upload_self" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'profile-avatars'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY "order_driver_avatar_read" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'profile-avatars'::text) AND (EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.profiles p ON ((p.id = o.driver_id)))
  WHERE ((o.user_id = auth.uid()) AND (p.role = 'driver'::text) AND (p.avatar_url = objects.name) AND ((p.id)::text = (storage.foldername(objects.name))[1]))))));

CREATE POLICY "phase3_read_chat_image" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'order-chat'::text) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE (((o.id)::text = (storage.foldername(objects.name))[1]) AND ((o.user_id = auth.uid()) OR (o.driver_id = auth.uid())))))));

CREATE POLICY "phase3_remove_own_chat_upload" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'order-chat'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE (((o.id)::text = (storage.foldername(objects.name))[1]) AND (o.user_id = auth.uid())))) AND (NOT (EXISTS ( SELECT 1
   FROM public.messages m
  WHERE (m.image_url = objects.name))))));

CREATE POLICY "phase3_upload_chat_image" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'order-chat'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE (((o.id)::text = (storage.foldername(objects.name))[1]) AND (o.user_id = auth.uid()))))));

CREATE POLICY "restaurant_review_photos_read_published" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'review-photos'::text) AND private.can_read_restaurant_review_photo(name)));

CREATE POLICY "review_photos_delete_draft" ON "storage"."objects"
  FOR DELETE
  TO "authenticated"
  USING (((bucket_id = 'review-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (NOT (EXISTS ( SELECT 1
   FROM public.reviews r
  WHERE ((r.restaurant_image_path = objects.name) AND (r.user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY "review_photos_read_own" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'review-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

CREATE POLICY "review_photos_upload_completed" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'review-photos'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM public.orders o
  WHERE (((o.id)::text = (storage.foldername(objects.name))[2]) AND (o.user_id = ( SELECT auth.uid() AS uid)) AND (o.status = 'completed'::text) AND (NOT (EXISTS ( SELECT 1
           FROM public.reviews r
          WHERE ((r.order_id = o.id) AND (r.restaurant_submitted_at IS NOT NULL))))))))));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."messages";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."orders";

COMMENT ON COLUMN "public"."driver_settings"."payout_per_delivery" IS 'Cột cũ, không dùng trong luồng tính tiền công theo km.';

COMMENT ON COLUMN "public"."orders"."payment_status" IS 'NULL: trạng thái thanh toán lịch sử chưa xác minh; đơn mới mặc định unpaid. Không suy ra thanh toán từ status đơn.';

COMMENT ON COLUMN "public"."orders"."recipient_name" IS 'Recipient name captured when placing this order.';

COMMENT ON COLUMN "public"."orders"."recipient_phone" IS 'Recipient phone captured when placing this order.';

COMMENT ON COLUMN "public"."user_addresses"."recipient_name" IS 'Name of the recipient at this saved address.';

COMMENT ON COLUMN "public"."user_addresses"."recipient_phone" IS 'Recipient phone number, stored as text to retain leading zero or country prefix.';

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';

REVOKE ALL ON FUNCTION "private"."account_phone_key"(text) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."can_read_restaurant_review_photo"(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."can_read_restaurant_review_photo"(text) TO "authenticated";

REVOKE ALL ON FUNCTION "private"."driver_bridge_order"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."driver_cod"(text, text, numeric) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."driver_expire_offers"(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."driver_log_event"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."driver_payout_quote"(uuid, double precision, double precision) FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."driver_reject_insert_assignment"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."driver_require_approved"() FROM PUBLIC;

REVOKE ALL ON FUNCTION "private"."food_review_stats"(uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."food_review_stats"(uuid[]) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "private"."submit_order_review"(uuid, text, integer, text, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "private"."submit_order_review"(uuid, text, integer, text, text, jsonb) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."admin_driver_assign"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_driver_assign"(uuid, uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_driver_assign"(uuid, uuid) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_driver_migrate_order"(uuid, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_driver_migrate_order"(uuid, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_driver_migrate_order"(uuid, boolean) TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_driver_resolve"(uuid, text, text, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_driver_resolve"(uuid, text, text, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."admin_driver_resolve"(uuid, text, text, boolean) TO "service_role";

GRANT EXECUTE ON FUNCTION "public"."collect_my_voucher"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."collect_my_voucher"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."collect_my_voucher"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text, double precision, double precision, numeric) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text, double precision, double precision, numeric) TO "postgres";

REVOKE ALL ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text, double precision, double precision, numeric, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text, double precision, double precision, numeric, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text, double precision, double precision, numeric, text, text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text, double precision, double precision, numeric, text, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_food_order"(uuid, jsonb, text, text, double precision, double precision, numeric, text, text, text) TO "postgres";

REVOKE ALL ON FUNCTION "public"."create_food_order_at_location"(uuid, jsonb, text, text, double precision, double precision) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."create_food_order_at_location"(uuid, jsonb, text, text, double precision, double precision) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_my_address"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."delete_my_address"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."delete_my_address"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_dashboard"() TO "authenticated";

REVOKE ALL ON FUNCTION "public"."driver_dashboard"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_dashboard"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_messages"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."driver_messages"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_messages"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_save_profile"(text, text, text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."driver_save_profile"(text, text, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_save_profile"(text, text, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_send_message"(uuid, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."driver_send_message"(uuid, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_send_message"(uuid, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_set_online"(boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."driver_set_online"(boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_set_online"(boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_step"(uuid, text, text, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."driver_step"(uuid, text, text, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_step"(uuid, text, text, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_update_location"(double precision, double precision, double precision) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."driver_update_location"(double precision, double precision, double precision) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."driver_update_location"(double precision, double precision, double precision) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."food_review_stats"(uuid[]) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."food_review_stats"(uuid[]) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."food_review_stats"(uuid[]) TO "postgres";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."order_delivery_progress"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."order_delivery_progress"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."order_delivery_progress"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."order_driver_location"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."order_driver_location"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."order_driver_location"(uuid) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."restaurant_review_feed"(uuid, text, integer, boolean, boolean, integer, integer) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."restaurant_review_feed"(uuid, text, integer, boolean, boolean, integer, integer) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."restaurant_review_feed"(uuid, text, integer, boolean, boolean, integer, integer) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."restaurant_review_summary"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."restaurant_review_summary"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."restaurant_review_summary"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."save_my_address"(uuid, text, text, double precision, double precision, boolean, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."save_my_address"(uuid, text, text, double precision, double precision, boolean, boolean) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."save_my_address"(uuid, text, text, double precision, double precision, boolean, boolean, text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."save_my_address"(uuid, text, text, double precision, double precision, boolean, boolean, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."save_my_address"(uuid, text, text, double precision, double precision, boolean, boolean, text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."signup_account_exists"(text, text) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."signup_account_exists"(text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."signup_account_exists"(text, text) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_order_review"(uuid, text, integer, text, text, jsonb) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."submit_order_review"(uuid, text, integer, text, text, jsonb) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."submit_order_review"(uuid, text, integer, text, text, jsonb) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."update_my_profile"(text, text, text) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."update_my_profile"(text, text, text) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."update_my_profile"(text, text, text) TO "postgres";

GRANT USAGE ON SCHEMA "private" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."banners" FROM "anon";

GRANT SELECT ON TABLE "public"."banners" TO "anon";

REVOKE ALL ON TABLE "public"."banners" FROM "authenticated";

GRANT SELECT ON TABLE "public"."banners" TO "authenticated";

REVOKE ALL ON TABLE "public"."banners" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."banners" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."banners" TO "service_role";

REVOKE ALL ON TABLE "public"."calls" FROM "authenticated";

GRANT SELECT ON TABLE "public"."calls" TO "authenticated";

REVOKE ALL ON TABLE "public"."calls" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."calls" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."calls" TO "service_role";

REVOKE ALL ON TABLE "public"."categories" FROM "anon";

GRANT SELECT ON TABLE "public"."categories" TO "anon";

REVOKE ALL ON TABLE "public"."categories" FROM "authenticated";

GRANT SELECT ON TABLE "public"."categories" TO "authenticated";

REVOKE ALL ON TABLE "public"."categories" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categories" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categories" TO "service_role";

REVOKE ALL ON TABLE "public"."delivery_assignments" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."delivery_assignments" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."delivery_assignments" TO "service_role";

REVOKE ALL ON TABLE "public"."delivery_events" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."delivery_events" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."delivery_events" TO "service_role";

REVOKE ALL ON TABLE "public"."discovery_categories" FROM "anon";

GRANT SELECT ON TABLE "public"."discovery_categories" TO "anon";

REVOKE ALL ON TABLE "public"."discovery_categories" FROM "authenticated";

GRANT SELECT ON TABLE "public"."discovery_categories" TO "authenticated";

REVOKE ALL ON TABLE "public"."discovery_categories" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."discovery_categories" TO "postgres";

REVOKE ALL ON TABLE "public"."discovery_categories" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."discovery_categories" TO "service_role";

REVOKE ALL ON TABLE "public"."driver_ledger_entries" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."driver_ledger_entries" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."driver_ledger_entries" TO "service_role";

REVOKE ALL ON TABLE "public"."driver_locations" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."driver_locations" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."driver_locations" TO "service_role";

REVOKE ALL ON TABLE "public"."driver_presence" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."driver_presence" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."driver_presence" TO "service_role";

REVOKE ALL ON TABLE "public"."driver_profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."driver_profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."driver_profiles" TO "service_role";

REVOKE ALL ON TABLE "public"."driver_settings" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."driver_settings" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."driver_settings" TO "service_role";

REVOKE ALL ON TABLE "public"."favorites" FROM "authenticated";

GRANT DELETE, INSERT, SELECT ON TABLE "public"."favorites" TO "authenticated";

REVOKE ALL ON TABLE "public"."favorites" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."favorites" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."favorites" TO "service_role";

REVOKE ALL ON TABLE "public"."food_discovery_categories" FROM "anon";

GRANT SELECT ON TABLE "public"."food_discovery_categories" TO "anon";

REVOKE ALL ON TABLE "public"."food_discovery_categories" FROM "authenticated";

GRANT SELECT ON TABLE "public"."food_discovery_categories" TO "authenticated";

REVOKE ALL ON TABLE "public"."food_discovery_categories" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."food_discovery_categories" TO "postgres";

REVOKE ALL ON TABLE "public"."food_discovery_categories" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."food_discovery_categories" TO "service_role";

REVOKE ALL ON TABLE "public"."food_option_groups" FROM "anon";

GRANT SELECT ON TABLE "public"."food_option_groups" TO "anon";

REVOKE ALL ON TABLE "public"."food_option_groups" FROM "authenticated";

GRANT SELECT ON TABLE "public"."food_option_groups" TO "authenticated";

REVOKE ALL ON TABLE "public"."food_option_groups" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."food_option_groups" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."food_option_groups" TO "service_role";

REVOKE ALL ON TABLE "public"."food_option_items" FROM "anon";

GRANT SELECT ON TABLE "public"."food_option_items" TO "anon";

REVOKE ALL ON TABLE "public"."food_option_items" FROM "authenticated";

GRANT SELECT ON TABLE "public"."food_option_items" TO "authenticated";

REVOKE ALL ON TABLE "public"."food_option_items" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."food_option_items" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."food_option_items" TO "service_role";

REVOKE ALL ON TABLE "public"."food_reviews" FROM "authenticated";

GRANT SELECT ON TABLE "public"."food_reviews" TO "authenticated";

REVOKE ALL ON TABLE "public"."food_reviews" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."food_reviews" TO "postgres";

REVOKE ALL ON TABLE "public"."food_reviews" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."food_reviews" TO "service_role";

REVOKE ALL ON TABLE "public"."foods" FROM "anon";

GRANT SELECT ON TABLE "public"."foods" TO "anon";

REVOKE ALL ON TABLE "public"."foods" FROM "authenticated";

GRANT SELECT ON TABLE "public"."foods" TO "authenticated";

REVOKE ALL ON TABLE "public"."foods" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."foods" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."foods" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."messages" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "service_role";

REVOKE ALL ON TABLE "public"."notifications" FROM "authenticated";

GRANT SELECT ON TABLE "public"."notifications" TO "authenticated";

REVOKE ALL ON TABLE "public"."notifications" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."notifications" TO "service_role";

REVOKE ALL ON TABLE "public"."order_items" FROM "authenticated";

GRANT SELECT ON TABLE "public"."order_items" TO "authenticated";

REVOKE ALL ON TABLE "public"."order_items" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."order_items" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."order_items" TO "service_role";

REVOKE ALL ON TABLE "public"."orders" FROM "authenticated";

GRANT SELECT ON TABLE "public"."orders" TO "authenticated";

REVOKE ALL ON TABLE "public"."orders" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."orders" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."orders" TO "service_role";

REVOKE ALL ON TABLE "public"."profiles" FROM "authenticated";

GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

REVOKE ALL ON TABLE "public"."restaurants" FROM "anon";

GRANT SELECT ON TABLE "public"."restaurants" TO "anon";

REVOKE ALL ON TABLE "public"."restaurants" FROM "authenticated";

GRANT SELECT ON TABLE "public"."restaurants" TO "authenticated";

REVOKE ALL ON TABLE "public"."restaurants" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurants" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."restaurants" TO "service_role";

REVOKE ALL ON TABLE "public"."reviews" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."reviews" TO "anon";

REVOKE ALL ON TABLE "public"."reviews" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."reviews" TO "authenticated";

REVOKE ALL ON TABLE "public"."reviews" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reviews" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."reviews" TO "service_role";

REVOKE ALL ON TABLE "public"."user_addresses" FROM "anon";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."user_addresses" TO "anon";

REVOKE ALL ON TABLE "public"."user_addresses" FROM "authenticated";

GRANT MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE ON TABLE "public"."user_addresses" TO "authenticated";

REVOKE ALL ON TABLE "public"."user_addresses" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_addresses" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_addresses" TO "service_role";

REVOKE ALL ON TABLE "public"."user_vouchers" FROM "authenticated";

GRANT SELECT ON TABLE "public"."user_vouchers" TO "authenticated";

REVOKE ALL ON TABLE "public"."user_vouchers" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_vouchers" TO "postgres";

REVOKE ALL ON TABLE "public"."user_vouchers" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."user_vouchers" TO "service_role";

REVOKE ALL ON TABLE "public"."vouchers" FROM "anon";

GRANT SELECT ON TABLE "public"."vouchers" TO "anon";

REVOKE ALL ON TABLE "public"."vouchers" FROM "authenticated";

GRANT SELECT ON TABLE "public"."vouchers" TO "authenticated";

REVOKE ALL ON TABLE "public"."vouchers" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vouchers" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vouchers" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "service_role";

SELECT cron.schedule_in_database('subifood-driver-expire-offers', '* * * * *', 'select private.driver_expire_offers();', 'postgres', NULL, true);

CREATE UNIQUE INDEX profiles_phone_unique ON public.profiles USING btree (private.account_phone_key(phone));

