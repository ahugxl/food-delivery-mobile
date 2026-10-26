import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { AppPressable } from '../components/AppPressable';
import { FlowButton, FlowCard, FlowHeader } from '../components/FlowUI';
import { OrderDriverInfo } from '../components/OrderDriverInfo';
import { engagementApi } from '../services/engagement';
import { purchaseApi } from '../services/purchase';
import { useAuthStore } from '../store/authStore';
import { REVIEW_TAGS, type ReviewInput } from '../features/reviews/review';
import { messageError } from '../features/chat/messages';
import { viLabel } from '../utils/vietnamese';

function Stars({ label, value, onChange, disabled }: { label: string; value: number; onChange: (rating: number) => void; disabled: boolean }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} className="flex-row gap-2">
    {[1,2,3,4,5].map(star => <AppPressable key={star} accessibilityRole="radio" accessibilityLabel={`${label}: ${star} sao`} accessibilityState={{ checked: value === star, disabled }} disabled={disabled} onPress={() => onChange(star)} className="h-12 w-12 items-center justify-center">
      <Ionicons name={star <= value ? 'star' : 'star-outline'} size={32} color={star <= value ? '#FF6B55' : '#C8CEC9'} />
    </AppPressable>)}
  </View>;
}
export default function RatingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  return orderId ? <OrderReview key={orderId} orderId={orderId} /> : <SafeAreaView className="flex-1 bg-cream"><FlowHeader title="Đánh giá" /><View className="gap-4 p-5"><Text className="text-muted">Chọn một đơn đã hoàn thành để đánh giá.</Text><FlowButton title="Mở lịch sử đơn hàng" onPress={() => router.replace('/orders')} /></View></SafeAreaView>;
}
function OrderReview({ orderId }: { orderId: string }) {
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const order = useQuery({ queryKey: ['order', userId, orderId], queryFn: ({ signal }) => purchaseApi.order(orderId, userId!, signal), enabled: !!userId, staleTime: 0 });
  const reviewKey = ['review', userId, orderId] as const;
  const review = useQuery({ queryKey: reviewKey, queryFn: ({ signal }) => engagementApi.review(orderId, userId!, signal), enabled: !!userId });
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [restaurantFeedback, setRestaurantFeedback] = useState('');
  const [driverFeedback, setDriverFeedback] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const submitted = useRef(false);
  const mutation = useMutation({ mutationFn: (input: ReviewInput) => engagementApi.submitReview(orderId, userId!, input), retry: false });
  useEffect(() => {
    if (!review.data) return;
    setRestaurantRating(review.data.restaurant_rating ?? 0); setDriverRating(review.data.driver_rating ?? 0);
    setRestaurantFeedback(review.data.restaurant_feedback ?? ''); setDriverFeedback(review.data.driver_feedback ?? '');
    setTags(Array.isArray(review.data.driver_tags) ? review.data.driver_tags.filter((tag): tag is string => typeof tag === 'string') : []);
  }, [review.data]);
  const disabled = !!review.data || mutation.isPending || order.data?.status !== 'completed';
  const submit = async () => {
    if (submitted.current || disabled || !userId || !restaurantRating || !driverRating) return;
    submitted.current = true;
    try {
      const result = await mutation.mutateAsync({ restaurantRating, driverRating, restaurantFeedback, driverFeedback, tags });
      if (useAuthStore.getState().user?.id !== userId) return;
      client.setQueryData(reviewKey, result);
      void client.invalidateQueries({ queryKey: ['orders', userId] });
      Toast.show({ type: 'success', text1: 'Đã lưu đánh giá. Cảm ơn bạn!' });
    } catch (error) { Toast.show({ type: 'error', text1: 'Chưa lưu được đánh giá', text2: messageError(error) }); }
    finally { submitted.current = false; }
  };
  return <SafeAreaView className="flex-1 bg-cream"><FlowHeader title="Đánh giá đơn hàng" />
    {order.isPending || review.isPending ? <Text className="p-5 text-muted">Đang tải đánh giá...</Text>
      : order.isError || review.isError ? <View className="gap-4 p-5"><Text className="text-coral">Không tải được đơn hoặc đánh giá.</Text><FlowButton title="Thử lại" onPress={() => { void order.refetch(); void review.refetch(); }} /></View>
      : !order.data ? <Text className="p-5 text-muted">Không tìm thấy đơn hàng của bạn.</Text>
      : <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
        {order.data.status !== 'completed' && <Text accessibilityRole="alert" className="mb-5 text-sm text-coral">Chỉ được đánh giá sau khi đơn hàng đã hoàn thành.</Text>}
        {!!review.data && <Text className="mb-5 font-semibold text-sm text-teal">Đánh giá của bạn đã được lưu. Mỗi đơn được gửi một lần.</Text>}
        <FlowCard><Text className="font-bold text-lg text-ink">{order.data.restaurants?.name ?? 'Quán ăn'}</Text>
          <Stars label="Đánh giá quán ăn" value={restaurantRating} onChange={setRestaurantRating} disabled={disabled} />
          <TextInput accessibilityLabel="Nhận xét quán ăn" value={restaurantFeedback} onChangeText={setRestaurantFeedback} maxLength={2000} editable={!disabled} multiline placeholder="Món ăn và dịch vụ của quán..." className="min-h-24 rounded-2xl border border-line p-4 text-sm text-ink" />
        </FlowCard>
        <FlowCard><OrderDriverInfo orderId={orderId} driverId={order.data.driver_id} />
          <Stars label="Đánh giá tài xế" value={driverRating} onChange={setDriverRating} disabled={disabled} />
          <View className="flex-row flex-wrap gap-2">{REVIEW_TAGS.map(tag => <AppPressable key={tag} accessibilityRole="checkbox" accessibilityLabel={viLabel(tag)} accessibilityState={{ checked: tags.includes(tag), disabled }} disabled={disabled} onPress={() => setTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag])}
            className={`min-h-11 justify-center rounded-full border px-4 ${tags.includes(tag) ? 'border-teal bg-tealLight' : 'border-line bg-card'}`}><Text className="font-medium text-sm text-ink">{viLabel(tag)}</Text></AppPressable>)}</View>
          <TextInput accessibilityLabel="Nhận xét tài xế" value={driverFeedback} onChangeText={setDriverFeedback} maxLength={2000} editable={!disabled} multiline placeholder="Chia sẻ trải nghiệm giao hàng..." className="min-h-24 rounded-2xl border border-line p-4 text-sm text-ink" />
        </FlowCard>
        {mutation.isError && <Text accessibilityRole="alert" className="mb-4 text-sm text-coral">{messageError(mutation.error)}</Text>}
        <FlowButton title={review.data ? 'Đã gửi đánh giá' : mutation.isPending ? 'Đang gửi...' : 'Gửi đánh giá'} disabled={disabled || !restaurantRating || !driverRating} onPress={() => { void submit(); }} />
        <View className="mt-4"><FlowButton title="Xem lại hóa đơn" onPress={() => router.push({ pathname: '/tracking', params: { orderId } })} /></View>
      </ScrollView></KeyboardAvoidingView>}
  </SafeAreaView>;
}
