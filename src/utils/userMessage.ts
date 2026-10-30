import { DUPLICATE_ACCOUNT, isDuplicateAccount } from '../features/account/signup';
/** Only display localized messages; raw SDK/database errors belong in diagnostics. */
export function userMessage(error: unknown) {
    if (isDuplicateAccount(error)) return DUPLICATE_ACCOUNT;
    const message = typeof error === 'string' ? error : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : '';
    const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '';
    if (code === 'over_email_send_rate_limit' || /email.*rate limit|rate limit.*email/i.test(message))
        return 'Hệ thống đã chạm giới hạn gửi email xác nhận. Vui lòng thử lại sau hoặc liên hệ hỗ trợ. Đổi email hay bấm Đăng ký liên tục không khắc phục được giới hạn này.';
    if (code === 'email_address_not_authorized' || /email address not authorized/i.test(message))
        return 'Máy chủ chưa được cấu hình để gửi email xác nhận đến địa chỉ này. Vui lòng liên hệ hỗ trợ.';
    if (/invalid login/i.test(message))
        return 'Email hoặc mật khẩu không đúng.';
    if (/email not confirmed/i.test(message))
        return 'Vui lòng xác nhận email trước khi đăng nhập.';
    if (/already registered|already exists/i.test(message))
        return 'Email này đã được đăng ký.';
    if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || /rate limit|too many requests/i.test(message))
        return 'Bạn thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.';
    if (/expired.*(token|jwt)|(token|jwt).*expired|not authenticated|not signed in/i.test(message))
        return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (/voucher.*expired/i.test(message))
        return 'Mã ưu đãi đã hết hạn. Vui lòng chọn mã khác.';
    if (/voucher.*(inactive|invalid|not found|restaurant|minimum)/i.test(message))
        return 'Mã ưu đãi không phù hợp với đơn hàng này. Vui lòng kiểm tra lại.';
    if (/price.*changed|menu.*changed/i.test(message))
        return 'Giá hoặc thực đơn đã thay đổi. Vui lòng chọn lại món trước khi đặt.';
    if (/closed|unavailable/i.test(message))
        return 'Quán hoặc món ăn hiện chưa thể nhận đơn. Vui lòng kiểm tra lại.';
    if (/permission denied|row.level security|not allowed/i.test(message))
        return 'Bạn chưa có quyền thực hiện thao tác này. Vui lòng thử đăng nhập lại.';
    if (/fetch|network|connection|offline/i.test(message))
        return 'Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.';
    if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(message))
        return message;
    return 'Không thực hiện được thao tác. Vui lòng thử lại.';
}
