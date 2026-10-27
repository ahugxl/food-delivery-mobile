import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { AppPressable } from '../../components/AppPressable';
import { FlowButton, FlowHeader } from '../../components/FlowUI';
import { RestaurantRow } from '../../components/RestaurantRow';
import { Skeleton } from '../../components/Skeleton';
import { catalogApi, catalogKeys } from '../../services/catalog';
import { useFavorites } from '../../hooks/useFavorites';
import { defaultFilters } from './catalog';
import type { Coordinates } from './liveCatalog';
import { searchRestaurants } from './restaurantSearch';
import { viLabel } from '../../utils/vietnamese';
import { findFoodCollection } from './foodCollections';
import { FoodCollectionStrip } from '../../components/FoodCollectionStrip';
import { useDiscoveryCategories } from '../../hooks/useDiscoveryCategories';
export default function SearchScreen({ categoryId }: {
    categoryId?: string;
}) {
    const [keyword, setKeyword] = useState('');
    const params = useLocalSearchParams<{ collection?: string | string[] }>();
    const collectionId = typeof params.collection === 'string' && !categoryId ? params.collection : undefined;
    const discovery = useDiscoveryCategories();
    const collection = findFoodCollection(collectionId, discovery.data ?? []);
    const [filters, setFilters] = useState(defaultFilters);
    const [location, setLocation] = useState<Coordinates | null>(null);
    const [locating, setLocating] = useState(false);
    const restaurants = useQuery({ queryKey: catalogKeys.restaurants, queryFn: ({ signal }) => catalogApi.restaurants(signal) });
    const foods = useQuery({
        queryKey: collection?.kind === 'food' ? catalogKeys.discoveryFoods(collection.id) : catalogKeys.foods(categoryId),
        queryFn: ({ signal }) => collection?.kind === 'food' ? catalogApi.discoveryFoods(collection.id, signal) : catalogApi.foods({ categoryId }, signal),
        enabled: !collectionId || !!collection,
    });
    const categories = useQuery({ queryKey: catalogKeys.categories, queryFn: ({ signal }) => catalogApi.categories(signal) });
    const favorites = useFavorites();
    const results = useMemo(() => searchRestaurants(restaurants.data ?? [], foods.data ?? [], keyword, filters, favorites.favorites.map(r => r.id), location, categoryId, collectionId, collection), [restaurants.data, foods.data, keyword, filters, favorites.favorites, location, categoryId, collectionId, collection]);
    useEffect(() => { setKeyword(''); }, [collectionId]);
    const chooseCollection = (id: string) => { setKeyword(''); router.setParams({ collection: id === collectionId ? '' : id }); };
    const locate = async () => {
        if (location)
            return true;
        setLocating(true);
        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== 'granted')
                throw new Error('Cần quyền vị trí để tìm quán gần bạn.');
            setLocation((await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })).coords);
            return true;
        }
        catch {
            Toast.show({ type: 'error', text1: 'Không lấy được vị trí', text2: 'Kiểm tra quyền vị trí rồi thử lại.' });
            return false;
        }
        finally {
            setLocating(false);
        }
    };
    const category = categories.data?.find(item => item.id === categoryId);
    const loading = restaurants.isPending || (!!collectionId && discovery.isPending) || ((!collectionId || !!collection) && foods.isPending);
    const failed = restaurants.isError || foods.isError || (!!collectionId && discovery.isError);
    const refresh = () => { void restaurants.refetch(); void foods.refetch(); void discovery.refetch(); };
    const collectionTitle = collection?.kind === 'restaurant_tag' ? collection.name : collection ? `Quán bán ${collection.name.toLowerCase()}` : 'Khám phá quán ngon';
    return <SafeAreaView className="flex-1 bg-white"><FlowHeader title={category ? viLabel(category.name) : collectionTitle}/>
    {!categoryId && <View style={{ flexShrink: 0 }}><FoodCollectionStrip selectedId={collectionId} refreshKey={foods.dataUpdatedAt} onSelect={chooseCollection} /></View>}
    <View className="mx-5 mb-4 flex-row items-center gap-3 rounded-2xl bg-[#F5F6F5] px-4"><Ionicons name="search-outline" size={24} color="#17241B"/><TextInput accessibilityLabel="Tìm quán hoặc món ăn" placeholder={collection ? `Tìm quán hoặc món trong ${collection.name.toLowerCase()}…` : 'Bạn đang thèm gì nào?'} value={keyword} onChangeText={setKeyword} returnKeyType="search" className="min-h-14 flex-1 py-3 text-base text-ink"/>{!!keyword && <AppPressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={() => setKeyword('')} className="h-11 w-9 items-center justify-center"><Ionicons name="close-circle" size={22} color="#727772"/></AppPressable>}</View>
    <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 14, gap: 10 }}>
      <AppPressable accessibilityRole="button" disabled={locating} onPress={async () => { if (filters.sort === 'rating' && !(await locate()))
        return; setFilters(f => ({ ...f, sort: f.sort === 'recommended' ? 'rating' : f.sort === 'rating' ? 'distance' : 'recommended' })); }} className="min-h-11 flex-row items-center gap-2 rounded-full border border-line px-4"><Ionicons name="swap-vertical" size={18} color="#17241B"/><Text className="text-sm text-ink">{filters.sort === 'rating' ? 'Đánh giá cao' : filters.sort === 'distance' ? 'Khoảng cách' : 'Sắp xếp'}</Text><Ionicons name="chevron-down" size={14} color="#17241B"/></AppPressable>
      {([{ key: 'favorite', label: 'Yêu thích' }, { key: 'nearby', label: 'Gần tôi' }] as const).map(item => <AppPressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: filters[item.key] }} disabled={locating} onPress={async () => { if (item.key === 'nearby' && !filters.nearby && !(await locate()))
        return; setFilters(f => ({ ...f, [item.key]: !f[item.key] })); }} className={`min-h-11 justify-center rounded-full border px-4 ${filters[item.key] ? 'border-teal bg-tealLight' : 'border-line'}`}><Text className="text-sm text-ink">{item.label}</Text></AppPressable>)}
    </ScrollView></View>
    <Text accessibilityLiveRegion="polite" className="px-5 pb-2 text-sm text-muted">{locating ? 'Đang xác định vị trí…' : `${results.length} quán${filters.nearby ? ' trong phạm vi 2 km' : ''} · Chọn quán để xem thực đơn`}</Text>
    {loading ? <View className="gap-4 p-5"><Skeleton height={145}/><Skeleton height={145}/></View> : failed ? <View className="gap-4 p-5"><Text className="text-muted">Không tải được danh sách quán hoặc thực đơn.</Text><FlowButton title="Thử lại" onPress={refresh}/></View> : <FlashList data={results} keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }} refreshing={restaurants.isRefetching || foods.isRefetching} onRefresh={refresh} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <RestaurantRow restaurant={item} onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: item.id } })}/>} ListEmptyComponent={<View className="gap-4 py-12"><Text className="text-center font-bold text-xl text-ink">Chưa tìm thấy quán phù hợp</Text><Text className="text-center text-sm text-muted">Thử từ khóa khác hoặc bỏ bớt bộ lọc.</Text><FlowButton title="Xóa tìm kiếm và bộ lọc" onPress={() => { setKeyword(''); setFilters(defaultFilters); if (!categoryId) router.setParams({ collection: '' }); }}/></View>}/>}
  </SafeAreaView>;
}
