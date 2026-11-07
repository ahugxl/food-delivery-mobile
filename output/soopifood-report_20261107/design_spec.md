<!-- ppt-master-schema: design-spec/v1 -->
# soopiFood - Design Spec

## I. Project Information

| Item | Value |
| --- | --- |
| Project Name | soopifood-report |
| Canvas Format | ppt169 — 1280 × 720 |
| Page Count | 9 |
| Primary Language | vi-VN |
| Target Audience | Giảng viên Nguyễn Minh Hái và sinh viên lớp 420300143202 |
| Communication Intent | Báo cáo kiến trúc, UI/UX, backend, database, SDLC và kỹ thuật đã hiện thực trong soopiFood |
| Desired Audience Outcome | Hiểu cách hệ thống tổ chức, vận hành và đóng góp ghi nhận của nhóm |
| Core Message / Ask / Action | soopiFood kết nối đặt món, dữ liệu thật, theo dõi giao hàng và AI chọn món |
| Delivery Context | Thuyết trình trực tiếp bằng tiếng Việt trong 5 phút |
| Artifact Afterlife | PPTX chỉnh sửa được, kèm ghi chú và kịch bản thuyết trình |
| Reading Mode | presentation |
| Content Strategy | Bám mã nguồn hiện tại; không bịa benchmark hay kết quả kiểm thử; phân công dùng bảng đóng góp Git do người dùng cung cấp |
| Design Style | Xanh–trắng, sơ đồ rõ ràng, ảnh thật của ứng dụng, hiện đại và thoáng |
| AI Image Acquisition Path | not applicable |
| Generation Mode | continuous |
| Spec Refinement | disabled |
| Speaker Notes | enabled — confirmed Stage-2 policy |
| Custom Animations | disabled — confirmed Stage-2 policy |
| Narration Audio | disabled — confirmed Stage-2 policy |
| Created Date | 2026-11-07 |

## II. Canvas Specification

| Property | Value |
| --- | --- |
| Format | PPT 16:9 |
| Dimensions | 1280 × 720 |
| viewBox | `0 0 1280 720` |
| Margins | 48 px |
| Content Area | 1184 × 624 |

## III. Visual Theme

### Theme Style

- **Mode**: custom
- **Mode Behavior**: Giới thiệu sản phẩm, giải thích hệ thống bằng sơ đồ, chứng minh bằng UI và mã nguồn, chốt bằng kết quả và hướng phát triển.
- **Visual style**: custom
- **Visual Style Behavior**: Màu xanh đậm cho tiêu đề và các điểm neo; nền trắng hoặc xanh rất nhạt, hình học tối giản; sơ đồ native và ảnh màn hình thật, chữ ngắn đủ đọc khi chiếu.
- **Theme**: Một đường dẫn màu xanh nối hành trình đặt món với hệ thống dữ liệu.
- **Tone**: Rõ ràng, chuyên nghiệp, phù hợp báo cáo đồ án.

### Color Scheme

| Role | HEX | Purpose |
| --- | --- | --- |
| Background | #FFFFFF | Nội dung |
| Secondary background | #EFF7F1 | Vùng nhóm và ảnh |
| Primary | #006B42 | Tiêu đề và điểm neo |
| Accent | #00A65A | Luồng và nhấn mạnh |
| Secondary accent | #F1B83A | Điểm đáng chú ý |
| Body text | #153F32 | Nội dung |
| Secondary text | #61766B | Chú thích |
| Divider | #D4E4D9 | Đường chia và liên kết |

## IV. Typography System

### Font Plan

| Role | Character (Reference) | Primary | English if non-English | Fallback tail |
| --- | --- | --- | --- | --- |
| Title | Sans đậm, rõ dấu tiếng Việt | Segoe UI | Segoe UI | Arial |
| Body | Sans gọn, dễ đọc khi chiếu | Segoe UI | Segoe UI | Arial |

- **Title stack**: Segoe UI, Arial
- **Body stack**: Segoe UI, Arial

### Font Size Hierarchy

| Purpose | Anchor Size (px) |
| --- | ---: |
| Body | 24 |
| Title | 40 |
| Subtitle | 28 |
| Label | 20 |
| Annotation | 16 |
| Display | 64 |

## V. Layout Principles

### Deck-wide Direction

- **Hierarchy direction**: Kết luận ở tiêu đề; hình và sơ đồ dẫn mắt; chú thích nguồn ở cuối trang.
- **Composition tendency**: Trang kiến trúc và dữ liệu có sơ đồ; trang UI có bộ ba màn hình; trang kết thúc có một ảnh AI và kết luận.
- **Cross-page continuity**: Nhãn phần hai chữ số, một đường xanh ngắn và số trang ở chân.
- **Spacing posture**: Biến đổi theo lượng nội dung; bìa và kết thúc thoáng.
- **Spacing anchors**: page margin 48; block gap 24; column gutter 32; corner radius 20; body leading 34.

