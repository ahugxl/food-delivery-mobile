import { useEffect, useRef, useState } from 'react';
import { Modal, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import Toast from 'react-native-toast-message';
import { AppPressable } from '../../components/AppPressable';
import { FlowButton } from '../../components/FlowUI';
import { useAuthStore } from '../../store/authStore';
import { accountApi } from '../../services/account';
import { rewardsApi } from '../../services/rewards';
import { voucherKeys } from '../../services/voucherApi';
import { currency } from '../order/checkout';
import { userMessage } from '../../utils/userMessage';
import { REWARD_TIERS, parseRewardRequest, rewardRequestKey, type RewardAmount, type RewardRequest } from './rewards';

const xu = (points: number) => `${points.toLocaleString('vi-VN')} xu`;

export default function RewardsScreen() {
  const userId = useAuthStore(s => s.user?.id) || '';
  const client = useQueryClient();
  const profile = useQuery({ queryKey: ['profile', userId], queryFn: ({ signal }) => accountApi.profile(userId, signal), enabled: !!userId, staleTime: 0, refetchInterval: 30000 });
  const history = useQuery({ queryKey: ['loyalty-redemptions', userId], queryFn: ({ signal }) => rewardsApi.history(userId, signal), enabled: !!userId });
  const [confirm, setConfirm] = useState<RewardAmount | null>(null);
  const [info, setInfo] = useState(false);
  const [pending, setPending] = useState<RewardRequest | null>(null);
  const [ready, setReady] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const running = useRef(false);
  const mutation = useMutation({ mutationFn: (request: RewardRequest) => rewardsApi.redeem(userId, request), retry: false });
  useEffect(() => {
    let active = true;
    setReady(false); setPending(null); setError(''); setConfirm(null);
    if (!userId) return;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(rewardRequestKey(userId));
        const stored = raw ? parseRewardRequest(JSON.parse(raw)) : null;
        if (raw && !stored) throw Error('Không đọc được yêu cầu đổi xu trước đó. Vui lòng liên hệ hỗ trợ trước khi đổi tiếp.');
        if (active) { setPending(stored); setReady(true); }
      } catch (reason) { if (active) setError(userMessage(reason)); }
    })();
    return () => { active = false; };
  }, [userId, loadVersion]);
  const refresh = () => { void profile.refetch(); void history.refetch(); };
  const redeem = async (request: RewardRequest) => {
    if (running.current || !userId || !ready) return;
    running.current = true; setWorking(true); setError(''); setConfirm(null);
    let persisted = false;
    try {
      // Persist BEFORE sending. Reopen/retry uses the same server idempotency key.
      await AsyncStorage.setItem(rewardRequestKey(userId), JSON.stringify(request));
      persisted = true; setPending(request);
      const result = await mutation.mutateAsync(request);
      if (useAuthStore.getState().user?.id !== userId) return;
      client.setQueryData<NonNullable<typeof profile.data>>(['profile', userId], previous => previous ? { ...previous, loyalty_points: result.balance } : previous);
      try {
        await AsyncStorage.removeItem(rewardRequestKey(userId));
        setPending(null);
      } catch { setError('Đã nhận voucher. Bấm kiểm tra yêu cầu trước để đồng bộ lại; xu sẽ không bị trừ thêm.'); }
      void client.invalidateQueries({ queryKey: ['profile', userId] });
      void client.invalidateQueries({ queryKey: ['loyalty-redemptions', userId] });
      void client.invalidateQueries({ queryKey: voucherKeys.wallet(userId) });
      void client.invalidateQueries({ queryKey: voucherKeys.owned(userId) });
      Toast.show({ type: 'success', text1: 'Đã đổi xu thành công!', text2: `Voucher giảm ${currency(result.discount_amount)} đã có trong ví.` });
    } catch (reason) {
      if (useAuthStore.getState().user?.id !== userId) return;
      setError(userMessage(reason));
      // PostgreSQL application rejection is definitive; network failures may have committed.
      if (persisted && reason && typeof reason === 'object' && 'code' in reason && reason.code === 'P0001') {
        try { await AsyncStorage.removeItem(rewardRequestKey(userId)); setPending(null); } catch { /* Retain request for safe replay. */ }
      }
      void profile.refetch();
    } finally { running.current = false; setWorking(false); }
  };
  const points = Number(profile.data?.loyalty_points ?? 0);
  const selected = REWARD_TIERS.find(t => t.amount === confirm);
  return <SafeAreaView className="flex-1 bg-cream" edges={['top','left','right']}>
    <ScrollView refreshControl={<RefreshControl refreshing={profile.isRefetching || history.isRefetching} onRefresh={refresh} />} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={{ backgroundColor: '#006A3B', padding: 22, gap: 18, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <View className="flex-row items-center justify-between"><Text style={{ color: 'white', fontSize: 24, fontFamily: 'Inter_700Bold' }}>Xu & ưu đãi</Text><AppPressable accessibilityRole="button" accessibilityLabel="Mở ví voucher" onPress={() => router.push('/voucher-wallet')} style={{ padding: 8 }}><Ionicons name="ticket-outline" size={28} color="white" /></AppPressable></View>
        <Text style={{ color: '#DAF2D7', fontSize: 15 }}>Tích xu từ đánh giá, đổi mã cho bữa ngon</Text>
        <View style={{ backgroundColor: 'white', borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF3CA', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#CA8C00', fontSize: 20, fontFamily: 'Inter_700Bold' }}>Xu</Text></View>
          <View className="flex-1 gap-1"><Text className="text-sm text-muted">Xu hiện có của bạn</Text><Text className="font-bold text-2xl text-ink">{profile.isPending || profile.isError ? '—' : xu(points)}</Text></View>
        </View>
      </View>
      <View className="gap-4 p-5">
        <View className="flex-row gap-3">{[{ label: 'Đổi xu', active: !info, press: () => setInfo(false) }, { label: 'Cách tích xu', active: info, press: () => setInfo(true) }].map(tab => <AppPressable key={tab.label} accessibilityRole="button" accessibilityState={{ selected: tab.active }} onPress={tab.press} style={{ flex: 1, paddingVertical: 13, borderRadius: 24, alignItems: 'center', backgroundColor: tab.active ? '#164D42' : '#E6F2E7' }}><Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: tab.active ? 'white' : '#164D42' }}>{tab.label}</Text></AppPressable>)}</View>
        {profile.isError && <View className="gap-2"><Text className="text-sm text-coral">Chưa tải được số xu.</Text><FlowButton title="Thử lại" onPress={() => { void profile.refetch(); }} /></View>}
        {!!error && <Text accessibilityRole="alert" className="text-sm text-coral">{error}</Text>}
        {!ready && !!userId && !!error && <FlowButton title="Đọc lại yêu cầu đổi xu" onPress={() => setLoadVersion(v => v + 1)} />}
        {pending && <View className="gap-3 rounded-2xl bg-sage p-4"><Text className="text-sm text-ink">Có yêu cầu đổi voucher {currency(pending.amount)} đang chờ xác nhận. Kiểm tra yêu cầu này trước khi đổi tiếp để tránh trừ xu hai lần.</Text><FlowButton title={working ? 'Đang kiểm tra…' : 'Kiểm tra yêu cầu trước'} disabled={working} onPress={() => { void redeem(pending); }} /></View>}
        {info ? <View className="gap-3 rounded-3xl bg-white p-5"><Ionicons name="star" color="#F5B21B" size={30} /><Text className="font-bold text-lg text-ink">Đánh giá bữa ăn, nhận 500 xu</Text><Text className="text-sm text-muted" style={{ lineHeight: 22 }}>Sau khi đơn hoàn thành, gửi đánh giá quán với bình luận từ 50 ký tự và 1 ảnh hợp lệ để nhận 500 xu. Mỗi đơn chỉ được nhận thưởng một lần.</Text><FlowButton title="Xem đơn hàng của tôi" onPress={() => router.push('/(tabs)/orders')} /></View> : <>
          <View className="gap-2"><Text className="font-bold text-xl text-ink">Đổi xu lấy voucher</Text><Text className="text-sm text-muted" style={{ lineHeight: 21 }}>Giảm tiền món tại mọi quán · Không yêu cầu đơn tối thiểu · Hạn 30 ngày từ lúc đổi. Mỗi voucher dùng một lần, giảm tối đa bằng tiền món.</Text></View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{REWARD_TIERS.map(tier => {
            const insufficient = points < tier.points;
            const disabled = !ready || working || !!pending || !profile.data || profile.isError || insufficient;
            return <View key={tier.amount} style={{ width: '48%', flexGrow: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: 'white', borderWidth: 1, borderColor: '#E2EAE3' }}>
              <View style={{ backgroundColor: '#DFF0DD', padding: 16, gap: 8 }}><Ionicons name="ticket" size={30} color="#008B45" /><Text style={{ fontSize: 13, color: '#176543' }}>Voucher giảm tiền món</Text><Text style={{ fontSize: 25, fontFamily: 'Inter_700Bold', color: '#006A3B' }}>{currency(tier.amount)}</Text></View>
              <View style={{ padding: 14, gap: 12 }}><Text className="font-semibold text-base text-ink">{xu(tier.points)}</Text>{insufficient && !profile.isPending && <Text className="text-xs text-muted">Cần thêm {xu(tier.points - points)}</Text>}<AppPressable accessibilityRole="button" accessibilityLabel={`Đổi ${xu(tier.points)} lấy voucher ${currency(tier.amount)}`} disabled={disabled} onPress={() => setConfirm(tier.amount)} style={{ borderRadius: 22, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: disabled ? '#ECEEEC' : '#008B45' }}><Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: disabled ? '#727772' : 'white' }}>{insufficient ? 'Chưa đủ xu' : 'Đổi ngay'}</Text></AppPressable></View>
            </View>;
          })}</View>
          <Text className="font-bold text-lg text-ink">Lịch sử đổi xu</Text>
          {history.isPending ? <Text className="text-sm text-muted">Đang tải lịch sử…</Text> : history.isError ? <FlowButton title="Tải lại lịch sử" onPress={() => { void history.refetch(); }} /> : !history.data?.length ? <Text className="text-sm text-muted">Bạn chưa đổi voucher nào.</Text> : history.data.map(item => <View key={item.id} className="gap-1 rounded-2xl bg-white p-4"><Text className="font-semibold text-sm text-ink">Voucher giảm {currency(item.discount_amount)}</Text><Text className="text-xs text-muted">−{xu(item.points_spent)} · {new Date(item.created_at).toLocaleString('vi-VN')}</Text></View>)}
        </>}
      </View>
    </ScrollView>
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setConfirm(null)}><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,.45)', padding: 24 }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 430, borderRadius: 24, backgroundColor: 'white', padding: 22, gap: 18 }}><Text className="font-bold text-xl text-ink">Xác nhận đổi voucher</Text><Text className="text-sm text-muted" style={{ lineHeight: 22 }}>Dùng {xu(selected?.points ?? 0)} để nhận voucher giảm {currency(selected?.amount ?? 0)} tiền món. Voucher sẽ được thêm vào ví và có hạn sử dụng 30 ngày.</Text><FlowButton title={`Đổi ${xu(selected?.points ?? 0)}`} disabled={working} onPress={() => { if (selected) void redeem({ id: randomUUID(), amount: selected.amount }); }} /><AppPressable accessibilityRole="button" onPress={() => setConfirm(null)} style={{ padding: 12, alignItems: 'center' }}><Text className="font-semibold text-base text-muted">Để sau</Text></AppPressable></View></View></Modal>
  </SafeAreaView>;
}
