import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Text, View, useWindowDimensions } from 'react-native';
import { AppPressable } from '../../components/AppPressable';
import { AuthButton, AuthInput, AuthMessage, AuthScreen, isValidEmail, SocialLogin } from '../../components/auth/AuthUI';
import { useAuthStore } from '../../store/authStore';
import { userMessage } from '../../utils/userMessage';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const login = useAuthStore(state => state.login);
  const isLoading = useAuthStore(state => state.isLoading);
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [socialBusy, setSocialBusy] = useState(false);
  const { height } = useWindowDimensions();
  const logoSize = Math.min(168, Math.max(116, height * .19));
  const busy = isLoading || socialBusy;
  const handleLogin = async () => {
    if (busy) return;
    if (!isValidEmail(email) || !password.trim()) { setMessage('Vui lòng nhập email hợp lệ và mật khẩu.'); return; }
    setMessage('');
    try { await login(email, password); }
    catch (reason) { setMessage(userMessage(reason)); }
  };
  return <AuthScreen>
    <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 28, gap: 10 }}>
      <Image source={require('../../../assets/images/subifood-logo.png')} accessibilityLabel="Logo soopiFood" contentFit="contain" style={{ width: logoSize, height: logoSize, borderRadius: 30 }} />
      <Text accessibilityRole="header" style={{ fontFamily: 'Inter_700Bold', fontSize: 28, color: '#006B3A', letterSpacing: -.5 }}>soopiFood</Text>
    </View>
    <AuthInput label="Email" icon="mail-outline" placeholder="Nhập email" value={email} onChangeText={setEmail} editable={!busy} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
    <AuthInput label="Mật khẩu" icon="lock-closed-outline" placeholder="Nhập mật khẩu" value={password} onChangeText={setPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => { void handleLogin(); }} />
    <AuthMessage message={message} />
    <AppPressable accessibilityRole="link" disabled={busy} onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { email } })} className="mb-3 min-h-11 justify-center self-end"><Text className="font-semibold text-sm text-teal">Quên mật khẩu?</Text></AppPressable>
    <AuthButton title="Đăng nhập" onPress={() => { void handleLogin(); }} loading={isLoading} disabled={socialBusy} />
    <SocialLogin onBusyChange={setSocialBusy} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingBottom: 12 }}>
      <Text className="font-regular text-sm text-muted">Chưa có tài khoản? </Text>
      <AppPressable accessibilityRole="link" disabled={busy} onPress={() => router.push('/(auth)/register')} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}><Text className="font-semibold text-sm text-teal">Đăng ký</Text></AppPressable>
    </View>
  </AuthScreen>;
}
