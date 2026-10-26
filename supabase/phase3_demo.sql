-- DEMO ONLY: this targets the existing Phase 2 test order labelled KHONG GIAO HANG.
-- Run while its Chat screen is open to see the driver message arrive without reload.
-- The sender FK uses the test customer's real auth ID; sender_type='driver' is
-- inserted only by the privileged Dashboard, never by the customer app.
insert into public.messages(id,order_id,sender_id,sender_type,message_type,content)
select '0c50168e-0d0c-4ed0-9d09-000000000003', o.id, o.user_id, 'driver', 'text',
  '[MO PHONG PHA 3] Tai xe da nhan don, toi dang tren duong giao hang.'
from public.orders o
where o.id = '0805d837-1e73-4aea-bca2-0f6f958f54aa'
  and o.delivery_address like '%KHONG GIAO HANG%'
on conflict(id) do nothing;

-- Sample destination is an offset from the restaurant, not a person's GPS.
-- Simulation runs only in the UI; no paid route service or driver app is used.
update public.orders o set status='delivering', latitude=r.latitude+0.003, longitude=r.longitude+0.003
from public.restaurants r
where r.id=o.restaurant_id
  and o.id='0805d837-1e73-4aea-bca2-0f6f958f54aa'
  and o.delivery_address like '%KHONG GIAO HANG%'
  and r.latitude between -89 and 89 and r.longitude between -179 and 179;
