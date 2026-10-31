# Bàn giao tích hợp app tài xế với SubiFood

Ngày: 30/10/2026.

Tài liệu để nhóm app khách và app tài xế thống nhất database, API và luồng vận hành trước khi triển khai.

## 1. Phạm vi và trạng thái kiểm tra

- App khách: SubiFood, thư mục `D:\TBDD\btl\food-delivery`.
- Supabase project ref: `glchegbogadnllehcnzf`.
- File tài xế được đọc: `D:\TBDD\soopi_driver_import.sql`, 362 dòng.
- Nguồn đối chiếu: file SQL trên và mã nguồn app khách hiện tại, gồm `src/types/database.types.ts`, `src/types/supabase.ts`, `src/services/purchaseApi.ts`, `src/hooks/useOrderTracking.ts` và các migration.
- Chưa chạy file tài xế lên database, chưa sửa file đó và chưa kiểm thử thực thi migration này. Đây là đánh giá tĩnh, không phải xác nhận trạng thái hiện tại của database production.
- Chưa tạo bản backup. Cần backup và thử khôi phục trên môi trường riêng trước khi chạy migration chính thức.

## 2. Database app khách hiện tại

File kiểu dữ liệu hiện tại mô tả 20 bảng public, không còn là 16 bảng ban đầu:

| Nhóm | Bảng |
| --- | --- |
| Hồ sơ và địa chỉ | `profiles`, `user_addresses` |
| Nhà hàng và thực đơn | `restaurants`, `categories`, `foods`, `food_option_groups`, `food_option_items` |
| Khám phá và banner | `discovery_categories`, `food_discovery_categories`, `banners` |
| Đơn hàng | `orders`, `order_items` |
| Khuyến mãi | `vouchers`, `user_vouchers` |
| Đánh giá | `reviews`, `food_reviews` |
| Yêu thích | `favorites` |
| Liên lạc và thông báo | `messages`, `calls`, `notifications` |

Không lấy tài liệu này thay cho toàn bộ schema. Cần đọc file types và kiểm tra metadata database thực tế trước khi áp dụng migration.

### Danh tính người dùng và tài xế

- Hai app dùng chung Supabase Auth và UUID tài khoản.
- `profiles.id` liên kết với `auth.users.id`.
- `orders.user_id` là khách đặt đơn; `orders.driver_id` là UUID hồ sơ tài xế, không phải ID của chuyến giao.
- Quyền tài xế dựa vào `profiles.role` do phía quản trị kiểm soát. Không tin `user_metadata.role` từ client.
- Trigger đăng ký hiện tại tạo hồ sơ với vai trò `user`. Đăng ký trong app tài xế không tự trở thành tài xế được duyệt.
- Luồng dự kiến: đăng ký -> quản trị gán vai trò `driver` -> hồ sơ tài xế ở trạng thái `pending` -> quản trị duyệt `approved`.
- Đăng ký email/mật khẩu hiện bắt buộc gửi tên và số điện thoại trong metadata `full_name`, `phone`.
- Hồ sơ hiện có unique index số điện thoại chuẩn hóa: `081...` và `+8481...` được xem là một số. Google/Facebook có thể chưa có số điện thoại.
- Không dùng `user_addresses.recipient_phone` để xác định tài khoản: người nhận có thể là người khác.

### Hóa đơn và địa chỉ giao hàng

| Trường | Ý nghĩa |
| --- | --- |
| `orders.restaurant_id` | Quán của đơn |
| `orders.subtotal` | Tiền hàng trước các khoản giảm voucher của hóa đơn |
| `orders.delivery_fee` | Phí giao hàng khách phải trả trước giảm phí ship |
| `orders.food_discount_amount` | Khoản giảm voucher tiền món |
| `orders.shipping_discount_amount` | Khoản giảm voucher phí giao hàng |
| `orders.total` | Tổng tiền cuối cùng do RPC checkout tính |
| `orders.recipient_name`, `recipient_phone` | Thông tin người nhận được chụp tại lúc đặt |
| `orders.delivery_address`, `latitude`, `longitude` | Địa chỉ và tọa độ giao hàng của khách |
| `restaurants.latitude`, `longitude` | Điểm lấy món tại quán |
| `order_items.options_snapshot` | Cấu hình lựa chọn/topping đã đặt, không truy lại cấu hình menu hiện tại |

Tất cả khoản tiền đang dùng VND. Phí ship tính theo khoảng cách được kiểm tra phía database; không để app tài xế tính lại hoặc ghi đè hóa đơn.

