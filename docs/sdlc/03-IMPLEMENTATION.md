# 3. Implementation — Triển khai mã nguồn

## 3.1. Phương pháp hiện thực

Ứng dụng tách route/giao diện, quy tắc nghiệp vụ thuần, truy cập dữ liệu và state. Cùng một frontend phục vụ native/web. Nghiệp vụ cần toàn vẹn chạy trong PostgreSQL RPC; trợ lý AI chạy trong dịch vụ Java. Tài liệu này giải thích code hiện hữu, không khẳng định nhóm đã viết code theo một SDS lập trước đó.

## 3.2. Cấu trúc source

```text
src/
  app/                 route Expo Router và màn hình
  features/            giao diện và quy tắc theo nghiệp vụ
  services/            SDK/API adapters, factory để kiểm thử
  store/               Zustand: auth, cart, location...
  hooks/               hooks phối hợp dữ liệu/UI
  types/               kiểu miền, database, SDK metadata
  utils/               khoảng cách, tiền/nhãn, xử lý thông báo...
supabase/
  migrations/          lịch sử migration đang hoạt động
  migrations_old/      bản lưu các migration cũ
  seed.sql             dữ liệu dump hiện có; cần rà soát trước phân phối
  config.toml          cấu hình local Supabase
ai-service/
  src/main/            controller/service/tools/gateway/indexer AI
  src/test/            JUnit và HTTP mock integration
tests/                 Node test runner, TypeScript loader, fixture
scripts/               SQL integration, kiểm tra và build
server/                static build/manifest server
docs/sdlc/             hồ sơ quy trình và bằng chứng lần này
```

`node_modules`, `.expo`, `.tools`, `dist`, `backups` không phải source ứng dụng cần nộp như mã tự viết. Không đồng nhất tất cả file trong workspace với code do nhóm tự xây dựng.

## 3.3. Hiện thực các luồng chính

1. **Auth:** `authState.ts` quản lý khôi phục phiên và thay đổi trạng thái; `passwordRecovery.ts` tách request/verify/update để không cho đổi mật khẩu khi chưa xác minh user. `socialAuthFlow.ts` xử lý callback, còn việc bật Google/Facebook thuộc cấu hình môi trường.
2. **Tìm món:** Home/Search gọi catalog API; phân loại khám phá tách khỏi category menu; FoodOptions và selection kiểm tra cấu hình món trước thêm giỏ.
3. **Giỏ/checkout:** CartItem giữ lineId, foodId, basePrice, unitPrice, quantity, options, note và quán. `purchaseTotals` tính giá tạm; `createPurchaseApi` serialize và gọi RPC. Server quyết định giá cuối và tính hợp lệ.
4. **Vị trí:** `coordinates.ts` kiểm tra miền tọa độ; `distance.ts` tính Haversine/phí; `deliveryRange.ts` kiểm tra 20 km; dữ liệu người nhận được tách khỏi Auth/profile.
5. **Theo dõi/chat:** hook/service tải trạng thái theo đơn; `driverApi.ts` đọc RPC; `chatWindow.ts` kiểm tra cửa sổ gửi. Các thông tin tiến độ phải đến từ backend.
6. **Ưu đãi/đánh giá:** voucher và review đi qua API/RPC; UI có cập nhật cache và xử lý thất bại. Banner chiến dịch là phần đang có thay đổi trong working tree tại thời điểm lập hồ sơ.
7. **AI:** client validate JSON/SSE bằng Zod; Java validate request, xác thực qua Supabase, giới hạn tần suất, gọi Gemini/tools, truy xuất và kiểm tra lại món trước trả thẻ.

## 3.4. Coding standard

### Quy ước quan sát được

- TypeScript cho app; kiểu database và kiểu miền riêng; `.tsx` cho UI, `.ts` cho logic.
- PascalCase cho component/lớp Java; camelCase cho hàm/biến; snake_case theo schema SQL.
- API adapter có thể nhận dependency để fake/mock khi test.
- Quy tắc tính tiền/khoảng cách/validate được tách khỏi UI để kiểm thử biên.
- Lỗi không tạo dữ liệu giả thay cho giao dịch thật; trạng thái rỗng và lỗi cần phân biệt.
- Cấu hình public dùng `.env.example`; secret backend không nằm trong biến `EXPO_PUBLIC_*`.

### Quy chuẩn đề xuất áp dụng chính thức

