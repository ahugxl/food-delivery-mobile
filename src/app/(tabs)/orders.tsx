import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { purchaseApi } from '../../services/purchase';
import { FlowButton } from '../../components/FlowUI';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Order } from '../../store/orderStore';
import { EmptyState } from '../../components/EmptyState';
import { useColors } from '@/hooks/useColors';

type OrderFilter = 'Active orders' | 'Past orders';

function OrderCard({ order }: { order: Order }) {
  const colors = useColors();
  const isActive = !['Delivered', 'Cancelled'].includes(order.status);
  const statusColor =
    order.status === 'Cancelled'
      ? colors.destructive
      : order.status === 'Delivered'
        ? colors.accentForeground
        : colors.tabActive;

  return (
    <View
      style={[
        styles.orderCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.orderTopRow}>
        <Image
          source={{ uri: order.image }}
          contentFit="cover"
          transition={180}
          accessibilityLabel={`${order.restaurant} restaurant`}
          style={[styles.restaurantImage, { backgroundColor: colors.accent }]}
        />
        <View style={styles.restaurantDetails}>
          <Text
            className="text-ink"
            numberOfLines={1}
            style={styles.restaurantName}
          >
            {order.restaurant}
          </Text>
          <Text style={[styles.orderDate, { color: colors.mutedForeground }]}>
            {order.date}
          </Text>
          <Text style={[styles.orderNumber, { color: colors.mutedForeground }]}>
            Order #{order.id}
          </Text>
        </View>
        <Text className="text-ink" style={styles.orderTotal}>
          {order.total}
        </Text>
      </View>

      <View style={[styles.orderDivider, { backgroundColor: colors.border }]} />

      <View style={styles.orderBottomRow}>
        <View style={[styles.statusBadge, { backgroundColor: colors.accent }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {order.status}
          </Text>
        </View>
        <Pressable
          testID={`order-action-${order.id}`}
          accessibilityRole="button"
          onPress={() => isActive ? router.push({ pathname: '/tracking', params: { orderId: order.id } }) : order.restaurantId ? router.push({ pathname: '/restaurant/[id]', params: { id: order.restaurantId } }) : router.push('/(tabs)')}
          style={styles.orderAction}
        >
          <Text style={[styles.orderActionText, { color: colors.primary }]}>
            {isActive ? 'Track order' : 'Order again'}
          </Text>
          <Ionicons name="arrow-forward" size={15} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const colors = useColors();
  const [filter, setFilter] = useState<OrderFilter>('Active orders');
  const userId = useAuthStore(state => state.user?.id);
  const serverOrders = useQuery({ queryKey: ['orders', userId], queryFn: ({ signal }) => purchaseApi.orders(userId!, signal), enabled: !!userId });
  const statusMap: Record<string, Order['status']> = { pending: 'Pending', preparing: 'Preparing', delivering: 'On the way', completed: 'Delivered', cancelled: 'Cancelled' };
  const allOrders: Order[] = (serverOrders.data ?? []).map(row => ({ id: row.id, restaurant: row.restaurants?.name ?? 'Restaurant', restaurantId: row.restaurant_id,
    date: new Date(row.created_at).toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }), total: `$${Number(row.total).toFixed(2)}`,
    status: statusMap[row.status] ?? 'Pending', image: row.restaurants?.image_url ?? '',
  }));
  const orders = allOrders.filter((order) =>
    filter === 'Active orders'
      ? !['Delivered', 'Cancelled'].includes(order.status)
      : ['Delivered', 'Cancelled'].includes(order.status),
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.content, { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
      >
        {serverOrders.isPending && <Text className="p-5 text-muted">Loading your orders...</Text>}
        {serverOrders.isError && <View className="gap-3 p-5"><Text className="text-coral">Unable to load your orders.</Text><FlowButton title="Try again" onPress={() => { void serverOrders.refetch(); }} /></View>}
        <View style={styles.pageHeading}>
          <Text className="text-ink" style={styles.pageTitle}>
            My orders
          </Text>
          <Text
            style={[styles.pageSubtitle, { color: colors.mutedForeground }]}
          >
            Keep up with your favorite meals.
          </Text>
        </View>

        <View
          style={[styles.filterGroup, { backgroundColor: colors.secondary }]}
        >
          {(['Active orders', 'Past orders'] as const).map((item) => {
            const selected = item === filter;
            return (
              <Pressable
                key={item}
                testID={`orders-filter-${item === 'Active orders' ? 'active' : 'past'}`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setFilter(item)}
                className={selected ? 'bg-card' : undefined}
                style={[
                  styles.filterButton,
                  selected ? styles.selectedFilter : undefined,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: selected
                        ? colors.foreground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {orders.length > 0 ? (
          orders.map((order) => <OrderCard key={order.id} order={order} />)
        ) : serverOrders.isSuccess ? (
          <EmptyState
            title={
              filter === 'Active orders'
                ? 'No active orders yet'
                : 'No past orders yet'
            }
            description="Your next great meal is just a few taps away. Find a favorite and place your first order."
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
  },
  pageHeading: {
    marginBottom: 22,
  },
  pageTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 27,
    letterSpacing: -0.6,
    marginBottom: 5,
  },
  pageSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  filterGroup: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 17,
  },
  filterButton: {
    flex: 1,
    minHeight: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  selectedFilter: {
    elevation: 1,
  },
  filterText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  orderCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 13,
    marginBottom: 12,
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  restaurantImage: {
    width: 62,
    height: 62,
    borderRadius: 13,
  },
  restaurantDetails: {
    flex: 1,
    gap: 4,
  },
  restaurantName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  orderDate: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
  orderNumber: {
    fontFamily: 'Inter_400Regular',
    fontSize: 9,
  },
  orderTotal: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    alignSelf: 'flex-start',
    marginTop: 3,
  },
  orderDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  orderBottomRow: {
    minHeight: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
  },
  orderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
  },
  orderActionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
  },
});
