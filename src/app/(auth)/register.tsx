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
import { userMessage } from '../../utils/userMessage';
import { isDuplicateAccount, signupPhone } from '../../features/account/signup';

export default function RegisterScreen() {
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [duplicate, setDuplicate] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleRegister = async () => {
    if (isLoading) return;
    if (!name.trim() || !isValidEmail(email)) {
      setMessage('Vui lòng nhập họ tên và email hợp lệ.');
      return;
    }
    if (password.trim().length < 6) {
      setMessage('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setMessage('Mật khẩu xác nhận không khớp. Vui lòng thử lại.');
      return;
    }

    setMessage('');
    setDuplicate(false);
    try {
      const signedIn = await register(name, email, password, signupPhone(phone));
      setPassword('');
      setConfirmPassword('');
      if (!signedIn) setMessage('Vui lòng xác nhận tài khoản qua email, sau đó quay lại đăng nhập.');
    } catch (error) {
      setDuplicate(isDuplicateAccount(error));
      setMessage(userMessage(error));
    }
  };

  return (
    <AuthScreen back>
      <AuthHeading
        title="Tạo tài khoản"
        subtitle="Đăng ký để đặt món ngon mỗi ngày."
      />
      <AuthInput
        label="Họ và tên"
        icon="person-outline"
        placeholder="Nhập họ và tên"
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
      <AuthInput label="Số điện thoại" icon="call-outline" placeholder="Ví dụ: 0812345678" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" editable={!isLoading} maxLength={25} />
      <AuthInput
        label="Mật khẩu"
        icon="lock-closed-outline"
        placeholder="Ít nhất 6 ký tự"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <AuthInput
        label="Xác nhận mật khẩu"
        icon="lock-closed-outline"
        placeholder="Nhập lại mật khẩu"
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
      {duplicate && <View className="mb-4 flex-row flex-wrap gap-5">
        <Pressable accessibilityRole="link" onPress={() => router.replace({ pathname: '/(auth)/login', params: { email: email.trim() } })} className="min-h-11 justify-center"><Text className="font-semibold text-teal">Đăng nhập</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { email: email.trim() } })} className="min-h-11 justify-center"><Text className="font-semibold text-teal">Quên mật khẩu</Text></Pressable>
      </View>}
      <AuthButton title="Đăng ký" onPress={handleRegister} loading={isLoading} />
      <View className="mt-auto flex-row flex-wrap items-center justify-center pt-8">
        <Text className="font-regular text-sm text-muted">
          Đã có tài khoản?{' '}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace('/(auth)/login')}
          className="min-h-11 justify-center px-1"
        >
          <Text className="font-semibold text-sm text-coral">Đăng nhập</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}
