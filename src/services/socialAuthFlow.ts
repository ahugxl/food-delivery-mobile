import type { SupabaseClient } from '@supabase/supabase-js';

export type SocialProvider = 'google' | 'facebook';
export function oauthCode(url: string) {
  const params = new URL(url).searchParams;
  if (params.get('error') || params.get('error_description')) throw new Error(params.get('error_description') || 'Đăng nhập mạng xã hội chưa thành công.');
  const code = params.get('code');
  if (!code) throw new Error('Không nhận được mã xác thực đăng nhập.');
  return code;
}

export function createSocialAuthFlow(client: Pick<SupabaseClient, 'auth'>, options: {
  redirectTo: string;
  web: boolean;
  ensureEnabled: (provider: SocialProvider) => Promise<void>;
  openSession: (url: string, redirectTo: string) => Promise<{ type: string; url?: string }>;
}) {
  let exchange: { code: string; promise: Promise<void> } | null = null;
  const complete = (url: string) => {
    const code = oauthCode(url);
    if (exchange?.code === code) return exchange.promise;
    const promise = client.auth.exchangeCodeForSession(code).then(({ error }) => { if (error) throw error; }).catch(error => { exchange = null; throw error; });
    exchange = { code, promise };
    return promise;
  };
  return {
    complete,
    async start(provider: SocialProvider) {
      await options.ensureEnabled(provider);
      const { data, error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: options.redirectTo, skipBrowserRedirect: !options.web } });
      if (error) throw error;
      if (options.web) return;
      if (!data.url) throw new Error('Không mở được trang đăng nhập.');
      const result = await options.openSession(data.url, options.redirectTo);
      if (result.type !== 'success') return;
      if (!result.url) throw new Error('Không nhận được kết quả đăng nhập.');
      const actual = new URL(result.url), expected = new URL(options.redirectTo);
      if (actual.protocol !== expected.protocol || actual.host !== expected.host || actual.pathname !== expected.pathname) throw new Error('Đường dẫn đăng nhập trả về không hợp lệ.');
      await complete(result.url);
    },
  };
}
