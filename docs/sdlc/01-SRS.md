# 1. Requirement Analysis — SRS

## 1.1. Mục đích và phạm vi

soopiFood là ứng dụng đặt món, giúp khách tìm quán/món phù hợp, tùy chỉnh món, đặt đơn COD, theo dõi giao hàng, liên lạc và đánh giá. Frontend hiện tại là ứng dụng khách hàng React Native/Expo có bản web. Backend nghiệp vụ chủ yếu nằm ở Supabase; dịch vụ Java riêng hỗ trợ AI gợi ý món.

Repository có schema/RPC tích hợp tài xế và tài liệu bàn giao admin, nhưng chưa thấy một ứng dụng tài xế hoặc giao diện quản trị hoàn chỉnh trong `src/app`. Vì vậy không đưa hai giao diện này vào danh sách sản phẩm UI đã hoàn thành. Nhà hàng là bên liên quan nghiệp vụ; chưa có cổng nhà hàng được xác minh trong repository.

Thanh toán online, cuộc gọi VoIP hoàn chỉnh, push notification và việc phát hành lên store không được xem là đã hoàn thành chỉ vì có bảng dữ liệu hoặc cấu hình liên quan.

## 1.2. Thu thập yêu cầu từ người dùng giả định

**Phương pháp:** xây dựng persona và phỏng vấn mô phỏng, kết hợp phân tích các luồng đang có. Bảng dưới là dữ liệu giả định phục vụ môn học, không phải phỏng vấn đã thực hiện. Nhóm có thể thay bằng biên bản khảo sát thật; cần lưu ngày, người tham gia, câu hỏi và chấp thuận sử dụng thông tin.

| Persona giả định | Câu hỏi phỏng vấn | Câu trả lời mô phỏng | Yêu cầu rút ra |
|---|---|---|---|
| Sinh viên đặt bữa trưa | Điều gì khiến bạn khó chọn món? | Muốn tìm món theo từ khóa, giá và quán gần điểm giao | FR-02, FR-10 |
| Nhân viên văn phòng | Bạn cần biết gì trước khi xác nhận? | Giá món, topping, phí ship và số tiền cuối sau voucher | FR-03, FR-04, FR-05 |
| Khách đặt cho người thân | Người đặt và người nhận có giống nhau không? | Không; cần lưu tên và điện thoại người nhận riêng | FR-06 |
| Khách đang chờ đơn | Bạn muốn theo dõi điều gì? | Trạng thái đơn, tiến độ tài xế và nhắn tin khi cần | FR-07, FR-08 |
| Khách quay lại | Điều gì giúp đặt nhanh lần sau? | Quán yêu thích, địa chỉ đã lưu, mã ưu đãi và xu | FR-04, FR-06, FR-09 |
| Tài xế giả định | Cần thông tin nào để giao đúng? | Điểm lấy/giao, người nhận, COD và trạng thái chuyến | FR-11 |
| Quản trị giả định | Cần kiểm soát dữ liệu gì? | Quán, món, voucher, nhóm khám phá, tài xế | FR-12 |

**Kết luận phân tích:** ưu tiên tính đúng đắn của checkout và quyền truy cập, sau đó là tìm kiếm, theo dõi, liên lạc và gợi ý AI. AI hỗ trợ khám phá; khách tự lựa chọn và xác nhận đặt đơn.

## 1.3. Actor và ranh giới hệ thống

| Actor | Vai trò và quyền |
|---|---|
| A-01 Khách chưa đăng nhập | Đăng ký, đăng nhập, khôi phục mật khẩu; truy cập các màn được router cho phép |
| A-02 Khách hàng đã đăng nhập | Tìm món, giỏ hàng, đặt/xem đơn của mình, hồ sơ/địa chỉ, voucher, đánh giá, chat, AI |
| A-03 Tài xế | Tương tác qua app tích hợp bên ngoài: hồ sơ, online, chuyến giao, vị trí và chat theo RPC |
| A-04 Quản trị | Quản lý dữ liệu/quyền và điều phối qua công cụ/backend được cấp quyền; UI admin ngoài phạm vi repo này |
| A-05 Supabase Auth và dịch vụ email/OAuth | Cấp phiên, xác thực, gửi email hoặc kết nối nhà cung cấp đăng nhập |
| A-06 Gemini | Tạo embedding và phản hồi AI qua backend Java |
| A-07 Dịch vụ bản đồ | Cung cấp nền bản đồ theo cấu hình; định vị do thiết bị cấp quyền |

Supabase DB, RPC, Storage và Realtime là thành phần backend của sản phẩm. Không mô tả cơ sở dữ liệu như một người dùng cuối.

