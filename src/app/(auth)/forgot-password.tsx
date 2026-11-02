import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthButton, AuthHeading, AuthInput, AuthMessage, AuthScreen } from '../../components/auth/AuthUI';
import { AppPressable } from '../../components/AppPressable';
import { createPasswordRecovery } from '../../services/passwordRecovery';
import { supabase } from '../../services/supabase';
import { userMessage } from '../../utils/userMessage';

const recovery = createPasswordRecovery(supabase);
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sending = useRef(false);
  const send = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true); setMessage('');
    try {
      await recovery.request(email);
      router.push({ pathname: '/reset-password', params: { email: email.trim().toLowerCase(), resendAt: String(Date.now() + 60000) } });
    } catch (error) { setMessage(userMessage(error)); }
    finally { sending.current = false; setBusy(false); }
  };
  return <AuthScreen back>
    <AuthHeading title="Quên mật khẩu" subtitle="Nhập email đã đăng ký để nhận mã xác nhận và đặt lại mật khẩu ngay trong app." />
    <AuthInput label="Email đã đăng ký" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="Nhập email đã đăng ký" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} />
    <AuthMessage message={message} />
    <AuthButton title="Gửi mã xác nhận" onPress={() => { void send(); }} loading={busy} />
    <AppPressable accessibilityRole="link" onPress={() => router.replace({ pathname: '/(auth)/login', params: { email } })} className="min-h-11 items-center justify-center mt-4"><Text className="font-semibold text-teal">Quay lại đăng nhập</Text></AppPressable>
  </AuthScreen>;
}
