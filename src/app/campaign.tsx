import { ScrollView, Text, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlowButton, FlowHeader } from '../components/FlowUI';
import { VoucherTicket } from '../components/VoucherTicket';
import { Skeleton } from '../components/Skeleton';
import { voucherApi } from '../services/vouchers';
import { collectionError, voucherKeys, type WalletEntry } from '../services/voucherApi';
import { useAuthStore } from '../store/authStore';
import { userMessage } from '../utils/userMessage';

export default function CampaignScreen() {
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const offers = useQuery({ queryKey: voucherKeys.campaign, queryFn: ({ signal }) => voucherApi.campaign(signal), refetchInterval: 30000 });
  const owned = useQuery({ queryKey: voucherKeys.owned(userId), queryFn: ({ signal }) => voucherApi.owned(userId!, signal), enabled: !!userId, refetchInterval: 30000 });
  const collect = useMutation({
    mutationFn: (id: string) => voucherApi.collect(userId!, id), retry: false,
    onSuccess: voucher => {
      if (useAuthStore.getState().user?.id !== userId) return;
      client.setQueryData<WalletEntry[]>(voucherKeys.owned(userId), previous => [
        ...(previous ?? []).filter(entry => entry.voucher_id !== voucher.id),
        { user_id: userId!, voucher_id: voucher.id, is_used: false },
      ]);
      void client.invalidateQueries({ queryKey: voucherKeys.owned(userId) });
      void client.invalidateQueries({ queryKey: voucherKeys.wallet(userId) });
    }, onError: () => { void offers.refetch(); void owned.refetch(); },
  });
  const refresh = () => { void Promise.allSettled([offers.refetch(), owned.refetch()]); };
  return <SafeAreaView className="flex-1 bg-white"><FlowHeader title="Ưu đãi hôm nay" />
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={offers.isRefetching || owned.isRefetching} onRefresh={refresh} />}>
      <View style={{ backgroundColor: '#EFF5A5', borderRadius: 24, padding: 22, gap: 10, marginBottom: 22 }}>
        <Text className="font-bold text-3xl text-ink">Săn mã, ăn ngon</Text><Text className="text-sm text-ink">Lấy mã về ví để sử dụng khi thanh toán. Mỗi mã chỉ dùng một lần.</Text>
        <FlowButton title="Mở ví voucher" onPress={() => router.push('/voucher-wallet')} />
      </View>
      {(offers.isPending || owned.isPending) ? <Skeleton height={180} /> : offers.isError || owned.isError ? <View className="gap-3"><Text accessibilityRole="alert" className="text-sm text-coral">{userMessage(offers.error || owned.error)}</Text><FlowButton title="Tải lại ưu đãi" onPress={refresh} /></View> : <>
        {collect.isError && <Text accessibilityRole="alert" className="mb-4 text-sm text-coral">{userMessage(collect.error)}</Text>}
        {collect.isSuccess && <Text accessibilityLiveRegion="polite" className="mb-4 text-sm text-teal">Đã lưu mã vào ví voucher.</Text>}
        {!offers.data?.length && <Text className="text-center text-sm text-muted">Chưa có mã ưu đãi. Hãy quay lại sau nhé!</Text>}
        {offers.data?.map(voucher => {
          const entry = owned.data?.find(row => row.voucher_id === voucher.id);
          const reason = collectionError(voucher);
          const pending = collect.isPending && collect.variables === voucher.id;
          const action = reason || (entry ? entry.is_used ? 'Đã sử dụng' : 'Đã thu thập' : pending ? 'Đang lấy mã…' : 'Lấy mã');
          return <VoucherTicket key={voucher.id} voucher={voucher} reason={reason} action={action} disabled={!!reason || !!entry || collect.isPending || !userId} onPress={() => collect.mutate(voucher.id)} />;
        })}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
