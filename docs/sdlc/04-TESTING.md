# 4. Testing — Kế hoạch, test case và kết quả

## 4.1. Mục tiêu và phạm vi

Kiểm tra quy tắc nghiệp vụ, hành vi service/state, hợp đồng AI, SQL transaction/quyền và khả năng build. Phân biệt unit test, tích hợp dùng fake/mock, tích hợp PostgreSQL WASM và E2E thật. Không coi fake Auth, SQL fixture hoặc HTTP mock là đã gọi Supabase/Gemini production.

**Ngày thực hiện:** 04/11/2026, Asia/Saigon. **Môi trường:** Windows, PowerShell, Node v22.12.0, npm 10.9.0; dependencies có sẵn trong workspace. Java tests chạy bằng `ai-service/run.ps1` (Maven portable 3.9.11, chọn JBR Android Studio khi có). **Nguồn:** commit nền `007ba69` + working tree, bao gồm thay đổi campaign/voucher hiện có.

## 4.2. Chiến lược

| Tầng | Công cụ | Kiểm tra | Giới hạn |
|---|---|---|---|
| Kiểu | TypeScript `tsc --noEmit` | Hợp đồng compile-time | Không bảo đảm dữ liệu runtime hoặc UI |
| Unit/adapter | `node:test`, `assert`, TypeScript transpile | Tính toán, validate, state, service với fake client | Một số test đọc source hoặc mock; không đo coverage |
| Java unit/contract | JUnit, Mockito/MockRestServiceServer | Conversation, FoodTools, streaming, payload/headers Supabase | Không gọi Gemini/Supabase thật |
| SQL integration | PGlite trong bộ nhớ | Thực thi SQL, ràng buộc, quyền và rollback theo fixture | Fixture không phải toàn bộ dịch vụ Supabase; không kiểm tra Realtime/Storage server thật |
| Build/hosting smoke | Expo export, HTTP localhost | Tạo bundle, phục vụ HTML/JS và fallback route | Không thực thi toàn bộ UI trong trình duyệt |
| E2E/native | Kịch bản thủ công đề xuất | Đặt đơn test, OTP, GPS, camera, tài xế, quyền hai tài khoản | Chưa thực hiện trong đợt này |

**Tiêu chí vào:** dependencies sẵn có, test không kết nối DB production, log lưu được. **Tiêu chí ra đề xuất:** các test bắt buộc chạy đạt, không còn blocker checkout/quyền, smoke trên thiết bị đạt, bug còn lại có mức ưu tiên. Hiện chưa đạt đầy đủ tiêu chí ra vì 15 SQL suite bị chặn và E2E chưa chạy.

## 4.3. Kết quả thực thi tổng hợp

| Lệnh/nhóm | Kết quả ngày 04/11 | Bằng chứng |
|---|---|---|
| `npm test` | **PASS: 183/183**, 0 fail, 0 skipped | [unit-tests.log](evidence/unit-tests.log) |
| `npm run typecheck` | **PASS**, exit 0 | [typecheck.log](evidence/typecheck.log) |
| `.\ai-service\run.ps1 test` | **PASS: 17/17**, 0 failures/errors/skipped | [java-tests.log](evidence/java-tests.log) |
| 20 script `scripts/test-*-sql.cjs` | **5 PASS, 15 BLOCKED**, các script blocked exit 1 | [sql-results.json](evidence/sql-results.json) |
| Expo export web | **PASS**, exit 0 | [web-export.log](evidence/web-export.log) |
| Local hosting smoke | **PASS** cho 3 HTTP request: root, checkout fallback và JS bundle | [web-smoke.json](evidence/web-smoke.json) |

Không cộng 20 script SQL vào số lượng test case: mỗi script chứa nhiều assertion và không cung cấp cùng định dạng count với Node/JUnit. 183 + 17 = 200 test do hai runner báo cáo; con số đó không đại diện mọi đường đi của ứng dụng.

## 4.4. Bộ test case tiêu biểu

Các TC dưới đây là nhóm kịch bản truy vết đến suite hiện có, không phải tên mới được thêm vào runner. PASS ở đây áp dụng cho test tự động trong phạm vi suite, không thay cho UI E2E.

