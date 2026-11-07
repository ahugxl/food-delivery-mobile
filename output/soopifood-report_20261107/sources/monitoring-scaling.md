# Giám sát và mở rộng soopiFood

Đối chiếu mã nguồn và tài liệu chính thức ngày 2026-11-07. Không thay đổi cấu hình hay triển khai hạ tầng trong tác vụ tạo slide.

## Hiện trạng đã đọc từ code

- `ai-service/src/main/java/vn/subifood/ai/AiController.java`: GET `/api/ai/status` trả trường `configured`; không kiểm tra trực tiếp tính sẵn sàng của Supabase hoặc Gemini. SSE có giới hạn thời gian và hủy tác vụ.
- `ai-service/src/main/java/vn/subifood/ai/RecommendationService.java`: log lỗi và HTTP status nhà cung cấp; bộ giới hạn theo user đặt trong `ConcurrentHashMap` của từng process; executor giới hạn số tác vụ và hàng đợi.
- `ai-service/src/main/java/vn/subifood/ai/MenuIndexer.java`: scheduler đồng bộ vector theo chu kỳ, bật/tắt bằng cấu hình và tạm dừng khi chạm quota; log số món cập nhật và lỗi.
- `ai-service/src/main/java/vn/subifood/ai/MenuEmbeddings.java`: thời gian dừng do quota nằm trong bộ nhớ process. Khi nhân bản backend cần phối hợp quota dùng chung; không coi nhiều instance là cách tăng quota Gemini.

## Đề xuất giám sát

Theo dõi độ trễ p95 của API (và thời gian tới token đầu tiên cho SSE), tỷ lệ lỗi/timeout/429, CPU/RAM/restart; query chậm, kết nối, dung lượng và egress của Supabase; số kết nối/tin Realtime; quota Gemini và số món còn chờ tạo vector. Không khẳng định dashboard/cảnh báo đã cài hay có số liệu benchmark. Ping giữ dịch vụ hoạt động không thay thế kiểm tra nghiệp vụ hoặc cảnh báo.

## Lựa chọn mở rộng

1. Đo điểm nghẽn và tối ưu query/index/cache/pagination trước. Không có một số lượng user cố định tự quyết định lúc cần nâng cấp.
2. Nếu database thiếu CPU/RAM: nâng compute Supabase là scale dọc. Gói thuê bao, quota và kích thước compute là các khái niệm khác nhau; nâng gói không tự động sharding database. Compute thay đổi có thể có gián đoạn, cần lên lịch và kiểm thử.
3. Nếu API xử lý quá tải: chạy nhiều instance backend AI/Admin sau cân bằng tải là scale ngang. Trước đó chuyển rate limit/quota ra kho dùng chung (ví dụ Redis) và để một worker index hoặc dùng khóa/hàng đợi phối hợp. Không chạy scheduler tạo vector độc lập ở mọi replica.
4. Với tải đọc database phù hợp: cân nhắc Supabase read replicas. Replication bất đồng bộ có độ trễ; đơn hàng, thanh toán và dữ liệu cần nhất quán đọc/ghi nên dùng primary. Replica không tăng khả năng ghi. Chỉ chuyển những truy vấn đọc tương thích; không chuyển toàn bộ Auth/Realtime sang replica.
5. Render Free chỉ có một instance; phương án nhiều instance cần dịch vụ/gói đủ điều kiện. Không đề xuất di chuyển toàn bộ Supabase sang tự host chỉ vì user tăng: cần đánh giá vận hành, dự phòng và chi phí thực tế trước.

## Tài liệu chính thức

- Supabase Compute and Disk: https://supabase.com/docs/guides/platform/compute-and-disk
- Supabase Read Replicas: https://supabase.com/docs/guides/platform/read-replicas
- Supabase Metrics API: https://supabase.com/docs/guides/observability/metrics
- Render Scaling Services: https://render.com/docs/scaling

Các điều kiện gói có thể thay đổi; không đưa giá cố định hoặc mức tải chưa đo vào slide.
