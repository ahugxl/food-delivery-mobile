# Hồ sơ SDLC — soopiFood / Food Delivery

**Phiên bản:** 1.0 · **Ngày đối chiếu:** 04/11/2026 (Asia/Saigon) · **Mã nguồn:** commit nền `007ba69` cùng thay đổi đang có trong working tree.

Hồ sơ mô tả hệ thống thực tế trong repository, bổ sung yêu cầu giả định phục vụ bài tập. Đây là tài liệu dựng lại từ sản phẩm hiện có, không phải bằng chứng các giai đoạn đã diễn ra tuần tự trước khi lập trình. Tên thành viên, lớp, giảng viên và phân công thực tế cần nhóm điền trước khi nộp.

## Nội dung theo yêu cầu môn học

| Giai đoạn | Tài liệu | Sản phẩm bàn giao |
|---|---|---|
| 1. Requirement Analysis | [01-SRS.md](01-SRS.md) | Khảo sát giả định, actor, yêu cầu, use case, tiêu chí nghiệm thu |
| 2. System Design | [02-SDS.md](02-SDS.md) | Kiến trúc, module, dữ liệu, API, UML và ERD |
| 3. Implementation | [03-IMPLEMENTATION.md](03-IMPLEMENTATION.md) | Ánh xạ mã nguồn, coding standard, hướng dẫn chạy và bàn giao source |
| 4. Testing | [04-TESTING.md](04-TESTING.md) | Test plan, test case, kết quả chạy, log và giới hạn kiểm thử |
| 5. Deployment | [05-DEPLOYMENT.md](05-DEPLOYMENT.md) | Cài đặt, môi trường test, build web, smoke test và rollback |
| 6. Maintenance & Improvement | [06-MAINTENANCE.md](06-MAINTENANCE.md) | Danh sách lỗi, cải tiến, mức ưu tiên, quy trình xử lý |
| Đối chiếu chéo | [07-TRACEABILITY.md](07-TRACEABILITY.md) | Yêu cầu → use case → module → kiểm thử |

Sơ đồ có mã PlantUML trong `diagrams/*.puml` và ảnh SVG tương ứng để đọc hoặc đưa vào báo cáo. Log chạy thực tế nằm trong `evidence/`. Đường dẫn mã nguồn trong các tài liệu tính từ thư mục gốc repository, trừ liên kết tương đối có thể nhấp trực tiếp.

## Cách hiểu trạng thái

- **Có mã nguồn:** đã tìm thấy triển khai; chưa đồng nghĩa đã nghiệm thu trên thiết bị/backend thật.
- **PASS:** lệnh kiểm tra được chạy trong đợt lập hồ sơ và kết thúc thành công trong phạm vi được nêu.
- **BLOCKED:** không thực hiện hết bài kiểm thử vì điều kiện môi trường/fixture; không kết luận chức năng sản phẩm bị lỗi.
- **Chưa kiểm thử:** có kịch bản nhưng chưa thực hiện, tuyệt đối không tính là PASS.
- **Đề xuất:** mục tiêu hoặc quy trình nhóm nên áp dụng, không khẳng định đã có.

## Kết quả nổi bật của đợt lập hồ sơ

- JavaScript: **183/183 PASS**; TypeScript: **PASS**.
- Java AI: **17/17 PASS**, gồm kiểm tra hợp đồng HTTP với mock server.
- SQL/PGlite: **5/20 script PASS**, **15/20 BLOCKED** do tham chiếu migration đã chuyển sang `supabase/migrations_old/`.
- Kết quả build và chạy thử web được ghi riêng tại [Deployment](05-DEPLOYMENT.md).

Chưa xác minh E2E tài khoản thật, nhận email OTP, OAuth provider, GPS/camera thiết bị, giao hàng thực tế hay phản hồi Gemini thật trong đợt này. Không lấy kết quả cũ trong `PHASE4_REPORT.md` thay cho kết quả hiện tại.

## Căn cứ và tài liệu tham khảo

Ưu tiên mã nguồn, `package.json`, `ai-service/pom.xml`, các migration và log hiện tại. README và tài liệu cũ là nguồn tham khảo có thể đã lỗi thời. Ví dụ, code hiện dùng VND, có khôi phục mật khẩu OTP và hội thoại AI streaming, khác một số đoạn mô tả cũ.

Đã tra cứu bằng Context7 ngày 04/11/2026:

1. [Supabase: local development workflows](https://supabase.com/docs/guides/local-development/cli-workflows) — baseline và lịch sử migration.
2. [Supabase: database migrations](https://supabase.com/docs/guides/local-development/database-migrations) — kiểm thử migration trên môi trường local.
3. [Expo: deploy web](https://docs.expo.dev/deploy/web/) — export bản web.
4. [Expo: publishing websites](https://docs.expo.dev/guides/publishing-websites/) — cấu hình fallback khi host SPA.

Không dùng tài liệu thư viện để khẳng định tính năng riêng của dự án đã hoàn thành; tính năng phải có căn cứ trong repository.