App khách tạo đơn qua RPC `create_food_order`, không insert trực tiếp `orders` và `order_items`. Checkout hiện tạo đơn thanh toán `cash`. Các cột cũ như `payment_method`, tọa độ và thông tin người nhận có thể null ở dữ liệu lịch sử.

Không ghi tọa độ tài xế vào `orders.latitude/longitude`: đó là tọa độ giao hàng của khách.

## 3. File tài xế đang đề xuất thêm gì?

### Bảng mới: 7 bảng

| Bảng | Mục đích |
| --- | --- |
| `driver_profiles` | Duyệt tài xế, loại xe, biển số |
| `driver_presence` | Bật/tắt nhận đơn và thời gian hoạt động |
| `driver_locations` | Tọa độ GPS mới nhất của tài xế |
| `driver_settings` | Tiền công mỗi chuyến và thời hạn nhận đề nghị |
| `delivery_assignments` | Đề nghị/chuyến giao giữa một đơn và một tài xế |
| `delivery_events` | Nhật ký thay đổi trạng thái chuyến |
| `driver_ledger_entries` | Sổ tiền công và tiền thu hộ |

Thêm vào `orders`: `payment_status` mặc định `unpaid`, và `completed_at`.

Thêm 11 hàm, trong đó 3 hàm nội bộ (`driver_require_approved`, `driver_log_event`, `driver_bridge_order`) và 8 RPC cho ứng dụng. Có 2 trigger ghi sự kiện chuyến và nối thay đổi đơn với phân công tài xế.

### RPC app tài xế theo file hiện tại

| RPC | Cách dùng |
| --- | --- |
| `driver_dashboard()` | Lấy hồ sơ, trạng thái online, chuyến, sổ tiền và đánh giá |
| `driver_set_online(p_online)` | Bật/tắt nhận đơn |
| `driver_update_location(p_latitude,p_longitude,p_accuracy)` | Gửi GPS, yêu cầu tài xế được duyệt và đang online |
| `driver_step(p_assignment_id,p_action,p_reason,p_cod_confirmed)` | Thực hiện bước trong chuyến |
| `driver_save_profile(p_full_name,p_phone,p_vehicle_type,p_plate_number)` | Sửa thông tin cá nhân/xe, không có quyền sửa vai trò hoặc tự duyệt |
| `driver_messages(p_assignment_id)` | Lấy tin nhắn của chuyến đang thực hiện |
| `driver_send_message(p_assignment_id,p_content)` | Gửi tin nhắn dưới vai trò tài xế |

RPC phía khách mới: `order_driver_location(p_order_id)`, chỉ trả vị trí của tài xế thuộc đơn của chính khách và trong trạng thái cho phép.

Client dùng public/publishable key + phiên đăng nhập. Không đưa `service_role` hoặc mật khẩu database vào bất kỳ app nào.

Các bảng tài xế mới bật RLS và thu hồi quyền trực tiếp của `anon`/`authenticated`. App phải dùng RPC đã cấp quyền. File này chưa cấu hình publication/SELECT để app đăng ký Realtime trực tiếp các bảng mới; cần thiết kế riêng nếu muốn dùng WebSocket. Không giải quyết bằng cách mở quyền đọc toàn bộ bảng.

## 4. Luồng trạng thái cần thống nhất

`orders.status` là trạng thái tổng quan của khách. `delivery_assignments.status` là bước công việc của tài xế. Không dùng hai trường thay thế nhau.

| Thao tác | Trạng thái chuyến | Trạng thái đơn mong đợi |
| --- | --- | --- |
| Quản trị phân công | `offered` | `preparing` |
| Tài xế nhận | `accepted` | `preparing` |
| Đến quán | `at_restaurant` | `preparing` |
| Lấy món | `picked_up` | `delivering` |
| Đến khách | `at_customer` | `delivering` |
| Giao thành công | `delivered` | `completed` |
| Từ chối đề nghị | `rejected` | Bỏ phân công, chờ điều phối |
| Hết hạn đề nghị | `expired` | Bỏ phân công, chờ điều phối |
| Giao thất bại | `failed` | Giữ thông tin để quản trị xử lý, không tự xem là đã thanh toán |

- `p_assignment_id` là `delivery_assignments.id`, không phải `orders.id`.
- Mỗi tài xế chỉ có một chuyến đang hoạt động theo unique index của file hiện tại, kể cả đề nghị `offered`.
- Giao COD cần xác nhận đã thu tiền trước khi kết thúc.
- Trạng thái hoàn tất, xác nhận thu tiền và ghi sổ phải nằm trong cùng transaction.
- Không tự retry một bước làm việc mới bằng cách nhảy qua các trạng thái. Thiết kế idempotency/retry cho từng thao tác.
- Quản trị cần một luồng xử lý ngoại lệ có lý do và nhật ký, nhất là khi đã lấy món.

