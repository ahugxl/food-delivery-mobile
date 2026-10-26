import { AppPressable as Pressable } from '@/src/components/AppPressable';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import Toast from 'react-native-toast-message';
import { FlowButton, FlowCard, FlowHeader } from '../components/FlowUI';
import { currency } from '../features/order/checkout';
import { purchaseSignature, purchaseTotals, validatePurchase } from '../features/order/purchase';
import { purchaseApi } from '../services/purchase';
import { useCartStore } from '../store/cartStore';
import { useOrderStore } from '../store/orderStore';
import { useAuthStore } from '../store/authStore';
import { validCoordinates } from '../features/location/coordinates';
import { viLabel } from '../utils/vietnamese';
import { userMessage } from '../utils/userMessage';
import { useShippingQuote } from '../hooks/useShippingQuote';
import { voucherKeys } from '../services/voucherApi';

export default function CheckoutScreen() {
  const items = useCartStore(state => state.items);
  const locked = useCartStore(state => state.isCheckingOut);
  const address = useOrderStore(state => state.deliveryAddress);
  const voucher = useOrderStore(state => state.checkoutVoucher);
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const submitGuard = useRef(false);
  const shipping = useShippingQuote(items[0]?.restaurantId, address);
  const shippingReady = items.length === 0 || shipping.deliveryFee !== null;
  const totals = purchaseTotals(items, voucher, Date.now(), shipping.deliveryFee ?? 0);
  const mutation = useMutation({ mutationFn: purchaseApi.createOrder, retry: false });
  const coordinates = validCoordinates(address) ? { latitude: address.latitude, longitude: address.longitude } : undefined;
  const canOrder = !!userId && items.length > 0 && address.street.trim().length >= 5 && !!coordinates && shippingReady && !shipping.isFetching && !totals.voucherError && !locked;
  const placeOrder = async () => {
    if (!canOrder || shipping.deliveryFee === null || submitGuard.current || useCartStore.getState().isCheckingOut) return;
    submitGuard.current = true;
    let submittedRequestId: string | null = null;
    try {
      validatePurchase(items, address.street);
      // A refreshed restaurant location/quote must not create a second order after a lost response.
      const signature = purchaseSignature(items, address.street, voucher?.code, coordinates);
      const orderId = useCartStore.getState().prepareCheckout(signature, randomUUID(), { address, voucher });
      submittedRequestId = orderId;
      useCartStore.getState().setCheckingOut(true);
      const order = await mutation.mutateAsync({ orderId, items, address: address.street, voucherCode: voucher?.code, coordinates: coordinates!, deliveryFee: shipping.deliveryFee });
      if (useAuthStore.getState().user?.id !== userId || useCartStore.getState().checkoutRequest?.id !== order.id) return;
      useCartStore.getState().clearCart();
      useOrderStore.getState().setCheckoutVoucher(null);
      void client.invalidateQueries({ queryKey: ['orders', userId] });
      void client.invalidateQueries({ queryKey: voucherKeys.wallet(userId) });
      void client.invalidateQueries({ queryKey: voucherKeys.owned(userId) });
      Toast.show({ type: 'success', text1: 'Đặt hàng thành công!', text2: 'Đơn hàng đang chờ quán xác nhận.' });
      router.replace({ pathname: '/tracking', params: { orderId: order.id } });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Chưa xác nhận được đơn hàng', text2: errorMessage(error) });
      void shipping.refetch();
    } finally {
      submitGuard.current = false;
      if (useAuthStore.getState().user?.id === userId && useCartStore.getState().checkoutRequest?.id === submittedRequestId) useCartStore.getState().setCheckingOut(false);
    }
  };
  return <SafeAreaView className="flex-1 bg-cream">
    <FlowHeader title="Xác nhận đơn hàng" />
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <FlowCard>
        <Text className="font-bold text-base text-ink">Giao đến {viLabel(address.label)}</Text>
        <Text className="font-regular text-sm text-muted">{address.street || 'Vui lòng nhập địa chỉ giao hàng.'}</Text>
        {!coordinates && <Text className="text-sm text-coral">Vui lòng chọn điểm giao trên bản đồ trước khi đặt hàng.</Text>}
        <Pressable accessibilityRole="button" disabled={locked} onPress={() => router.push('/select-location')} className="min-h-11 justify-center">
          <Text className="font-semibold text-sm text-teal">Đổi địa chỉ</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={locked} onPress={() => router.push({ pathname: '/addresses', params: { select: '1' } })} className="min-h-11 justify-center">
          <Text className="font-semibold text-sm text-teal">Chọn địa chỉ đã lưu</Text>
        </Pressable>
      </FlowCard>
      <FlowCard>
        <Text className="font-bold text-base text-ink">{items[0]?.restaurantName || 'Đơn hàng của bạn'}</Text>
        {items.length === 0 ? <FlowButton title="Khám phá quán ngon" onPress={() => router.replace('/(tabs)')} /> : items.map(item => <View key={item.lineId} className="flex-row items-center gap-3">
          <Image source={item.image ? { uri: item.image } : undefined} style={{ width: 56, height: 56, borderRadius: 14 }} contentFit="cover" />
          <View className="flex-1 gap-1"><Text className="font-semibold text-sm text-ink">{item.quantity} × {viLabel(item.name)}</Text>
            <Text className="font-regular text-xs text-muted">{item.options.map(option => `${viLabel(option.groupName)}: ${viLabel(option.label)}`).join(' · ') || 'Mặc định'}</Text>
            {!!item.note && <Text className="font-regular text-xs text-muted">Ghi chú: {item.note}</Text>}
          </View><Text className="font-semibold text-sm text-ink">{currency(item.unitPrice * item.quantity)}</Text>
        </View>)}
      </FlowCard>
      <Pressable accessibilityRole="button" disabled={locked || !items.length} onPress={() => router.push('/select-offer')} className="mb-5 gap-2 rounded-3xl border border-line bg-card p-5">
        <Text className="font-semibold text-base text-ink">Mã ưu đãi</Text>
        <Text className="font-regular text-sm text-teal">{voucher?.code || 'Nhập mã ưu đãi'}</Text>
        {!!totals.voucherError && <Text accessibilityRole="alert" className="text-sm text-coral">{totals.voucherError} Vui lòng bỏ hoặc đổi mã ưu đãi này.</Text>}
      </Pressable>
      <FlowCard>
        <Text className="font-bold text-base text-ink">Chi tiết thanh toán</Text>
        {shipping.distanceKm !== null && <Text className="font-medium text-sm text-teal">Khoảng cách: {shipping.distanceKm.toFixed(1)} km (đường chim bay)</Text>}
        {!!shipping.error && <Text accessibilityLiveRegion="polite" className="text-sm text-muted">{shipping.error}</Text>}
        {!shippingReady && items.length > 0 && <FlowButton title="Tính lại phí giao hàng" disabled={shipping.isFetching || locked} onPress={() => { void shipping.refetch(); }} />}
        {([['Tạm tính', totals.subtotal], ['Phí giao hàng', totals.deliveryFee], ['Giảm giá', -totals.discount], ['Tổng cộng', totals.total]] as const).map(([label, amount]) => <View key={label} className="flex-row justify-between">
          <Text className="font-medium text-sm text-muted">{label}</Text><Text className="font-semibold text-base text-ink">{!shippingReady && (label === 'Phí giao hàng' || label === 'Tổng cộng') ? 'Chưa xác định' : amount < 0 ? `-${currency(-amount)}` : currency(amount)}</Text>
        </View>)}
        <Text className="text-xs leading-5 text-muted">15.000 ₫ cho 2 km đầu. Mỗi km tiếp theo cộng 5.000 ₫, làm tròn lên. Phí tính theo khoảng cách đường chim bay.</Text>
      </FlowCard>
      <Text className="mb-3 font-regular text-xs text-muted">Thanh toán khi nhận hàng. Giá và mã ưu đãi được kiểm tra lại khi đặt đơn.</Text>
      {mutation.isError && <Text accessibilityRole="alert" className="mb-4 font-medium text-sm text-coral">{errorMessage(mutation.error)} Giỏ hàng vẫn được giữ. Thử lại để kiểm tra cùng yêu cầu đặt đơn.</Text>}
    </ScrollView>
    <View className="border-t border-line bg-card p-5"><FlowButton title={locked ? 'Đang đặt hàng…' : !shippingReady ? 'Chọn điểm giao để tính phí' : `Đặt hàng · ${currency(totals.total)}`} onPress={() => { void placeOrder(); }} disabled={!canOrder} /></View>
  </SafeAreaView>;
}

function errorMessage(error: unknown) {
  return userMessage(error);
}