| ID / yêu cầu | Dữ liệu hoặc tiền điều kiện | Bước chính | Kết quả mong đợi | Suite / kết quả |
|---|---|---|---|---|
| TC-01 / FR-01 | Thiếu config hoặc Auth fake trả lỗi | Initialize, đăng nhập | Không có phiên demo; giữ lỗi đúng | `auth.test.cjs`, `auth-errors.test.cjs` — PASS |
| TC-02 / FR-01 | OTP sai/hết hạn, user phiên khác | Verify rồi update mật khẩu | Chặn cập nhật khi chưa xác minh đúng user | `signup-recovery.test.cjs` — PASS |
| TC-03 / FR-01 | Callback OAuth và provider giả lập | Start/complete callback | Xử lý thành công/hủy/lỗi đúng | `social-auth.test.cjs` — PASS; provider live chưa thử |
| TC-04 / FR-02 | Từ khóa tiếng Việt, danh sách quán/món | Chuẩn hóa và lọc tìm kiếm | Kết quả và nhóm khớp quy tắc | `restaurant-search.test.cjs`, `food-collections.test.cjs` — PASS |
| TC-05 / FR-03 | Lựa chọn món và giỏ theo tài khoản | Thêm/sửa, lưu, đổi tài khoản | Snapshot và dữ liệu tài khoản tách biệt | `flows.test.cjs`, `cart-persist.test.cjs` — PASS |
| TC-06 / FR-05 | Giỏ rỗng/khác quán, lượng sai, địa chỉ sai | Validate checkout | Từ chối đầu vào không hợp lệ | `purchase.test.cjs` — PASS |
| TC-07 / BR-03 | Khoảng cách trong/ngoài mốc tính phí | Tính Haversine và phí | 15.000 trong 2 km; mỗi km vượt làm tròn lên thêm 5.000 | `distance.test.cjs` — PASS |
| TC-08 / BR-04 | 0 km, 20 km, lớn hơn 20, ghim sai | Kiểm tra client và SQL | 0/20 được phép, >20/ghim sai bị chặn | `delivery-range.test.cjs` + SQL tương ứng — PASS |
| TC-09 / FR-04 | Voucher món/ship, hạn và ngưỡng | Tính hai khoản giảm | Không giảm vượt phần tiền được áp dụng | `dual-vouchers.test.cjs` — PASS; SQL checkout liên quan BLOCKED |
| TC-10 / FR-05 | Cùng UUID retry; giá thay đổi; insert item lỗi | Gọi transaction checkout | Một đơn, từ chối giá sai, rollback khi lỗi | `test-checkout-sql.cjs` — BLOCKED trước assertion do thiếu file |
| TC-11 / FR-06 | Hồ sơ/địa chỉ/người nhận hợp lệ và sai | Validate, save/delete qua fake | Không sửa role, giữ dữ liệu người nhận đúng | `account.test.cjs`, `recipients.test.cjs` — PASS; SQL đầy đủ BLOCKED |
| TC-12 / FR-07 | Tiến độ và vị trí tài xế mẫu | Ánh xạ progress, xử lý GPS | Phân biệt chưa có GPS và trạng thái chuyến | `delivery-progress.test.cjs`, `driver-location.test.cjs` — PASS |
| TC-13 / FR-08 | Đơn active, completed <5 phút, ≥5 phút, cancelled | Thử gửi, kiểm tra policy SQL | Chỉ active/grace hợp lệ được gửi | `chat-window.test.cjs` + `test-chat-window-sql.cjs` — PASS |
| TC-14 / FR-09 | Review các stage, đơn/owner khác | Gửi và tổng hợp review | Rating/count đúng, loại dữ liệu không hợp lệ | `review-flow.test.cjs`, `restaurant-rating.test.cjs`, SQL rating — PASS; SQL feed BLOCKED |
| TC-15 / FR-04 | Đủ/thiếu xu; retry request đổi | Gọi redeem trong PGlite | Không trừ hai lần, không cấp trùng, kiểm tra quyền | `test-loyalty-redemption-sql.cjs` — PASS |
| TC-16 / FR-10 | JSON/SSE lỗi, history và thẻ món | Parse, validate stream | Chặn schema sai, trả thẻ đúng giới hạn | `ai-api.test.cjs` — PASS |
| TC-17 / FR-10 | Vector/model/filter/giá/khả dụng thay đổi | Match và recheck bằng PGlite | Loại sai model, ngoài phạm vi, stale data | `test-ai-vector-sql.cjs` — PASS |
| TC-18 / FR-10 | Supabase HTTP mock, user token, filters | Gateway gọi match/recheck | Header/token và bộ lọc được giữ | `SupabaseSearchTest` — PASS; integration mock |
| TC-19 / FR-10 | Hội thoại và streaming tool output | Java services với dependency giả lập | Đúng quy tắc trong assertion | `ConversationTest`, `FoodToolsTest`, `StreamingReplyTest` — PASS |
| TC-20 / FR-13 | Campaign active/inactive, expiry lỗi, tương lai, không hạn | Xác định khả dụng của campaign/voucher | Không coi mã hết hạn/ngừng là sẵn sàng | `voucher-wallet.test.cjs` — PASS |

## 4.5. Chi tiết SQL integration