## 1.4. Yêu cầu chức năng

Ưu tiên **Must** là chức năng cốt lõi cần nghiệm thu; **Should** là phần bổ trợ; mức ưu tiên này là đề xuất cho bài nộp.

| Mã | Yêu cầu | Ưu tiên | Tiêu chí nghiệm thu |
|---|---|---|---|
| FR-01 | Đăng ký, đăng nhập, đăng xuất, phục hồi phiên, OTP đặt lại mật khẩu; OAuth khi provider được cấu hình | Must | Sai thông tin báo lỗi; không tạo phiên giả; OTP đúng mới đổi mật khẩu; đổi tài khoản dọn dữ liệu liên quan |
| FR-02 | Xem danh mục/quán/menu, tìm kiếm và nhóm khám phá, xem chi tiết món | Must | Dữ liệu gắn UUID thật; xử lý loading/rỗng/lỗi; món/quán không khả dụng không được đặt |
| FR-03 | Chọn tùy chọn, số lượng, ghi chú; lưu giỏ theo tài khoản | Must | Tùy chọn bắt buộc hợp lệ; một đơn thuộc một quán; dữ liệu còn khi gửi đơn thất bại |
| FR-04 | Thu thập voucher, ví mã, chọn giảm món và giảm ship, đổi xu | Should | Kiểm tra đúng phạm vi/hạn/điều kiện; không dùng lại hoặc đổi xu trùng khi retry |
| FR-05 | Tạo đơn COD và tính hóa đơn trên server | Must | Tạo đơn/items nguyên tử; giá và phí được xác minh lại; retry cùng request không tạo hai đơn |
| FR-06 | Hồ sơ, ảnh đại diện, sổ địa chỉ, ghim giao hàng và người nhận riêng | Must | Chỉ sửa dữ liệu được phép của mình; một địa chỉ mặc định; sửa sổ địa chỉ không đổi hóa đơn cũ |
| FR-07 | Lịch sử, chi tiết và theo dõi tiến độ/vị trí tài xế | Must | Khách chỉ xem đơn của mình; trạng thái phản ánh backend; thiếu GPS không tự coi là vị trí thật |
| FR-08 | Chat văn bản/ảnh theo đơn | Should | Chỉ người có quyền truy cập; gửi trong thời gian cho phép; sau đóng chat vẫn xem lịch sử được cấp quyền |
| FR-09 | Yêu thích quán, đánh giá tài xế/quán/món và hiển thị tổng hợp | Should | Gắn tài khoản và đơn; chỉ đánh giá đơn đủ điều kiện; retry không nhân đôi kết quả |
| FR-10 | Hỏi AI bằng tiếng Việt và xem gợi ý món | Should | Hỏi tối đa 600 ký tự; trả tối đa 5 thẻ được xác minh; lỗi cấu hình/quota không sinh món giả |
| FR-11 | Cung cấp hợp đồng tích hợp tài xế | Must cho backend | RPC kiểm tra quyền và trạng thái chuyển; app khách đọc tiến độ phù hợp; nghiệm thu app tài xế riêng |
| FR-12 | Cung cấp dữ liệu và hợp đồng quản trị catalog/voucher/nhóm khám phá | Should | Thao tác quản trị cần quyền server; không cho khách tự nâng vai trò; UI admin cần bàn giao riêng |
| FR-13 | Banner chiến dịch và thu thập mã gắn chiến dịch | Should | Liên kết banner–voucher đúng; phân biệt mã tương lai, hết hạn, ngừng hoạt động và khả dụng |

FR-01…FR-10 và FR-13 có mã phía khách; FR-11 có schema/RPC; FR-12 có tài liệu và một số RPC. Trạng thái chạy thực tế xem hồ sơ Testing, không suy ra từ bảng yêu cầu.

## 1.5. Quy tắc nghiệp vụ

