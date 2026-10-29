import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { createSocialAuthFlow, type SocialProvider } from './socialAuthFlow';

WebBrowser.maybeCompleteAuthSession();
const flow = supabase ? createSocialAuthFlow(supabase, {
  redirectTo: Linking.createURL('oauth-callback'),
  web: Platform.OS === 'web',
  openSession: (url, redirectTo) => WebBrowser.openAuthSessionAsync(url, redirectTo),
  ensureEnabled: async provider => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10000);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '' }, signal: abort.signal });
      if (!response.ok) throw new Error('Không kiểm tra được cấu hình đăng nhập. Vui lòng thử lại.');
      const settings: { external?: Partial<Record<SocialProvider, boolean>> } = await response.json();
      if (!settings.external?.[provider]) throw new Error(`Đăng nhập ${provider === 'google' ? 'Google' : 'Facebook'} chưa được cấu hình trên Supabase. Vui lòng dùng email và mật khẩu.`);
    } finally { clearTimeout(timer); }
  },
}) : null;

export function startSocialLogin(provider: SocialProvider) {
  if (!flow) throw new Error('Chưa cấu hình Supabase.');
  return flow.start(provider);
}
export function completeSocialLogin(url: string) {
  if (!flow) throw new Error('Chưa cấu hình Supabase.');
  return flow.complete(url);
}
