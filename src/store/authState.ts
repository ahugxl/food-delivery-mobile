import { create } from 'zustand';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { duplicateAccountError, isDuplicateAccount, signupPhone } from '../features/account/signup';

export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
};

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

export function createAuthStore(client: Pick<SupabaseClient, 'auth'> | null, accountExists?: (phone: string, email: string) => Promise<boolean>) {
  return create<AuthState>((set, get) => {
    const applySession = (session: Session | null) => {
      const user = session?.user;
      set({
        isInitialized: true,
        isAuthenticated: !!user,
        user: user ? {
          id: user.id,
          name: user.user_metadata.full_name || user.email?.split('@')[0] || 'Tài khoản của bạn',
          email: user.email || '',
          avatar: user.user_metadata.avatar_url || null,
        } : null,
      });
    };
    const requireClient = () => {
      if (!client) throw new Error('Chưa cấu hình Supabase. Vui lòng kiểm tra cấu hình kết nối rồi khởi động lại ứng dụng.');
      return client;
    };
    const perform = async <T,>(action: () => Promise<T>): Promise<T> => {
      if (get().isLoading) throw new Error('Đang xử lý đăng nhập. Vui lòng chờ.');
      set({ isLoading: true, error: null });
      try {
        return await action();
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Không thể kết nối. Vui lòng thử lại.' });
        throw error;
      } finally {
        set({ isLoading: false });
      }
    };
    return {
      user: null,
      isAuthenticated: false,
      isInitialized: false,
      isLoading: false,
      error: null,
      initialize: () => {
        if (!client) {
          applySession(null);
          return () => {};
        }
        let active = true;
        let receivedEvent = false;
        const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
          if (!active) return;
          receivedEvent = true;
          applySession(session);
        });
        void client.auth.getSession().then(({ data, error }) => {
          // A sign-in/out event takes priority over an older storage read.
          if (!active || receivedEvent) return;
          if (error) set({ error: error.message });
          applySession(error ? null : data.session);
        }).catch((error: unknown) => {
          if (!active || receivedEvent) return;
          set({ error: error instanceof Error ? error.message : 'Không khôi phục được phiên đăng nhập.' });
          applySession(null);
        });
        return () => { active = false; subscription.unsubscribe(); };
      },
      login: (email, password) => perform(async () => {
        const { data, error } = await requireClient().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) throw error;
        applySession(data.session);
      }),
      register: (name, email, password, phone) => perform(async () => {
        const normalizedPhone = signupPhone(phone);
        if (name.trim().length < 2 || name.trim().length > 100) throw new Error('Họ tên cần từ 2 đến 100 ký tự.');
        const normalizedEmail = email.trim().toLowerCase();
        if (accountExists && await accountExists(normalizedPhone, normalizedEmail)) throw duplicateAccountError();
        const { data, error } = await requireClient().auth.signUp({
          email: normalizedEmail, password,
          options: { data: { full_name: name.trim(), phone: normalizedPhone } },
        });
        if (error) {
          if (isDuplicateAccount(error)) throw duplicateAccountError();
          // A concurrent registration may have reserved the same phone after preflight.
          if (error.code === 'unexpected_failure' && accountExists && await accountExists(normalizedPhone, normalizedEmail)) throw duplicateAccountError();
          throw error;
        }
        // With confirmation enabled, Supabase can return an obfuscated existing user.
        if (data.user?.identities?.length === 0) throw duplicateAccountError();
        applySession(data.session);
        return !!data.session;
      }),
      logout: () => perform(async () => {
        const { error } = await requireClient().auth.signOut({ scope: 'local' });
        if (error) throw error;
        applySession(null);
      }),
    };
  });
}