| Mã | Quy tắc và căn cứ |
|---|---|
| BR-01 | Giỏ có 1–100 dòng khi checkout; mỗi dòng 1–99 suất; mọi dòng cùng quán (`features/order/purchase.ts`) |
| BR-02 | Ghi chú tối đa 500 ký tự; địa chỉ 5–500 ký tự; người nhận phải qua `recipientInput` |
| BR-03 | VND; phí ship = 15.000 + ceil(max(0, d − 2)) × 5.000, với d là km Haversine; không phải độ dài tuyến đường giao thông (`utils/distance.ts`) |
| BR-04 | Điểm giao và tọa độ quán phải hợp lệ; phạm vi tối đa 20 km; client và database đều có kiểm tra |
| BR-05 | Giảm món không vượt subtotal; giảm ship không vượt phí ship; tổng = subtotal + ship − hai khoản giảm |
| BR-06 | UUID request checkout được tái sử dụng khi retry cùng payload; server kiểm tra chủ sở hữu, khóa và trả đơn đã tạo |
| BR-07 | Snapshot món/tùy chọn/người nhận/địa chỉ bảo toàn nội dung hóa đơn; không tính lại đơn cũ từ menu hiện tại |
| BR-08 | Chat gửi được khi đơn pending/preparing/delivering; completed chỉ trong 5 phút kể từ completed_at; cancelled không cho gửi |
| BR-09 | Vai trò do backend kiểm soát; người dùng không được đổi role bằng form hồ sơ hoặc user metadata |
| BR-10 | AI không tự đặt đơn. Backend kiểm tra phiên, lọc và kiểm tra lại món. Lịch sử gửi lên tối đa 12 lượt, mỗi lượt tối đa 2.000 ký tự theo ApiTypes |

Ví dụ BR-03/05: subtotal 100.000 VND, khoảng cách 3,1 km → ship 25.000 VND; giảm món 20.000 và giảm ship 10.000 → tổng 95.000 VND. Đây là ví dụ tính toán, không phải dữ liệu đơn thật.

## 1.6. Đặc tả use case

### UC-01 — Truy cập tài khoản (FR-01)

- Actor: A-01. Tiền điều kiện: app có cấu hình Auth và mạng phù hợp.
- Luồng chính: nhập email/mật khẩu → kiểm tra đầu vào → gọi Auth → nhận phiên → tải dữ liệu theo tài khoản.
- Đăng ký: gửi tên/điện thoại theo luồng signup; nếu yêu cầu xác nhận email thì hướng dẫn xác nhận, không coi là đã đăng nhập.
- Ngoại lệ: sai mật khẩu, email chưa xác nhận, provider chưa bật, mất mạng → thông báo phù hợp; không dùng phiên mock.
- Khôi phục: gửi email → nhập OTP → verify recovery → kiểm tra user phiên → cập nhật mật khẩu.
- Hậu điều kiện: có phiên hợp lệ hoặc giữ trạng thái chưa đăng nhập rõ ràng.

### UC-02 — Tìm và thêm món (FR-02, FR-03)

- Actor: A-02. Tiền điều kiện: có catalog và vị trí giao hợp lệ khi kiểm tra khả năng đặt.
- Luồng chính: tìm/chọn quán → mở món → chọn nhóm bắt buộc và topping → nhập số lượng/ghi chú → thêm giỏ.
- Ngoại lệ: quán đóng cửa, món ngừng bán, ngoài 20 km, chọn thiếu tùy chọn → không thêm; khác quán phải xử lý thay giỏ theo UI.
- Hậu điều kiện: giỏ lưu cấu hình đã chọn và tổng tạm tính, chưa có đơn server.

### UC-03 — Đặt đơn COD (FR-03…FR-06)

- Actor: A-02. Tiền điều kiện: đăng nhập, giỏ hợp lệ, điểm giao và người nhận hợp lệ.
- Luồng chính: mở checkout → chọn địa chỉ/người nhận → chọn voucher món/ship nếu có → xem tổng → xác nhận → tạo request UUID → gọi RPC → server kiểm tra và ghi transaction → nhận đơn → xóa giỏ → theo dõi.
- Ngoại lệ E1: giá thay đổi/voucher không hợp lệ → báo lỗi và giữ giỏ để sửa.
- Ngoại lệ E2: mất phản hồi → retry cùng UUID; không tạo hóa đơn trùng.
- Ngoại lệ E3: insert item lỗi → transaction rollback, không giữ hóa đơn thiếu item.
- Hậu điều kiện thành công: có order/items và snapshot nhất quán; phương thức cash.

### UC-04 — Theo dõi và liên lạc (FR-07, FR-08, FR-11)

- Actor: A-02; A-03 qua hệ thống tích hợp.
- Tiền điều kiện: đơn thuộc khách và có quyền đọc; nếu chưa gán tài xế thì UI phản ánh trạng thái đó.
- Luồng chính: mở đơn → tải hóa đơn/tiến độ → đăng ký cập nhật → xem vị trí được phép → mở chat và gửi tin/ảnh.
- Ngoại lệ: không có GPS, mất mạng, hết cửa sổ chat, đơn người khác → trạng thái chờ/lỗi hoặc từ chối đúng quyền.
- Hậu điều kiện: không tự thay trạng thái đơn bằng thao tác phía khách.

### UC-05 — Đánh giá và đổi xu (FR-04, FR-09)

