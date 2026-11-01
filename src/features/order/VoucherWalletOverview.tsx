import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppPressable } from '../../components/AppPressable';
import { FlowButton } from '../../components/FlowUI';
import { Skeleton } from '../../components/Skeleton';
import { VoucherTicket } from '../../components/VoucherTicket';
import { useAuthStore } from '../../store/authStore';
import { voucherApi } from '../../services/vouchers';
import { collectionError, voucherKeys } from '../../services/voucherApi';
import { voucherTarget, type VoucherTarget } from './purchase';
import { userMessage } from '../../utils/userMessage';

const tabs = [
  { id: 'all', title: 'Tất cả' },
  { id: 'food', title: 'Giảm giá món' },
  { id: 'shipping', title: 'Phí vận chuyển' },
] as const;

export default function VoucherWalletOverview({ history = false }: { history?: boolean }) {
  const userId = useAuthStore(s => s.user?.id);
  const [filter, setFilter] = useState<'all' | VoucherTarget>('all');
  const wallet = useQuery({
    queryKey: history ? voucherKeys.usedWallet(userId) : voucherKeys.wallet(userId),
    queryFn: ({ signal }) => history ? voucherApi.usedWallet(userId!, signal) : voucherApi.wallet(userId!, signal),
    enabled: !!userId,
    refetchInterval: 30000,
  });
  const vouchers = (wallet.data ?? []).filter(v => filter === 'all' || voucherTarget(v) === filter);
  return <SafeAreaView className="flex-1 bg-white">
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12 }}>
      <AppPressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/offers')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="arrow-back" size={26} color="#008B45" /></AppPressable>
      <Text className="flex-1 font-bold text-xl text-ink">{history ? 'Voucher đã sử dụng' : 'Ví voucher'}</Text>
      {!history && <AppPressable accessibilityRole="button" accessibilityLabel="Lịch sử voucher đã sử dụng" onPress={() => router.push('/voucher-history')} style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }}><Text className="text-base text-muted">Lịch sử</Text></AppPressable>}
    </View>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E8ECE9' }}>{tabs.map(tab => <AppPressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: filter === tab.id }} onPress={() => setFilter(tab.id)} style={{ flex: 1, minHeight: 54, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 3, borderBottomColor: filter === tab.id ? '#008B45' : 'transparent' }}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ fontSize: 15, fontFamily: filter === tab.id ? 'Inter_600SemiBold' : 'Inter_400Regular', color: filter === tab.id ? '#008B45' : '#17241B' }}>{tab.title}</Text></AppPressable>)}</View>
    <ScrollView contentContainerStyle={{ padding: 20, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={wallet.isRefetching} onRefresh={() => { void wallet.refetch(); }} />}>
      {wallet.isPending ? <Skeleton height={180} /> : wallet.isError ? <View className="gap-3"><Text accessibilityRole="alert" className="text-sm text-coral">{userMessage(wallet.error)}</Text><FlowButton title="Tải lại" onPress={() => { void wallet.refetch(); }} /></View> : !vouchers.length ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18, paddingVertical: 44 }}>
        <View style={{ width: 126, height: 126, backgroundColor: '#F4F6F4', borderRadius: 63, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="ticket-outline" color="#B6BDB7" size={68} /></View>
        <Text className="font-semibold text-lg text-ink" style={{ textAlign: 'center' }}>{history ? 'Chưa có voucher đã sử dụng' : filter === 'all' ? 'Ví của bạn chưa có voucher' : `Chưa có voucher ${filter === 'food' ? 'giảm giá món' : 'phí vận chuyển'}`}</Text>
        <Text className="text-sm text-muted" style={{ textAlign: 'center', lineHeight: 22 }}>{history ? 'Các mã đã dùng khi đặt hàng sẽ xuất hiện ở đây.' : 'Khám phá ưu đãi hoặc đổi xu để nhận thêm voucher vào ví nhé!'}</Text>
        {!history && <FlowButton title="Khám phá ưu đãi" onPress={() => router.push('/(tabs)/offers')} />}
      </View> : <>
        <Text className="mb-4 text-sm text-muted">{vouchers.length} voucher {history ? 'đã sử dụng' : 'chưa sử dụng'}</Text>
        {vouchers.map(voucher => <VoucherTicket key={voucher.id} voucher={voucher} action={history ? 'Đã sử dụng' : 'Trong ví'} reason={history ? null : collectionError(voucher) ? 'Mã đã hết hạn hoặc hiện không khả dụng.' : null} disabled onPress={() => {}} />)}
        {!history && <FlowButton title="Lấy thêm mã ưu đãi" onPress={() => router.push('/campaign')} />}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
