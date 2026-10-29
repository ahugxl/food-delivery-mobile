import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { completeSocialLogin } from '../services/socialAuth';
import { useAuthStore } from '../store/authStore';
import { FlowButton } from '../components/FlowUI';
import { userMessage } from '../utils/userMessage';

export default function OAuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const authenticated = useAuthStore(state => state.isAuthenticated);
  const [error, setError] = useState('');
  useEffect(() => {
    if (authenticated) { router.replace('/(tabs)'); return; }
    let active = true;
    const query = new URLSearchParams();
    for (const key of ['code','error','error_description'] as const) if (typeof params[key] === 'string') query.set(key, params[key]);
    void completeSocialLogin(`${Linking.createURL('oauth-callback')}?${query}`).catch(reason => { if (active) setError(userMessage(reason)); });
    return () => { active = false; };
  }, [authenticated, params.code, params.error, params.error_description]);
  return <SafeAreaView className="flex-1 bg-white"><View className="flex-1 justify-center gap-5 p-6"><Text accessibilityRole={error ? 'alert' : undefined} className="text-center text-base text-ink">{error || 'Đang hoàn tất đăng nhập…'}</Text>{!!error && <FlowButton title="Quay lại đăng nhập" onPress={() => router.replace('/(auth)/login')} />}</View></SafeAreaView>;
}
