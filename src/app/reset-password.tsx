import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthButton, AuthHeading, AuthInput, AuthMessage, AuthScreen } from '../components/auth/AuthUI';
import { createPasswordRecovery } from '../services/passwordRecovery';
import { supabase } from '../services/supabase';
import { userMessage } from '../utils/userMessage';

const recovery = createPasswordRecovery(supabase);
export default function ResetPasswordScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const verifying = useRef<Promise<void> | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    verifying.current ??= recovery.verify(typeof code === 'string' ? code : '');
    void verifying.current.then(() => { if (active) setReady(true); }).catch(error => { if (active) setMessage(userMessage(error)); });
    return () => { active = false; };
  }, [code]);
  const save = async () => {
    if (!ready || busy) return;
    setBusy(true); setMessage('');
    try { await recovery.update(password, confirm); router.replace('/(tabs)'); }
    catch (error) { setMessage(userMessage(error)); }
    finally { setBusy(false); }
  };
  return <AuthScreen>
    <AuthHeading title="Đặt lại mật khẩu" subtitle={ready ? 'Tạo mật khẩu mới cho tài khoản SubiFood.' : 'Đang kiểm tra liên kết khôi phục…'} />
    {ready && <>
      <AuthInput label="Mật khẩu mới" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="Ít nhất 6 ký tự" secureTextEntry autoCapitalize="none" autoComplete="new-password" editable={!busy} />
      <AuthInput label="Xác nhận mật khẩu mới" icon="lock-closed-outline" value={confirm} onChangeText={setConfirm} placeholder="Nhập lại mật khẩu mới" secureTextEntry autoCapitalize="none" autoComplete="new-password" editable={!busy} />
    </>}
    <AuthMessage message={message} />
    <AuthButton title="Lưu mật khẩu mới" onPress={() => { void save(); }} loading={busy} disabled={!ready} />
    {!ready && !!message && <AuthButton title="Quay lại" onPress={() => router.replace('/(auth)/login')} />}
  </AuthScreen>;
}
