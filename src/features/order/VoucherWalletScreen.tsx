import { useState } from 'react';
import { ScrollView, Text, TextInput, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlowButton, FlowHeader } from '../../components/FlowUI';
import { VoucherTicket } from '../../components/VoucherTicket';
import { Skeleton } from '../../components/Skeleton';
import { voucherApi } from '../../services/vouchers';
import { collectionError, voucherKeys, type Voucher } from '../../services/voucherApi';
import { useCartStore } from '../../store/cartStore';
import { useOrderStore } from '../../store/orderStore';
import { useAuthStore } from '../../store/authStore';
import { cartSubtotal, purchaseSignature, voucherError, voucherTarget, type VoucherTarget } from './purchase';
import { currency } from './checkout';
import { userMessage } from '../../utils/userMessage';

const groups = [{ target: 'food', title: 'Voucher giảm tiền món' }, { target: 'shipping', title: 'Voucher giảm phí giao hàng' }] as const;
export default function VoucherWalletScreen({ checkout = false }: { checkout?: boolean }) {
  const items = useCartStore(state => state.items);
  const locked = useCartStore(state => state.isCheckingOut);
  const food = useOrderStore(state => state.checkoutVoucher);
  const shipping = useOrderStore(state => state.shippingVoucher);
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState<Record<VoucherTarget, string | null>>({ food: food?.id ?? null, shipping: shipping?.id ?? null });
  const [selectionError, setSelectionError] = useState('');
  const wallet = useQuery({ queryKey: voucherKeys.wallet(userId), queryFn: ({ signal }) => voucherApi.wallet(userId!, signal), enabled: !!userId, refetchInterval: 30000 });
  const subtotal = cartSubtotal(items);
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/checkout');
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: voucherKeys.wallet(userId) });
    void client.invalidateQueries({ queryKey: voucherKeys.owned(userId) });
  };
  const manual = useMutation({
    mutationFn: async (value: string) => {
      const snapshot = useCartStore.getState().items;
      const signature = purchaseSignature(snapshot, '');
      const voucher = await voucherApi.collectForOrder(userId!, value, snapshot);
      const otherTarget = voucherTarget(voucher) === 'food' ? 'shipping' : 'food';
      let other: Voucher | null = null;
      if (selected[otherTarget]) {
        other = (await voucherApi.wallet(userId!)).find(row => row.id === selected[otherTarget]) ?? null;
        if (!other) throw new Error('Mã còn lại không còn trong ví. Mã vừa nhập đã được thu thập, vui lòng chọn lại.');
        const reason = voucherError(other, cartSubtotal(snapshot), snapshot[0]?.restaurantId ?? '', Date.now(), otherTarget);
        if (reason) throw new Error(reason);
      }
      return { voucher, other, signature };
    }, retry: false,
    onSuccess: ({ voucher, other, signature }) => {
      if (useAuthStore.getState().user?.id !== userId) return;
      invalidate();
      if (useCartStore.getState().isCheckingOut || purchaseSignature(useCartStore.getState().items, '') !== signature) {
        setSelectionError('Giỏ hàng đã thay đổi. Mã đã được lưu vào ví, vui lòng chọn lại.'); return;
      }
      useOrderStore.getState().setCheckoutVouchers(voucherTarget(voucher) === 'food' ? voucher : other, voucherTarget(voucher) === 'shipping' ? voucher : other); goBack();
    },
  });
  const confirm = useMutation({
    mutationFn: async () => {
      const signature = purchaseSignature(useCartStore.getState().items, '');
      const fresh = await voucherApi.wallet(userId!);
      const result: Record<VoucherTarget, Voucher | null> = { food: null, shipping: null };
      const currentItems = useCartStore.getState().items;
      for (const { target } of groups) {
        if (!selected[target]) continue;
        const current = fresh.find(row => row.id === selected[target]);
        if (!current) throw new Error('Mã không còn trong ví hoặc đã sử dụng. Vui lòng chọn lại.');
        const reason = voucherError(current, cartSubtotal(currentItems), currentItems[0]?.restaurantId ?? '', Date.now(), target);
        if (reason) throw new Error(reason);
        result[target] = current;
      }
      return { result, signature };
    }, retry: false,
    onSuccess: ({ result, signature }) => {
      if (useAuthStore.getState().user?.id !== userId || useCartStore.getState().isCheckingOut) return;
      if (signature !== purchaseSignature(useCartStore.getState().items, '')) { setSelectionError('Giỏ hàng đã thay đổi. Vui lòng chọn lại mã.'); return; }
      useOrderStore.getState().setCheckoutVouchers(result.food, result.shipping); goBack();
    }, onError: () => { void wallet.refetch(); },
  });
  const busy = manual.isPending || confirm.isPending || locked;
  const reasonFor = (voucher: Voucher) => checkout ? voucherError(voucher, subtotal, items[0]?.restaurantId ?? '') : collectionError(voucher);
  const available = wallet.data?.filter(v => !reasonFor(v)) ?? [];
  const unavailable = wallet.data?.filter(v => !!reasonFor(v)) ?? [];
  const error = selectionError || (manual.error ? userMessage(manual.error) : confirm.error ? userMessage(confirm.error) : '');
  const validSelection = groups.every(({ target }) => !selected[target] || available.some(v => v.id === selected[target] && voucherTarget(v) === target));
  return <SafeAreaView className="flex-1 bg-white"><FlowHeader title={checkout ? 'Chọn voucher cho đơn hàng' : 'Ví voucher của bạn'} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={wallet.isRefetching} onRefresh={() => { void wallet.refetch(); }} />}>
      {checkout && <View className="mb-5 gap-3">
        <Text className="text-sm text-muted">Tiền món: {currency(subtotal)} · Chọn tối đa 1 mã giảm món và 1 mã giảm phí giao hàng.</Text>
        <TextInput accessibilityLabel="Mã ưu đãi" placeholder="Nhập mã giảm món hoặc phí giao hàng" value={code} onChangeText={value => { setCode(value); manual.reset(); setSelectionError(''); }} autoCapitalize="characters" autoCorrect={false} maxLength={100} editable={!busy} className="min-h-14 rounded-2xl border border-line bg-cream px-4 text-base text-ink" />
        <FlowButton title={manual.isPending ? 'Đang kiểm tra…' : 'Áp dụng mã'} onPress={() => manual.mutate(code)} disabled={busy || !code.trim() || !items.length || !userId} />
        {!!error && <Text accessibilityRole="alert" className="text-sm text-coral">{error}</Text>}
      </View>}
      <FlowButton title="Khám phá ưu đãi · Lấy thêm mã" onPress={() => router.push('/campaign')} disabled={busy} />
      <View className="mt-5">
        {wallet.isPending ? <Skeleton height={180} /> : wallet.isError ? <View className="gap-3"><Text accessibilityRole="alert" className="text-sm text-coral">{userMessage(wallet.error)}</Text><FlowButton title="Tải lại ví" onPress={() => { void wallet.refetch(); }} /></View> : <>
          {!wallet.data?.length && <Text className="py-8 text-center text-sm text-muted">Ví chưa có mã chưa sử dụng. Hãy lấy mã tại trang ưu đãi nhé!</Text>}
          {groups.map(({ target, title }) => <View key={target} className="mb-5 gap-2">
            <Text className="mb-2 font-bold text-lg text-ink">{title}</Text>
            {checkout && selected[target] && <FlowButton title="Bỏ mã đã chọn cho loại này" disabled={busy} onPress={() => { setSelected(value => ({ ...value, [target]: null })); setSelectionError(''); confirm.reset(); }} />}
            {!available.some(v => voucherTarget(v) === target) && <Text className="mb-3 text-sm text-muted">Chưa có mã khả dụng cho loại này.</Text>}
            {available.filter(v => voucherTarget(v) === target).map(v => <VoucherTicket key={v.id} voucher={v} action={checkout ? selected[target] === v.id ? 'Đã chọn · Bỏ chọn' : 'Chọn mã' : 'Đã thu thập'} selected={selected[target] === v.id && checkout} disabled={busy || !checkout} onPress={() => { setSelected(value => ({ ...value, [target]: value[target] === v.id ? null : v.id })); setSelectionError(''); confirm.reset(); }} />)}
          </View>)}
          {unavailable.length > 0 && <Text className="mb-4 font-bold text-lg text-ink">Voucher không khả dụng</Text>}
          {unavailable.map(v => <VoucherTicket key={v.id} voucher={v} reason={reasonFor(v)} action="Chưa thể dùng" disabled onPress={() => {}} />)}
        </>}
      </View>
    </ScrollView>
    {checkout && <View className="gap-3 border-t border-line bg-white p-5"><FlowButton title={confirm.isPending ? 'Đang áp dụng…' : 'Xác nhận voucher'} disabled={busy || !validSelection || wallet.isError || wallet.isPending || !userId || !items.length} onPress={() => confirm.mutate()} /><FlowButton title="Không dùng voucher" disabled={busy} onPress={() => { useOrderStore.getState().setCheckoutVouchers(null, null); goBack(); }} /></View>}
  </SafeAreaView>;
}
