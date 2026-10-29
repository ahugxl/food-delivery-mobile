import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { reviewFlowApi } from '../services/reviewFlow';
import { AppPressable } from './AppPressable';

export function FoodReviewStats({ foodId }: { foodId: string }) {
  const query = useQuery({ queryKey: ['food-review-stats', foodId], queryFn: ({ signal }) => reviewFlowApi.stats(foodId, signal), staleTime: 30000 });
  if (query.isPending) return <Text className="mb-4 text-xs text-muted">Đang tải lượt bán và yêu thích…</Text>;
  if (query.isError) return <AppPressable accessibilityRole="button" onPress={() => { void query.refetch(); }}><Text className="mb-4 text-xs text-muted">Chạm để tải lại lượt bán và yêu thích</Text></AppPressable>;
  return <Text className="mb-4 text-sm text-muted">Đã bán {Number(query.data.sold_count).toLocaleString('vi-VN')} | {Number(query.data.like_count).toLocaleString('vi-VN')} lượt thích</Text>;
}
