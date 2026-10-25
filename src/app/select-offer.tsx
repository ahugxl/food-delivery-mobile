import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlowButton, FlowCard, FlowHeader } from '../components/FlowUI';
import { purchaseApi } from '../services/purchase';
import { useCartStore } from '../store/cartStore';
import { useOrderStore } from '../store/orderStore';
import { cartSubtotal } from '../features/order/purchase';
import { currency } from '../features/order/checkout';

export default function SelectOfferScreen() {
  const items = useCartStore(state => state.items);
  const locked = useCartStore(state => state.isCheckingOut);
  const applied = useOrderStore(state => state.checkoutVoucher);
  const setApplied = useOrderStore(state => state.setCheckoutVoucher);
  const [code, setCode] = useState(applied?.code ?? '');
  const mutation = useMutation({ mutationFn: (value: string) => purchaseApi.checkVoucher(value, useCartStore.getState().items), retry: false });
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/checkout');
  const apply = async () => {
    if (mutation.isPending || locked) return;
    try { const voucher = await mutation.mutateAsync(code); setApplied(voucher); goBack(); } catch { /* Error shown below. */ }
  };
  const message = mutation.error && typeof mutation.error === 'object' && 'message' in mutation.error ? String(mutation.error.message) : 'Unable to check this voucher.';
  return <SafeAreaView className="flex-1 bg-cream">
    <FlowHeader title="Apply voucher" />
    <View className="gap-5 p-5"><FlowCard>
      <Text className="font-semibold text-base text-ink">{items[0]?.restaurantName || 'Your cart'}</Text>
      <Text className="font-regular text-sm text-muted">Food subtotal: {currency(cartSubtotal(items))}</Text>
      <TextInput accessibilityLabel="Voucher code" placeholder="Enter voucher code" value={code} onChangeText={value => { setCode(value); mutation.reset(); }} autoCapitalize="characters" autoCorrect={false} maxLength={100} editable={!mutation.isPending && !locked}
        className="min-h-14 rounded-2xl border border-line bg-card px-4 font-semibold text-base text-ink" />
      {mutation.isError && <Text accessibilityRole="alert" className="font-medium text-sm text-coral">{message}</Text>}
      <FlowButton title={mutation.isPending ? 'Checking...' : 'Apply code'} onPress={() => { void apply(); }} disabled={!code.trim() || !items.length || mutation.isPending || locked} />
    </FlowCard>
    <FlowButton title="Remove voucher" onPress={() => { setApplied(null); goBack(); }} disabled={mutation.isPending || locked} />
    </View>
  </SafeAreaView>;
}