## 5. Các việc cần sửa trước khi chạy database chính

### P1 — Chuyển đơn cũ đã gán tài xế

Vị trí nguồn: SQL dòng 142–189. Trigger chỉ chạy khi UPDATE làm thay đổi `orders.driver_id`. File chưa có bước tạo chuyến cho các đơn đã gán trước thời điểm import, cũng không tạo chuyến khi INSERT đơn có sẵn driver_id.

Yêu cầu:
- Có bước chuyển dữ liệu riêng, chạy lại không tạo trùng.
- Đơn `pending`/`preparing` đã gán: tạo đề nghị mới, tài xế xác nhận nhận chuyến.
- Đơn `delivering`: quản trị xác minh đã lấy món trước khi chuyển sang chuyến `picked_up`; giữ nguyên trạng thái đơn.
- Đơn `completed`/`cancelled`: không tạo đề nghị hoạt động hay tự phát sinh tiền công lịch sử.
- Chốt việc có cho INSERT đơn kèm driver_id hay bắt buộc tạo đơn rồi phân công bằng UPDATE.

Tiêu chí đạt: đơn cũ đang hoạt động hiển thị đúng trên app tài xế, chạy chuyển dữ liệu lần hai không nhân đôi chuyến.

### P2 — Luồng quản trị và trạng thái

Vị trí nguồn: SQL dòng 168–180 và 215–271. Trigger sẽ chặn một số cập nhật thủ công của quản trị khi có chuyến đang hoạt động.

Yêu cầu:
- Hai app tuân thủ bảng trạng thái mục 4.
- Xây luồng quản trị xử lý mất kết nối, đổi tài xế, hủy và giao thất bại; không đơn giản gỡ trigger để vượt kiểm tra.
- Quyền quản trị không được suy ra từ dữ liệu metadata do client tự sửa.
- Chốt quy tắc đối với `payment_method` null/không hợp lệ và dữ liệu cũ. Không để biểu thức SQL với null vô tình bỏ qua kiểm tra thanh toán.
- `payment_status='unpaid'` thêm mới không phải bằng chứng rằng các đơn lịch sử chưa thanh toán. Chỉ chuyển dữ liệu thanh toán khi có căn cứ.

Tiêu chí đạt: nhận -> đến quán -> lấy món -> đến khách -> giao thành công đồng bộ đúng app khách; lỗi ở bước ghi sổ không để đơn hoàn tất nửa chừng.

### P3 — Hết hạn đề nghị phía máy chủ

Vị trí nguồn: SQL dòng 278–284. Hiện việc dọn đề nghị hết hạn nằm trong `driver_dashboard()` của chính tài xế. Tài xế không mở app thì việc dọn không tự chạy.

Yêu cầu:
- Tạo hàm nội bộ xử lý `offered` đã quá `expires_at`, chạy bởi tác vụ máy chủ định kỳ.
- Khóa đơn trước, chuyến sau, cùng thứ tự với hàm nhận chuyến.
- Kiểm tra lại trạng thái sau khi khóa; không làm hết hạn chuyến vừa được nhận.
- Chỉ bỏ driver_id nếu đơn vẫn gắn đúng tài xế và đúng đề nghị đang hết hạn.
- Ghi sự kiện hết hạn và đưa đơn về danh sách chờ điều phối; chưa tự chọn tài xế khác nếu chưa có quy tắc.

Tiêu chí đạt: đóng app tài xế vẫn hết hạn được; nhận chuyến đồng thời với tác vụ hết hạn không làm sai phân công.

### P4 — Cấu hình tiền công

Vị trí nguồn: SQL dòng 36–42 và 161–165. `payout_per_delivery` hiện mặc định 0 và được chụp vào chuyến lúc phân công.

Yêu cầu:
- Chặn tạo đề nghị nếu chưa cấu hình mức tiền công được thống nhất. Nên biểu diễn riêng trạng thái chưa cấu hình thay vì âm thầm dùng 0.
- Tiền công là khoản riêng với phí ship khách trả và tiền COD thu hộ.
- Đổi cấu hình chỉ áp dụng chuyến mới, không sửa mức đã ghi nhận cho chuyến cũ.
- Mức trả cụ thể cần chủ dự án chốt, không tự đặt theo phí ship hoặc tổng đơn.

