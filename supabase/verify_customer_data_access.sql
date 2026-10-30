-- Read-only metadata verification after harden_customer_data_access.sql.
-- Does not query customer rows or perform API writes.
select c.relname as table_name,c.relrowsecurity as rls_enabled,
  r.role_name,
  has_table_privilege(r.role_name,c.oid,'SELECT') as can_select,
  has_table_privilege(r.role_name,c.oid,'INSERT') as can_insert,
  has_table_privilege(r.role_name,c.oid,'UPDATE') as can_update,
  has_table_privilege(r.role_name,c.oid,'DELETE') as can_delete,
  has_table_privilege(r.role_name,c.oid,'TRUNCATE') as can_truncate,
  has_any_column_privilege(r.role_name,c.oid,'INSERT,UPDATE,REFERENCES') as any_column_write
from pg_class c join pg_namespace n on n.oid=c.relnamespace
cross join (values ('anon'),('authenticated')) r(role_name)
where n.nspname='public' and c.relkind='r'
  and c.relname in ('banners','categories','food_option_groups','food_option_items',
    'foods','restaurants','vouchers','profiles','orders','order_items',
    'favorites','calls','notifications')
order by c.relname,r.role_name;

-- Run separately if SQL Editor only shows the last result set.
select tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='public'
order by tablename,policyname;