1. Mọi thay đổi phải chạy `npm run typecheck` và test liên quan; Java thay đổi phải chạy Maven test.
2. Không dùng `any` để bỏ qua lỗi kiểu nếu có thể mô tả dữ liệu; kiểm tra runtime ở biên API vì type không bảo vệ JSON từ mạng.
3. UI không chứa secret hoặc bỏ qua backend authorization; function SQL phải khai báo và kiểm tra quyền cần thiết.
4. Thêm lỗi nghiệp vụ mới kèm thông báo tiếng Việt và test biên, tránh catch rỗng.
5. Tách hàm quá nhiều trách nhiệm; dùng formatter/linter thống nhất sau khi nhóm chọn cấu hình.
6. Migration mới phải có test và kế hoạch rollback/forward fix; giữ fixture và schema đồng bộ.
7. PR/commit mô tả vấn đề, thay đổi và kiểm thử; không ghi “PASS” cho test chưa chạy.

**Giới hạn hiện tại:** `package.json` chưa có script lint/format; một số Java/SQL được viết rất gọn. Vì vậy chưa đủ bằng chứng kết luận toàn bộ code đã tuân thủ một coding standard tự động. Typecheck PASS chỉ xác minh kiểu trong phạm vi tsconfig.

## 3.5. Hướng dẫn chạy source

Tại thư mục repository:

```powershell
npm ci
# Chỉ tạo .env khi chưa có; điền public URL/key của môi trường test.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run typecheck
npm test
npm run web
```

Android có SDK/emulator phù hợp: `npm run android`. Lệnh `npm start` mở Metro cho thiết bị. Máy Windows không build iOS native tại chỗ; cần môi trường macOS/EAS phù hợp và nghiệm thu riêng. Chọn Node đáp ứng `engines` của dependency; nhánh Node 22 cần từ 22.13.0 theo React Native đang cài. Máy kiểm tra dùng 22.12.0, cần xem đây là độ lệch môi trường dù các lệnh đã chạy đạt.

AI: cấu hình file riêng từ `ai-service/.env.properties.example`, dùng JDK 17+; chạy `.\ai-service\run.ps1 test` rồi `.\ai-service\run.ps1 start`. Xem [Deployment](05-DEPLOYMENT.md) cho địa chỉ emulator/LAN và database.

## 3.6. Source code bàn giao

Nguồn chính là repository hiện tại. Commit nền `007ba69` chưa bao gồm toàn bộ thay đổi working tree, nên chỉ dùng `git archive HEAD` sẽ bỏ sót phần đang sửa. Không tự commit thay người dùng trong đợt lập hồ sơ.

Gói nộp nên có: `src`, `components`, `constants`, `hooks`, `assets`, `android` nếu cần build native; cấu hình Expo/TypeScript/Metro/Babel/Tailwind; `package.json`, lockfile; `ai-service` bỏ target/secret; schema/migration đã rà soát; `tests`, `scripts`, `server`, README và tài liệu SDLC.

Loại khỏi gói: `.git`, `node_modules`, `.expo`, `.tools`, `backups`, file `.env` và `ai-service/.env.properties`, log có dữ liệu riêng, build cache. Chỉ giữ file mẫu không chứa secret. `supabase/seed.sql` là dump, không mặc nhiên coi là bộ seed giả định an toàn để công khai; nhóm cần thay bằng dữ liệu demo đã ẩn danh và xác minh FK/Auth.

Đi kèm bản nộp cần ghi: mã phiên bản/commit, môi trường, tài khoản demo qua kênh riêng, lệnh chạy, kết quả test và hạn chế. Không gửi service-role/Gemini key cho frontend.

## 3.7. Phân công nhóm

Chưa có danh sách thành viên được cung cấp. Bảng sau là khung phân công đề xuất, không phải ghi nhận đóng góp thực tế.

| Hạng mục | Vai trò đề xuất | Thông tin nhóm cần điền |
|---|---|---|
| SRS, use case, nghiệm thu | Phân tích nghiệp vụ | Họ tên, đầu việc, minh chứng |
| UI, giỏ, tìm kiếm | Frontend | Họ tên, module, commit/PR |
| DB, RPC, RLS, tài xế | Backend | Họ tên, migration, kiểm thử |
| AI | Backend AI | Họ tên, service, test |
| Test, triển khai, báo cáo | QA/DevOps/tài liệu | Họ tên, log, demo |

Một thành viên có thể đảm nhiệm nhiều vai trò; đánh giá đóng góp theo sản phẩm thực tế thay vì chỉ chia số trang báo cáo.
