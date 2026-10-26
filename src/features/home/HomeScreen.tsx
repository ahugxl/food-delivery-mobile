import { ScrollView, Text, View, RefreshControl, useWindowDimensions, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { AppPressable } from '../../components/AppPressable';
import { RestaurantRow } from '../../components/RestaurantRow';
import { FlowButton } from '../../components/FlowUI';
import { Skeleton } from '../../components/Skeleton';
import { catalogApi, catalogKeys } from '../../services/catalog';
import { useOrderStore } from '../../store/orderStore';
import { useCartStore } from '../../store/cartStore';
import { viLabel } from '../../utils/vietnamese';
export default function HomeScreen() {
    const restaurants = useQuery({ queryKey: catalogKeys.restaurants, queryFn: ({ signal }) => catalogApi.restaurants(signal) });
    const categories = useQuery({ queryKey: catalogKeys.categories, queryFn: ({ signal }) => catalogApi.categories(signal) });
    const banners = useQuery({ queryKey: catalogKeys.banners, queryFn: ({ signal }) => catalogApi.banners(signal) });
    const address = useOrderStore(state => state.deliveryAddress.street);
    const items = useCartStore(state => state.items);
    const { width } = useWindowDimensions();
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    return <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}><StatusBar style="dark"/>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }} refreshControl={<RefreshControl tintColor="#008B45" refreshing={restaurants.isRefetching || categories.isRefetching || banners.isRefetching} onRefresh={() => { void Promise.allSettled([restaurants.refetch(), categories.refetch(), banners.refetch()]); }}/>}>
      <View style={{ backgroundColor: '#EFF5A5', padding: 20, paddingBottom: 28, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 }}>
        <View className="mb-6 flex-row items-center gap-3"><AppPressable accessibilityRole="button" accessibilityLabel="Chọn địa chỉ giao hàng" onPress={() => router.push('/select-location')} className="flex-1 gap-1"><Text className="font-medium text-xs text-ink">GIAO NGAY</Text><View className="flex-row items-center gap-1"><Text numberOfLines={1} className="max-w-[230px] font-bold text-lg text-ink">{address || 'Chọn địa chỉ giao hàng'}</Text><Ionicons name="chevron-down" size={18} color="#17241B"/></View></AppPressable>
          <AppPressable accessibilityRole="button" accessibilityLabel="Quán yêu thích" onPress={() => router.push('/favorites')} className="h-11 w-11 items-center justify-center rounded-full bg-white/60"><Ionicons name="heart-outline" size={25} color="#17241B"/></AppPressable><AppPressable accessibilityRole="button" accessibilityLabel="Lịch sử đơn hàng" onPress={() => router.push('/orders')} className="h-11 w-11 items-center justify-center rounded-full bg-white/60"><Ionicons name="receipt-outline" size={24} color="#17241B"/></AppPressable>
        </View>
        <AppPressable accessibilityRole="button" accessibilityLabel="Tìm quán ăn" onPress={() => router.push('/search')} className="min-h-14 flex-row items-center gap-3 rounded-2xl bg-white px-4"><Ionicons name="search-outline" size={25} color="#17241B"/><Text className="text-base text-muted">Bạn đang thèm gì nào?</Text></AppPressable>
        <View className="mt-6 flex-row items-center justify-between"><View className="flex-1 gap-2"><Text className="font-bold text-3xl text-ink">Món ngon quanh bạn</Text><Text className="text-sm text-ink">Chọn quán yêu thích, khám phá thực đơn</Text></View><View className="ml-3 h-20 w-20 items-center justify-center rounded-full bg-white/60"><Ionicons name="restaurant" size={42} color="#008B45"/></View></View>
      </View>
      <View className="px-5 pt-6"><View className="mb-6 flex-row items-center justify-center gap-2 rounded-full bg-forest py-3"><Ionicons name="bicycle-outline" size={21} color="white"/><Text className="font-semibold text-base text-white">Giao món ngon tận nơi</Text></View>
        {categories.isPending ? <Skeleton height={90}/> : categories.isError ? <Message text="Không tải được danh mục." retry={() => { void categories.refetch(); }}/> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingBottom: 24 }}>{categories.data?.map(category => <AppPressable key={category.id} accessibilityRole="button" accessibilityLabel={`Khám phá ${viLabel(category.name)}`} onPress={() => router.push({ pathname: '/category/[id]', params: { id: category.id } })} className="w-16 items-center gap-2"><View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-sage">{category.icon_url ? <Image source={{ uri: category.icon_url }} contentFit="cover" style={{ width: 64, height: 64 }}/> : <Ionicons name="restaurant-outline" size={28} color="#008B45"/>}</View><Text className="text-center font-medium text-xs text-ink">{viLabel(category.name)}</Text></AppPressable>)}</ScrollView>}
        <View className="mb-7 flex-row gap-3">{([{ title: 'Khám phá quán', copy: 'Tìm món bạn thích', icon: 'restaurant-outline', route: '/search' }, { title: 'Đặt lại món quen', copy: 'Xem lịch sử đơn', icon: 'receipt-outline', route: '/orders' }] as const).map(tile => <AppPressable key={tile.title} accessibilityRole="button" onPress={() => router.push(tile.route)} className="flex-1 items-center gap-2 rounded-3xl bg-[#F5F6F5] px-3 py-5"><Ionicons name={tile.icon} size={32} color="#008B45"/><Text className="font-bold text-sm text-ink">{tile.title}</Text><Text className="text-xs text-muted">{tile.copy}</Text></AppPressable>)}</View>
        <Text className="mb-4 font-bold text-xl text-ink">Có gì hôm nay?</Text>
        {banners.isPending ? <Skeleton height={145}/> : banners.isError ? <Message text="Không tải được ưu đãi." retry={() => { void banners.refetch(); }}/> : banners.data?.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 26 }}>{banners.data.map((banner, index) => <AppPressable key={banner.id} accessibilityLabel={`Ưu đãi ${index + 1}`} accessibilityRole={banner.link_url && /^https?:\/\//i.test(banner.link_url) ? 'link' : undefined} onPress={banner.link_url && /^https?:\/\//i.test(banner.link_url) ? () => { void Linking.openURL(banner.link_url!).catch(() => { }); } : undefined}><Image source={{ uri: banner.image_url }} contentFit="cover" style={{ width: Math.min(370, width - 56), height: 155, borderRadius: 20 }}/></AppPressable>)}</ScrollView> : <Text className="mb-6 text-sm text-muted">Chưa có chương trình ưu đãi.</Text>}
        <View className="flex-row items-center justify-between"><Text className="font-bold text-xl text-ink">Quán ngon dành cho bạn</Text><AppPressable accessibilityRole="button" accessibilityLabel="Xem tất cả quán" onPress={() => router.push('/search')} className="h-11 w-11 items-center justify-center rounded-full bg-tealLight"><Ionicons name="arrow-forward" size={22} color="#008B45"/></AppPressable></View>
        {restaurants.isPending ? <View className="mt-5 gap-4"><Skeleton height={140}/><Skeleton height={140}/></View> : restaurants.isError ? <Message text="Không tải được danh sách quán." retry={() => { void restaurants.refetch(); }}/> : restaurants.data?.length ? restaurants.data.map(restaurant => <RestaurantRow key={restaurant.id} restaurant={restaurant} onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: restaurant.id } })}/>) : <Message text="Chưa có quán hoạt động."/>}
      </View>
    </ScrollView><AppPressable accessibilityRole="button" accessibilityLabel={`Mở giỏ hàng, ${count} món`} onPress={() => router.push('/cart')} className="absolute bottom-5 right-5 flex-row items-center gap-2 rounded-full bg-teal px-5 py-4" style={{ elevation: 5, shadowColor: '#008B45', shadowOpacity: .18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}><Ionicons name="cart-outline" size={22} color="white"/><Text className="font-semibold text-sm text-white">Giỏ hàng{count ? ` · ${count}` : ''}</Text></AppPressable>
  </SafeAreaView>;
}
function Message({ text, retry }: {
    text: string;
    retry?: () => void;
}) { return <View className="my-4 gap-3 rounded-2xl bg-sage p-4"><Text className="text-sm text-muted">{text}</Text>{retry && <FlowButton title="Thử lại" onPress={retry}/>}</View>; }
