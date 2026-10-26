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
import { userMessage } from '../utils/userMessage';

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
  const message = userMessage(mutation.error);
  return <SafeAreaView className="flex-1 bg-cream">
    <FlowHeader title="Áp dụng mã ưu đãi" />
    <View className="gap-5 p-5"><FlowCard>
      <Text className="font-semibold text-base text-ink">{items[0]?.restaurantName || 'Giỏ hàng của bạn'}</Text>
      <Text className="font-regular text-sm text-muted">Tạm tính món ăn: {currency(cartSubtotal(items))}</Text>
      <TextInput accessibilityLabel="Mã ưu đãi" placeholder="Nhập mã ưu đãi" value={code} onChangeText={value => { setCode(value); mutation.reset(); }} autoCapitalize="characters" autoCorrect={false} maxLength={100} editable={!mutation.isPending && !locked}
        className="min-h-14 rounded-2xl border border-line bg-card px-4 font-semibold text-base text-ink" />
      {mutation.isError && <Text accessibilityRole="alert" className="font-medium text-sm text-coral">{message}</Text>}
      <FlowButton title={mutation.isPending ? 'Đang kiểm tra…' : 'Áp dụng mã'} onPress={() => { void apply(); }} disabled={!code.trim() || !items.length || mutation.isPending || locked} />
    </FlowCard>
    <FlowButton title="Bỏ mã ưu đãi" onPress={() => { setApplied(null); goBack(); }} disabled={mutation.isPending || locked} />
    </View>
  </SafeAreaView>;
}
