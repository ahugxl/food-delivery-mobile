import { ActivityIndicator, ScrollView, Text, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppPressable } from '../../components/AppPressable';
import { RestaurantRow } from '../../components/RestaurantRow';
import { FlowButton } from '../../components/FlowUI';
import { Skeleton } from '../../components/Skeleton';
import { catalogApi, catalogKeys } from '../../services/catalog';
import { useOrderStore } from '../../store/orderStore';
import { useCartStore } from '../../store/cartStore';
import { FoodCollectionStrip } from '../../components/FoodCollectionStrip';
import { useDiscoveryCategories } from '../../hooks/useDiscoveryCategories';
import { BannerCarousel } from './BannerCarousel';
import { LinearGradient } from 'expo-linear-gradient';
import { RestaurantHighlights } from './RestaurantHighlights';
import { useLocationStore } from '../../store/locationStore';
import { DeliveryAddressReminder } from '../../components/DeliveryAddressReminder';
export default function HomeScreen() {
    const restaurants = useQuery({ queryKey: catalogKeys.restaurants, queryFn: ({ signal }) => catalogApi.restaurants(signal) });
    const banners = useQuery({ queryKey: catalogKeys.banners, queryFn: ({ signal }) => catalogApi.banners(signal) });
    const discovery = useDiscoveryCategories();
    const address = useOrderStore(state => state.deliveryAddress.street);
    const items = useCartStore(state => state.items);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const locationStatus = useLocationStore(state => state.status);
    const locationError = useLocationStore(state => state.error);
    const locatedCoordinates = useLocationStore(state => state.coordinates);
    if (locationStatus === 'locating') return <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 22 }}>
      <Text accessibilityLiveRegion="polite" className="text-base text-muted">Đang tìm vị trí…</Text>
      <View style={{ width: 150, height: 150, borderRadius: 75, backgroundColor: '#E6F2E7', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="location" size={72} color="#008B45"/></View>
      <ActivityIndicator color="#008B45" size="large"/>
      <Text className="text-center font-semibold text-lg text-ink">{locatedCoordinates ? 'Đã tìm thấy vị trí. Đang lấy địa chỉ…' : 'Đang xác định vị trí giao hàng của bạn'}</Text>
      <AppPressable accessibilityRole="button" onPress={() => router.push('/select-location')} className="min-h-12 justify-center"><Text className="font-semibold text-sm text-teal">Chọn địa chỉ đã lưu</Text></AppPressable>
    </View></SafeAreaView>;
    return <SafeAreaView className="flex-1 bg-[#F5F5F5]" edges={['top', 'left', 'right']}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }} refreshControl={<RefreshControl tintColor="#008B45" refreshing={restaurants.isRefetching || banners.isRefetching || discovery.isRefetching} onRefresh={() => { void Promise.allSettled([restaurants.refetch(), banners.refetch(), discovery.refetch()]); }}/>}>
      <LinearGradient colors={['#008B45', '#124C42']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 44, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ position: 'absolute', right: 12, top: -12, opacity: .08, transform: [{ rotate: '-12deg' }] }}><Ionicons name="restaurant" size={145} color="white"/></View>
        <View style={{ position: 'relative', zIndex: 20 }}>
        <AppPressable accessibilityRole="button" accessibilityLabel="Chọn địa chỉ giao hàng" onPress={() => router.push('/select-location')} style={{ gap: 10, marginBottom: 18 }}>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 16, color: 'white' }}>Giao đến:</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="location" size={23} color="white"/><Text numberOfLines={1} style={{ flex: 1, fontFamily: 'Inter_700Bold', fontSize: 17, color: 'white' }}>{address || 'Chọn địa chỉ giao hàng'}</Text><Ionicons name="chevron-forward" size={23} color="white"/></View>
        </AppPressable>
        <DeliveryAddressReminder />
        </View>
        <AppPressable accessibilityRole="button" accessibilityLabel="Tìm quán ăn" onPress={() => router.push('/search')} style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 15, backgroundColor: 'white', paddingHorizontal: 15 }}><Ionicons name="search-outline" size={27} color="#008B45"/><Text style={{ flex: 1, fontFamily: 'Inter_500Medium', fontSize: 16, color: '#008B45' }}>Bạn đang thèm gì nào?</Text></AppPressable>
      </LinearGradient>
      <View style={{ marginTop: -28, marginHorizontal: 8, marginBottom: 12 }}>
        {banners.isPending ? <View className="mt-5"><Skeleton height={145}/></View> : banners.isError ? <Message text="Không tải được ưu đãi." retry={() => { void banners.refetch(); }}/> : !!banners.data?.length && <BannerCarousel banners={banners.data} onPress={() => router.push('/campaign')} />}
      </View>
      <View className="px-4">
        {locationStatus === 'error' && <View className="mb-3 gap-2 rounded-2xl bg-white p-4"><Text className="text-sm text-muted">{locationError}</Text><AppPressable accessibilityRole="button" onPress={() => router.push('/select-location')} className="min-h-11 justify-center"><Text className="font-semibold text-sm text-teal">Chọn địa chỉ hoặc định vị lại</Text></AppPressable></View>}
        <View style={{ backgroundColor: 'white', borderRadius: 18, paddingVertical: 8, marginBottom: 12, overflow: 'hidden' }}><FoodCollectionStrip refreshKey={restaurants.dataUpdatedAt} onSelect={id => router.push({ pathname: '/search', params: { collection: id } })} /></View>
        <RestaurantHighlights restaurants={restaurants.data ?? []} loading={restaurants.isPending} error={restaurants.isError} onRetry={() => { void restaurants.refetch(); }}/>
        <View className="flex-row items-center justify-between"><Text className="font-bold text-xl text-ink">Quán ngon dành cho bạn</Text><AppPressable accessibilityRole="button" accessibilityLabel="Xem tất cả quán" onPress={() => router.push('/search')} className="h-11 w-11 items-center justify-center rounded-full bg-tealLight"><Ionicons name="arrow-forward" size={22} color="#008B45"/></AppPressable></View>
        {restaurants.isPending ? <View className="mt-5 gap-4"><Skeleton height={140}/><Skeleton height={140}/></View> : restaurants.isError ? <Message text="Không tải được danh sách quán." retry={() => { void restaurants.refetch(); }}/> : restaurants.data?.length ? restaurants.data.map(restaurant => <RestaurantRow key={restaurant.id} restaurant={restaurant} onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: restaurant.id } })}/>) : <Message text="Chưa có quán hoạt động."/>}
      </View>
    </ScrollView>{count > 0 && <AppPressable accessibilityRole="button" accessibilityLabel={`Mở giỏ hàng, ${count} món`} onPress={() => router.push('/cart')} className="absolute bottom-5 right-5 flex-row items-center gap-2 rounded-full bg-teal px-5 py-4" style={{ elevation: 5, shadowColor: '#008B45', shadowOpacity: .18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}><Ionicons name="cart-outline" size={22} color="white"/><Text className="font-semibold text-sm text-white">Giỏ hàng{count ? ` · ${count}` : ''}</Text></AppPressable>}
  </SafeAreaView>;
}
function Message({ text, retry }: {
    text: string;
    retry?: () => void;
}) { return <View className="my-4 gap-3 rounded-2xl bg-sage p-4"><Text className="text-sm text-muted">{text}</Text>{retry && <FlowButton title="Thử lại" onPress={retry}/>}</View>; }