| Script | Trạng thái | Nguyên nhân / phạm vi |
|---|---|---|
| `test-ai-vector-sql.cjs` | PASS | Vector, filter, recheck, phân quyền và chạy lại migration trong fixture |
| `test-chat-window-sql.cjs` | PASS | Active/grace, mốc 5 phút, cancelled, owner, Storage policy theo fixture |
| `test-delivery-range-sql.cjs` | PASS | Mốc 20 km, ghim sai, rollback, grants theo fixture |
| `test-loyalty-redemption-sql.cjs` | PASS | Mức đổi, quyền, replay, thiếu xu và rollback |
| `test-restaurant-rating-sql.cjs` | PASS | Backfill/insert/update/delete, trạng thái và tổng hợp rating |
| `test-checkout-sql.cjs` | BLOCKED | Thiếu `20261026_phase2_checkout.sql` ở thư mục migrations |
| `test-customer-delivery-progress-sql.cjs` | BLOCKED | Thiếu migration customer_delivery_progress |
| `test-discovery-sql.cjs` | BLOCKED | Thiếu migration discovery_categories |
| `test-driver-foundation-sql.cjs` | BLOCKED | Thiếu migration driver_foundation |
| `test-driver-sql.cjs` | BLOCKED | Thiếu migration order_driver |
| `test-driver-workflow-sql.cjs` | BLOCKED | Thiếu migration driver_foundation |
| `test-dual-vouchers-sql.cjs` | BLOCKED | Thiếu migration phase2_checkout |
| `test-phase3-sql.cjs` | BLOCKED | Thiếu migration phase2_checkout |
| `test-phase4-sql.cjs` | BLOCKED | Thiếu migration phase2_checkout |
| `test-profile-addresses-sql.cjs` | BLOCKED | Thiếu migration profile_addresses |
| `test-recipient-sql.cjs` | BLOCKED | Thiếu migration phase2_checkout |
| `test-restaurant-review-feed-sql.cjs` | BLOCKED | Thiếu migration restaurant_review_feed |
| `test-shipping-sql.cjs` | BLOCKED | Thiếu migration phase2_checkout |
| `test-signup-phone-sql.cjs` | BLOCKED | Thiếu migration signup_phone |
| `test-voucher-wallet-sql.cjs` | BLOCKED | Thiếu migration phase2_checkout |

Mỗi script có log cùng tên trong `evidence/`. Các file thiếu hiện có trong `supabase/migrations_old/`; chưa đổi script hoặc phục hồi migration trong đợt viết tài liệu. Sửa đường dẫn có thể giúp test lịch sử chạy, nhưng không tự chứng minh schema mới hoạt động; cần thêm test trên baseline hiện hành.

## 4.6. Kịch bản nghiệm thu thủ công — chưa thực hiện

| ID | Chuẩn bị và thao tác | Kết quả cần ghi nhận |
|---|---|---|
| MAN-01 | Hai tài khoản test A/B; A đăng nhập, B thử truy cập ID đơn A | B bị từ chối/không có dữ liệu cả UI và API |
| MAN-02 | Email test; gửi OTP, nhập sai rồi đúng; đổi mật khẩu | Email đến, sai bị chặn, mật khẩu mới dùng được |
| MAN-03 | Quán/món test, ghim ≤20 km, người nhận test; checkout COD | Đơn/items/tổng đúng; ghi rõ đơn kiểm thử không giao thật |
| MAN-04 | Ngắt mạng sau gửi đơn rồi retry | Chỉ một đơn; giỏ không mất trước xác nhận |
| MAN-05 | Client tài xế và tài khoản đã được duyệt | Nhận/chuyển trạng thái/vị trí; khách thấy tiến độ đúng |
| MAN-06 | Chat khi active rồi sau completed 5 phút | Gửi đúng thời gian, lịch sử còn theo quyền |
| MAN-07 | Thiết bị Android, cấp/từ chối GPS và camera | Không crash; lỗi quyền có hướng xử lý; ảnh tải/hiển thị đúng |
| MAN-08 | Backend AI test có quota và chỉ mục | Câu hỏi hợp lệ trả món phù hợp; quota/lỗi có thông báo |
| MAN-09 | Trình duyệt reload `/checkout`, đăng xuất rồi đăng nhập B | SPA route hoạt động; không rò cache/giỏ A |

Khi thực hiện, bổ sung cột người chạy, thời điểm, dữ liệu, thực tế, PASS/FAIL và ảnh/video. Không dùng tài khoản hoặc đơn hàng thật để tự tạo bằng chứng cho bài tập.

## 4.7. Lệnh tái chạy

```powershell
npm test
npm run typecheck
.\ai-service\run.ps1 test
node scripts/test-ai-vector-sql.cjs
node scripts/test-chat-window-sql.cjs
node scripts/test-delivery-range-sql.cjs
node scripts/test-loyalty-redemption-sql.cjs
node scripts/test-restaurant-rating-sql.cjs
```

SQL scripts dùng PGlite ở `.tools/sql-check` hoặc `backups/sql-check`, không khai báo chung trong devDependencies. Máy mới cần cài đúng vị trí theo `require` của từng script; ví dụ `npm install --prefix .tools/sql-check --no-save --ignore-scripts @electric-sql/pglite`, và tương tự cho `backups/sql-check` khi suite yêu cầu. Đây là điểm cần chuẩn hóa, không phải quy trình dependency lý tưởng.

Không có báo cáo coverage hoặc benchmark tải trong lần chạy này. Tổng kết: các kiểm thử đã chạy đạt hỗ trợ tính đúng đắn trong phạm vi assertion; toàn bộ hệ thống chưa đủ bằng chứng để tuyên bố nghiệm thu hoàn chỉnh.