## VI. Icon Usage Specification

- **Primary bundled library**: none

| Icon Path | Suitable Scenarios |
| --- | --- |

## VIII. Image Resource List

| Filename | Dimensions | Ratio | Purpose | Type | Image pattern | Crop Policy | Acquire Via | Status | Reference | text_policy | page_role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| logo.png | 1024x1024 | 1 | Nhận diện app | Logo | Đặt cùng tên sản phẩm | no-crop | user | Existing | assets/images/icon.png trong dự án | embedded | local |
| app-login.png | 428x918 | 0.466 | Bằng chứng đăng nhập | Screenshot | Màn hình nguyên vẹn trong khung điện thoại | no-crop | user | Existing | Cắt vùng điện thoại từ final-s02 của video demo đã ẩn dữ liệu cá nhân | embedded | local |
| app-search.png | 428x918 | 0.466 | Bằng chứng tìm quán và món | Screenshot | Màn hình nguyên vẹn, cùng baseline với các bước khác | no-crop | user | Existing | Vùng điện thoại final-s08 | embedded | local |
| app-checkout.png | 428x918 | 0.466 | Bằng chứng hai loại voucher | Screenshot | Màn hình nguyên vẹn, ngang hàng hai bước trước | no-crop | user | Existing | Vùng điện thoại final-s12 đã che thông tin giao hàng | embedded | local |
| app-tracking.png | 428x918 | 0.466 | Theo dõi đơn thực tế | Screenshot | Một màn hình làm điểm neo ở bìa | no-crop | user | Existing | Vùng điện thoại final-s16; tài xế được mô phỏng bằng SQL trong demo | embedded | local |
| app-ai.png | 720x1600 | 0.45 | Hội thoại AI và kết quả có giá | Screenshot | Màn hình nguyên vẹn bên kết luận | no-crop | user | Existing | portrait-review từ phần quay bổ sung AI, địa chỉ đã ẩn | embedded | local |

## IX. Content Outline

### Part 1: Báo cáo đồ án

#### Slide 01 - soopiFood

- **Audience move**: Chưa biết đề tài → hiểu sản phẩm và nhóm thực hiện.
- **Relationships**: Thành viên thuộc nhóm; ứng dụng liên kết chọn món, đặt hàng và theo dõi.
- **Composition**: Bìa bất đối xứng với tên lớn bên trái và màn hình theo dõi bên phải.
- **Title**: soopiFood
- **Core message**: Đặt món liền mạch. Theo dõi rõ ràng.
- **Content**: Báo cáo đồ án; GVHD Nguyễn Minh Hái; lớp 420300143202; Nguyễn Hữu Thịnh — 23690091; Huỳnh Anh Trọng — 23711131; Đào Thế Vinh — 23702541.
- **Images**: logo.png, app-tracking.png — nhận diện và trải nghiệm thật; chú thích demo SQL ở ghi chú.

#### Slide 02 - Kiến trúc hệ thống

- **Audience move**: Biết app → hiểu các giao diện, backend và nơi lưu dữ liệu.
- **Relationships**: App khách và app tài xế gọi Supabase; app khách gọi backend AI; web admin gọi API quản trị; API quản trị và backend AI gọi Supabase; Supabase dùng PostgreSQL và pgvector; backend AI gọi Gemini; API quản trị upload S3, app nhận link CDN qua B2 và Cloudflare.
- **Composition**: Sơ đồ phân tầng như ảnh người dùng: giao diện ở trên, vùng Supabase lớn và hai dịch vụ riêng ở giữa, dữ liệu và dịch vụ ngoài ở dưới. Dùng icon và ranh giới nét đứt, đường nối vuông góc.
- **Title**: Kiến trúc hệ thống
- **Core message**: Supabase là backend dùng chung; AI và API quản trị là hai dịch vụ riêng với quyền ở phía server.
- **Content**: App khách Expo / React Native; app tài xế trạng thái, GPS và chat; web admin trình duyệt. Supabase Auth (email, OAuth, JWT), Data API/RPC cho nghiệp vụ, Realtime cho tin nhắn và đơn hàng, Storage cho ảnh người dùng, RLS và quyền RPC. PostgreSQL + pgvector lưu dữ liệu và vector menu. API quản trị Node.js/Express kiểm tra JWT và quyền admin, CRUD và phân công. Backend AI Spring Boot/Spring AI thực hiện tool calling, vector và SSE. Gemini chat + embedding. Backblaze B2 upload S3, Cloudflare phân phối CDN. Khóa đặc quyền giữ ở backend.

#### Slide 03 - Công nghệ sử dụng

