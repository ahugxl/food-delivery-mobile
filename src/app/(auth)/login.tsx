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

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    if (isLoading) return;
    if (!isValidEmail(email) || !password.trim()) {
      setMessage('Please enter a valid email address and your password.');
      return;
    }

    setMessage('');
    try {
      await login(email, password);
      // Protected routing reacts to the authenticated session.
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to log in. Please try again.');
    }
  };

  return (
    <AuthScreen back>
      <AuthHeading
        title="Welcome back!"
        subtitle="Login to find your next favorite meal."
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
        label="Password"
        icon="lock-closed-outline"
        placeholder="Enter your password"
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
            'Password reset is coming soon. Please use your registered password.',
          )
        }
        className="mb-5 min-h-11 self-end justify-center"
      >
        <Text className="font-semibold text-sm text-coral">
          Forgot Password?
        </Text>
      </Pressable>
      <AuthMessage message={message} />
      <AuthButton title="Login" onPress={handleLogin} loading={isLoading} />
      <SocialLogin />
      <View className="mt-auto flex-row flex-wrap items-center justify-center pt-8">
        <Text className="font-regular text-sm text-muted">
          Don't have an account?{' '}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace('/(auth)/register')}
          className="min-h-11 justify-center px-1"
        >
          <Text className="font-semibold text-sm text-coral">Sign Up</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}
