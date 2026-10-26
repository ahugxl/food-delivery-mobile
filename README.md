# Food Delivery

Ứng dụng Expo Router, React Native, NativeWind, Zustand và React Query. Dùng npm và `package-lock.json` của dự án này.

## Chạy dự án

Node hiện tại của máy là 22.12.0. React Native/Metro đang cài yêu cầu Node 22.13.0 trở lên trên nhánh 22; nên cập nhật Node trước khi cài trên máy khác.

```powershell
npm ci
npm run typecheck
npm test
npm start
```

Nếu cổng mặc định đã được dùng: `npm start -- --port 8093`.

## Supabase Auth

Client nằm tại `src/services/supabase.ts`. `.env` hiện đã được cấu hình với URL/anon key do chủ dự án cung cấp và được bỏ qua bởi Git. Khi cài trên máy khác, sao chép `.env.example` thành `.env`, điền Project URL và publishable key (hoặc `EXPO_PUBLIC_SUPABASE_ANON_KEY` cho anon key cũ). Khởi động lại Expo bằng `npm start -- --clear` sau khi sửa biến môi trường. Chỉ dùng public key cho ứng dụng client.

Email/password đã nối với `signInWithPassword`, `signUp` và `signOut`. Phiên được khôi phục khi mở ứng dụng, lưu qua AsyncStorage trên native và storage mặc định trên web. Auto-refresh chạy theo vòng đời ứng dụng native. Protected routes chờ khôi phục phiên; lỗi kết nối không tạo phiên mock. Thiếu cấu hình vẫn mở được Welcome và hiển thị lỗi khi gửi form.

Đăng ký gửi `full_name` qua user metadata. Nếu bật Confirm email trên Supabase, người dùng cần xác nhận qua email rồi quay lại đăng nhập. Bước này chưa xử lý OAuth, deep link phiên hoặc đổi mật khẩu. Nút đăng nhập mạng xã hội vẫn là UI demo.

Schema 16 bảng trong `src/types/database.types.ts` được sao chép nguyên từ `D:\TBDD\btl\database.types.ts`. Bảng `profiles` có `id`, `full_name`, `phone`, `avatar_url`, `role`, `loyalty_points`, `created_at`. Account dùng React Query đọc profile theo ID phiên đăng nhập; dùng auth metadata khi chưa có profile, và cho phép retry khi lỗi. Chưa ghi profiles hay thay đổi trigger/RLS. Cần kiểm tra trigger tạo profile trước khi thêm chỉnh sửa hồ sơ; file types không chứa thông tin trigger hay policies. Client bổ sung metadata kiểu dữ liệu theo SDK để đọc bảng có type checking, giữ nguyên file schema gốc.

Pha 1 đã nối Home với `banners`, `categories`, `restaurants`; menu nhà hàng, Search và Category đọc `foods` theo UUID thật. Chi tiết món lấy một truy vấn lồng nhau `foods -> food_option_groups -> food_option_items`, kèm nhà hàng. Các nhóm tùy chọn lấy tên, giá, bắt buộc/tùy chọn và chế độ chọn một/nhiều từ database; giỏ hàng lưu snapshot của tất cả nhóm, kể cả Spiciness. Không thay lỗi hoặc dữ liệu trống bằng mock.

Home có skeleton, retry theo từng phần và pull-to-refresh; Chi tiết có trạng thái loading, lỗi, không tìm thấy và không khả dụng. Nhà hàng không active bị lọc; nhà hàng đóng cửa hoặc món không khả dụng không thể thêm vào giỏ. Bảng banners hiện có 3 banner active; không tự thêm dữ liệu seed.

Search giữ bộ lọc/sắp xếp và FlashList, nay dùng catalog thật. Favorite vẫn dùng Zustand. Near you/Distance yêu cầu vị trí qua luồng cấp quyền của thiết bị; không tự gán khoảng cách giả cho nhà hàng thiếu tọa độ. Các API danh sách hiện lấy tối đa giới hạn trả về của Supabase (mặc định 1.000 bản ghi); chưa có phân trang server cho catalog lớn.

