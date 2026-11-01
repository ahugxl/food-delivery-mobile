import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppPressable } from './AppPressable';
import { useOrderStore } from '../store/orderStore';
import { deliveryRange, MAX_DELIVERY_DISTANCE_KM } from '../features/location/deliveryRange';
import type { Row } from '../types/supabase';

export function DeliveryRangeNotice({ restaurant }: { restaurant: Row<'restaurants'> }) {
  const address = useOrderStore(state => state.deliveryAddress);
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const key = `${restaurant.id}:${restaurant.latitude}:${restaurant.longitude}:${address.latitude}:${address.longitude}`;
  const { distanceKm, outsideRange } = deliveryRange(restaurant, address);
  const close = () => setDismissed(key);
  return <>{outsideRange && <View className="mx-5 my-3 gap-2 rounded-2xl bg-red-50 p-4"><Text accessibilityRole="alert" className="text-sm text-coral">Quán ngoài phạm vi giao hàng 20 km. Bạn có thể xem thực đơn nhưng chưa thể thêm món hoặc đặt hàng tại địa chỉ này.</Text><AppPressable accessibilityRole="button" onPress={() => router.push('/select-location')}><Text className="font-semibold text-sm text-teal">Thay đổi địa chỉ giao hàng</Text></AppPressable></View>}<Modal visible={outsideRange && dismissed !== key} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <View accessibilityViewIsModal style={{ alignSelf: 'center', width: '100%', maxWidth: 520, maxHeight: '85%', backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E8ECE9', gap: 8 }}>
          <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', color: '#17241B', fontFamily: 'Inter_700Bold', fontSize: 20 }}>Ngoài phạm vi giao hàng</Text>
          <AppPressable accessibilityRole="button" accessibilityLabel="Đóng thông báo phạm vi giao hàng" onPress={close} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={27} color="#827A71"/></AppPressable>
        </View>
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 30, paddingBottom: 28, gap: 22 }}>
          <View style={{ width: 130, height: 130, borderRadius: 65, backgroundColor: '#E6F2E7', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="map-outline" size={76} color="#008B45"/><View style={{ position: 'absolute', right: 9, top: 13, backgroundColor: 'white', borderRadius: 20, padding: 4 }}><Ionicons name="location" size={31} color="#008B45"/></View></View>
          <Text style={{ textAlign: 'center', color: '#727772', fontSize: 16, lineHeight: 25 }}>Ui, địa chỉ quán ở quá xa! Quán cách địa chỉ giao hàng của bạn khoảng {distanceKm?.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km, vượt phạm vi {MAX_DELIVERY_DISTANCE_KM} km. Bạn vui lòng chọn quán gần hơn hoặc thay đổi địa chỉ nhé.</Text>
        </ScrollView>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <AppPressable accessibilityRole="button" onPress={() => { close(); router.replace('/search'); }} style={{ minHeight: 56, borderWidth: 1, borderColor: '#008B45', backgroundColor: '#008B45', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 12 }}><Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: 'white' }}>Tìm quán khác</Text></AppPressable>
          <AppPressable accessibilityRole="button" onPress={() => { close(); router.push('/select-location'); }} style={{ minHeight: 56, borderWidth: 1, borderColor: '#CBD5CE', borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 12 }}><Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: '#17241B' }}>Thay đổi địa chỉ</Text></AppPressable>
        </View>
      </View>
    </View>
  </Modal></>;
}
