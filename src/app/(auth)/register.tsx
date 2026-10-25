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
} from '@/src/components/auth/AuthUI';
import { useAuthStore } from '@/src/store/authStore';

export default function RegisterScreen() {
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = async () => {
    if (isLoading) return;
    if (!name.trim() || !isValidEmail(email)) {
      setMessage('Please enter your full name and a valid email address.');
      return;
    }
    if (password.trim().length < 6) {
      setMessage('Please choose a password with at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Your passwords do not match. Please try again.');
      return;
    }

    setMessage('');
    try {
      const signedIn = await register(name, email, password);
      setPassword('');
      setConfirmPassword('');
      if (!signedIn) setMessage('Check your email to confirm your account, then return here to log in.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to register. Please try again.');
    }
  };

  return (
    <AuthScreen back>
      <AuthHeading
        title="Create an account"
        subtitle="Sign up for good food and great moments."
      />
      <AuthInput
        label="Full Name"
        icon="person-outline"
        placeholder="Your full name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
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
        placeholder="At least 6 characters"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <AuthInput
        label="Confirm Password"
        icon="lock-closed-outline"
        placeholder="Re-enter your password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleRegister}
      />
      <AuthMessage message={message} />
      <AuthButton title="Sign Up" onPress={handleRegister} loading={isLoading} />
      <View className="mt-auto flex-row flex-wrap items-center justify-center pt-8">
        <Text className="font-regular text-sm text-muted">
          Already have an account?{' '}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace('/(auth)/login')}
          className="min-h-11 justify-center px-1"
        >
          <Text className="font-semibold text-sm text-coral">Login</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}
