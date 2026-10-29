import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlowButton, FlowCard, FlowHeader } from '../../components/FlowUI';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton';
import { useOrderTracking } from '../../hooks/useOrderTracking';
import MapPanel from '../../components/maps/MapPanel';
import { router } from 'expo-router';
import { currency } from './checkout';
import type { Json } from '../../types/database.types';
import { viLabel } from '../../utils/vietnamese';
import { OrderDriverInfo } from '../../components/OrderDriverInfo';

const statuses: Record<string, string> = { pending: 'Chờ quán xác nhận', preparing: 'Quán đang chuẩn bị món', delivering: 'Đang giao hàng', completed: 'Đã giao hàng', cancelled: 'Đã hủy' };

export default function ServerTracking({ orderId }: { orderId: string }) {
  const order = useOrderTracking(orderId);
  return <SafeAreaView className="flex-1 bg-cream">
    <FlowHeader title="Theo dõi đơn hàng" />
    {order.isPending ? <SkeletonGroup label="Đang tải đơn hàng"><View className="gap-4 p-5"><Skeleton height={150} /><Skeleton height={120} /></View></SkeletonGroup>
      : order.isError ? <View className="gap-4 p-5"><Text className="text-ink">Không tải được đơn hàng.</Text><FlowButton title="Thử lại" onPress={() => { void order.refetch(); }} /></View>
      : !order.data ? <Text className="p-5 text-ink">Không tìm thấy đơn hàng.</Text>
      : <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View className="mb-5 gap-3">
          <Text className="text-xs text-muted">{order.connection === 'connected' ? 'Đang đồng bộ trực tiếp' : 'Đang kết nối lại; tự tải lại trạng thái'}</Text>
          {order.destination && order.origin ? <MapPanel coordinate={order.destination} origin={order.origin} driver={order.driverLocation} simulation />
            : <Text className="rounded-2xl bg-tealLight p-4 text-sm text-muted">Đơn hoặc nhà hàng chưa có tọa độ, nên chưa thể vẽ tuyến đường. Các đơn mới sẽ lưu tọa độ đã chọn khi thanh toán.</Text>}
          {order.data.status === 'delivering' && order.destination && order.origin && <Text className="text-sm text-teal">{order.progress >= 1 ? 'Xe mô phỏng đã tới điểm giao. Trạng thái đơn vẫn do hệ thống quản lý.' : `Xe mô phỏng đang di chuyển · ${Math.round(order.progress * 100)}%`}</Text>}
          <FlowButton title="Nhắn tin về đơn hàng" onPress={() => router.push({ pathname: '/chat', params: { orderId } })} />
          {order.data.status === 'completed' && <FlowButton title="Đánh giá quán và tài xế" onPress={() => router.push({ pathname: '/rating', params: { orderId } })} />}
        </View>
        <FlowCard><Text className="font-bold text-xl text-ink">{statuses[order.data.status] ?? 'Đang cập nhật'}</Text>
          <Text selectable className="font-regular text-xs text-muted">Mã đơn #{order.data.id}</Text>
          <Text className="font-semibold text-base text-ink">{order.data.restaurants?.name ?? 'Quán ăn'}</Text>
          <OrderDriverInfo orderId={orderId} driverId={order.data.driver_id} />
        </FlowCard>
        <FlowCard><Text className="font-bold text-base text-ink">Địa chỉ giao hàng</Text><Text className="font-regular text-sm text-muted">{order.data.delivery_address}</Text><Text className="font-semibold text-sm text-ink">{[order.data.recipient_name, order.data.recipient_phone].filter(Boolean).join(' · ') || 'Đơn cũ chưa lưu thông tin người nhận.'}</Text></FlowCard>
        <FlowCard><Text className="font-bold text-base text-ink">Đơn hàng của bạn</Text>
          {order.data.order_items.map(item => <View key={item.id} className="gap-2 border-b border-line pb-3">
            <Text className="font-semibold text-sm text-ink">{item.quantity} × {snapshotName(item.options_snapshot, item.food_id)}</Text>
            <Text className="font-regular text-xs text-muted">{snapshotDescription(item.options_snapshot)}</Text>
            <Text className="font-medium text-sm text-ink">{currency(Number(item.unit_price) * item.quantity)}</Text>
          </View>)}
          <Text className="font-regular text-sm text-muted">Tạm tính: {currency(Number(order.data.subtotal))}</Text>
          <Text className="font-regular text-sm text-muted">Phí giao hàng: {currency(Number(order.data.delivery_fee))}</Text>
          <Text className="font-regular text-sm text-muted">Giảm tiền món: -{currency(Number(order.data.food_discount_amount ?? order.data.discount_amount))}</Text>
          <Text className="font-regular text-sm text-muted">Giảm phí giao hàng: -{currency(Number(order.data.shipping_discount_amount ?? 0))}</Text>
          <Text className="font-bold text-lg text-teal">Tổng cộng: {currency(Number(order.data.total))}</Text>
          <Text className="font-regular text-xs text-muted">Thanh toán khi nhận hàng</Text>
        </FlowCard>
      </ScrollView>}
  </SafeAreaView>;
}

function snapshotName(snapshot: Json, fallback: string) {
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && typeof snapshot.food_name === 'string' ? viLabel(snapshot.food_name) : fallback;
}
function snapshotDescription(snapshot: Json) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return '';
  const options = Array.isArray(snapshot.options) ? snapshot.options.flatMap(option => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return [];
    return typeof option.groupName === 'string' && typeof option.label === 'string' ? [`${viLabel(option.groupName)}: ${viLabel(option.label)}`] : [];
  }) : [];
  if (typeof snapshot.note === 'string' && snapshot.note) options.push(`Ghi chú: ${snapshot.note}`);
  return options.join(' · ');
}