## Pha 2: Cart, voucher và checkout

Cart dùng Zustand, lưu `foodId`, `basePrice`, `quantity`, tên món/nhà hàng, `options` (ID/tên nhóm, ID/tên lựa chọn, giá cộng thêm), `note` và giá mỗi phần. Mỗi đơn chỉ thuộc một nhà hàng. Các cấu hình/ghi chú khác nhau thành các dòng riêng; số lượng tối đa 99 mỗi dòng. Ghi chú sửa được ở chi tiết món hoặc giỏ, tối đa 500 ký tự. Giỏ khóa thao tác sửa trong lúc gửi đơn.

`src/services/purchaseApi.ts` kiểm tra voucher bằng mã được trim/uppercase với phép so sánh bằng. Kiểm tra active, hạn dùng, nhà hàng, tổng tối thiểu (được phép bằng ngưỡng), discount type và giá trị. Hỗ trợ `percentage` và `fixed`; giảm tối đa subtotal món, phí giao hàng hiện là $2/đơn. Tất cả số tiền tính theo cent trên client.

Migration `supabase/migrations/20261026_phase2_checkout.sql` đã được chủ dự án chạy trong SQL Editor. RPC `create_food_order` tạo `orders` và toàn bộ `order_items` trong cùng transaction; bất kỳ lỗi nào đều rollback. Server tự kiểm tra phiên, nhà hàng/món, nhóm tùy chọn bắt buộc/chọn một, giá hiện tại, voucher và tổng. Giá món/tùy chọn đổi so với giỏ thì yêu cầu cập nhật giỏ. `options_snapshot` chứa `{ options: [{ groupId, groupName, id, label, price }], note, food_name, base_price }`; tên/giá snapshot lấy từ database lúc tạo đơn.

Client tạo request UUID bằng expo-crypto và tái sử dụng ID với cùng payload khi retry trong cùng phiên ứng dụng. RPC có advisory lock và trả đơn đã tạo nếu request cùng ID gửi lại bởi cùng chủ sở hữu. Không tự retry mutation. Thành công mới xóa giỏ/voucher và chuyển `/tracking?orderId=...`. Khi lỗi, giỏ và ghi chú vẫn giữ nguyên. Địa chỉ phải được người dùng nhập (5–500 ký tự), không dùng địa chỉ demo mặc định.

My orders đọc đơn thật qua React Query. Tracking đọc hóa đơn, snapshot và trạng thái từ server, refresh mỗi 10 giây cho đơn đang hoạt động; không hiển thị tài xế hay ETA giả. Thanh toán hiện chỉ là cash on delivery, không thu tiền online. Chat, đánh giá, thông báo và quản lý sổ địa chỉ chưa tích hợp backend. Giỏ/favorites vẫn trong bộ nhớ; dữ liệu cục bộ và React Query cache được xóa khi tài khoản thay đổi. Giỏ/request UUID chưa được khôi phục qua việc đóng hẳn ứng dụng.

SQL kiểm thử chạy trên PostgreSQL WASM riêng trong bộ nhớ, không chạm backend:

```powershell
npm install --prefix backups/sql-check --no-save --ignore-scripts @electric-sql/pglite
node scripts/test-checkout-sql.cjs
```

`tests/fixtures/schema.sql` là schema chỉ dùng cho database kiểm thử cục bộ, không phải migration triển khai. SQL test xác nhận snapshot, voucher, idempotency, kiểm tra giá/quyền và rollback cả hóa đơn khi insert item lỗi. Client tests nằm trong `tests/purchase.test.cjs`.

