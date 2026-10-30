import type { SupabaseClient } from '@supabase/supabase-js';

export function createPasswordRecovery(client: Pick<SupabaseClient, 'auth'> | null) {
  const auth = () => {
    if (!client) throw new Error('Chưa cấu hình Supabase.');
    return client.auth;
  };
  return {
    async request(email: string, redirectTo: string) {
      const normalized = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('Vui lòng nhập email hợp lệ.');
      const { error } = await auth().resetPasswordForEmail(normalized, { redirectTo });
      if (error) throw error;
    },
    async verify(code: string) {
      if (!code) throw new Error('Liên kết khôi phục không hợp lệ. Vui lòng yêu cầu gửi lại email.');
      const { data, error } = await auth().exchangeCodeForSession(code);
      if (error) throw error;
      if (!data.session) throw new Error('Liên kết khôi phục đã hết hạn. Vui lòng yêu cầu gửi lại email.');
    },
    async update(password: string, confirm: string) {
      if (password.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
      if (password !== confirm) throw new Error('Mật khẩu xác nhận không khớp.');
      const { error } = await auth().updateUser({ password });
      if (error) throw error;
    },
  };
}
