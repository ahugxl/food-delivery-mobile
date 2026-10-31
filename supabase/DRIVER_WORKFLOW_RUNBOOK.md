# Cài đặt luồng tài xế SubiFood — bước 2

## Trạng thái bàn giao

- Chưa cài bước 2 lên Supabase. Kiểm thử logic bằng PostgreSQL cục bộ đã đạt.
- Lần kiểm tra metadata trước khi soạn bước 2 chưa thấy các bảng bước 1 trong project `glchegbogadnllehcnzf`. Xác nhận bạn đang chạy đúng project.
- Không chạy `D:\TBDD\soopi_driver_import.sql` cũ.
- Chưa nối GPS thật vào giao diện app khách; RPC vị trí đã được chuẩn bị trong bước 2.
- pg_cron được mô phỏng phần đăng ký job trong kiểm thử cục bộ. Cần kiểm tra lịch chạy thật và các phiên giao dịch đồng thời trên staging sau khi cài đặt.

## Thứ tự chạy

1. Sao lưu và thử khôi phục database riêng.
2. Chạy `supabase/migrations/20261030153047_driver_foundation.sql` trong SQL Editor.
3. Chạy `supabase/migrations/20261030154146_driver_workflow.sql` trong SQL Editor trên staging trước. File sẽ tạo/bật extension pg_cron và đăng ký job mỗi phút. Nếu tài khoản không bật được extension, toàn bộ bước 2 rollback; bật pg_cron trong Supabase Integrations rồi chạy lại.
4. Kiểm tra bằng các truy vấn bên dưới.
5. Duyệt một tài xế kiểm thử, dùng đơn kiểm thử mới và thử hết một chuyến qua app tài xế.
6. Chỉ chuyển từng đơn cũ sau khi xác minh tài xế và thanh toán.

Bước foundation chạy lại được trước khi có workflow; nó chủ động dừng nếu phát hiện workflow đã cài. Bước workflow có thể chạy lại sau đó mà không tự nhân đôi job. Không xóa dữ liệu và không tự duyệt/chuyển hàng loạt đơn cũ. Nếu gặp lỗi khi chạy file, không chạy rời các câu lệnh còn lại.

## Tiền công đã được chủ dự án chốt

- Khoảng cách đường chim bay từ tọa độ quán đến tọa độ giao hàng, bằng công thức Haversine.
- Không quá 2 km: 15.000 VND.
- Vượt 2 km: cộng 5.000 VND cho mỗi km vượt quá, làm tròn lên.
- Ví dụ: 2 km = 15.000; 2,1 km = 20.000; 3,5 km = 25.000 VND.
- Không trừ voucher món hoặc voucher phí ship khỏi tiền công.
- `delivery_assignments.fee`, `distance_km`, `payout_rules` là snapshot lúc phân công. Sửa cấu hình không làm thay đổi mức đã giao cho tài xế.
- `cod_amount` là `orders.total` còn phải thu của đơn cash/unpaid; đây là tiền khách thanh toán sau ưu đãi, không phải tiền công tài xế.
- Không dùng cột cũ `payout_per_delivery` nữa.

## Xác minh sau khi cài

```sql
select payout_base_fee, payout_base_km, payout_extra_km_fee, offer_seconds
from public.driver_settings where id=true;

select jobname,schedule,command,active
from cron.job where jobname='subifood-driver-expire-offers';

select has_function_privilege('authenticated','public.driver_dashboard()','EXECUTE') as driver_rpc_allowed,
  has_function_privilege('authenticated','public.admin_driver_assign(uuid,uuid)','EXECUTE') as app_cannot_assign,
  has_table_privilege('authenticated','public.delivery_assignments','SELECT') as app_cannot_read_table;
```

Kết quả quyền mong đợi theo thứ tự: true, false, false.

Trong Supabase Cron, kiểm tra History của job có các lần chạy thành công. Kiểm tra có đề nghị hết hạn thực sự được dọn khi không mở app tài xế. Job xử lý tối đa 100 đề nghị mỗi lần; nếu tải lớn cần điều chỉnh tần suất/giới hạn sau khi đo.

## Duyệt một tài xế kiểm thử

Chạy bằng SQL Editor hoặc backend quản trị; thay UUID bằng ID tài khoản đã xác minh. Không đưa câu lệnh hoặc service_role key vào app tài xế.

```sql
begin;
update public.profiles set role='driver' where id='THAY_UUID_TAI_XE';
insert into public.driver_profiles(user_id,approval_status)
values('THAY_UUID_TAI_XE','approved')
on conflict(user_id) do update set approval_status='approved',updated_at=now();
insert into public.driver_presence(driver_id)
values('THAY_UUID_TAI_XE') on conflict do nothing;
commit;
```

Không duyệt tất cả hồ sơ có role driver cùng lúc. Đăng ký mới vẫn tạo role user, cần quản trị kiểm tra rồi duyệt.

## Phân công đơn mới

Chạy từ SQL Editor hoặc backend quản trị:

```sql
select public.admin_driver_assign('THAY_UUID_DON_HANG','THAY_UUID_TAI_XE');
```

Kết quả trả về là assignment ID. Điều kiện: đơn pending/preparing, thanh toán đã rõ, tọa độ hợp lệ, tài xế được duyệt và không có chuyến hoạt động khác.

Cho phép gửi đề nghị khi tài xế đang offline, nhưng tài xế phải bật online mới nhận được. Sau 300 giây mặc định mà chưa nhận, job sẽ hết hạn và bỏ phân công để quản trị chọn lại.

