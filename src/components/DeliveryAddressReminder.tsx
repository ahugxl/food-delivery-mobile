import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppPressable } from './AppPressable';
import { useSavedAddresses } from '../hooks/useSavedAddresses';
import { useLocationStore } from '../store/locationStore';
import { useOrderStore } from '../store/orderStore';
import { deliveryFromSaved } from '../features/account/validation';
import { differsFromDefault } from '../features/location/addressReminder';

export function DeliveryAddressReminder() {
  const query = useSavedAddresses();
  const detected = useLocationStore(state => state.detected);
  const dismissed = useLocationStore(state => state.reminderDismissed);
  const dismiss = useLocationStore(state => state.dismissReminder);
  const current = useOrderStore(state => state.deliveryAddress);
  const savedDefault = query.data?.find(row => row.is_default);
  // A saved address or a different manual pin means the user already chose the destination.
  if (dismissed || !query.isSuccess || current.savedAddressId || current.street !== detected?.street ||
      !differsFromDefault(detected, savedDefault ? (deliveryFromSaved(savedDefault) ?? { street: savedDefault.address, label: 'Other' }) : null)) return null;
  return <View accessibilityLiveRegion="polite" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: -8, zIndex: 30, elevation: 8, borderRadius: 10, backgroundColor: '#333333', flexDirection: 'row', alignItems: 'center' }}>
    <View pointerEvents="none" style={{ position: 'absolute', top: -6, left: 17, borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 6, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#333333' }}/>
    <AppPressable accessibilityRole="button" accessibilityLabel="Kiểm tra địa chỉ giao hàng" onPress={() => { dismiss(); router.push('/select-location'); }} style={{ flex: 1, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Text style={{ color: 'white', fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 }}>Đừng quên kiểm tra địa chỉ giao hàng nhé bạn ơi!</Text>
    </AppPressable>
    <AppPressable accessibilityRole="button" accessibilityLabel="Đóng lời nhắc địa chỉ giao hàng" onPress={dismiss} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={20} color="white"/></AppPressable>
  </View>;
}
