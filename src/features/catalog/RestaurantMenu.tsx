import { restaurantRatingLabel } from '../../utils/restaurantRating';
import { useState } from 'react';
import { SectionList, View, Text, TextInput, Share, useWindowDimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { AppPressable } from '../../components/AppPressable';
import { FlowButton, FlowHeader } from '../../components/FlowUI';
import { Skeleton } from '../../components/Skeleton';
import { catalogApi, catalogKeys } from '../../services/catalog';
import { toRestaurantCard } from '../home/adapters';
import { useFavorites } from '../../hooks/useFavorites';
import { useCartStore } from '../../store/cartStore';
import { FoodPrice } from '../../components/FoodPrice';
import { RestaurantOffers } from './RestaurantOffers';
import { menuSections } from './menuSections';
import { normalizeSearch } from '../search/restaurantSearch';
import { viLabel, viHours } from '../../utils/vietnamese';
import { DeliveryRangeNotice } from '../../components/DeliveryRangeNotice';
import { useRestaurantReviewSummary } from '../../hooks/useRestaurantReviewSummary';
export default function RestaurantMenu({ restaurantId }: {
    restaurantId: string;
}) {
    const restaurants = useQuery({ queryKey: catalogKeys.restaurants, queryFn: ({ signal }) => catalogApi.restaurants(signal) });
    const foods = useQuery({ queryKey: catalogKeys.foods(undefined, restaurantId), queryFn: ({ signal }) => catalogApi.foods({ restaurantId }, signal) });
    const categories = useQuery({ queryKey: catalogKeys.categories, queryFn: ({ signal }) => catalogApi.categories(signal) });
    const favorites = useFavorites();
    const items = useCartStore(state => state.items);
    const [keyword, setKeyword] = useState('');
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const { width: windowWidth } = useWindowDimensions();
    const width = Platform.OS === 'web' ? Math.min(windowWidth, 520) : windowWidth;
    const restaurant = restaurants.data?.find(item => item.id === restaurantId);
    const reviewSummary = useRestaurantReviewSummary(restaurantId, !!restaurant);
    const saved = favorites.favorites.some(item => item.id === restaurantId);
    const results = (foods.data ?? []).filter(food => (!categoryId || food.category_id === categoryId) && normalizeSearch(`${food.name} ${viLabel(food.name)}`).includes(normalizeSearch(keyword)));
    const menuCategories = categories.data?.filter(category => foods.data?.some(food => food.category_id === category.id)) ?? [];
    const sections = menuSections(results, categories.data ?? []);
    const refresh = () => { void restaurants.refetch(); void foods.refetch(); void categories.refetch(); void reviewSummary.refetch(); };
    if (restaurants.isPending || foods.isPending)
        return <SafeAreaView className="flex-1 bg-white"><FlowHeader title="Thực đơn của quán"/><View className="gap-5 p-5"><Skeleton height={220}/><Skeleton height={120}/><Skeleton height={180}/></View></SafeAreaView>;
    if (restaurants.isError || foods.isError || !restaurant)
        return <SafeAreaView className="flex-1 bg-white"><FlowHeader title="Thực đơn của quán"/><View className="gap-5 p-5"><Text className="text-muted">{!restaurant && !restaurants.isError ? 'Quán không còn hoạt động hoặc không tồn tại.' : 'Không tải được thực đơn.'}</Text><FlowButton title="Thử lại" onPress={refresh}/></View></SafeAreaView>;
    const tags = toRestaurantCard(restaurant).tags;
    const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
    return <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
    <DeliveryRangeNotice restaurant={restaurant}/>
    <SectionList sections={sections} stickySectionHeadersEnabled={false} keyExtractor={row => row.map(food => food.id).join(':')} refreshing={restaurants.isRefetching || foods.isRefetching} onRefresh={refresh} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false} ListHeaderComponent={<View><View style={{ height: 210, backgroundColor: '#EEF4EB' }}><Image source={restaurant.image_url ? { uri: restaurant.image_url } : undefined} contentFit="cover" style={{ width: '100%', height: '100%' }}/><View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,.2)' }}/><View className="absolute left-5 right-5 top-4 flex-row justify-between"><AppPressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} className="h-11 w-11 items-center justify-center rounded-full bg-black/50"><Ionicons name="arrow-back" size={25} color="white"/></AppPressable><AppPressable accessibilityRole="button" accessibilityLabel={saved ? 'Bỏ yêu thích quán' : 'Yêu thích quán'} disabled={favorites.isPending || favorites.isUpdating(restaurantId)} onPress={() => { void favorites.toggle(toRestaurantCard(restaurant)); }} className="h-11 w-11 items-center justify-center rounded-full bg-black/50"><Ionicons name={saved ? 'heart' : 'heart-outline'} size={25} color="white"/></AppPressable></View></View>
        <AppPressable accessibilityRole="button" accessibilityLabel="Xem đánh giá của quán" onPress={() => router.push({ pathname: "/restaurant-reviews", params: { restaurantId } })} className="mx-5 gap-3 rounded-3xl border border-line bg-white p-5" style={{ marginTop: -40, shadowColor: '#17241B', shadowOpacity: .07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}><View className="flex-row items-center gap-3"><Image source={restaurant.image_url ? { uri: restaurant.image_url } : undefined} style={{ width: 78, height: 78, borderRadius: 18 }}/><View className="flex-1 gap-2"><Text className="font-bold text-xl text-ink">{restaurant.name}</Text><View className="flex-row items-center gap-1"><Ionicons name="star" color="#FFBC23" size={18}/><Text className="text-sm text-ink">{restaurantRatingLabel(restaurant.rating)}{reviewSummary.data && restaurant.rating != null ? ` (${Number(reviewSummary.data.review_count)} đánh giá)` : ''} · {restaurant.is_open ? 'Đang mở cửa' : 'Đã đóng cửa'}</Text></View></View></View><Text className="text-sm text-muted">Giờ mở cửa: {viHours(restaurant.opening_hours)}</Text></AppPressable>
        <View className="mx-5 my-5 flex-row gap-3"><View className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-tealLight p-3"><Ionicons name="bicycle-outline" size={20} color="#008B45"/><Text className="font-semibold text-sm text-teal">Giao hàng tận nơi</Text></View><AppPressable accessibilityRole="button" onPress={() => { void Share.share({ message: `Khám phá quán ${restaurant.name} trên ứng dụng soopiFood.` }).catch(() => { }); }} className="flex-row items-center gap-2 rounded-full border border-line px-4"><Ionicons name="share-social-outline" size={19} color="#17241B"/><Text className="text-sm text-ink">Chia sẻ</Text></AppPressable></View>
        {!!tags.length && <View className="mx-5 mb-5 flex-row flex-wrap gap-2">{tags.map(tag => <View key={tag} className="flex-row items-center gap-2 rounded-2xl border border-line px-4 py-3"><Ionicons name="pricetag-outline" size={18} color="#008B45"/><Text className="font-medium text-sm text-ink">{tag}</Text></View>)}</View>}
        {!restaurant.is_open && <Text className="mx-5 mb-4 text-sm text-coral">Quán đang đóng cửa. Bạn có thể xem thực đơn và quay lại đặt sau.</Text>}
        <View className="mx-5 mb-4 flex-row items-center gap-2 rounded-2xl bg-[#F5F6F5] px-4"><Ionicons name="search-outline" size={22} color="#727772"/><TextInput accessibilityLabel="Tìm món trong quán" placeholder="Tìm món trong quán này" value={keyword} onChangeText={setKeyword} className="min-h-12 flex-1 py-3 text-sm text-ink"/></View>
        <View className="mx-5 mb-5 flex-row flex-wrap gap-2">{[{ id: null, name: 'Tất cả' }, ...menuCategories].map(category => <AppPressable key={category.id ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: categoryId === category.id }} onPress={() => setCategoryId(category.id)} className={`min-h-11 justify-center rounded-full px-4 ${categoryId === category.id ? 'bg-teal' : 'bg-sage'}`}><Text className={`font-medium text-sm ${categoryId === category.id ? 'text-white' : 'text-ink'}`}>{viLabel(category.name)}</Text></AppPressable>)}</View>
        <RestaurantOffers foods={results} width={width} />
        <Text className="mx-5 mb-5 font-bold text-xl text-ink">Dành cho bạn <Text className="text-base text-muted">({results.length})</Text></Text>
      </View>} renderSectionHeader={({ section }) => <Text accessibilityRole="header" className="mx-5 mb-4 mt-2 font-bold text-lg text-ink">{viLabel(section.title)} <Text className="text-sm text-muted">({section.count})</Text></Text>} renderItem={({ item: row }) => <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 16 }}>{row.map(item => <AppPressable key={item.id} accessibilityRole="button" accessibilityLabel={`Xem món ${viLabel(item.name)}`} onPress={() => router.push({ pathname: '/food/[id]', params: { id: item.id } })} style={{ width: (width - 56) / 2, marginBottom: 24 }}><View><Image source={item.image_url ? { uri: item.image_url } : undefined} contentFit="cover" style={{ width: '100%', aspectRatio: 1, borderRadius: 20, backgroundColor: '#F3F4F4' }}/><View className="absolute bottom-2 right-2 h-11 w-11 items-center justify-center rounded-full bg-teal"><Ionicons name="add" size={27} color="white"/></View></View><Text numberOfLines={2} className="mb-2 mt-3 font-medium text-sm text-ink">{viLabel(item.name)}</Text><FoodPrice food={item} /></AppPressable>)}</View>} ListEmptyComponent={<Text className="p-8 text-center text-sm text-muted">{keyword || categoryId ? 'Không tìm thấy món phù hợp.' : 'Quán chưa có món đang bán.'}</Text>}/>
    <AppPressable accessibilityRole="button" onPress={() => router.push('/cart')} className="absolute bottom-5 left-5 right-5 flex-row items-center justify-center gap-3 rounded-full bg-teal p-4"><Ionicons name="cart-outline" size={23} color="white"/><Text className="font-bold text-base text-white">Xem giỏ hàng{cartCount ? ` · ${cartCount} món` : ''}</Text></AppPressable>
  </SafeAreaView>;
}
