import type { SupabaseClient } from '@supabase/supabase-js';

export function createPasswordRecovery(client: Pick<SupabaseClient, 'auth'> | null) {
  const auth = () => {
    if (!client) throw new Error('Chưa cấu hình Supabase.');
    return client.auth;
  };
  const normalizeEmail = (email: string) => {
      const normalized = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Vui lòng nhập email hợp lệ.');
      return normalized;
  };
  return {
    async request(email: string) {
      // The Reset Password email template sends {{ .Token }}; no redirect is needed.
      const { error } = await auth().resetPasswordForEmail(normalizeEmail(email));
      if (error) throw error;
    },
    async verify(email: string, code: string): Promise<string> {
      const normalized = normalizeEmail(email);
      const token = code.replace(/\s/g, '');
      if (!/^\d{6,10}$/.test(token)) throw new Error('Nhập đầy đủ mã xác nhận gồm 6–10 chữ số trong email.');
      const { data, error } = await auth().verifyOtp({ email: normalized, token, type: 'recovery' });
      if (error) {
        if (error.code === 'otp_expired' || error.code === 'otp_disabled')
          throw new Error('Mã xác nhận không đúng hoặc đã hết hạn. Hãy kiểm tra mã mới nhất hoặc gửi lại mã.');
        throw error;
      }
      if (!data.session || !data.user?.id) throw new Error('Chưa xác minh được mã. Vui lòng gửi lại mã xác nhận.');
      return data.user.id;
    },
    async update(password: string, confirm: string, verifiedUserId: string) {
      if (password.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
      if (password !== confirm) throw new Error('Mật khẩu xác nhận không khớp.');
      if (!verifiedUserId) throw new Error('Vui lòng xác nhận mã email trước khi đặt mật khẩu mới.');
      const { data, error: sessionError } = await auth().getUser();
      if (sessionError || data.user?.id !== verifiedUserId)
        throw new Error('Phiên khôi phục đã thay đổi hoặc hết hạn. Vui lòng yêu cầu mã mới.');
      const { error } = await auth().updateUser({ password });
      if (error) throw error;
    },
  };
}
