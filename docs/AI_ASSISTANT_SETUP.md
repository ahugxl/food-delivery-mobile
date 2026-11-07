# Trợ lý chọn món Gemini + Spring AI + Supabase pgvector

## Cấu trúc

- `ai-service`: backend Java 17+, Spring Boot 4.0.9, Spring AI 2.0.2.
- `src/app/ai-assistant.tsx`: giao diện Expo; mở từ Home → Hỏi AI chọn món.
- SQL: `supabase/migrations/20261101194052_ai_food_vector_search.sql`.
- Vector nằm trong bảng riêng tư `private.ai_food_embeddings`, không nằm trong dữ liệu người dùng.
- Gemini gọi `searchFoods`; hàm tạo query vector, gọi Supabase lọc menu hiện tại, sau đó kiểm tra lại các ID trước khi render thẻ món.
- Không bật Google Search/Maps grounding. Không có tool đặt hàng, sửa dữ liệu hay chạy SQL tùy ý.

## Cấu hình backend

1. Tạo Gemini API key tại https://aistudio.google.com/apikey . Không gửi key vào chat/Git/Expo.
2. Điền file riêng `ai-service/.env.properties` (đã nằm trong gitignore), dựa trên `.env.properties.example`:

```properties
AI_ENABLED=true
GEMINI_API_KEY=DIEN_KEY_TAI_DAY
GEMINI_CHAT_MODEL=gemini-3.1-flash-lite
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
SUPABASE_URL=https://glchegbogadnllehcnzf.supabase.co
SUPABASE_PUBLIC_KEY=PUBLIC_KEY_CUA_DU_AN
SUPABASE_SERVICE_ROLE_KEY=SERVER_KEY_CHI_LUU_O_BACKEND
AI_INDEX_ENABLED=true
AI_INDEX_BATCH_SIZE=20
AI_INDEX_DELAY_MS=60000
AI_ALLOWED_ORIGINS=http://localhost:8081,http://localhost:8093
PORT=3002
```

Khóa quyền cao chỉ được sử dụng bởi tác vụ lập chỉ mục menu; các truy vấn gợi ý dùng public key + phiên đăng nhập của khách.
Backend kiểm tra phiên đăng nhập với Supabase Auth; không gửi token hoặc địa chỉ cụ thể sang Gemini.
Gemini nhận câu hỏi và dữ liệu catalog cần thiết, không nhận lịch sử đơn, hồ sơ khách hay tin nhắn.

3. Trong PowerShell tại thư mục app:

```powershell
.\ai-service\run.ps1 start
```

Script dùng Maven portable đã kiểm SHA512 và Java có sẵn trong Android Studio nếu có. Không cài/sửa Java toàn hệ thống.
Máy khác cần JDK 17+ hoặc Android Studio; không chạy bằng Java 8.

## Cấu hình Expo

Thêm `.env` của app:

```dotenv
EXPO_PUBLIC_AI_API_URL=http://IP_LAN_CUA_MAY_CHAY_BACKEND:3002
```

- Điện thoại/Expo Go và máy backend phải truy cập được nhau; localhost trên điện thoại là chính điện thoại.
- Web trên cùng máy có thể dùng `http://localhost:3002`; Android Emulator có thể dùng `http://10.0.2.2:3002`.
- IP LAN thường dùng được cho cả web, máy ảo và điện thoại cùng mạng.
- Sau đổi biến Expo, khởi động lại Metro.
- Khi đóng gói APK sử dụng ngoài mạng nhà, cần triển khai backend và dùng URL HTTPS công khai. Cập nhật URL đó trong EAS environment tương ứng; không đóng gói IP LAN như URL production.
- Tuyệt đối không tạo `EXPO_PUBLIC_GEMINI_API_KEY` hoặc đưa service-role vào app.

## Lập vector và cập nhật menu

Tác vụ chạy khi backend hoạt động, `AI_ENABLED=true`, `AI_INDEX_ENABLED=true` và đủ khóa.
Mỗi vòng lấy tối đa `AI_INDEX_BATCH_SIZE` món mới/thay đổi; chỉ tạo lại vector khi nội dung thay đổi.
Tên, mô tả, danh mục, tên quán và tùy chọn được dùng tạo vector. Giá/khả dụng/mở cửa được lấy trực tiếp lúc tìm, không tin bản chụp cũ.
Món có nội dung thay đổi chưa lập lại vector sẽ tạm không xuất hiện trong AI; menu thường vẫn dùng được.
Không có vector thì app báo rõ menu chưa lập chỉ mục, không trả gợi ý giả.
Lần đầu với 1.829 món cần nhiều vòng; thời gian và hạn mức phụ thuộc Gemini. Có thể điều chỉnh batch/chu kỳ theo quota của tài khoản.
Các request tạo embedding sử dụng quota Gemini; không giả định tài khoản có quota miễn phí.

