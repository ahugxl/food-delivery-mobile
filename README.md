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
