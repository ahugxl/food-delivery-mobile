import { useState } from 'react';
import { SectionList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlowButton, FlowCard } from '../../components/FlowUI';
import { AppPressable } from '../../components/AppPressable';
import { useMyOrders } from '../../hooks/useMyOrders';
import { ORDER_LABELS, orderSection, orderHistoryMonths, orderHistoryTime, type OrderSection } from '../../features/order/history';
import { currency } from '../../features/order/checkout';

export default function OrdersScreen() {
  const query = useMyOrders();
  const [section, setSection] = useState<OrderSection>('active');
  const orders = (query.data ?? []).filter(order => orderSection(order.status) === section);
  const sections = section === 'history' ? orderHistoryMonths(orders) : orders.length ? [{ key: 'active', title: '', data: orders }] : [];
  return <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
    <View className="gap-4 p-5"><Text className="font-bold text-2xl text-ink">Đơn hàng ăn uống</Text>
      <View accessibilityRole="tablist" className="flex-row gap-3">{(['active', 'history'] as const).map(value => <AppPressable key={value} accessibilityRole="tab" accessibilityLabel={value === 'active' ? 'Đang đến' : 'Lịch sử'} accessibilityState={{ selected: section === value }} onPress={() => setSection(value)} className={`min-h-12 flex-1 items-center justify-center rounded-2xl border ${section === value ? 'border-teal bg-tealLight' : 'border-line bg-card'}`}><Text className="font-semibold text-sm text-ink">{value === 'active' ? 'Đang đến' : 'Lịch sử'}</Text></AppPressable>)}</View>
    </View>
    {query.isPending ? <Text className="p-5 text-muted">Đang tải đơn hàng...</Text> : query.isError && !query.data ? <View className="gap-4 p-5"><Text className="text-coral">Không tải được đơn hàng.</Text><FlowButton title="Thử lại" onPress={() => { void query.refetch(); }} /></View>
      : <SectionList key={section} sections={sections} stickySectionHeadersEnabled={false} keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }}
        renderSectionHeader={({ section: month }) => month.title ? <Text accessibilityRole="header" className="mb-7 mt-4 font-semibold text-base text-muted">{month.title}</Text> : null}
        renderItem={({ item }) => section === 'history' ? <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 12, marginBottom: 16 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: '#E1F4E8', alignItems: 'center', justifyContent: 'center', marginTop: 3 }}>
            {item.restaurants?.image_url ? <Image source={{ uri: item.restaurants.image_url }} contentFit="cover" style={{ width: 40, height: 40 }} /> : <Ionicons name="restaurant-outline" size={22} color="#008B45" />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppPressable accessibilityRole="button" accessibilityLabel={`Xem hóa đơn ${item.restaurants?.name ?? 'Nhà hàng'}, ${currency(Number(item.total))}`} onPress={() => router.push({ pathname: '/order-detail', params: { orderId: item.id } })} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <Text numberOfLines={2} className="font-medium text-base text-ink" style={{ flex: 1 }}>{item.restaurants?.name ?? 'Nhà hàng'}</Text>
                <Text className="font-medium text-base text-ink" style={{ flexShrink: 0 }}>{currency(Number(item.total))}</Text>
              </View>
              <Text className="text-sm text-muted">{orderHistoryTime(item.created_at)}</Text>
              {item.status === 'cancelled' && <Text className="text-xs text-coral">Đã hủy</Text>}
            </AppPressable>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 22, marginTop: 8 }}>
              {item.status === 'completed' && <AppPressable accessibilityRole="button" onPress={() => router.push({ pathname: '/rating', params: { orderId: item.id } })} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text className="font-semibold text-sm text-teal">Đánh giá</Text><Ionicons name="arrow-forward" size={21} color="#008B45" /></AppPressable>}
              <AppPressable accessibilityRole="button" accessibilityLabel="Xem thực đơn và đặt hàng lại" onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: item.restaurant_id } })} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5 }}><Text className="font-semibold text-sm text-teal">Đặt hàng lại</Text><Ionicons name="arrow-forward" size={21} color="#008B45" /></AppPressable>
            </View>
          </View>
        </View> : <FlowCard><View className="flex-row items-center gap-3"><Image source={item.restaurants?.image_url ? { uri: item.restaurants.image_url } : undefined} style={{ width: 64, height: 64, borderRadius: 16 }} contentFit="cover" />
          <View className="flex-1 gap-1"><Text className="font-bold text-base text-ink">{item.restaurants?.name ?? 'Nhà hàng'}</Text><Text selectable className="text-xs text-muted">#{item.id}</Text><Text className="text-xs text-muted">{orderHistoryTime(item.created_at)}</Text></View></View>
          <View className="flex-row justify-between"><Text className="font-semibold text-sm text-teal">{ORDER_LABELS[item.status ?? ""] ?? 'Đang cập nhật'}</Text><Text className="font-bold text-base text-ink">{currency(Number(item.total))}</Text></View>
          <FlowButton title="Theo dõi đơn" onPress={() => router.push({ pathname: '/tracking', params: { orderId: item.id } })} />
        </FlowCard>}
        ListEmptyComponent={<Text className="py-12 text-center text-sm text-muted">{section === 'active' ? 'Bạn chưa có đơn đang đến.' : 'Bạn chưa có lịch sử đơn hàng.'}</Text>} />}
  </SafeAreaView>;
}
