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
import { cartSubtotal, purchaseSignature, voucherError } from './purchase';
import { currency } from './checkout';
import { userMessage } from '../../utils/userMessage';

export default function VoucherWalletScreen({ checkout = false }: { checkout?: boolean }) {
  const items = useCartStore(state => state.items);
  const locked = useCartStore(state => state.isCheckingOut);
  const applied = useOrderStore(state => state.checkoutVoucher);
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState<string | null>(applied?.id ?? null);
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
      const collected = await voucherApi.collectForOrder(userId!, value, snapshot);
      return { voucher: collected, signature };
    }, retry: false,
    onSuccess: ({ voucher, signature }) => {
      if (useAuthStore.getState().user?.id !== userId) return;
      invalidate();
      if (useCartStore.getState().isCheckingOut || purchaseSignature(useCartStore.getState().items, '') !== signature) {
        setSelectionError('Giỏ hàng đã thay đổi. Mã đã được lưu vào ví, vui lòng chọn lại.'); return;
      }
      useOrderStore.getState().setCheckoutVoucher(voucher); goBack();
    },
  });
  const confirm = useMutation({
    mutationFn: async (voucher: Voucher) => {
      const fresh = await voucherApi.wallet(userId!);
      const current = fresh.find(row => row.id === voucher.id);
      if (!current) throw new Error('Mã không còn trong ví hoặc đã sử dụng. Vui lòng tải lại ví.');
      const currentItems = useCartStore.getState().items;
      const reason = voucherError(current, cartSubtotal(currentItems), currentItems[0]?.restaurantId ?? '');
      if (reason) throw new Error(reason);
      return current;
    }, retry: false,
    onSuccess: voucher => {
      if (useAuthStore.getState().user?.id !== userId || useCartStore.getState().isCheckingOut) return;
      const currentItems = useCartStore.getState().items;
      const reason = voucherError(voucher, cartSubtotal(currentItems), currentItems[0]?.restaurantId ?? '');
      if (reason) { setSelectionError(reason); return; }
      useOrderStore.getState().setCheckoutVoucher(voucher); goBack();
    }, onError: () => { void wallet.refetch(); },
  });
  const busy = manual.isPending || confirm.isPending || locked;
  const reasonFor = (voucher: Voucher) => checkout ? voucherError(voucher, subtotal, items[0]?.restaurantId ?? '') : collectionError(voucher);
  const available = wallet.data?.filter(v => !reasonFor(v)) ?? [];
  const unavailable = wallet.data?.filter(v => !!reasonFor(v)) ?? [];
  const error = selectionError || (manual.error ? userMessage(manual.error) : confirm.error ? userMessage(confirm.error) : '');
  const chosen = available.find(v => v.id === selected);
  return <SafeAreaView className="flex-1 bg-white"><FlowHeader title={checkout ? 'Chọn hoặc nhập voucher' : 'Ví voucher của bạn'} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={wallet.isRefetching} onRefresh={() => { void wallet.refetch(); }} />}>
      {checkout && <View className="mb-5 gap-3">
        <Text className="text-sm text-muted">Tiền món: {currency(subtotal)} · Chỉ chọn 01 voucher</Text>
        <TextInput accessibilityLabel="Mã ưu đãi" placeholder="Vui lòng nhập mã voucher" value={code} onChangeText={value => { setCode(value); manual.reset(); setSelectionError(''); }} autoCapitalize="characters" autoCorrect={false} maxLength={100} editable={!busy}
          className="min-h-14 rounded-2xl border border-line bg-cream px-4 text-base text-ink" />
        <FlowButton title={manual.isPending ? 'Đang kiểm tra…' : 'Áp dụng mã'} onPress={() => manual.mutate(code)} disabled={busy || !code.trim() || !items.length || !userId} />
        {!!error && <Text accessibilityRole="alert" className="text-sm text-coral">{error}</Text>}
      </View>}
      <FlowButton title="Khám phá ưu đãi · Lấy thêm mã" onPress={() => router.push('/campaign')} disabled={busy} />
      <View className="mt-5">
        {wallet.isPending ? <Skeleton height={180} /> : wallet.isError ? <View className="gap-3"><Text accessibilityRole="alert" className="text-sm text-coral">{userMessage(wallet.error)}</Text><FlowButton title="Tải lại ví" onPress={() => { void wallet.refetch(); }} /></View> : <>
          {!wallet.data?.length && <Text className="py-8 text-center text-sm text-muted">Ví chưa có mã chưa sử dụng. Hãy lấy mã tại trang ưu đãi nhé!</Text>}
          {available.length > 0 && <Text className="mb-4 font-bold text-lg text-ink">Voucher khả dụng</Text>}
          {available.map(v => <VoucherTicket key={v.id} voucher={v} action={checkout ? selected === v.id ? 'Đã chọn' : 'Chọn mã' : 'Đã thu thập'} selected={selected === v.id && checkout} disabled={busy || !checkout} onPress={() => { setSelected(v.id); setSelectionError(''); confirm.reset(); }} />)}
          {unavailable.length > 0 && <Text className="mb-4 mt-5 font-bold text-lg text-ink">Voucher không khả dụng</Text>}
          {unavailable.map(v => <VoucherTicket key={v.id} voucher={v} reason={reasonFor(v)} action="Chưa thể dùng" disabled onPress={() => {}} />)}
        </>}
      </View>
    </ScrollView>
    {checkout && <View className="gap-3 border-t border-line bg-white p-5"><FlowButton title={confirm.isPending ? 'Đang áp dụng…' : 'Xác nhận voucher'} disabled={busy || !chosen || wallet.isError || wallet.isPending || !userId} onPress={() => { if (chosen) confirm.mutate(chosen); }} /><FlowButton title="Không dùng voucher" disabled={busy} onPress={() => { useOrderStore.getState().setCheckoutVoucher(null); goBack(); }} /></View>}
  </SafeAreaView>;
}
