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

export default function CheckoutScreen() {
  const items = useCartStore(state => state.items);
  const locked = useCartStore(state => state.isCheckingOut);
  const address = useOrderStore(state => state.deliveryAddress);
  const voucher = useOrderStore(state => state.checkoutVoucher);
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const submitGuard = useRef(false);
  const totals = purchaseTotals(items, voucher);
  const mutation = useMutation({ mutationFn: purchaseApi.createOrder, retry: false });
  const coordinates = validCoordinates(address) ? { latitude: address.latitude, longitude: address.longitude } : undefined;
  const canOrder = !!userId && items.length > 0 && address.street.trim().length >= 5 && !!coordinates && !totals.voucherError && !locked;
  const placeOrder = async () => {
    if (!canOrder || submitGuard.current || useCartStore.getState().isCheckingOut) return;
    submitGuard.current = true;
    let submittedRequestId: string | null = null;
    try {
      validatePurchase(items, address.street);
      const signature = purchaseSignature(items, address.street, voucher?.code, coordinates);
      const orderId = useCartStore.getState().prepareCheckout(signature, randomUUID(), { address, voucher });
      submittedRequestId = orderId;
      useCartStore.getState().setCheckingOut(true);
      const order = await mutation.mutateAsync({ orderId, items, address: address.street, voucherCode: voucher?.code, coordinates });
      if (useAuthStore.getState().user?.id !== userId || useCartStore.getState().checkoutRequest?.id !== order.id) return;
      useCartStore.getState().clearCart();
      useOrderStore.getState().setCheckoutVoucher(null);
      void client.invalidateQueries({ queryKey: ['orders', userId] });
      Toast.show({ type: 'success', text1: 'Order placed successfully!', text2: 'Your order is waiting for restaurant confirmation.' });
      router.replace({ pathname: '/tracking', params: { orderId: order.id } });
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Order was not confirmed', text2: errorMessage(error) });
    } finally {
      submitGuard.current = false;
      if (useAuthStore.getState().user?.id === userId && useCartStore.getState().checkoutRequest?.id === submittedRequestId) useCartStore.getState().setCheckingOut(false);
    }
  };
  return <SafeAreaView className="flex-1 bg-cream">
    <FlowHeader title="Review your order" />
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <FlowCard>
        <Text className="font-bold text-base text-ink">Deliver to {address.label}</Text>
        <Text className="font-regular text-sm text-muted">{address.street || 'Please enter a delivery address.'}</Text>
        {!coordinates && <Text className="text-sm text-coral">Please select a delivery pin before ordering.</Text>}
        <Pressable accessibilityRole="button" disabled={locked} onPress={() => router.push('/select-location')} className="min-h-11 justify-center">
          <Text className="font-semibold text-sm text-teal">Change address</Text>
        </Pressable>
      </FlowCard>
      <FlowCard>
        <Text className="font-bold text-base text-ink">{items[0]?.restaurantName || 'Your order'}</Text>
        {items.length === 0 ? <FlowButton title="Browse food" onPress={() => router.replace('/(tabs)')} /> : items.map(item => <View key={item.lineId} className="flex-row items-center gap-3">
          <Image source={item.image ? { uri: item.image } : undefined} style={{ width: 56, height: 56, borderRadius: 14 }} contentFit="cover" />
          <View className="flex-1 gap-1"><Text className="font-semibold text-sm text-ink">{item.quantity} × {item.name}</Text>
            <Text className="font-regular text-xs text-muted">{item.options.map(option => `${option.groupName}: ${option.label}`).join(' · ') || 'Standard'}</Text>
            {!!item.note && <Text className="font-regular text-xs text-muted">Note: {item.note}</Text>}
          </View><Text className="font-semibold text-sm text-ink">{currency(item.unitPrice * item.quantity)}</Text>
        </View>)}
      </FlowCard>
      <Pressable accessibilityRole="button" disabled={locked || !items.length} onPress={() => router.push('/select-offer')} className="mb-5 gap-2 rounded-3xl border border-line bg-card p-5">
        <Text className="font-semibold text-base text-ink">Voucher</Text>
        <Text className="font-regular text-sm text-teal">{voucher?.code || 'Enter a voucher code'}</Text>
        {!!totals.voucherError && <Text accessibilityRole="alert" className="text-sm text-coral">{totals.voucherError} Remove or replace this voucher.</Text>}
      </Pressable>
      <FlowCard>
        <Text className="font-bold text-base text-ink">Payment details</Text>
        {([['Subtotal', totals.subtotal], ['Delivery fee', totals.deliveryFee], ['Voucher discount', -totals.discount], ['Total', totals.total]] as const).map(([label, amount]) => <View key={label} className="flex-row justify-between">
          <Text className="font-medium text-sm text-muted">{label}</Text><Text className="font-semibold text-base text-ink">{amount < 0 ? `-${currency(-amount)}` : currency(amount)}</Text>
        </View>)}
      </FlowCard>
      <Text className="mb-3 font-regular text-xs text-muted">Payment: Cash on delivery. Prices and vouchers are checked again when placing your order.</Text>
      {mutation.isError && <Text accessibilityRole="alert" className="mb-4 font-medium text-sm text-coral">{errorMessage(mutation.error)} Your cart has been kept. Retry to check the same order request.</Text>}
    </ScrollView>
    <View className="border-t border-line bg-card p-5"><FlowButton title={locked ? 'Placing order...' : `Order now · ${currency(totals.total)}`} onPress={() => { void placeOrder(); }} disabled={!canOrder} /></View>
  </SafeAreaView>;
}

function errorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Unable to connect. Please try again.';
}
