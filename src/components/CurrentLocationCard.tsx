import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppPressable } from './AppPressable';
import { useLocationStore } from '../store/locationStore';
import { useOrderStore } from '../store/orderStore';
import { useCartStore } from '../store/cartStore';
import { hasRecipient } from '../features/order/recipient';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import type { Row } from '../types/supabase';

export function CurrentLocationCard({ selectionMode = false }: { selectionMode?: boolean }) {
  const { status, detected, coordinates, error, retry } = useLocationStore();
  const client = useQueryClient();
  const userId = useAuthStore(state => state.user?.id);
  const locked = useCartStore(state => state.isCheckingOut);
  if (status === 'idle') return null;
  return <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 18, gap: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Ionicons name="location" size={25} color="#008B45"/><Text className="flex-1 font-bold text-base text-ink">Vị trí hiện tại</Text>{status === 'locating' && <ActivityIndicator color="#008B45"/>}</View>
    {status === 'locating' ? <Text accessibilityLiveRegion="polite" className="text-sm text-muted">Đang tìm vị trí và địa chỉ của bạn…</Text> : detected ? <>
      <AppPressable accessibilityRole="button" accessibilityLabel={`Giao đến vị trí hiện tại: ${detected.street}`} disabled={locked} onPress={() => {
        if (useCartStore.getState().isCheckingOut) return;
        useOrderStore.getState().setDeliveryAddress(detected);
        if (selectionMode) router.canGoBack() ? router.back() : router.replace('/');
      }} className="gap-3 py-2"><Text className="font-semibold text-base text-ink">{detected.street}</Text><Text className="text-sm text-muted">{[detected.recipientName, detected.recipientPhone].filter(Boolean).join(' · ')}</Text></AppPressable>
      {!hasRecipient(detected) && <Text className="text-sm text-muted">Bổ sung tên và số điện thoại người nhận trước khi đặt hàng.</Text>}
      <AppPressable accessibilityRole="button" disabled={locked} onPress={() => {
        if (useCartStore.getState().isCheckingOut) return;
        useOrderStore.getState().setDeliveryAddress(detected);
        router.push('/delivery-location');
      }} className="min-h-11 justify-center"><Text className="font-semibold text-sm text-teal">Sửa địa chỉ và người nhận</Text></AppPressable>
    </> : null}
    {!!error && <Text accessibilityRole="alert" className="text-sm text-muted">{error}</Text>}
    {status === 'error' && coordinates && <AppPressable accessibilityRole="button" disabled={locked} onPress={() => {
      if (useCartStore.getState().isCheckingOut) return;
      const profile = client.getQueryData<Pick<Row<'profiles'>, 'full_name' | 'phone'>>(['profile', userId]);
      useOrderStore.getState().setDeliveryAddress({ ...coordinates, street: '', label: 'Other', recipientName: profile?.full_name ?? '', recipientPhone: profile?.phone ?? '' });
      router.push('/delivery-location');
    }} className="min-h-11 justify-center"><Text className="font-semibold text-sm text-teal">Nhập địa chỉ cho vị trí đã tìm được</Text></AppPressable>}
    {status === 'error' && <AppPressable accessibilityRole="button" disabled={locked} onPress={retry} className="min-h-11 justify-center"><Text className="font-semibold text-sm text-teal">Định vị lại</Text></AppPressable>}
  </View>;
}
