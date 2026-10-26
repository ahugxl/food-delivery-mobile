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

Search giữ bộ lọc/sắp xếp và FlashList, nay dùng catalog thật. Favorites đã dùng Supabase và React Query; Zustand chỉ giữ khóa thao tác chống nhấn lặp. Near you/Distance yêu cầu vị trí qua luồng cấp quyền của thiết bị; không tự gán khoảng cách giả cho nhà hàng thiếu tọa độ. Các API danh sách hiện lấy tối đa giới hạn trả về của Supabase (mặc định 1.000 bản ghi); chưa có phân trang server cho catalog lớn.

## Pha 2: Cart, voucher và checkout

Cart dùng Zustand, lưu `foodId`, `basePrice`, `quantity`, tên món/nhà hàng, `options` (ID/tên nhóm, ID/tên lựa chọn, giá cộng thêm), `note` và giá mỗi phần. Mỗi đơn chỉ thuộc một nhà hàng. Các cấu hình/ghi chú khác nhau thành các dòng riêng; số lượng tối đa 99 mỗi dòng. Ghi chú sửa được ở chi tiết món hoặc giỏ, tối đa 500 ký tự. Giỏ khóa thao tác sửa trong lúc gửi đơn.

`src/services/purchaseApi.ts` kiểm tra voucher bằng mã được trim/uppercase với phép so sánh bằng. Kiểm tra active, hạn dùng, nhà hàng, tổng tối thiểu (được phép bằng ngưỡng), discount type và giá trị. Hỗ trợ `percentage` và `fixed`; giảm tối đa subtotal món, phí giao hàng hiện là $2/đơn. Tất cả số tiền tính theo cent trên client.

Migration `supabase/migrations/20261026_phase2_checkout.sql` đã được chủ dự án chạy trong SQL Editor. RPC `create_food_order` tạo `orders` và toàn bộ `order_items` trong cùng transaction; bất kỳ lỗi nào đều rollback. Server tự kiểm tra phiên, nhà hàng/món, nhóm tùy chọn bắt buộc/chọn một, giá hiện tại, voucher và tổng. Giá món/tùy chọn đổi so với giỏ thì yêu cầu cập nhật giỏ. `options_snapshot` chứa `{ options: [{ groupId, groupName, id, label, price }], note, food_name, base_price }`; tên/giá snapshot lấy từ database lúc tạo đơn.

Client tạo request UUID bằng expo-crypto và tái sử dụng ID với cùng payload khi retry trong cùng phiên ứng dụng. RPC có advisory lock và trả đơn đã tạo nếu request cùng ID gửi lại bởi cùng chủ sở hữu. Không tự retry mutation. Thành công mới xóa giỏ/voucher và chuyển `/tracking?orderId=...`. Khi lỗi, giỏ và ghi chú vẫn giữ nguyên. Địa chỉ phải được người dùng nhập (5–500 ký tự), không dùng địa chỉ demo mặc định.

My orders đọc đơn thật qua React Query và Realtime. Tracking hiển thị hóa đơn, snapshot và trạng thái server. Thanh toán hiện chỉ là cash on delivery. Chat, đánh giá, yêu thích đã tích hợp backend trong Pha 3/4; thông báo và sổ địa chỉ chưa tích hợp. Giỏ dùng Zustand Persist + AsyncStorage theo tài khoản, lưu tùy chọn, ghi chú và request UUID; chỉ xóa sau checkout thành công hoặc đăng xuất/chuyển tài khoản. React Query cache được dọn khi đổi tài khoản.

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

Kiểm thử live Pha 2 ngày 26/10/2026: voucher PIZZAHUT20 bị từ chối tại Hana Chicken; GIAM5K giảm $5 trên subtotal $17. Đơn kiểm thử `0805d837-1e73-4aea-bca2-0f6f958f54aa` được tạo qua UI, tổng $14 gồm phí giao $2, ghi chú/địa chỉ ghi rõ KHONG GIAO HANG. Tracking đọc lại đầy đủ các nhóm Size/Topping/Spiciness từ snapshot. Đây là bản ghi kiểm thử, đã chuyển completed qua demo Pha 4, không phải thanh toán online.


## Pha 3: Location, tracking mô phỏng và chat realtime

Đã cài react-native-maps, expo-location theo SDK 57. Native hỗ trợ kéo ghim, vị trí hiện tại, reverse geocoding hệ điều hành, debounce và bỏ kết quả cũ. Web dùng sơ đồ, nhập tọa độ/địa chỉ thủ công. RPC create_food_order_at_location lưu tọa độ cùng hóa đơn/items trong transaction.

Tracking subscribe UPDATE theo order ID, đồng bộ sau reconnect/foreground và polling dự phòng. Xe nội suy đường thẳng trong 40 giây khi delivering; không tự chuyển trạng thái completed. Đây là mô phỏng, chưa có GPS tài xế hay định tuyến đường bộ.

Chat tải 200 tin gần nhất, subscribe INSERT theo order_id, gộp theo ID để tránh trùng/mất tin khi history và live chạy đồng thời. Gửi dùng request UUID khi retry. App chỉ gửi sender_type=user, tài xế demo thêm từ Dashboard. Bucket order-chat private, ảnh dùng URL ký có hạn. Upload chưa gắn message sau lỗi có thể cần dọn định kỳ.

