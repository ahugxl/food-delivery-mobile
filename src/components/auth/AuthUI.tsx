import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { useState, type PropsWithChildren } from 'react';
import { useRef } from 'react';
import { startSocialLogin } from '../../services/socialAuth';
import { useAuthStore } from '../../store/authStore';
import { userMessage } from '../../utils/userMessage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '@/constants/colors';

export function AuthScreen({
  children,
  back = false,
}: PropsWithChildren<{ back?: boolean }>) {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View className="w-full max-w-md flex-1 self-center">
            {back && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quay lại màn hình chào"
                onPress={() => router.replace('/(auth)/welcome')}
                className="mb-8 h-12 w-12 items-center justify-center rounded-full border border-line bg-card active:opacity-70"
              >
                <Ionicons
                  name="arrow-back"
                  size={22}
                  color={colors.light.foreground}
                />
              </Pressable>
            )}
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View className="mb-8 gap-3">
      <View className="mb-2 h-14 w-14 items-center justify-center rounded-2xl bg-sage">
        <Ionicons
          name="restaurant"
          size={26}
          color={colors.light.accentForeground}
        />
      </View>
      <Text accessibilityRole="header" className="font-bold text-3xl text-ink">
        {title}
      </Text>
      <Text className="font-regular text-base leading-6 text-muted">
        {subtitle}
      </Text>
    </View>
  );
}

type AuthInputProps = TextInputProps & {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

export function AuthInput({
  label,
  icon,
  secureTextEntry = false,
  ...props
}: AuthInputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View className="mb-5 gap-2">
      <Text className="font-semibold text-sm text-ink">{label}</Text>
      <View
        className={`min-h-14 flex-row items-center rounded-2xl border bg-card px-4 ${focused ? 'border-teal' : 'border-line'}`}
      >
        <Ionicons name={icon} size={20} color={colors.light.mutedForeground} />
        <TextInput
          {...props}
          accessibilityLabel={label}
          className="min-h-14 flex-1 px-3 py-4 font-regular text-base text-ink"
          placeholderTextColor={colors.light.mutedForeground}
          secureTextEntry={secureTextEntry && !visible}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${visible ? 'Ẩn' : 'Hiện'} ${label.toLowerCase()}`}
            accessibilityState={{ checked: visible }}
            onPress={() => setVisible((value) => !value)}
            className="h-12 w-10 items-center justify-center"
          >
            <Ionicons
              name={visible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.light.mutedForeground}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function AuthButton({
  title,
  onPress,
  secondary = false,
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? 'Vui lòng chờ…' : title}
      accessibilityState={{ disabled: loading || disabled, busy: loading }}
      disabled={loading || disabled}
      onPress={onPress}
      style={{ flexShrink: 0 }}
      className={`min-h-14 items-center justify-center rounded-2xl border px-5 py-4 active:opacity-80 ${secondary ? 'border-line bg-card' : 'border-teal bg-teal'}`}
    >
      <Text
        style={{ alignSelf: 'stretch', textAlign: 'center', flexShrink: 0, includeFontPadding: true, paddingVertical: 2 }}
        className={`font-semibold text-base ${secondary ? 'text-ink' : 'text-white'}`}
      >
        {loading ? 'Vui lòng chờ…' : title}
      </Text>
    </Pressable>
  );
}

export function AuthMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="mb-5 rounded-xl bg-sage p-4 font-medium text-sm leading-5 text-forest"
    >
      {message}
    </Text>
  );
}

export function SocialLogin({ onBusyChange }: { onBusyChange?: (busy: boolean) => void } = {}) {
  const [message, setMessage] = useState('');
  const [providerLoading, setProviderLoading] = useState<string | null>(null);
  const emailLoading = useAuthStore(state => state.isLoading);
  const pending = useRef(false);
  const signIn = async (provider: 'google' | 'facebook') => {
    if (pending.current || emailLoading) return;
    pending.current = true; setProviderLoading(provider); onBusyChange?.(true); setMessage('');
    try { await startSocialLogin(provider); }
    catch (reason) { setMessage(userMessage(reason)); }
    finally { pending.current = false; setProviderLoading(null); onBusyChange?.(false); }
  };

  return (
    <View className="mt-6">
      <View className="mb-5 flex-row items-center gap-4">
        <View className="h-px flex-1 bg-line" />
        <Text className="font-regular text-sm text-muted">
          Hoặc
        </Text>
        <View className="h-px flex-1 bg-line" />
      </View>
      <View className="mb-4 gap-3">
        {(['Google', 'Facebook'] as const).map((provider) => (
          <Pressable
            key={provider}
            accessibilityRole="button"
            accessibilityLabel={`Tiếp tục với ${provider}`}
            accessibilityState={{ disabled: !!providerLoading || emailLoading, busy: providerLoading === provider.toLowerCase() }}
            disabled={!!providerLoading || emailLoading}
            onPress={() => { void signIn(provider === 'Google' ? 'google' : 'facebook'); }}
            style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E3E8E3', backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 12 }}
          >
            <Ionicons
              name={provider === 'Google' ? 'logo-google' : 'logo-facebook'}
              size={22}
              color={provider === 'Google' ? '#4285F4' : '#1877F2'}
            />
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#17241B', flexShrink: 1, textAlign: 'center' }}>{providerLoading === provider.toLowerCase() ? 'Đang kết nối…' : `Tiếp tục với ${provider}`}</Text>
          </Pressable>
        ))}
      </View>
      <AuthMessage message={message} />
    </View>
  );
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