## Hợp đồng RPC cho app tài xế

Giữ public/publishable key và JWT người dùng, không dùng service_role.

```ts
await supabase.rpc('driver_set_online', { p_online: true });
const { data } = await supabase.rpc('driver_dashboard');

await supabase.rpc('driver_step', {
  p_assignment_id: assignmentId,
  p_action: 'accept',
});
```

Các action theo thứ tự: `accept` -> `arrive_restaurant` -> `pickup` -> `arrive_customer` -> `deliver`.

- `deliver` với chuyến có COD: gửi thêm `p_cod_confirmed: true` sau khi thực sự đã thu đủ tiền.
- `reject`: chỉ khi offered, `p_reason` 5–1000 ký tự.
- `fail`: khi đã nhận/đến quán/lấy món/đến khách, `p_reason` 5–1000 ký tự. Cần quản trị xử lý tiếp; không tự ghi đã thanh toán/tiền công.
- Dashboard trả `fee`, `cod_amount`, `distance_km`, `payout_rules` cho đề nghị. Thông tin người nhận, địa chỉ/tọa độ giao và chi tiết món chỉ trả khi chuyến đang thực hiện, vẫn đúng tài xế hiện tại.
- `delivery_area` hiện trả null vì schema chưa có vùng giao thô riêng. Không tự thay bằng địa chỉ đầy đủ trước khi tài xế nhận.
- Lịch sử sổ tiền tối đa 200 dòng, chuyến và đánh giá tối đa 100 dòng mỗi lần gọi; chưa có phân trang toàn bộ lịch sử.
- App không có quyền SELECT trực tiếp bảng tài xế. RPC dashboard/messages có thể gọi định kỳ; chưa cấu hình Realtime trực tiếp các bảng mới.

Chat: `driver_messages(p_assignment_id)` và `driver_send_message(p_assignment_id,p_content)`. Chỉ hoạt động trong chuyến đang thực hiện, đúng tài xế hiện tại.

GPS: `driver_update_location(p_latitude,p_longitude,p_accuracy)` khi tài xế đã được duyệt và đang online. Không ghi GPS tài xế vào orders.latitude/longitude.

App khách: `order_driver_location(p_order_id)` trả `{latitude,longitude,received_at,is_stale}` hoặc null. `is_stale=true` khi tọa độ cũ quá 2 phút. Chỉ chủ đơn được đọc trong trạng thái giao phù hợp.

## Chuyển một đơn cũ

Không chuyển đơn completed/cancelled. Đơn đang chạy có payment_status null phải được quản trị xác minh trước; không tự giả định toàn bộ đơn cũ chưa trả tiền.

Ví dụ CHỈ sau khi xác nhận một đơn COD chưa thu tiền:

```sql
update public.orders set payment_status='unpaid'
where id='THAY_UUID_DON_CU' and payment_method='cash'
  and status in ('pending','preparing','delivering') and payment_status is null;
```

Đơn đã gán driver và đang pending/preparing:

```sql
select public.admin_driver_migrate_order('THAY_UUID_DON_CU',false);
```

Đơn delivering, CHỈ sau khi quản trị xác nhận tài xế đã lấy món:

```sql
select public.admin_driver_migrate_order('THAY_UUID_DON_CU',true);
```

Tài xế phải được duyệt; nếu tài xế có nhiều đơn cũ đang hoạt động, unique index chặn chuyển tiếp. Quản trị phải xử lý từng đơn, không bỏ index. Chạy lại cùng đơn đang có chuyến sẽ trả cùng assignment ID.

Thời gian lấy món lịch sử không được suy đoán từ thời điểm chạy migration. Việc chuyển chỉ ghi sự kiện và lý do, chưa trả tiền công; tiền công chỉ được ghi khi giao thành công.

## Xử lý ngoại lệ bởi quản trị

Chỉ SQL Editor/backend quản trị được gọi:

```sql
-- Hủy đơn có sự cố; không tự coi là đã hoàn tiền.
select public.admin_driver_resolve('THAY_UUID_CHUYEN','cancel','Lý do đã xác minh ít nhất 10 ký tự',false);

-- Trả về điều phối; sau lấy món phải xác nhận món đã trả về quán.
select public.admin_driver_resolve('THAY_UUID_CHUYEN','return_to_dispatch','Quán xác nhận đã nhận lại món',true);
```

Luồng ngoại lệ ghi nhật ký, không tự xác nhận thu COD/hoàn tiền hoặc phát sinh tiền công. Các khoản tiền thực tế khi có sự cố cần đối soát riêng. Không xử lý lại chuyến đã hoàn tất bằng hai hàm này.

## Kiểm thử bắt buộc trước production

- Hai tài khoản tài xế; mỗi người chỉ thao tác chuyến của mình.
- Driver pending/suspended không sử dụng chức năng giao đơn.
- Voucher không làm giảm tiền công nhưng giảm số tiền COD phải thu đúng theo orders.total.
- Nhận chuyến đua với job hết hạn; hai phiên admin phân công cùng một tài xế.
- Gửi lại yêu cầu hoàn tất không nhân đôi tiền công và thu hộ.
- Từ chối/đổi tài xế/kết thúc chuyến làm mất quyền đọc dữ liệu giao và chat của tài xế cũ.
- Cron thực sự chạy khi không mở app; xem History thay vì chỉ kiểm tra có tên job.
- Checkout app khách vẫn tạo được đơn chưa gán tài xế.
- App khách vẫn dùng mô phỏng vị trí cho đến khi nhóm khách nối RPC GPS ở bước tiếp theo.