Triển khai theo [Supabase React Native Auth quickstart](https://supabase.com/docs/guides/auth/quickstarts/react-native).
Truy vấn catalog theo [Supabase joins and nesting](https://supabase.com/docs/guides/database/joins-and-nesting); metadata khóa ngoại cho SDK nằm trong `src/types/supabase.ts`, các kiểu Row tiếp tục lấy từ `database.types.ts`.

## Kiểm tra

```powershell
npm run typecheck
npm test
npx expo install --check
npm run check:supabase
npx expo export --platform android --platform web --output-dir dist
```

`tests/flows.test.cjs` kiểm tra các luồng mock hiện có. `tests/auth.test.cjs` kiểm tra Auth với client giả lập: khôi phục phiên, lỗi đăng nhập, xác nhận email, đăng xuất, cleanup và các request đồng thời. `check:supabase` kiểm tra Auth settings và 16 REST endpoints bằng `limit=0`, không tải hồ sơ, tạo tài khoản hay sửa dữ liệu. Kiểm tra endpoint không xác minh RLS theo tài khoản. Cần tài khoản test để xác minh đăng nhập/đăng ký và đọc profile với backend thật; test giả lập không thay thế kiểm tra đó.

Bản sao lưu trước khi sửa nằm trong `backups/`, gồm mã nguồn, assets, cấu hình, tests và npm lockfile; bỏ qua `node_modules` và cache `.expo` có thể tạo lại.

Trong lần kiểm tra này, `hermesc.exe` có sẵn trong `node_modules` khác binary từ gói npm chính thức cùng phiên bản `hermes-compiler@250829098.0.17` và không tạo file `.hbc`. Đã lưu binary cũ trong `backups/hermes-check/` và phục hồi binary từ đúng gói npm này. Không đổi phiên bản compiler hay tắt Hermes trong cấu hình ứng dụng. Khi cài lại dependencies, dùng `npm ci` từ registry chính thức thay vì sao chép `node_modules`.

Kiểm thử live Pha 2 ngày 26/10/2026: voucher PIZZAHUT20 bị từ chối tại Hana Chicken; GIAM5K giảm $5 trên subtotal $17. Đơn kiểm thử `0805d837-1e73-4aea-bca2-0f6f958f54aa` được tạo qua UI, tổng $14 gồm phí giao $2, ghi chú/địa chỉ ghi rõ KHONG GIAO HANG. Tracking đọc lại đầy đủ các nhóm Size/Topping/Spiciness từ snapshot. Đây là bản ghi kiểm thử pending, không phải thanh toán online.


## Pha 3: Location, simulated tracking v? chat realtime

?? ch?y `npx expo install react-native-maps expo-location` theo SDK 57. `MapPanel.tsx` d?ng b?n ?? native m?c ??nh (Apple Maps iOS, Google Maps Android); kh?ng c?u h?nh Google Cloud key trong d? ?n. Th? b?ng Expo Go kh?ng c?n setup Maps ri?ng theo [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/). Binary Android ph?t h?nh ri?ng c?n c?u h?nh Maps theo h??ng d?n Expo; kh?ng xem k?t qu? export l? ki?m th? b?n ?? tr?n ?i?n tho?i.

Select Location h? tr? ch?m b?n ??/k?o ghim, n?t l?y v? tr? hi?n t?i, reverse geocode b?ng expo-location, debounce 350ms v? b? k?t qu? c? khi ng??i d?ng k?o/nh?p ti?p. L?i m?ng ho?c t? ch?i quy?n kh?ng tr? th?nh chu?i ??a ch? h?p l?; ng??i d?ng c? th? nh?p ??a ch? cho ghim ?? ch?n. D? li?u ph??ng/qu?n t?y geocoder h? ?i?u h?nh, kh?ng b?o ??m lu?n ?? s? nh?. Web c? s? ?? v? ? nh?p t?a ??/??a ch?; reverse geocode ch? d?ng tr?n native. Kh?ng g?i geocoder tr? ph?.

Checkout g?i `create_food_order_at_location` ?? ghi latitude/longitude giao h?ng trong c?ng transaction v?i h?a ??n/items, gi? request UUID khi retry. ??n Pha 2 c? c? t?a ?? null v?n ??c/chat b?nh th??ng, nh?ng kh?ng v? tuy?n khi thi?u t?a ??.

`useOrderTracking` ??ng k? UPDATE c?a orders theo ID, ??c l?i joined order qua React Query, t?i b? sau reconnect/foreground v? fallback polling khi WebSocket ch?a k?t n?i. Khi delivering, xe m? ph?ng n?i suy ???ng th?ng t? qu?n t?i ?i?m giao trong 40 gi?y; native marker animate gi?a c?c b??c. ??y l? m? ph?ng c?c b?, kh?ng c? GPS t?i x?, kh?ng ?i?u h??ng ???ng b? v? kh?ng t? ??i tr?ng th?i completed. M? l?i m?n h?nh delivering b?t ??u l??t m? ph?ng m?i.

Inbox li?t k? cu?c tr? chuy?n theo ??n th?t. `useChatRealtime` t?i 200 tin g?n nh?t, subscribe INSERT theo order_id, g?p/s?p x?p theo ID + th?i gian, gi? ri?ng buffer live ?? tr?nh history response ghi ?? tin v?a ??n, t?i b? khi reconnect/foreground. G?i c? request UUID, ch?n nh?n l?p v? t?i s? d?ng ID khi retry. Ch? g?i sender_type=user t? app; driver demo ch? th?m b?ng Dashboard.

Chat h? tr? ch?n/ch?p ?nh JPEG/PNG/WebP t?i ?a 5 MB. Bucket `order-chat` private, object path `orderId/userId/UUID.ext`; messages.image_url l?u path. App t?o signed URL 1 gi?, refresh sau 50 ph?t; kh?ng public ?nh chat. ?nh ?? g?i th?nh c?ng ???c gi? ?? xem l?ch s?. Upload ch?a g?n v?o message sau l?i/tho?t c? th? c?n d?n ??nh k?.

Ch? d? ?n ?? ch?y `supabase/migrations/20261026_phase3_location_chat.sql`: RPC t?a ??, RLS messages, Storage policies/bucket v? publication orders/messages. Kh?ng c?p quy?n gi? sender_type=driver cho app. ?? demo: m? Chat c?a ??n test Pha 2 r?i ch?y `supabase/phase3_demo.sql` trong Dashboard; file ch? nh?m ??n 0805d837-1e73-4aea-bca2-0f6f958f54aa c? nh?n KHONG GIAO HANG, th?m m?t tin driver v? ??i sang delivering v?i t?a ?? m? ph?ng g?n qu?n. Sau ?? m? Tracking xem xe ch?y.

Ki?m tra: `npm run typecheck`, `npm test`, `node scripts/test-phase3-sql.cjs`, export Android/iOS/Web. PostgreSQL WASM test ch?y ri?ng trong b? nh?; kh?ng ghi d? li?u ki?m th? v?o backend th?t. Native k?o ghim/geocoder/camera v?n c?n x?c minh tr?n Expo Go/thi?t b?, kh?ng th? thay b?ng test web.

Kết quả kiểm tra live Pha 3 (26/10/2026): Chat của đơn 0805d837 nhận tin tài xế từ Dashboard không reload; WebSocket báo connected. Tracking hiển thị delivering, xe mô phỏng chạy tới điểm giao trong 40 giây, không đổi trạng thái server thành completed. Web xác nhận điểm tọa độ/địa chỉ thủ công vào Checkout. Persist giữ 2 phần ăn, 3 nhóm tùy chọn và ghi chú sau reload; clear rồi reload vẫn rỗng. Không tạo thêm đơn trong lần kiểm tra Pha 3. TypeScript, 58/58 tests, SQL tests Pha 2/3 và export Android/iOS/Web pass. Gửi ảnh/camera và bản đồ/geocoder native chưa được kiểm thử trực tiếp trên thiết bị Expo Go.