Chủ dự án đã chạy migration Pha 3 và phase3_demo.sql. Bản đồ/geocoder/camera native cần kiểm tra trực tiếp qua Expo Go. Android phát hành riêng cần cấu hình Maps theo tài liệu Expo; export thành công không thay thế kiểm thử thiết bị.

Kết quả kiểm tra live Pha 3 (26/10/2026): Chat của đơn 0805d837 nhận tin tài xế từ Dashboard không reload; WebSocket báo connected. Tracking hiển thị delivering, xe mô phỏng chạy tới điểm giao trong 40 giây, không đổi trạng thái server thành completed. Web xác nhận điểm tọa độ/địa chỉ thủ công vào Checkout. Persist giữ 2 phần ăn, 3 nhóm tùy chọn và ghi chú sau reload; clear rồi reload vẫn rỗng. Không tạo thêm đơn trong lần kiểm tra Pha 3. TypeScript, 58/58 tests, SQL tests Pha 2/3 và export Android/iOS/Web pass. Gửi ảnh/camera và bản đồ/geocoder native chưa được kiểm thử trực tiếp trên thiết bị Expo Go.

## Pha 4: Đánh giá, yêu thích và lịch sử đơn

Chủ dự án đã chạy supabase/migrations/20261026_phase4_reviews_favorites.sql và supabase/phase4_demo.sql. Demo chỉ hoàn thành đơn có nhãn KHONG GIAO HANG.

Đánh giá kiểm tra đơn thuộc tài khoản hiện tại và trạng thái completed. Hai mức sao quán/tài xế độc lập, kèm nhận xét và tag Friendly, Supportive, On-time. Mỗi đơn chỉ gửi một đánh giá, retry đọc lại bản đã lưu. Cả client và RLS kiểm tra điều kiện; app không tự hoàn thành đơn. John Cooper là tài xế mô phỏng.

Favorites đọc/ghi bảng favorites theo user_id. Trái tim cập nhật lạc quan, khóa nhấn lặp theo quán, rollback khi API lỗi và tải lại sau mutation. Thẻ nhà hàng và Favorites dùng chung cache. Tab đơn hàng phân completed/cancelled vào Lịch sử, pending/preparing/delivering vào Đang đến; có pull-to-refresh và Realtime.

Kiểm tra ngày 26/10/2026: TypeScript pass, 69/69 tests pass, SQL Pha 2/3/4 pass trên PostgreSQL WASM, export Android/iOS/Web thành công. Live UI xác minh lưu/bỏ yêu thích, giữ sau reload, phân loại đơn thật và đánh giá 5 sao quán / 4 sao tài xế. Schema gốc 16 bảng giữ nguyên; package.json và package-lock.json không đổi trong Pha 4.

Kiểm thử SQL thêm: node scripts/test-phase4-sql.cjs (cần PGlite trong backups/sql-check như hướng dẫn trên). Xem PHASE4_REPORT.md để bàn giao. Gói source trong artifacts bỏ qua .env, dependencies, cache và backups; điền .env từ .env.example trên máy nhận.

## Cập nhật giao diện tiếng Việt theo ảnh tham khảo

Trang chủ dùng nền trắng, phần đầu xanh vàng, danh mục tròn và các thẻ quán dạng hàng. Tìm kiếm/danh mục trả về quán trước, kể cả khi tìm theo tên món; chọn quán mới mở thực đơn riêng, lọc đúng restaurant_id. Trang quán có ảnh bìa, nút yêu thích/chia sẻ, nhãn ưu đãi, tìm món, lọc danh mục và lưới món hai cột. Dấu cộng mở chi tiết để chọn đủ tùy chọn bắt buộc trước khi thêm giỏ.

Đã Việt hóa các màn hình đăng nhập/đăng ký, tab, món ăn, giỏ, thanh toán, địa chỉ, mã ưu đãi, theo dõi đơn, đánh giá, yêu thích, tin nhắn, tài khoản và thông báo lỗi. Tên thương hiệu và nội dung người dùng nhập giữ nguyên. Tên món/tùy chọn/mô tả của dữ liệu mẫu được dịch khi hiển thị qua src/utils/vietnamese.ts, không thay ID, giá hay snapshot lưu xuống server. Catalog thêm mới nên nhập tiếng Việt trong Supabase để hiển thị nhất quán.

Đơn vị tiền hiện có của backend là USD; chỉ định dạng số theo vi-VN, không tự quy đổi sang VND. Giữ nguyên checkout, Auth, Realtime và cấu trúc npm/Supabase.

Kiểm tra cập nhật ngày 26/10/2026: TypeScript pass, 75/75 tests pass. Đã thử UI ở kích thước điện thoại: tìm “gà rán” trả về Hana Chicken, mở quán chỉ có món quán đó, chọn kích cỡ/món thêm/độ cay, thêm giỏ đúng tổng 17 USD + phí giao 2 USD và xem xác nhận đơn. Sau kiểm thử đã xóa món thử để trả giỏ về trống; không tạo đơn thật mới. Export Android/iOS/Web thành công. Bản sao trước chỉnh nằm tại backups/before-vietnamese-ui-20261026.zip. Kiểm thử phần cứng native vẫn cần thực hiện trên Expo Go. Gói source Pha 4 cũ là bản trước lần chỉnh UI này.
