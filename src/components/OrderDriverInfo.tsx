import { Text, View } from 'react-native';
import { useOrderDriver } from '../hooks/useOrderDriver';
import { DriverAvatar } from './DriverAvatar';
import { AppPressable } from './AppPressable';
import { userMessage } from '../utils/userMessage';

export function OrderDriverInfo({ orderId, driverId }: { orderId: string; driverId: string | null | undefined }) {
  const driver = useOrderDriver(orderId, driverId);
  if (driver.isPending) return <Text accessibilityLiveRegion="polite" className="text-sm text-muted">Đang tải thông tin tài xế…</Text>;
  if (driver.isError) return <AppPressable accessibilityRole="button" onPress={() => { void driver.refetch(); }} className="min-h-11 justify-center"><Text className="text-sm text-coral">{userMessage(driver.error)} Chạm để thử lại.</Text></AppPressable>;
  const profile = driver.data.profile;
  return <View className="flex-row items-center gap-3">
    <DriverAvatar size={54} path={profile?.avatar_url} />
    <View className="flex-1 gap-1">
      <Text className="font-bold text-base text-ink">{profile?.full_name?.trim() || (driver.data.driverId ? 'Tài xế chưa cập nhật hồ sơ' : 'Chưa phân công tài xế')}</Text>
      <Text className="text-xs text-muted">{driver.data.driverId ? 'Tài xế được phân công cho đơn hàng' : 'Thông tin sẽ cập nhật khi có tài xế nhận đơn.'}</Text>
      {!!profile?.phone && <Text selectable className="text-sm text-ink">Số điện thoại: {profile.phone}</Text>}
    </View>
  </View>;
}
