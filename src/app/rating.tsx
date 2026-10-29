import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { AppPressable } from '../components/AppPressable';
import { DriverAvatar } from '../components/DriverAvatar';
import { ReviewStars } from '../components/ReviewStars';
import { FlowButton, FlowHeader } from '../components/FlowUI';
import { useOrderDriver } from '../hooks/useOrderDriver';
import { engagementApi } from '../services/engagement';
import { purchaseApi } from '../services/purchase';
import { reviewFlowApi } from '../services/reviewFlow';
import { useAuthStore } from '../store/authStore';
import { earnsReviewReward, reviewCharacterCount, type ReviewStageInput } from '../features/reviews/reviewFlow';
import { imageFromBase64 } from '../features/chat/imageData';
import { orderSnapshot } from '../features/order/orderSnapshot';
import { userMessage } from '../utils/userMessage';

export default function RatingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  return orderId ? <OrderReview key={orderId} orderId={orderId} /> : <SafeAreaView className="flex-1 bg-white"><FlowHeader title="Đánh giá" /><View className="p-5"><FlowButton title="Mở lịch sử đơn hàng" onPress={() => router.replace('/orders')} /></View></SafeAreaView>;
}

function OrderReview({ orderId }: { orderId: string }) {
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const order = useQuery({ queryKey: ['order', userId, orderId], queryFn: ({ signal }) => purchaseApi.order(orderId, userId!, signal), enabled: !!userId, staleTime: 0 });
  const reviewKey = ['review', userId, orderId] as const;
  const review = useQuery({ queryKey: reviewKey, queryFn: ({ signal }) => engagementApi.review(orderId, userId!, signal), enabled: !!userId });
  const driver = useOrderDriver(orderId, order.data?.driver_id);
  const foodIds = [...new Set(order.data?.order_items.map(item => item.food_id) ?? [])];
  const foods = useQuery({ queryKey: ['order-food-images', orderId, foodIds], queryFn: ({ signal }) => reviewFlowApi.foods(foodIds, signal), enabled: !!order.data });
  const savedVotes = useQuery({ queryKey: ['review-food-votes', userId, review.data?.id], queryFn: ({ signal }) => reviewFlowApi.votes(review.data!.id, signal), enabled: !!review.data?.restaurant_submitted_at });
  const [stage, setStage] = useState<'driver' | 'restaurant'>('driver');
  const [driverRating, setDriverRating] = useState(0);
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [driverFeedback, setDriverFeedback] = useState('');
  const [restaurantFeedback, setRestaurantFeedback] = useState('');
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [photo, setPhoto] = useState<{ path: string; uri: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const picking = useRef(false);
  const persistedPhoto = useQuery({ queryKey: ['review-photo', userId, review.data?.restaurant_image_path], queryFn: () => reviewFlowApi.imageUrl(review.data!.restaurant_image_path!), enabled: !!review.data?.restaurant_image_path, staleTime: 50 * 60000, refetchInterval: 50 * 60000 });
  useEffect(() => {
    if (!review.data) return;
    setDriverRating(review.data.driver_rating ?? 0); setRestaurantRating(review.data.restaurant_rating ?? 0);
    setDriverFeedback(review.data.driver_feedback ?? ''); setRestaurantFeedback(review.data.restaurant_feedback ?? '');
    if (review.data.driver_submitted_at || review.data.restaurant_submitted_at) setStage('restaurant');
  }, [review.data]);
  const mutation = useMutation({ mutationFn: (input: ReviewStageInput) => reviewFlowApi.submit(orderId, userId!, input), retry: false });
  const busy = mutation.isPending || uploading;
  const submitted = stage === 'driver' ? !!review.data?.driver_submitted_at : !!review.data?.restaurant_submitted_at;
  const disabled = busy || submitted || order.data?.status !== 'completed';
  const goDetails = () => router.replace({ pathname: '/order-detail', params: { orderId } });
  const close = () => { if (busy) return; if (stage === 'driver') { setStage('restaurant'); setError(''); } else goDetails(); };
  const pickPhoto = async () => {
    if (!userId || disabled || picking.current) return;
    picking.current = true; setUploading(true); setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .75, base64: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('Không đọc được ảnh. Vui lòng chọn lại.');
      const image = imageFromBase64(asset.base64);
      const path = `${userId}/${orderId}/${randomUUID()}.${image.extension}`;
      await reviewFlowApi.upload(path, image.buffer, image.mime);
      if (useAuthStore.getState().user?.id !== userId) return;
      if (photo) void reviewFlowApi.removeDraft(photo.path).catch(() => {});
      setPhoto({ path, uri: asset.uri });
    } catch (reason) { setError(userMessage(reason)); }
    finally { picking.current = false; setUploading(false); }
  };
  const send = async () => {
    if (submitted) { goDetails(); return; }
    if (submitting.current || disabled || !userId) return;
    const rating = stage === 'driver' ? driverRating : restaurantRating;
    if (!rating) return;
    submitting.current = true; setError('');
    try {
      const result = await mutation.mutateAsync({ stage, rating, feedback: stage === 'driver' ? driverFeedback : restaurantFeedback,
        imagePath: photo?.path, votes: Object.entries(votes).map(([food_id, is_liked]) => ({ food_id, is_liked })),
      });
      if (useAuthStore.getState().user?.id !== userId) return;
      client.setQueryData(reviewKey, result);
      void client.invalidateQueries({ queryKey: ['orders', userId] });
      if (stage === 'driver') { setStage('restaurant'); }
      else {
        void client.invalidateQueries({ queryKey: ['profile', userId] });
        void client.invalidateQueries({ queryKey: ['food-review-stats'] });
        void client.invalidateQueries({ queryKey: ['review-food-votes', userId] });
        Toast.show({ type: 'success', text1: result.reward_points ? 'Đã lưu đánh giá và cộng 500 xu!' : 'Đã lưu đánh giá. Cảm ơn bạn!' });
        goDetails();
      }
    } catch (reason) { setError(userMessage(reason)); }
    finally { submitting.current = false; }
  };
  const currentRating = stage === 'driver' ? driverRating : restaurantRating;
  const imageUri = photo?.uri ?? persistedPhoto.data;
  return <SafeAreaView className="flex-1 bg-white">
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, minHeight: 64, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' }}>
      <AppPressable accessibilityRole="button" accessibilityLabel={stage === 'driver' ? 'Bỏ qua đánh giá tài xế' : 'Đóng đánh giá'} disabled={busy} onPress={close} style={{ width: 44, height: 48, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={30} color="#008B45" /></AppPressable>
      <Text className="font-semibold text-lg text-ink" style={{ flex: 1 }}>{stage === 'driver' ? 'Đánh giá tài xế' : 'Đánh giá quán và món'}</Text>
      <AppPressable accessibilityRole="button" onPress={() => Alert.alert('Hỗ trợ đánh giá SubiFood', 'Bạn có thể bỏ qua đánh giá tài xế bằng nút X. Đánh giá quán cần chọn 1–5 sao. Bình luận từ 50 ký tự và 1 ảnh hợp lệ được cộng 500 xu một lần cho mỗi đơn.')} style={{ minHeight: 44, justifyContent: 'center' }}><Text className="text-sm text-teal">Hỗ trợ</Text></AppPressable>
    </View>
    {order.isPending || review.isPending ? <Text className="p-5 text-muted">Đang tải đánh giá…</Text> : order.isError || review.isError ? <View className="gap-4 p-5"><Text className="text-coral">Không tải được đơn hoặc đánh giá.</Text><FlowButton title="Thử lại" onPress={() => { void order.refetch(); void review.refetch(); }} /></View>
      : !order.data ? <Text className="p-5 text-muted">Không tìm thấy đơn hàng của bạn.</Text>
      : <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={{ alignItems: 'center', paddingTop: 28, paddingBottom: 36, gap: 18 }}>
            {stage === 'driver' ? <DriverAvatar size={90} path={driver.data?.profile?.avatar_url} /> : <Image source={order.data.restaurants?.image_url ? { uri: order.data.restaurants.image_url } : undefined} style={{ width: 90, height: 90, borderRadius: 10, backgroundColor: '#EAF7EF' }} />}
            <Text className="font-semibold text-base text-muted" style={{ textAlign: 'center', paddingHorizontal: 20 }}>{stage === 'driver' ? driver.data?.profile?.full_name || (order.data.driver_id ? 'Tài xế chưa cập nhật hồ sơ' : 'Chưa phân công tài xế') : order.data.restaurants?.name ?? 'Quán ăn'}</Text>
            {stage === 'driver' && driver.isError && <AppPressable onPress={() => { void driver.refetch(); }}><Text className="text-sm text-coral">Không tải được hồ sơ tài xế. Chạm để thử lại.</Text></AppPressable>}
            <ReviewStars label={stage === 'driver' ? 'Đánh giá tài xế' : 'Đánh giá quán'} value={currentRating} onChange={stage === 'driver' ? setDriverRating : setRestaurantRating} disabled={disabled || (stage === 'driver' && !order.data.driver_id)} />
            {stage === 'driver' && !order.data.driver_id && <Text className="px-5 text-center text-sm text-muted">Đơn chưa có tài xế. Bấm X để chuyển sang đánh giá quán.</Text>}
            {order.data.status !== 'completed' && <Text className="px-5 text-sm text-coral">Chỉ được đánh giá sau khi đơn hoàn thành.</Text>}
            {submitted && <Text className="px-5 text-sm text-teal">Đánh giá đã được lưu{review.data?.reward_points ? ' · Đã nhận 500 xu' : ''}.</Text>}
          </View>
          <View style={{ borderTopWidth: 10, borderTopColor: '#F5F5F5', padding: 20 }}>
            <TextInput accessibilityLabel={stage === 'driver' ? 'Nhận xét tài xế' : 'Nhận xét quán'} value={stage === 'driver' ? driverFeedback : restaurantFeedback} onChangeText={stage === 'driver' ? setDriverFeedback : setRestaurantFeedback} editable={!disabled} maxLength={2000} multiline textAlignVertical="top"
              placeholder={stage === 'driver' ? 'Bạn có điều gì muốn chia sẻ cùng SubiFood? Hãy để lại đánh giá về trải nghiệm giao hàng nhé!' : 'Bạn hãy để lại bình luận tại đây nhé! Chia sẻ trải nghiệm về quán và món ăn cùng SubiFood.'}
              style={{ minHeight: stage === 'driver' ? 180 : 150, fontSize: 15, lineHeight: 23, color: '#17241B', padding: 0 }} placeholderTextColor="#9B9E9B" />
            {stage === 'restaurant' && <>
              {!submitted && <Text style={{ color: earnsReviewReward(restaurantFeedback, !!photo) ? '#008B45' : '#858A85', fontSize: 13, marginBottom: 14 }}>Bình luận từ 50 ký tự & 1 ảnh để nhận 500 xu · {reviewCharacterCount(restaurantFeedback)}/50 ký tự</Text>}
              {imageUri ? <View style={{ alignSelf: 'flex-start' }}><Image source={{ uri: imageUri }} style={{ width: 90, height: 90, borderRadius: 10 }} />{!disabled && <AppPressable accessibilityRole="button" accessibilityLabel="Bỏ ảnh đánh giá" onPress={() => { if (photo) void reviewFlowApi.removeDraft(photo.path).catch(() => {}); setPhoto(null); }} style={{ position: 'absolute', right: -6, top: -6, backgroundColor: 'white', borderRadius: 12 }}><Ionicons name="close-circle" size={25} color="#008B45" /></AppPressable>}</View>
                : !submitted && <AppPressable accessibilityRole="button" accessibilityLabel="Thêm ảnh đánh giá" disabled={disabled} onPress={() => { void pickPhoto(); }} style={{ width: 90, height: 90, borderWidth: 1, borderStyle: 'dashed', borderColor: '#008B45', borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 6 }}><Ionicons name="camera" size={28} color="#008B45" /><Text className="text-sm text-teal">{uploading ? 'Đang tải…' : 'Thêm ảnh'}</Text></AppPressable>}
              {persistedPhoto.isError && <Text className="mt-3 text-sm text-coral">Không tải được ảnh đánh giá.</Text>}
            </>}
          </View>
          {stage === 'restaurant' && <View style={{ borderTopWidth: 10, borderTopColor: '#F5F5F5', padding: 20, gap: 18 }}>
            <Text className="font-semibold text-base text-ink" style={{ textAlign: 'center', marginBottom: 8 }}>Bạn có hài lòng với món?</Text>
            {foodIds.map(foodId => {
              const item = order.data!.order_items.find(row => row.food_id === foodId)!;
              const food = foods.data?.find(row => row.id === foodId);
              const snapshot = orderSnapshot(item.options_snapshot, food?.name ?? 'Món ăn');
              const vote = submitted ? savedVotes.data?.find(row => row.food_id === foodId)?.is_liked : votes[foodId];
              return <View key={foodId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image source={snapshot.image || food?.image_url ? { uri: snapshot.image || food!.image_url! } : undefined} style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: '#F0F3F0' }} />
                <Text numberOfLines={2} className="text-sm text-ink" style={{ flex: 1 }}>{snapshot.name}</Text>
                {([false,true] as const).map(liked => <AppPressable key={String(liked)} accessibilityRole="checkbox" accessibilityLabel={`${liked ? 'Thích' : 'Không thích'} ${snapshot.name}`} accessibilityState={{ checked: vote === liked, disabled }} disabled={disabled} onPress={() => setVotes(current => { const next = { ...current }; if (next[foodId] === liked) delete next[foodId]; else next[foodId] = liked; return next; })} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={liked ? vote === true ? 'thumbs-up' : 'thumbs-up-outline' : vote === false ? 'thumbs-down' : 'thumbs-down-outline'} size={24} color={vote === liked ? '#008B45' : '#B2B9B2'} /></AppPressable>)}
              </View>;
            })}
            {savedVotes.isError && <Text className="text-sm text-coral">Không tải được đánh giá món.</Text>}
          </View>}
          {!!error && <Text accessibilityRole="alert" className="p-5 text-sm text-coral">{error}</Text>}
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F1F0' }}><FlowButton title={submitted ? 'Xem chi tiết đơn hàng' : busy ? 'Đang xử lý…' : 'Gửi đi'} disabled={busy || (!submitted && (disabled || !currentRating || (stage === 'driver' && !order.data.driver_id)))} onPress={() => { void send(); }} /></View>
      </KeyboardAvoidingView>}
  </SafeAreaView>;
}
