import { useCallback, useState } from 'react';
import { FlatList, Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { AppPressable } from '../../components/AppPressable';
import { FlowButton, FlowHeader } from '../../components/FlowUI';
import { Skeleton } from '../../components/Skeleton';
import { catalogApi, catalogKeys } from '../../services/catalog';
import { isUuid } from '../../services/catalogApi';
import { restaurantReviewsApi } from '../../services/restaurantReviews';
import { REVIEW_PAGE_SIZE, type RestaurantReview, type ReviewFilters } from '../../services/restaurantReviewsApi';
import { useAuthStore } from '../../store/authStore';
import { useRestaurantReviewSummary } from '../../hooks/useRestaurantReviewSummary';

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return <View accessible accessibilityLabel={`${rating} trên 5 sao`} style={{ flexDirection: 'row', gap: 2 }}>{[1,2,3,4,5].map(star => <Ionicons key={star} name={rating >= star ? 'star' : rating >= star - 0.5 ? 'star-half' : 'star'} color={rating >= star - 0.5 ? '#FFBD18' : '#E3E5E3'} size={size} />)}</View>;
}
function ReviewPhoto({ path, userId }: { path: string; userId: string }) {
  const [full, setFull] = useState(false), [failedUrl, setFailedUrl] = useState<string | null>(null);
  const image = useQuery({ queryKey: ['restaurant-review-photo', userId, path], queryFn: () => restaurantReviewsApi.photo(path), staleTime: 45 * 60 * 1000 });
  if (image.isPending) return <Skeleton height={190} />;
  if (image.isError || !image.data || failedUrl === image.data) return <View className="gap-2 rounded-2xl bg-sage p-4"><Text className="text-sm text-muted">Chưa tải được ảnh đánh giá.</Text><AppPressable accessibilityRole="button" onPress={() => { setFailedUrl(null); void image.refetch(); }}><Text className="text-sm text-teal">Tải lại ảnh</Text></AppPressable></View>;
  return <><AppPressable accessibilityRole="button" accessibilityLabel="Xem ảnh đánh giá đầy đủ" onPress={() => setFull(true)}><Image source={{ uri: image.data }} contentFit="cover" style={{ width: '100%', height: 210, borderRadius: 16, backgroundColor: '#F3F5F2' }} onError={() => setFailedUrl(image.data)} /></AppPressable>
    <Modal visible={full} animationType="fade" onRequestClose={() => setFull(false)}><SafeAreaView style={{ flex: 1, backgroundColor: '#101510' }}><AppPressable accessibilityRole="button" accessibilityLabel="Đóng ảnh" onPress={() => setFull(false)} style={{ padding: 18, alignSelf: 'flex-end' }}><Ionicons name="close" size={28} color="white" /></AppPressable><Image source={{ uri: image.data }} contentFit="contain" style={{ flex: 1 }} /></SafeAreaView></Modal></>;
}
function ReviewCard({ review, userId }: { review: RestaurantReview; userId: string }) {
  const date = new Date(review.submitted_at);
  return <View className="gap-3 border-b border-line bg-white px-5 py-5">
    <View className="flex-row items-center gap-3"><View className="h-10 w-10 items-center justify-center rounded-full bg-tealLight"><Text className="font-semibold text-base text-teal">{review.author_name.charAt(0)}</Text></View><View className="flex-1 gap-1"><Text className="font-semibold text-sm text-ink">{review.author_name}</Text><Text className="text-xs text-muted">Khách đã đặt hàng{review.is_mine ? ' · Đánh giá của bạn' : ''}</Text></View></View>
    <View className="flex-row flex-wrap items-center gap-2"><Stars rating={review.rating} /><Text className="text-xs text-muted">{Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</Text></View>
    {review.photo_path && <ReviewPhoto path={review.photo_path} userId={userId} />}
    {!!review.feedback && <Text className="text-sm text-ink" style={{ lineHeight: 22 }}>{review.feedback}</Text>}
    {!!review.ordered_foods.length && <Text className="text-xs text-muted" style={{ lineHeight: 19 }}>Đã đặt: {review.ordered_foods.join(' · ')}</Text>}
  </View>;
}
export default function RestaurantReviews({ restaurantId }: { restaurantId: string }) {
  const userId = useAuthStore(s => s.user?.id) || '', client = useQueryClient();
  const [filters, setFilters] = useState<ReviewFilters>({ sort: 'newest', rating: null, photos: false, mine: false });
  const valid = isUuid(restaurantId);
  const restaurant = useQuery({ queryKey: catalogKeys.restaurant(restaurantId), queryFn: ({ signal }) => catalogApi.restaurant(restaurantId, signal), enabled: valid });
  const enabled = valid && !!userId && !!restaurant.data;
  const summary = useRestaurantReviewSummary(restaurantId, enabled);
  const feed = useInfiniteQuery({ queryKey: ['restaurant-reviews', restaurantId, userId, 'feed', filters], initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => restaurantReviewsApi.feed(restaurantId, filters, pageParam, signal), enabled,
    getNextPageParam: (last, pages) => last.length === REVIEW_PAGE_SIZE && pages.length * REVIEW_PAGE_SIZE <= 100000 ? pages.length * REVIEW_PAGE_SIZE : undefined,
  });
  useFocusEffect(useCallback(() => { if (valid) void client.invalidateQueries({ queryKey: ['restaurant-reviews', restaurantId] }); }, [restaurantId, valid, client]));
  const refresh = () => { void restaurant.refetch(); void summary.refetch(); void feed.refetch(); };
  if (!valid || restaurant.isError || (!restaurant.isPending && !restaurant.data)) return <SafeAreaView className="flex-1 bg-white"><FlowHeader title="Đánh giá quán" /><View className="gap-4 p-5"><Text className="text-muted">{restaurant.isError ? 'Chưa tải được thông tin quán.' : 'Không tìm thấy quán đang hoạt động.'}</Text>{valid && <FlowButton title="Thử lại" onPress={() => { void restaurant.refetch(); }} />}</View></SafeAreaView>;
  const rows = feed.data?.pages.flat() ?? [], stats = summary.data;
  const chip = (label: string, selected: boolean, onPress: () => void) => <AppPressable key={label} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} className={`min-h-10 justify-center rounded-full border px-4 ${selected ? 'border-teal bg-tealLight' : 'border-line bg-white'}`}><Text className={`text-sm ${selected ? 'font-semibold text-teal' : 'text-muted'}`}>{label}</Text></AppPressable>;
  return <SafeAreaView className="flex-1 bg-white" edges={['top','left','right']}><FlowHeader title="Đánh giá quán" />
    <FlatList data={rows} keyExtractor={r => r.review_id} renderItem={({ item }) => <ReviewCard review={item} userId={userId} />}
      contentContainerStyle={{ paddingBottom: 36 }} refreshing={restaurant.isRefetching || summary.isRefetching || feed.isRefetching} onRefresh={refresh}
      ListHeaderComponent={<View>
        <View className="flex-row items-center gap-3 px-5 pb-5">{restaurant.data?.image_url && <Image source={{ uri: restaurant.data.image_url }} style={{ width: 54, height: 54, borderRadius: 12 }} />}<Text className="flex-1 font-bold text-lg text-ink">{restaurant.data?.name || 'Đang tải quán…'}</Text></View>
        {summary.isPending ? <View className="px-5 pb-5"><Skeleton height={130} /></View> : summary.isError ? <View className="gap-2 px-5 pb-5"><Text className="text-sm text-muted">Chưa tải được tổng hợp đánh giá.</Text><FlowButton title="Thử lại" onPress={() => { void summary.refetch(); }} /></View> : stats && <View className="flex-row gap-5 border-y border-line px-5 py-5">
          <View className="flex-1 justify-center gap-2"><Text className="font-bold text-ink" style={{ fontSize: 36 }}>{restaurant.data?.rating == null ? '—' : Number(restaurant.data.rating).toFixed(1)}</Text><Stars rating={Number(restaurant.data?.rating ?? 0)} size={19} /><Text className="text-xs text-muted">{Number(stats.review_count).toLocaleString('vi-VN')} đánh giá</Text></View>
          <View style={{ flex: 1.5, gap: 5 }}>{([5,4,3,2,1] as const).map(n => {
            const count = Number(stats[`star_${n}`]);
            return <AppPressable key={n} accessibilityRole="button" accessibilityLabel={`Lọc ${n} sao, ${count} đánh giá`} accessibilityState={{ selected: filters.rating === n }} onPress={() => setFilters(f => ({ ...f, rating: f.rating === n ? null : n }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 25 }}><Text style={{ width: 12, color: filters.rating === n ? '#008B45' : '#727772', fontSize: 12 }}>{n}</Text><View style={{ flex: 1, height: 5, backgroundColor: '#F1F3F1', borderRadius: 3, overflow: 'hidden' }}><View style={{ width: `${stats.review_count ? count / Number(stats.review_count) * 100 : 0}%`, height: '100%', backgroundColor: '#FFBD18' }} /></View><Text style={{ minWidth: 20, textAlign: 'right', fontSize: 10, color: '#727772' }}>{count}</Text></AppPressable>;
          })}</View>
        </View>}
        <Text className="px-5 pb-3 pt-5 font-bold text-lg text-ink">Bài đánh giá</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16, gap: 8 }}>
          {chip('Mới nhất', filters.sort === 'newest', () => setFilters(f => ({ ...f, sort: 'newest' })))}
          {chip('Cao nhất', filters.sort === 'highest', () => setFilters(f => ({ ...f, sort: 'highest' })))}
          {chip('Thấp nhất', filters.sort === 'lowest', () => setFilters(f => ({ ...f, sort: 'lowest' })))}
          {chip('Có ảnh', filters.photos, () => setFilters(f => ({ ...f, photos: !f.photos })))}
          {chip('Đánh giá của tôi', filters.mine, () => setFilters(f => ({ ...f, mine: !f.mine })))}
          {filters.rating !== null && chip(`${filters.rating} sao ✕`, true, () => setFilters(f => ({ ...f, rating: null })))}
        </ScrollView>
      </View>}
      ListEmptyComponent={feed.isPending || restaurant.isPending ? <View className="gap-4 p-5"><Skeleton height={90} /><Skeleton height={180} /></View> : feed.isError ? <View className="gap-4 p-5"><Text className="text-muted">Không tải được đánh giá. Vui lòng thử lại.</Text><FlowButton title="Thử lại" onPress={() => { void feed.refetch(); }} /></View> : <View className="items-center gap-3 p-8"><Ionicons name="chatbubble-ellipses-outline" size={40} color="#A5BAA8" /><Text className="text-center text-sm text-muted">{stats?.review_count ? 'Chưa có đánh giá phù hợp với bộ lọc.' : 'Quán chưa có đánh giá trên ứng dụng.'}</Text></View>}
      ListFooterComponent={rows.length > 0 ? <View className="gap-3 p-5">{feed.isFetchNextPageError && <Text className="text-sm text-coral">Chưa tải được các đánh giá tiếp theo.</Text>}{feed.hasNextPage && <FlowButton title={feed.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm đánh giá'} disabled={feed.isFetchingNextPage} onPress={() => { void feed.fetchNextPage(); }} />}<Text className="text-center text-xs text-muted">Tên khách được rút gọn để bảo vệ thông tin cá nhân.</Text></View> : null}
    />
  </SafeAreaView>;
}
