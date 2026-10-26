import { useQuery } from '@tanstack/react-query';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppPressable } from '../../components/AppPressable';
import { FlowButton } from '../../components/FlowUI';
import { useAuthStore } from '../../store/authStore';
import { purchaseApi } from '../../services/purchase';

export default function InboxScreen() {
  const userId = useAuthStore(state => state.user?.id);
  const orders = useQuery({ queryKey: ['orders', userId], queryFn: ({ signal }) => purchaseApi.orders(userId!, signal), enabled: !!userId });
  return <SafeAreaView className="flex-1 bg-cream">
    <View className="gap-2 p-5"><Text className="font-bold text-2xl text-ink">Inbox</Text><Text className="text-sm text-muted">Cuộc trò chuyện riêng theo từng đơn hàng.</Text></View>
    {orders.isPending ? <Text className="p-5 text-muted">Đang tải đơn hàng...</Text> : orders.isError ? <View className="gap-3 p-5"><Text className="text-coral">Không tải được danh sách.</Text><FlowButton title="Thử lại" onPress={() => { void orders.refetch(); }} /></View>
      : <FlatList data={orders.data} keyExtractor={item => item.id} contentContainerStyle={{ padding: 20, gap: 14 }} refreshing={orders.isRefetching} onRefresh={() => { void orders.refetch(); }}
        renderItem={({ item }) => <AppPressable accessibilityRole="button" accessibilityLabel={`Chat đơn ${item.id.slice(0, 8)}`} onPress={() => router.push({ pathname: '/chat', params: { orderId: item.id } })} className="gap-2 rounded-3xl border border-line bg-card p-5">
          <Text className="font-semibold text-base text-ink">{item.restaurants?.name ?? 'Nhà hàng'}</Text><Text className="text-xs text-muted">Đơn #{item.id.slice(0, 8)} · {item.status}</Text><Text className="text-sm text-teal">Mở tin nhắn →</Text>
        </AppPressable>}
        ListEmptyComponent={<Text className="py-12 text-center text-muted">Bạn chưa có đơn hàng để trò chuyện.</Text>} />}
  </SafeAreaView>;
}
