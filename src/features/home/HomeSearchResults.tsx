import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { catalogApi, catalogKeys } from '../../services/catalog';
import type { Row } from '../../types/supabase';
import { RestaurantRow } from '../../components/RestaurantRow';
import { FlowButton } from '../../components/FlowUI';
import { Skeleton } from '../../components/Skeleton';
import { matchingMenuFoods, searchRestaurants } from '../search/restaurantSearch';
import { defaultFilters } from '../search/catalog';
import { SearchFoodStrip } from '../search/SearchFoodStrip';
import { nearestRestaurants } from './nearbyRestaurants';
import { useOrderStore } from '../../store/orderStore';
import { validCoordinates } from '../location/coordinates';
import { useSearchUsage } from '../../hooks/useUsageAnalytics';

export function HomeSearchResults({ keyword, restaurants, loading, error, retry }: {
  keyword: string; restaurants: Row<'restaurants'>[]; loading: boolean; error: boolean; retry: () => void;
}) {
  const address = useOrderStore(state => state.deliveryAddress);
  const hasKeyword = !!keyword.trim();
  const foods = useQuery({ queryKey: catalogKeys.foods(), queryFn: ({ signal }) => catalogApi.foods({}, signal), enabled: hasKeyword });
  const results = useMemo(() => nearestRestaurants(searchRestaurants(restaurants, foods.data ?? [], keyword,
    defaultFilters, [], validCoordinates(address) ? address : null), address), [restaurants, foods.data, keyword, address]);
  const menus = useMemo(() => {
    const grouped = new Map<string, NonNullable<typeof foods.data>>();
    for (const food of matchingMenuFoods(foods.data ?? [], keyword)) {
      const menu = grouped.get(food.restaurant_id) ?? [];
      menu.push(food); grouped.set(food.restaurant_id, menu);
    }
    return grouped;
  }, [foods.data, keyword]);
  useSearchUsage(keyword, results.length, !loading && !error && foods.isSuccess, 'home');
  return <View className="px-4 pt-4">
    {!hasKeyword ? <Text className="py-6 text-center text-sm text-muted">Nhập tên quán hoặc món bạn muốn tìm.</Text>
      : loading || foods.isPending ? <View className="gap-4"><Skeleton height={140}/><Skeleton height={140}/></View>
      : error || foods.isError ? <View className="gap-3 py-5"><Text className="text-muted">Không tải được kết quả tìm kiếm.</Text><FlowButton title="Thử lại" onPress={() => { retry(); void foods.refetch(); }}/></View>
      : <>
        <Text accessibilityLiveRegion="polite" className="text-sm text-muted">{results.length} quán phù hợp</Text>
        {results.map(restaurant => <RestaurantRow key={restaurant.id} restaurant={restaurant}
          onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: restaurant.id } })}>
          <SearchFoodStrip foods={menus.get(restaurant.id) ?? []}/>
        </RestaurantRow>)}
        {!results.length && <Text className="py-8 text-center text-muted">Chưa tìm thấy quán hoặc món phù hợp. Thử từ khóa khác nhé.</Text>}
      </>}
  </View>;
}
