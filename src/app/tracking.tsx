import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ServerTracking from '../features/order/ServerTracking';
import { FlowButton, FlowHeader } from '../components/FlowUI';

export default function TrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  return orderId ? <ServerTracking key={orderId} orderId={orderId} /> : <SafeAreaView className="flex-1 bg-cream">
    <FlowHeader title="Order tracking" /><View className="gap-4 p-5"><Text className="text-sm text-muted">Chọn một đơn hàng để theo dõi trạng thái và chuyến đi.</Text>
      <FlowButton title="Mở đơn hàng của tôi" onPress={() => router.replace('/orders')} /></View>
  </SafeAreaView>;
}
