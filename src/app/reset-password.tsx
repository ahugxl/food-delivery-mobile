import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { AuthButton, AuthHeading, AuthInput, AuthMessage, AuthScreen } from '../components/auth/AuthUI';
import { AppPressable } from '../components/AppPressable';
import { createPasswordRecovery } from '../services/passwordRecovery';
import { supabase } from '../services/supabase';
import { userMessage } from '../utils/userMessage';

const recovery = createPasswordRecovery(supabase);
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; resendAt?: string }>();
  const email = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const [resendAt, setResendAt] = useState(() => {
    const value = Number(params.resendAt);
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), Date.now() + 60000) : 0;
  });
  const [now, setNow] = useState(Date.now());
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    if (verifiedUserId || resendAt <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, verifiedUserId]);

  const verify = async () => {
    if (lock.current || !validEmail) return;
    lock.current = true; setBusy(true); setMessage(''); setNotice('');
    try {
      const userId = await recovery.verify(email, code);
      setCode(''); setVerifiedUserId(userId);
    } catch (error) { setMessage(userMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  };
  const resend = async () => {
    if (lock.current || !validEmail || Date.now() < resendAt) return;
    lock.current = true; setBusy(true); setMessage(''); setNotice('');
    try {
      await recovery.request(email);
      setCode(''); setNow(Date.now()); setResendAt(Date.now() + 60000);
      setNotice('Nếu email có tài khoản, mã mới sẽ được gửi đến hộp thư. Hãy dùng mã trong email mới nhất.');
    } catch (error) { setMessage(userMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  };
  const save = async () => {
    if (!verifiedUserId || lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      await recovery.update(password, confirm, verifiedUserId);
      setPassword(''); setConfirm('');
      Toast.show({ type: 'success', text1: 'Đã cập nhật mật khẩu.' });
      router.replace('/(tabs)');
    } catch (error) { setMessage(userMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  };
  // This route stays outside the guest-only stack: verifyOtp creates a session,
  // but must not unmount the password form when auth state changes.
  return <AuthScreen>
    <AuthHeading title={verifiedUserId ? 'Đặt lại mật khẩu' : 'Nhập mã xác nhận'}
      subtitle={verifiedUserId ? 'Tạo mật khẩu mới cho tài khoản soopiFood.'
        : validEmail ? `Nếu email ${email} có tài khoản, bạn sẽ nhận được mã xác nhận. Kiểm tra cả thư rác và nhập mã ngay bên dưới.`
        : 'Vui lòng gửi mã xác nhận từ màn hình Quên mật khẩu.'}/>
    {validEmail && (verifiedUserId ? <>
      <AuthInput label="Mật khẩu mới" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Ít nhất 6 ký tự" secureTextEntry autoCapitalize="none" autoComplete="new-password" editable={!busy}/>
      <AuthInput label="Xác nhận mật khẩu mới" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} placeholder="Nhập lại mật khẩu mới" secureTextEntry autoCapitalize="none" autoComplete="new-password" editable={!busy}/>
    </> : <AuthInput label="Mã xác nhận trong email" icon="key-outline" value={code} onChangeText={setCode}
      placeholder="Nhập mã xác nhận" keyboardType="number-pad" inputMode="numeric" maxLength={16}
      autoComplete="one-time-code" textContentType="oneTimeCode" autoCapitalize="none" autoCorrect={false} editable={!busy}/>)}
    <AuthMessage message={message}/>
    {!!notice && <Text accessibilityLiveRegion="polite" className="mb-4 text-sm text-teal">{notice}</Text>}
    {validEmail && <AuthButton title={verifiedUserId ? 'Lưu mật khẩu mới' : 'Xác nhận mã'}
      onPress={() => { void (verifiedUserId ? save() : verify()); }} loading={busy}/>}
    {validEmail && !verifiedUserId && <View className="mt-4">
      <AuthButton title={remaining ? `Gửi lại mã sau ${remaining}s` : 'Gửi lại mã'} onPress={() => { void resend(); }} secondary disabled={busy || remaining > 0}/>
    </View>}
    {!verifiedUserId && <AppPressable accessibilityRole="link" disabled={busy}
      onPress={() => router.replace({ pathname: '/(auth)/forgot-password', params: { email } })} className="mt-4 min-h-11 items-center justify-center">
      <Text className="font-semibold text-teal">{validEmail ? 'Đổi email' : 'Gửi mã xác nhận'}</Text>
    </AppPressable>}
  </AuthScreen>;
}