- Actor: A-02. Tiền điều kiện: đơn đủ điều kiện đánh giá; đổi xu cần đủ số dư.
- Luồng chính: mở đánh giá → gửi từng giai đoạn tài xế/quán và phản hồi món → tải lại kết quả → vào ưu đãi → chọn mức đổi → RPC kiểm tra và cấp voucher riêng.
- Ngoại lệ: đơn không hợp lệ, gửi lại, thiếu xu → không tạo đánh giá/phần thưởng trùng.
- Hậu điều kiện: dữ liệu đánh giá/xu/voucher phản ánh kết quả server.

### UC-06 — Hỏi AI chọn món (FR-10)

- Actor: A-02, A-06. Tiền điều kiện: backend AI cấu hình hợp lệ, có menu được lập chỉ mục.
- Luồng chính: nhập nhu cầu và dùng điểm giao → gửi Bearer token/câu hỏi/lịch sử giới hạn → xác thực → truy xuất ứng viên → kiểm tra lại dữ liệu hiện hành → stream câu trả lời và thẻ → khách mở chi tiết món.
- Ngoại lệ: 401/429/503, chưa lập chỉ mục, không có món phù hợp, luồng SSE gián đoạn → thông báo có thể hành động; không coi câu chữ model là dữ liệu hóa đơn.
- Hậu điều kiện: hiển thị gợi ý; giỏ/đơn chỉ thay đổi khi khách thao tác riêng.

### UC-07 — Quản lý hồ sơ và địa chỉ (FR-06)

Actor A-02 chọn sửa hồ sơ hoặc thêm/sửa/xóa địa chỉ → validate → RPC/Storage → tải lại. Xóa địa chỉ mặc định cần có kết quả mặc định nhất quán; avatar lỗi upload không được thông báo lưu thành công. Dữ liệu người nhận tách với tài khoản đăng nhập.

### UC-08 — Lưu quán và thu thập ưu đãi (FR-04, FR-09, FR-13)

Actor A-02 lưu/bỏ quán yêu thích hoặc mở banner/ưu đãi → xem điều kiện → thu thập mã → mở ví. Thao tác lỗi phải rollback trạng thái hiển thị hoặc báo lỗi; mã hết hạn/đã dùng/không đủ điều kiện không được coi là sẵn sàng checkout.

### UC-09 — Tích hợp tài xế/quản trị (FR-11, FR-12)

Actor A-04 duyệt/điều phối theo quyền; A-03 cập nhật chuyến/vị trí qua RPC. Backend kiểm tra role, trạng thái và chủ chuyến, ghi sự kiện. UI hai actor này nằm ngoài ứng dụng khách trong repo; nghiệm thu tích hợp cần môi trường và client riêng.

## 1.7. Yêu cầu phi chức năng

| Mã | Yêu cầu và tiêu chí | Trạng thái bằng chứng |
|---|---|---|
| NFR-01 | Bảo mật: user A không đọc/sửa đơn, địa chỉ và ảnh riêng của B; key quyền cao chỉ ở server | Có thiết kế RLS/RPC; còn cần kiểm tra live toàn diện |
| NFR-02 | Toàn vẹn: checkout nguyên tử, idempotent; tổng tiền do server quyết định | Có code và test; một số SQL suite đang blocked |
| NFR-03 | Dễ dùng: tiếng Việt, VND, trạng thái loading/rỗng/lỗi và cách thử lại | Có triển khai; cần nghiệm thu UI trên thiết bị |
| NFR-04 | Hiệu năng mục tiêu đề xuất: p95 API thường ≤2 giây trên bộ dữ liệu/mạng test được ghi rõ | Chưa đo tải; không coi đây là kết quả hiện có |
| NFR-05 | AI có giới hạn: 20 yêu cầu/10 phút/user/instance; pool 2 worker; request thường chờ tối đa 45 giây; SSE emitter 65 giây | Căn cứ RecommendationService/AiController; chưa load test |
| NFR-06 | Khả năng bảo trì: TypeScript typecheck, module tách UI/service/rule, test tái chạy được | Typecheck PASS; test SQL chưa hoàn toàn tái lập |
| NFR-07 | Tương thích: bản web và Android cần kiểm tra riêng; iOS cần máy/môi trường phù hợp | Không suy ra native PASS từ build web |

## 1.8. Điều kiện nghiệm thu bài nộp

Nhóm chỉ ghi “đạt” sau khi: chạy bộ unit/integration cần thiết; xử lý blockers hoặc công bố rõ; demo đăng nhập → chọn món → đặt đơn test → theo dõi → đánh giá; xác minh user khác không truy cập đơn; cài được từ source trên môi trường sạch. Báo cáo phải tách kết quả thực thi khỏi mục tiêu và giả định.