Chốt model `gemini-embedding-001`, 1.536 chiều, task DOCUMENT khi lập chỉ mục và QUERY khi tìm; vector được chuẩn hóa.
Không trộn model khác trong cùng không gian: model key được lưu và kiểm tra ở mỗi truy vấn. Đổi embedding model phải lập lại toàn bộ menu.
Với số lượng món hiện tại, truy vấn cosine chính xác dùng pgvector. Chưa dùng HNSW để tránh bỏ sót món sau bộ lọc khoảng cách; có thể bổ sung khi số món tăng lớn.

## Giới hạn và kiểm tra

- Gợi ý chỉ có món còn bán, quán active/mở cửa, trong 20 km, không vượt giới hạn giá được xác định.
- RPC `ai_match_foods_v2` lọc bằng liên kết `food_discovery_categories` trước khi xếp hạng, không suy ra nhóm từ tên quán. Cả bước lấy ứng viên và kiểm tra lại đều kiểm tra nhóm/nhóm loại trừ và điểm cosine.
- Backend xác định sáu nhóm khám phá khi câu hỏi có tên nhóm rõ ràng; yêu cầu “cơm chay” cần đồng thời có cả hai liên kết. Nhóm chưa gán đủ có thể làm thiếu kết quả. Món chưa có liên kết phù hợp không được tự chuyển nhóm để đủ danh sách.
- Giữ câu hỏi gốc để tạo vector và xác định điều kiện; model không được làm mất điều kiện bằng cách viết lại truy vấn.
- `AI_MIN_SIMILARITY=0.62` là ngưỡng cosine khởi đầu có thể cấu hình trên backend, không phải 62% độ chính xác. Lấy tối đa 10 ứng viên đạt ngưỡng, trả tối đa 5 món sau kiểm tra lại; không bù bằng món dưới ngưỡng.
- Một số tên món cụ thể thông dụng như “bún bò”, “phở bò”, “cơm gà” còn cần xuất hiện trong tên món, tránh gợi ý món khác cùng nhóm. Bộ từ vựng hiện hữu hạn; không tuyên bố hỗ trợ mọi tên món hoặc yêu cầu dinh dưỡng.
- “Ít ngọt/không đường” cần tùy chọn đường làm căn cứ; không tự suy diễn dinh dưỡng, dị ứng hoặc khẩu vị từ tên món.
- Không render câu trả lời tự do của model thành sự thật về món; nội dung thẻ và gợi ý tùy chọn lấy từ dữ liệu đã kiểm tra lại.
- Câu hỏi đơn lẻ, tối đa 600 ký tự; không lưu lịch sử hội thoại vào database ở bản này.
- Tối đa 2 lần gọi tool/câu hỏi, 20 câu/10 phút/tài khoản trên một backend instance, 2 tác vụ AI đồng thời, thời gian chờ tối đa 45 giây.
- Khi chạy nhiều instance cần bộ giới hạn dùng chung trước khi mở rộng public.
- `/api/ai/status` chỉ cho biết đã cấu hình hay chưa; không lộ khóa.
- Không log token, API key, câu hỏi, GPS hoặc nội dung menu trong lỗi.

## Kiểm tra độ phù hợp ban đầu (02/11/2026)

Đo bằng `gemini-embedding-001`, vector QUERY, trên menu Supabase thật với vị trí kiểm thử gần quán tại TP.HCM. Chỉ mục đang đồng bộ nên đây là mẫu nhỏ để chọn ngưỡng ban đầu, chưa phải đánh giá toàn bộ hệ thống:

| Câu hỏi | Điểm cao nhất | Kết quả sau quy tắc mới |
|---|---:|---|
| Trà sữa ngọt nhẹ dưới 40k | 0,6884 | Đúng nhóm Trà sữa, có tùy chọn đường, đúng giá |
| Cơm gà ăn trưa dưới 60k | 0,7161 | Đúng nhóm Cơm, tên có cơm gà |
| Bún bò nóng | 0,6896 (món khác) | Không chấp nhận bún lẩu/mì Ý chỉ vì điểm cao; cần tên bún bò |
| Sữa rửa mặt dưỡng da | 0,5945 | Loại dưới ngưỡng |
| Điện thoại laptop máy tính | 0,5870 | Loại dưới ngưỡng |
| Khách sạn đặt phòng du lịch | 0,5516 | Loại dưới ngưỡng |

Migration `20261101202700_ai_food_relevance.sql` bổ sung liên kết ban đầu chỉ từ tên món/danh mục rõ ràng, không xóa hay sửa các liên kết đã gán. Kết quả lúc triển khai: 122 Trà sữa, 158 Cơm, 107 Bún mì phở, 24 Món Hàn, 2 Món chay; Ăn vặt giữ 14 liên kết cũ. Admin vẫn cần kiểm duyệt và bổ sung các món chưa phân loại.

Kiểm thử:

```powershell
.\ai-service\run.ps1 test
node scripts/test-ai-vector-sql.cjs
npm run typecheck
npm test
```

Tài liệu chính thức:
- https://docs.spring.io/spring-ai/reference/api/tools.html
- https://docs.spring.io/spring-ai/reference/api/embeddings/google-genai-embeddings-text.html
- https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001
