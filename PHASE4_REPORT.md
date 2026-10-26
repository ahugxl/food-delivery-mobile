# Báo cáo bàn giao Pha 4 — Food Delivery

Ngày kiểm tra: 26/10/2026. Thư mục: `D:\TBDD\btl\food-delivery`.

## Chức năng hoàn thành

- Review lấy đơn của người đăng nhập, chỉ gửi khi completed. Lưu hai mức sao độc lập, hai nhận xét và tag tài xế vào reviews. Chống gửi trùng, đọc lại bản đã tồn tại khi retry. John Cooper là tài xế mô phỏng.
- Favorites đọc/ghi Supabase theo user_id. Các trái tim và Tab Favorites dùng chung React Query cache, cập nhật lạc quan, rollback khi lỗi và khóa nhấn lặp theo quán.
- My order đọc orders của chính tài khoản, phân pending/preparing/delivering vào Đang đến; completed/cancelled vào Lịch sử. Có loading/error/retry, refresh, Realtime và truy cập hóa đơn/đánh giá.
- Migration bổ sung policy cho favorites/reviews và index. Chủ dự án đã chạy migration và demo thành công trong SQL Editor. Không đổi file schema 16 bảng gốc, package.json hay npm lockfile trong Pha 4.

## Bằng chứng kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| npm run typecheck | Pass |
| npm test | 69/69 pass |
| SQL Pha 2 | Pass: transaction, snapshot, voucher, idempotency, quyền và rollback |
| SQL Pha 3 | Pass: tọa độ, chat, quyền và Storage/publication |
| SQL Pha 4 | Pass: thêm/xóa/trùng favorite, review completed, sao hợp lệ, một review/đơn và tách tài khoản |
| Expo export Android/iOS/Web | Thành công, gồm biên dịch Hermes native |
| Expo dependency check | Up to date theo metadata offline; không phải kiểm tra registry trực tuyến |
| Schema gốc | SHA256 khớp database.types.ts nguồn |

Live UI với Supabase thật: thêm Hana Chicken vào Favorites, reload vẫn còn, bỏ lưu rồi kiểm tra trái tim Home trở lại chưa lưu. Đơn pending 6c5850a7 nằm Đang đến; đơn demo 0805d837 nằm Lịch sử với trạng thái completed. Gửi review 5 sao quán / 4 sao tài xế, tag Friendly và On-time, nhận xét ghi rõ kiểm thử. Sau reload và mở lại từ Lịch sử, review giữ đủ dữ liệu và form chuyển chỉ đọc. Không tạo đơn hay thanh toán mới trong Pha 4.

Ảnh bằng chứng được giữ trong backups/phase4-favorites.png và backups/phase4-review-saved.png. Bản sao trước sửa: backups/before-phase4-20261026-172620.zip.

## Bàn giao và giới hạn

Gói source: artifacts/food-delivery-phase4-source.zip. Bao gồm code, assets, tests, migrations, tài liệu, package.json, package-lock.json và .env.example; không chứa .env, node_modules, .git, .expo, dist hay backups. Trên máy nhận: giải nén, cấu hình .env theo .env.example, npm ci, npm run typecheck, npm test, npm start. Dùng Node 22.13+ trên nhánh 22 theo yêu cầu dependencies; máy kiểm thử hiện dùng 22.12 và vẫn chạy được các check đã nêu.

SQL tests dùng PGlite độc lập trong bộ nhớ; xem README để cài dependency kiểm thử vào backups/sql-check. Không chạy fixtures/schema.sql lên Supabase thật. Demo chỉ dành cho đơn kiểm thử KHONG GIAO HANG.

Bản đồ/geocoder/camera/ảnh native còn cần smoke test trên thiết bị Expo Go; export và web không xác nhận hành vi phần cứng. Xe là mô phỏng đường thẳng, thanh toán chỉ COD. OAuth, reset mật khẩu, thanh toán online, thông báo và sổ địa chỉ chưa thuộc phạm vi đã tích hợp. Danh sách chưa phân trang server cho quy mô lớn. Kết quả pass thể hiện phạm vi kiểm thử trên, không bảo đảm không có lỗi ngoài phạm vi đó.
