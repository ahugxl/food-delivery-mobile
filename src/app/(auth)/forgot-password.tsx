import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { Text } from 'react-native';
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
  const [sent, setSent] = useState(false);
  const send = async () => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      await recovery.request(email, Linking.createURL('reset-password'));
      setSent(true);
    } catch (error) { setMessage(userMessage(error)); }
    finally { setBusy(false); }
  };
  return <AuthScreen back>
    <AuthHeading title="Quên mật khẩu" subtitle="Nhập email của tài khoản cần khôi phục. Mở liên kết trong email trên chính thiết bị này." />
    <AuthInput label="Email đã đăng ký" icon="mail-outline" value={email} onChangeText={value => { setEmail(value); setSent(false); }} placeholder="Nhập email đã đăng ký" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy} />
    {sent && <Text className="mb-5 text-base text-teal">Nếu email có tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra cả thư rác. Nếu đăng nhập bằng Google/Facebook, bạn cũng có thể tiếp tục với tài khoản đó.</Text>}
    <AuthMessage message={message} />
    <AuthButton title={sent ? 'Đã gửi yêu cầu' : 'Gửi liên kết khôi phục'} onPress={() => { void send(); }} loading={busy} disabled={sent} />
    <AppPressable accessibilityRole="link" onPress={() => router.replace({ pathname: '/(auth)/login', params: { email } })} className="min-h-11 items-center justify-center mt-4"><Text className="font-semibold text-teal">Quay lại đăng nhập</Text></AppPressable>
  </AuthScreen>;
}
