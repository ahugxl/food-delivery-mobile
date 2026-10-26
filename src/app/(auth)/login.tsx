import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import {
  AuthButton,
  AuthHeading,
  AuthInput,
  AuthMessage,
  AuthScreen,
  isValidEmail,
  SocialLogin,
} from '@/src/components/auth/AuthUI';
import { useAuthStore } from '@/src/store/authStore';
import { userMessage } from '../../utils/userMessage';

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    if (isLoading) return;
    if (!isValidEmail(email) || !password.trim()) {
      setMessage('Vui lòng nhập email hợp lệ và mật khẩu.');
      return;
    }

    setMessage('');
    try {
      await login(email, password);
      // Protected routing reacts to the authenticated session.
    } catch (error) {
      setMessage(userMessage(error));
    }
  };

  return (
    <AuthScreen back>
      <AuthHeading
        title="Chào mừng bạn trở lại!"
        subtitle="Đăng nhập để khám phá những quán ngon bạn yêu thích."
      />
      <AuthInput
        label="Email"
        icon="mail-outline"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
      />
      <AuthInput
        label="Mật khẩu"
        icon="lock-closed-outline"
        placeholder="Nhập mật khẩu"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleLogin}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          setMessage(
            'Chức năng đặt lại mật khẩu đang được phát triển. Vui lòng dùng mật khẩu đã đăng ký.',
          )
        }
        className="mb-5 min-h-11 self-end justify-center"
      >
        <Text className="font-semibold text-sm text-coral">
          Quên mật khẩu?
        </Text>
      </Pressable>
      <AuthMessage message={message} />
      <AuthButton title="Đăng nhập" onPress={handleLogin} loading={isLoading} />
      <SocialLogin />
      <View className="mt-auto flex-row flex-wrap items-center justify-center pt-8">
        <Text className="font-regular text-sm text-muted">
          Chưa có tài khoản?{' '}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace('/(auth)/register')}
          className="min-h-11 justify-center px-1"
        >
          <Text className="font-semibold text-sm text-coral">Đăng ký</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}
