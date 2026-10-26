import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlowButton, FlowCard, FlowHeader } from '../../components/FlowUI';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton';
import { useOrderTracking } from '../../hooks/useOrderTracking';
import MapPanel from '../../components/maps/MapPanel';
import { router } from 'expo-router';
import { currency } from './checkout';
import type { Json } from '../../types/database.types';

const statuses: Record<string, string> = { pending: 'Waiting for restaurant confirmation', preparing: 'Preparing your food', delivering: 'On the way', completed: 'Delivered', cancelled: 'Cancelled' };

export default function ServerTracking({ orderId }: { orderId: string }) {
  const order = useOrderTracking(orderId);
  return <SafeAreaView className="flex-1 bg-cream">
    <FlowHeader title="Order tracking" />
    {order.isPending ? <SkeletonGroup label="Loading order"><View className="gap-4 p-5"><Skeleton height={150} /><Skeleton height={120} /></View></SkeletonGroup>
      : order.isError ? <View className="gap-4 p-5"><Text className="text-ink">Unable to load your order.</Text><FlowButton title="Try again" onPress={() => { void order.refetch(); }} /></View>
      : !order.data ? <Text className="p-5 text-ink">Order not found.</Text>
      : <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="mb-5 gap-3">
          <Text className="text-xs text-muted">{order.connection === 'connected' ? 'Realtime đã kết nối' : 'Đang kết nối lại; tự tải lại trạng thái'}</Text>
          {order.destination && order.origin ? <MapPanel coordinate={order.destination} origin={order.origin} driver={order.driverLocation} simulation />
            : <Text className="rounded-2xl bg-tealLight p-4 text-sm text-muted">Đơn hoặc nhà hàng chưa có tọa độ, nên chưa thể vẽ tuyến đường. Các đơn mới sẽ lưu tọa độ đã chọn khi checkout.</Text>}
          {order.data.status === 'delivering' && order.destination && order.origin && <Text className="text-sm text-teal">{order.progress >= 1 ? 'Xe mô phỏng đã tới điểm giao. Trạng thái đơn vẫn do server quản lý.' : `Xe mô phỏng đang di chuyển · ${Math.round(order.progress * 100)}%`}</Text>}
          <FlowButton title="Chat về đơn hàng" onPress={() => router.push({ pathname: '/chat', params: { orderId } })} />
          {order.data.status === 'completed' && <FlowButton title="Đánh giá quán và tài xế" onPress={() => router.push({ pathname: '/rating', params: { orderId } })} />}
        </View>
        <FlowCard><Text className="font-bold text-xl text-ink">{statuses[order.data.status] ?? order.data.status}</Text>
          <Text selectable className="font-regular text-xs text-muted">Order #{order.data.id}</Text>
          <Text className="font-semibold text-base text-ink">{order.data.restaurants?.name ?? 'Restaurant'}</Text>
          <Text className="font-regular text-sm text-muted">{order.data.driver_id ? 'A driver has been assigned.' : 'A driver has not been assigned yet.'}</Text>
        </FlowCard>
        <FlowCard><Text className="font-bold text-base text-ink">Delivery address</Text><Text className="font-regular text-sm text-muted">{order.data.delivery_address}</Text></FlowCard>
        <FlowCard><Text className="font-bold text-base text-ink">Your order</Text>
          {order.data.order_items.map(item => <View key={item.id} className="gap-2 border-b border-line pb-3">
            <Text className="font-semibold text-sm text-ink">{item.quantity} × {snapshotName(item.options_snapshot, item.food_id)}</Text>
            <Text className="font-regular text-xs text-muted">{snapshotDescription(item.options_snapshot)}</Text>
            <Text className="font-medium text-sm text-ink">{currency(Number(item.unit_price) * item.quantity)}</Text>
          </View>)}
          <Text className="font-regular text-sm text-muted">Subtotal: {currency(Number(order.data.subtotal))}</Text>
          <Text className="font-regular text-sm text-muted">Delivery: {currency(Number(order.data.delivery_fee))}</Text>
          <Text className="font-regular text-sm text-muted">Discount: -{currency(Number(order.data.discount_amount))}</Text>
          <Text className="font-bold text-lg text-teal">Total: {currency(Number(order.data.total))}</Text>
          <Text className="font-regular text-xs text-muted">Payment: Cash on delivery</Text>
        </FlowCard>
        <FlowButton title={order.isFetching ? 'Refreshing...' : 'Refresh status'} disabled={order.isFetching} onPress={() => { void order.refetch(); }} />
      </ScrollView>}
  </SafeAreaView>;
}

function snapshotName(snapshot: Json, fallback: string) {
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && typeof snapshot.food_name === 'string' ? snapshot.food_name : fallback;
}
function snapshotDescription(snapshot: Json) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return '';
  const options = Array.isArray(snapshot.options) ? snapshot.options.flatMap(option => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return [];
    return typeof option.groupName === 'string' && typeof option.label === 'string' ? [`${option.groupName}: ${option.label}`] : [];
  }) : [];
  if (typeof snapshot.note === 'string' && snapshot.note) options.push(`Note: ${snapshot.note}`);
  return options.join(' · ');
}