- **Audience move**: Hiểu kiến trúc → nhận diện công nghệ và vai trò của từng nhóm.
- **Relationships**: Công nghệ thuộc các nhóm ứng dụng, trạng thái và hiệu năng, backend và dữ liệu, AI, bản đồ và ảnh, quản trị và triển khai.
- **Composition**: Sáu nhóm trong hai cột, ba hàng; tên nhóm nổi bật và danh sách tên công nghệ ngắn, cùng tông xanh–trắng.
- **Title**: CÔNG NGHỆ SỬ DỤNG
- **Core message**: Các công nghệ được lựa chọn theo vai trò trong hệ thống.
- **Content**: Ứng dụng: Expo, React Native, TypeScript, Expo Router, NativeWind. Trạng thái và hiệu năng: Zustand, AsyncStorage, React Query, FlashList. Backend và dữ liệu: Supabase Auth, PostgreSQL, RPC/RLS, Realtime, Storage. AI: Java, Spring Boot, Spring AI, Google Gemini, pgvector, Tool Calling và SSE. Bản đồ và ảnh: Expo Location, Leaflet, OpenStreetMap, WebView, Backblaze B2, Cloudflare. Quản trị và triển khai: React/Vite, Node.js/Express, Docker, Render, Expo EAS, Git/GitHub, npm/Maven. Nội dung đã đối chiếu package.json, pom.xml và các file tích hợp.

#### Slide 04 - UI/UX theo hành trình đặt món

- **Audience move**: Hiểu thành phần → thấy người dùng thao tác thực tế.
- **Relationships**: Đăng nhập trước tìm quán, chọn món rồi xác nhận đơn.
- **Composition**: Ba màn hình thật cùng baseline với nhãn thứ tự, một cột nguyên tắc ngắn.
- **Title**: UI/UX theo hành trình đặt món
- **Core message**: Từ tìm quán đến thanh toán, thông tin cần thiết xuất hiện đúng lúc.
- **Content**: Đăng nhập email / OAuth; tìm quán và xem món; checkout với địa chỉ, người nhận và hai loại voucher. Giao diện tiếng Việt; phản hồi loading/error/empty; kiểm tra tùy chọn bắt buộc; phạm vi giao hàng 20 km.
- **Images**: app-login.png, app-search.png, app-checkout.png; ba bước ngang hàng, giữ nguyên nội dung.

#### Slide 05 - Dữ liệu thật và nghiệp vụ ở database

- **Audience move**: Thấy UI → hiểu quan hệ dữ liệu và nơi kiểm soát nghiệp vụ.
- **Relationships**: restaurants có foods; orders có order_items; order_items tham chiếu foods; profiles có orders; orders có reviews. RPC nối kiểm tra dữ liệu với ghi đơn và ưu đãi.
- **Composition**: Trái là các quan hệ lõi; phải là tuyến kiểm tra và ghi giao dịch.
- **Title**: Dữ liệu thật, nghiệp vụ có kiểm soát
- **Core message**: Database giữ đơn, snapshot tùy chọn và các khoản giảm riêng; client gửi yêu cầu qua RPC.
- **Content**: 29 bảng public được khai báo trong database.types.ts hiện tại, không phải kết quả đếm live. Nhóm dữ liệu danh mục; giao dịch; người dùng và giao hàng. create_food_order kiểm tra giá, phí ship, voucher; ghi orders và order_items với options_snapshot; RLS và RPC kiểm soát quyền; reviews, favorites và ví voucher kết nối dữ liệu thật. Không khẳng định mọi policy live đã được kiểm tra ở lần dựng này.

#### Slide 06 - Cache và AI có cơ chế cụ thể

- **Audience move**: Biết nghiệp vụ → hiểu kỹ thuật nổi bật và giới hạn bằng chứng.
- **Relationships**: React Query cache dữ liệu server; Zustand Persist lưu giỏ cục bộ; FlashList render danh sách. AI theo thứ tự yêu cầu → tool → vector → kiểm tra Supabase → kết quả.
- **Composition**: Hai vùng: cơ chế hiệu năng và đường đi AI, một chú thích giới hạn ở cuối.
- **Title**: Cache và AI có cơ chế cụ thể
- **Core message**: Tối ưu việc tải dữ liệu, giữ trạng thái và gợi ý món dựa trên menu thật.
- **Content**: React Query staleTime mặc định 60 giây, invalidation theo nghiệp vụ; Zustand Persist + AsyncStorage khôi phục giỏ; FlashList ở giỏ hàng. Gemini Tool Calling → tìm vector → kiểm tra nhóm, giá, còn món, quán mở và 20 km → trả lời tiếng Việt theo luồng. Chưa có benchmark để kết luận mức tăng tốc.

#### Slide 07 - Giám sát và mở rộng hệ thống

