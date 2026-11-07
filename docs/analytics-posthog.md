# Giám sát sử dụng soopiFood bằng PostHog

## Cấu hình app

Project đang chọn: US, ID `717951`. Vào PostHog → Settings → Project → Project API Key và lấy khóa thu thập công khai `phc_...`. Trong `.env` của app thêm:

```dotenv
EXPO_PUBLIC_POSTHOG_KEY=phc_DIEN_PROJECT_API_KEY
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
EXPO_PUBLIC_ANALYTICS_ENABLED=true
EXPO_PUBLIC_ANALYTICS_ENVIRONMENT=development
```

EU dùng `https://eu.i.posthog.com`. Không dùng Personal API Key cho app. Khi chưa có key đúng, analytics tự tắt và app tiếp tục hoạt động. Sau khi đổi cấu hình khởi động lại Metro `npx expo start --clear`.

Với APK phát hành: đặt các biến tương ứng trong EAS environment mà profile build sử dụng, riêng `EXPO_PUBLIC_ANALYTICS_ENVIRONMENT=production` (hoặc `preview` cho bản demo riêng). Các biến EXPO_PUBLIC được đóng gói khi build, thay `.env` không sửa APK đã cài. Nếu để trống environment: bản dev là `development`, bản release là `production`.

## Dữ liệu đã gắn vào code

| Event | Ý nghĩa |
| --- | --- |
| `app_opened` | Một lần khi khởi động, hoặc quay lại sau ít nhất 30 phút ở nền; không cộng khi render lại |
| `screen_viewed` | Màn hình mới theo Expo Router; chỉ tên chuẩn hóa, không URL/query/UUID route |
| `search_submitted` | Từ khóa ổn định 1 giây và kết quả sẵn sàng, ở Home hoặc Search/Category |
| `food_added_to_cart` | Thêm món từ chi tiết món thành công; không đếm khôi phục giỏ hay sửa ghi chú |
| `checkout_started` | Vào màn hình thanh toán với giỏ không rỗng; một lần mỗi lượt vào |
| `order_created` | RPC tạo đơn trả thành công, dùng tổng tiền từ database; UUID event cố định theo order để hỗ trợ chống đếm trùng |

Thuộc tính chung: `app=soopifood-customer`, `platform`, `environment`, `authenticated`, `event_version`. Định danh tài khoản bằng UUID, không gửi email/tên/số điện thoại. Logout/chuyển tài khoản reset identity. DAU/MAU mặc định chỉ đếm tài khoản đăng nhập; khách chưa đăng nhập không được đưa vào hai biểu đồ này.

Không gửi từ khóa tìm kiếm, địa chỉ, tọa độ, ghi chú món, nội dung chat, mật khẩu hoặc token. Không bật autocapture thao tác, session replay hay exception autocapture. GeoIP tắt. SDK dùng hàng đợi AsyncStorage (tối đa 100 event), gửi theo lô tối đa mỗi 30 giây, flush lúc xuống nền hoặc tạo đơn. Thiết bị offline/chặn analytics hoặc bị tắt đột ngột có thể làm thiếu sự kiện; số đơn và doanh thu chính thức lấy từ Supabase. Reset/logout có thể làm mất một phần sự kiện đang chờ; ưu tiên tách đúng identity.

## Tạo dashboard có biểu đồ

Script chỉ tạo dashboard/insight có nhãn `soopifood-usage-v1`, không sửa hoặc xóa biểu đồ mặc định. Chạy lại sẽ giữ các biểu đồ đã tạo. Bảy biểu đồ: lượt mở app, DAU, MAU theo tháng lịch, màn hình, tìm kiếm, sự kiện giỏ/checkout/đơn và funnel chuyển đổi.

1. Sao chép `.env.posthog.example` thành `.env.posthog.local` (file này đã bị Git bỏ qua).
2. Tạo Personal API Key trên PostHog với quyền đọc/ghi dashboards và insights của đúng project. Chỉ điền khóa `phx_...` vào `POSTHOG_PERSONAL_API_KEY` trong file local, không gửi vào chat hoặc đặt vào EXPO_PUBLIC.
3. Chọn `POSTHOG_DASHBOARD_ENVIRONMENT=development` khi kiểm thử Expo Go, `production` cho APK phát hành.
4. Chạy:

```powershell
npm run analytics:dashboard
```

Script in đường dẫn dashboard sau khi tạo. Xem cấu hình không gọi mạng: `npm run analytics:dashboard:preview`.

Có thể tạo thủ công trong Dashboards với đúng tên event ở trên: filter `app=soopifood-customer` và environment mong muốn; DAU/MAU dùng Unique users của `screen_viewed` với `authenticated=true`. MAU dùng khoảng thời gian 6 tháng và nhóm theo tháng, không cộng các DAU. Funnel: `food_added_to_cart` → `checkout_started` → `order_created`, cửa sổ 1 ngày. `screen_viewed` breakdown theo `screen_name`; tìm kiếm breakdown theo `source`.

## Kiểm tra dữ liệu thật

Vào Activity, mở app và chuyển vài màn hình; tìm kiếm rồi đợi 1 giây; thêm món, mở checkout. Sau tối đa khoảng 30 giây hoặc đưa app xuống nền, kiểm tra các event cùng properties. Đặt một đơn kiểm thử nếu muốn kiểm tra `order_created`; script setup không tự đặt đơn, không chèn dữ liệu thống kê giả. Đăng xuất rồi đăng nhập tài khoản khác để kiểm tra distinct ID đổi. Development không xuất hiện trong dashboard production.

Dashboard rỗng trước khi có event là bình thường. Dashboard sử dụng không thay thế kiểm thử tải hay giám sát CPU/database/Gemini.

Tài liệu chính thức: [SDK React Native](https://posthog.com/docs/libraries/react-native), [Dashboards API](https://posthog.com/docs/api/dashboards), [Insights API](https://posthog.com/docs/api/insights), [Query API](https://posthog.com/docs/api/queries).