Tiêu chí đạt: một chuyến chỉ ghi tiền công/thu hộ một lần khi gửi lại yêu cầu hoàn tất.

### P5 — Duyệt tài xế có kiểm soát

Vị trí nguồn: SQL dòng 84–89. File tự chèn `approved` cho mọi hồ sơ cũ đang có role `driver`.

Yêu cầu:
- Mặc định nhập hồ sơ cũ ở trạng thái `pending`.
- Quản trị duyệt danh sách UUID cụ thể sau khi kiểm tra.
- Người dùng không thể tự sửa role/approval_status thông qua app hoặc RPC hồ sơ.

Tiêu chí đạt: user thường, driver pending và driver suspended không gọi được chức năng nhận/giao chuyến; driver approved chỉ thao tác chuyến của mình.

### P6 — Giới hạn dữ liệu cá nhân trong dashboard

Vị trí nguồn: SQL dòng 290–303. Tên/số điện thoại có điều kiện theo trạng thái nhưng địa chỉ giao và tọa độ chính xác vẫn được trả cho cả đề nghị đã từ chối/hết hạn/hủy trong lịch sử.

Yêu cầu:
- `offered`: chỉ trả khu vực giao, thông tin khoảng cách và số tiền cần biết để nhận chuyến; không trả tên/số điện thoại/địa chỉ chính xác của khách.
- `accepted`/`at_restaurant`/`picked_up`/`at_customer`: trả thông tin cần giao hàng khi `orders.driver_id` vẫn đúng tài xế hiện tại.
- Chuyến kết thúc hoặc bị điều phối lại: ẩn liên hệ và địa chỉ/tọa độ giao chính xác, giữ lịch sử thời gian/trạng thái/tiền.
- Thực hiện giới hạn ngay trong RPC, không chỉ ẩn trên UI.
- Nếu cần lưu bằng chứng địa điểm giao cho tranh chấp, tách quyền quản trị khỏi payload lịch sử của tài xế.

Tiêu chí đạt: tài xế khác, tài xế cũ sau điều phối lại và chuyến bị từ chối không nhận được dữ liệu liên hệ giao hàng.

## 6. Việc phải nối thêm ở app khách

- `src/hooks/useOrderTracking.ts` hiện vẫn mô phỏng xe chạy 40 giây bằng nội suy khi đơn chuyển `delivering`.
- Cần nối `order_driver_location(orderId)` và dùng tọa độ tài xế thật khi RPC có dữ liệu hợp lệ.
- Kiểm tra `received_at`; tọa độ cũ phải được báo là chưa cập nhật, không trình bày như vị trí tức thời.
- Trong khi chưa có GPS, hiển thị trạng thái chờ vị trí; nếu còn chế độ mô phỏng phục vụ đồ án thì phải thể hiện rõ.
- Realtime trạng thái đơn và chat hiện có không đồng nghĩa GPS từ bảng mới đã được tích hợp.
- Sau khi chốt/apply migration, cập nhật lại `database.types.ts` và adapter `src/types/supabase.ts` từ schema thực tế. Tài liệu này chưa thực hiện cập nhật đó.
- Không cần thay RPC checkout của app khách nếu hợp đồng hiện tại vẫn được giữ; phải kiểm thử lại checkout sau khi thêm trigger.

## 7. Kế hoạch thực hiện đề xuất

1. Hai nhóm thống nhất tài liệu này và sửa P1–P6 trong migration tài xế.
2. Sao lưu database và lưu cấu hình/policies hiện tại; giữ backup ngoài Git. Database dump không chứa nội dung ảnh bucket, cấu hình OAuth hay secrets.
3. Khôi phục trên môi trường thử riêng; xác minh khôi phục thành công trước khi thử migration.
4. Chạy migration đã sửa trên môi trường thử, không trên database chính.
5. Thử một đơn COD mới từ app khách qua đầy đủ các bước của tài xế, chat, cập nhật GPS và đánh giá.
6. Thử các tình huống: đơn cũ, hết hạn khi app đóng, từ chối, đổi tài xế, giao thất bại, mất mạng/retry, driver chưa duyệt, truy cập chuyến người khác.
7. Chỉ sau khi đạt mới triển khai migration lên database chính và cập nhật types của hai app.

Không gửi mật khẩu database, khóa service_role hoặc backup chứa dữ liệu tài khoản trong nhóm chat công khai. Không chạy `tests/fixtures/schema.sql` lên database chính: đó là fixture kiểm thử có lệnh xóa bảng.