- **Audience move**: Hiểu cơ chế tối ưu → biết đo điểm nghẽn và chọn chiều mở rộng phù hợp.
- **Relationships**: So sánh hiện trạng giám sát với đề xuất; đối chiếu scale dọc (tài nguyên mỗi máy) và ngang (số bản chạy). Đo trước khi tối ưu hoặc tăng tài nguyên.
- **Composition**: Dải giám sát phía trên chia hiện trạng và đề xuất; hai cột dọc/ngang phía dưới; dải chốt lộ trình ở cuối. Không dùng số liệu vận hành giả lập.
- **Title**: GIÁM SÁT & MỞ RỘNG HỆ THỐNG
- **Core message**: Đo điểm nghẽn trước; Supabase tăng compute là scale dọc, backend tăng instance là scale ngang.
- **Content**: Hiện có log lỗi AI và tiến trình tạo vector, endpoint /api/ai/status chỉ kiểm tra cấu hình. Đề xuất dashboard/cảnh báo về độ trễ p95, lỗi, CPU/RAM, quota. Scale dọc: nâng compute CPU/RAM Supabase hoặc backend nếu tài nguyên thiếu; nâng gói không tự chia nhỏ database. Scale ngang: chạy nhiều instance AI/Admin sau cân bằng tải; read replicas chia tải đọc đủ điều kiện, dữ liệu ghi vẫn về primary và có độ trễ sao chép. Trước khi nhân bản AI cần một worker index và bộ giới hạn/quota dùng chung. Render Free chưa hỗ trợ nhiều instance. Đây là phương án đề xuất, chưa triển khai hay load test trong lần dựng này.

#### Slide 08 - SDLC và đóng góp của nhóm

- **Audience move**: Hiểu kỹ thuật → hiểu tiến trình phát triển và đóng góp có căn cứ.
- **Relationships**: Yêu cầu → thiết kế → lập trình → kiểm thử → triển khai → cải tiến; thành viên thuộc nhóm, có các đóng góp Git được cung cấp.
- **Composition**: Một đường sáu giai đoạn phía trên; ba vùng đóng góp bên dưới, không dùng bảng.
- **Title**: SDLC: phát triển qua từng vòng hoàn thiện
- **Core message**: Triển khai theo pha chức năng, kiểm tra logic và cải tiến từ phản hồi thực tế.
- **Content**: Yêu cầu / Thiết kế / Lập trình / Kiểm thử / Triển khai / Cải tiến. Đóng góp ghi nhận trong Git: Nguyễn Hữu Thịnh — App khách: tìm món, OAuth, đánh giá và đổi xu. Huỳnh Anh Trọng — AI: trả lời tiếng Việt, test hội thoại. Admin: sửa server. Đào Thế Vinh — Trang chủ, banner và chiến dịch voucher. Kiểm thử có npm test và typecheck; build APK qua EAS, backend AI có Dockerfile cho Render. Đây là khung tổng hợp quá trình, không phải biên bản nghiên cứu người dùng.

#### Slide 09 - Kết quả và bước tiếp theo

- **Audience move**: Hiểu dự án → nhớ kết quả và hướng phát triển có thể đánh giá.
- **Relationships**: Hành trình đặt món, theo dõi và hậu mãi tạo thành kết quả; benchmark, E2E ba app và giám sát là các việc tiếp theo.
- **Composition**: Kết luận lớn bên trái, ảnh AI bên phải; kết thúc bằng lời cảm ơn.
- **Title**: Đặt món liền mạch. Gợi ý đúng dữ liệu.
- **Core message**: soopiFood đã kết nối hành trình đặt món với dữ liệu và AI; cần tiếp tục đo lường và kiểm thử liên ứng dụng.
- **Content**: Đặt món + hai voucher; theo dõi + chat theo đơn; đánh giá + xu + ví voucher; AI hội thoại gợi ý món trong menu. Tiếp theo: đo độ trễ và tải; E2E app khách–admin–tài xế với GPS thật; theo dõi lỗi và quota AI. Cảm ơn thầy và các bạn.
- **Images**: app-ai.png — bằng chứng hội thoại và thẻ món, giữ nguyên toàn màn hình.

## X. Speaker Notes Requirements

- **Generation**: enabled
- **Filename**: match each SVG filename under notes/
- **Content**: Giải thích từng hình và cơ chế dựa trên code; phân biệt demo SQL, bằng chứng mã nguồn và việc chưa đo.
- **Total duration**: 5 phút; phân bổ 20 / 35 / 20 / 30 / 35 / 40 / 40 / 55 / 25 giây (mốc phân bổ mục tiêu).
- **Notes style**: Tiếng Việt, tự nhiên, báo cáo trực tiếp với giảng viên.
- **Presentation purpose**: Giải thích kiến trúc, UI/UX, database, SDLC và kỹ thuật nổi bật đã hiện thực.
