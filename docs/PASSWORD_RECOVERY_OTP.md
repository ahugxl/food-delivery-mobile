# Quên mật khẩu bằng mã email

App dùng `resetPasswordForEmail(email)` để yêu cầu khôi phục, `verifyOtp({ email, token, type: 'recovery' })` để xác minh mã, rồi `updateUser({ password })`. Không dùng `signInWithOtp`, không tự tạo tài khoản và không cần chuyển hướng qua trình duyệt.

## Cấu hình Supabase một lần

Đã kiểm tra dashboard thực tế ngày 02/11/2026: dự án đang dùng dịch vụ gửi thư mặc định và trình chỉnh sửa mẫu bị khóa với thông báo **Set up custom SMTP to edit templates**. Luồng mã chưa dùng được với email mặc định hiện tại. Cần cấu hình SMTP riêng trước; các lựa chọn khác dashboard đưa ra là Pro hoặc Send Email Hook. Chưa đổi bất kỳ thiết lập SMTP nào.

1. Mở project Supabase → Authentication → Email / Email Templates → **Reset Password**.
2. Subject: `Mã xác nhận đặt lại mật khẩu soopiFood`.
3. Thay nội dung bằng file `supabase/templates/recovery.html`. Biến bắt buộc là `{{ .Token }}`; không dùng `{{ .ConfirmationURL }}` cho luồng nhập mã.
4. Lưu. Không thay nhầm mẫu Confirm signup hoặc Magic Link.

File trong repository không tự cập nhật mẫu email của Supabase hosted. Không cần thay URL Configuration để dùng luồng OTP này. Không thay cấu hình OAuth Google/Facebook, không tắt xác thực mã.

## Dùng Resend SMTP

1. Resend → Domains → Add domain: thêm tên miền hoặc subdomain bạn sở hữu. Thêm chính xác các bản ghi DNS Resend cung cấp và chờ Verified. Không dùng gmail.com làm tên miền gửi.
2. Resend → API Keys: tạo key có quyền gửi thư cho domain đó. Tự nhập key vào Supabase, không đưa vào app Expo, Git hoặc chat.
3. Supabase → Authentication → Emails → SMTP Settings: bật custom SMTP và nhập:

| Trường | Giá trị |
|---|---|
| Sender email | no-reply@TEN_MIEN_DA_XAC_MINH |
| Sender name | soopiFood |
| Host | smtp.resend.com |
| Port | 465 (SSL/TLS) |
| Username | resend |
| Password | Resend API key có quyền gửi thư |

4. Lưu SMTP rồi cập nhật mẫu Reset Password theo hướng dẫn phía trên bằng `{{ .Token }}`.
5. Từ app yêu cầu email mới, kiểm tra mã trong hộp thư và trạng thái gửi tại Resend → Emails.

`onboarding@resend.dev` chỉ gửi thử đến email của tài khoản Resend; muốn gửi mã cho các khách hàng khác phải xác minh tên miền riêng và đổi Sender email. Không cần cài SDK Resend vào Expo; Supabase gửi qua SMTP. Chưa cấu hình SMTP hoặc kiểm thử gửi thư thật thay cho người dùng.

Nguồn: https://resend.com/docs/send-with-smtp ; https://resend.com/docs/dashboard/domains/introduction ; https://resend.com/docs/knowledge-base/403-error-resend-dev-domain

App chấp nhận mã số 6–10 chữ số để hỗ trợ cấu hình độ dài OTP của dự án. Thời hạn và giới hạn số lần xác minh do Supabase quản lý; app có thời gian chờ gửi lại 60 giây, không thay thế giới hạn server.

## Kiểm thử thật

1. Dùng tài khoản kiểm thử có email nhận được thư, mở Quên mật khẩu và gửi mã.
2. Email mới phải hiển thị mã số, không yêu cầu mở liên kết; email cũ không thay đổi nội dung.
3. Nhập mã sai/hết hạn phải báo lỗi và không mở form mật khẩu.
4. Nhập mã mới nhất, đặt mật khẩu mới và xác nhận trùng nhau.
5. Đăng xuất, đăng nhập bằng mật khẩu mới; mật khẩu cũ phải bị từ chối.
6. Thử gửi lại mã sau thời gian chờ; kiểm tra trên Expo Go và APK/web nếu có.

Mã OTP, mật khẩu và token không được lưu trong URL, log hay file. Khi xác minh thành công Supabase tạo session, vì vậy màn hình `/reset-password` nằm ngoài nhóm route chỉ dành cho khách chưa đăng nhập, tránh bị đóng trước khi lưu mật khẩu. Trước khi đổi mật khẩu, app kiểm tra user hiện tại vẫn là user vừa xác minh.

Các tests tự động chỉ xác minh hợp đồng API và xử lý lỗi; không chứng minh email thực tế đã gửi hoặc mật khẩu tài khoản thật đã thay đổi.
