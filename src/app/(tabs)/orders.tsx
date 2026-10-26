import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlowButton, FlowCard } from '../../components/FlowUI';
import { AppPressable } from '../../components/AppPressable';
import { useMyOrders } from '../../hooks/useMyOrders';
import { ORDER_LABELS, orderSection, type OrderSection } from '../../features/order/history';
import { currency } from '../../features/order/checkout';

export default function OrdersScreen() {
  const query = useMyOrders();
  const [section, setSection] = useState<OrderSection>('active');
  const orders = (query.data ?? []).filter(order => orderSection(order.status) === section);
  return <SafeAreaView className="flex-1 bg-cream">
    <View className="gap-4 p-5"><Text className="font-bold text-2xl text-ink">Đơn hàng của tôi</Text>
      <View accessibilityRole="tablist" className="flex-row gap-3">{(['active','history'] as const).map(value => <AppPressable key={value} accessibilityRole="tab" accessibilityLabel={value === 'active' ? 'Đang đến' : 'Lịch sử'} accessibilityState={{ selected: section === value }} onPress={() => setSection(value)} className={`min-h-12 flex-1 items-center justify-center rounded-2xl border ${section === value ? 'border-teal bg-tealLight' : 'border-line bg-card'}`}><Text className="font-semibold text-sm text-ink">{value === 'active' ? 'Đang đến' : 'Lịch sử'}</Text></AppPressable>)}</View>
    </View>
    {query.isPending ? <Text className="p-5 text-muted">Đang tải đơn hàng...</Text> : query.isError && !query.data ? <View className="gap-4 p-5"><Text className="text-coral">Không tải được đơn hàng.</Text><FlowButton title="Thử lại" onPress={() => { void query.refetch(); }} /></View>
      : <FlatList data={orders} keyExtractor={item => item.id} contentContainerStyle={{ padding: 20 }} refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}
        renderItem={({ item }) => <FlowCard><View className="flex-row items-center gap-3"><Image source={item.restaurants?.image_url ? { uri: item.restaurants.image_url } : undefined} style={{ width: 64, height: 64, borderRadius: 16 }} contentFit="cover" />
          <View className="flex-1 gap-1"><Text className="font-bold text-base text-ink">{item.restaurants?.name ?? 'Nhà hàng'}</Text><Text selectable className="text-xs text-muted">#{item.id}</Text><Text className="text-xs text-muted">{new Date(item.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</Text></View></View>
          <View className="flex-row justify-between"><Text className="font-semibold text-sm text-teal">{ORDER_LABELS[item.status] ?? 'Đang cập nhật'}</Text><Text className="font-bold text-base text-ink">{currency(Number(item.total))}</Text></View>
          <FlowButton title={section === 'active' ? 'Theo dõi đơn' : 'Xem hóa đơn'} onPress={() => router.push({ pathname: '/tracking', params: { orderId: item.id } })} />
          {item.status === 'completed' && <FlowButton title="Đánh giá / Xem đánh giá" onPress={() => router.push({ pathname: '/rating', params: { orderId: item.id } })} />}
          {section === 'history' && <AppPressable accessibilityRole="button" onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: item.restaurant_id } })} className="min-h-11 justify-center"><Text className="font-semibold text-sm text-teal">Xem thực đơn và đặt lại →</Text></AppPressable>}
        </FlowCard>}
        ListEmptyComponent={<Text className="py-12 text-center text-sm text-muted">{section === 'active' ? 'Bạn chưa có đơn đang đến.' : 'Bạn chưa có lịch sử đơn hàng.'}</Text>} />}
  </SafeAreaView>;
}
