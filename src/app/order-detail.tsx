import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlowButton, FlowCard, FlowHeader } from '../components/FlowUI';
import { AppPressable } from '../components/AppPressable';
import { purchaseApi } from '../services/purchase';
import { reviewFlowApi } from '../services/reviewFlow';
import { useAuthStore } from '../store/authStore';
import { orderSnapshot } from '../features/order/orderSnapshot';
import { ORDER_LABELS, orderHistoryTime } from '../features/order/history';
import { currency } from '../features/order/checkout';

function Amount({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}><Text className={strong ? 'font-bold text-base text-ink' : 'text-sm text-muted'} style={{ flex: 1 }}>{label}</Text><Text className={strong ? 'font-bold text-base text-ink' : 'text-sm text-ink'}>{value}</Text></View>;
}

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const userId = useAuthStore(state => state.user?.id);
  const query = useQuery({ queryKey: ['order', userId, orderId], queryFn: ({ signal }) => purchaseApi.order(orderId!, userId!, signal), enabled: !!userId && !!orderId, staleTime: 0 });
  const order = query.data;
  const ids = [...new Set(order?.order_items.map(item => item.food_id) ?? [])];
  const foods = useQuery({ queryKey: ['order-food-images', orderId, ids], queryFn: ({ signal }) => reviewFlowApi.foods(ids, signal), enabled: !!order });
  return <SafeAreaView className="flex-1 bg-cream" edges={['top','left','right']}>
    <FlowHeader title="Chi tiết đơn hàng" />
    {!orderId ? <Text className="p-5 text-muted">Vui lòng chọn đơn hàng.</Text> : query.isPending ? <Text className="p-5 text-muted">Đang tải đơn hàng…</Text> : query.isError ? <View className="gap-4 p-5"><Text className="text-coral">Không tải được chi tiết đơn hàng.</Text><FlowButton title="Thử lại" onPress={() => { void query.refetch(); }} /></View> : !order ? <Text className="p-5 text-muted">Không tìm thấy đơn hàng của bạn.</Text> : <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 32 }}>
      <FlowCard><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text className="font-bold text-lg text-ink">{order.status === 'completed' ? 'Đơn hoàn tất' : ORDER_LABELS[order.status] ?? 'Đang cập nhật'}</Text>
        <AppPressable accessibilityRole="button" accessibilityLabel="Nhắn tin về đơn hàng" onPress={() => router.push({ pathname: '/chat', params: { orderId } })} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chatbubbles-outline" size={26} color="#008B45" /></AppPressable>
      </View></FlowCard>
      <FlowCard>
        <Text className="text-sm text-muted">● Từ</Text>
        <AppPressable accessibilityRole="button" onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: order.restaurant_id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text className="font-bold text-base text-ink" style={{ flex: 1 }}>{order.restaurants?.name ?? 'Quán ăn'}</Text><Ionicons name="chevron-forward" size={20} color="#9AA19A" /></AppPressable>
        {!!order.restaurants?.address && <Text className="text-sm text-muted">{order.restaurants.address}</Text>}
        <View style={{ height: 12 }} />
        <Text className="text-sm text-teal">● Đến</Text>
        <Text className="font-semibold text-base text-ink">{order.delivery_address}</Text>
        <Text className="text-sm text-muted">{[order.recipient_name,order.recipient_phone].filter(Boolean).join(' · ') || 'Đơn cũ chưa lưu thông tin người nhận.'}</Text>
      </FlowCard>
      <FlowCard><Text className="font-bold text-lg text-ink">Tóm tắt đơn hàng</Text>
        {order.order_items.map(item => {
          const food = foods.data?.find(row => row.id === item.food_id);
          const snapshot = orderSnapshot(item.options_snapshot, food?.name ?? 'Món ăn');
          const image = snapshot.image ?? food?.image_url;
          return <View key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 }}>
            <Image source={image ? { uri: image } : undefined} style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: '#F0F2F0' }} />
            <View style={{ flex: 1, gap: 7 }}><Text className="text-sm text-ink">{item.quantity} × {snapshot.name}</Text>{!!snapshot.description && <Text className="text-xs text-muted">{snapshot.description}</Text>}</View>
            <Text className="font-semibold text-sm text-ink">{currency(Number(item.unit_price) * item.quantity)}</Text>
          </View>;
        })}
        <View style={{ gap: 20, paddingTop: 12 }}>
          <Amount label={`Tổng (${order.order_items.reduce((sum,item) => sum + item.quantity,0)} món)`} value={currency(Number(order.subtotal))} strong />
          <Amount label="Phí giao hàng" value={currency(Number(order.delivery_fee))} />
          <Amount label="Giảm tiền món" value={`−${currency(Number(order.food_discount_amount))}`} />
          <Amount label="Giảm phí giao hàng" value={`−${currency(Number(order.shipping_discount_amount))}`} />
          <View style={{ borderTopWidth: 1, borderTopColor: '#EBEEEB', paddingTop: 20 }}><Amount label="Tổng thanh toán" value={currency(Number(order.total))} strong /></View>
          <Text className="text-sm text-muted">{order.payment_method === 'cash' ? 'Thanh toán khi nhận hàng' : `Phương thức thanh toán: ${order.payment_method ?? 'Chưa xác định'}`}</Text>
        </View>
      </FlowCard>
      <FlowCard><Text className="font-semibold text-sm text-ink">Thông tin đơn hàng</Text><Text selectable className="text-xs text-muted">Mã đơn: {order.id}</Text><Text className="text-sm text-muted">Đặt lúc {orderHistoryTime(order.created_at)}</Text></FlowCard>
      {order.status === 'completed' && <View className="mb-3"><FlowButton title="Đánh giá / Xem đánh giá" onPress={() => router.push({ pathname: '/rating', params: { orderId } })} /></View>}
      {order.status !== 'completed' && order.status !== 'cancelled' && <View className="mb-3"><FlowButton title="Theo dõi đơn hàng" onPress={() => router.push({ pathname: '/tracking', params: { orderId } })} /></View>}
      <FlowButton title="Đặt hàng lại" onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: order.restaurant_id } })} />
    </ScrollView>}
  </SafeAreaView>;
}
