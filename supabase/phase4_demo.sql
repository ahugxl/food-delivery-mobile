-- Optional review demo: ONLY the existing labelled Phase 2 test order.
-- No real order is marked completed by the customer application.
update public.orders set status = 'completed'
where id = '0805d837-1e73-4aea-bca2-0f6f958f54aa'
  and delivery_address like '%KHONG GIAO HANG%';
