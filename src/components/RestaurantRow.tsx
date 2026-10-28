import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppPressable } from './AppPressable';
import { useFavorites } from '../hooks/useFavorites';
import { toRestaurantCard } from '../features/home/adapters';
import type { Row } from '../types/supabase';
import { useOrderStore } from '../store/orderStore';
import { validCoordinates } from '../features/location/coordinates';
import { haversineDistance } from '../utils/distance';
import { RestaurantClosedOverlay } from './RestaurantClosedOverlay';
export function RestaurantRow({ restaurant, onPress }: {
    restaurant: Row<'restaurants'>;
    onPress: () => void;
}) {
    const favorites = useFavorites();
    const address = useOrderStore(state => state.deliveryAddress);
    const distance = validCoordinates(address) && validCoordinates(restaurant)
        ? haversineDistance(restaurant, address) : null;
    const saved = favorites.favorites.some(item => item.id === restaurant.id);
    const tags = toRestaurantCard(restaurant).tags;
    return <View className="mb-1 border-b border-line py-5"><View className="flex-row gap-3">
    <AppPressable accessibilityRole="button" accessibilityLabel={`Xem quán ${restaurant.name}`} onPress={onPress} className="flex-1 flex-row gap-3">
      <View style={{ width: 108, height: 112, borderRadius: 18, overflow: 'hidden', flexShrink: 0, backgroundColor: '#F3F4F4' }}>
        <Image source={restaurant.image_url ? { uri: restaurant.image_url } : undefined} contentFit="cover" style={{ width: '100%', height: '100%' }}/>
        <RestaurantClosedOverlay closed={restaurant.is_open === false}/>
      </View>
      <View className="flex-1 gap-2 py-1"><Text numberOfLines={2} className="font-bold text-base text-ink">{restaurant.name}</Text>
        <View className="flex-row flex-wrap items-center gap-1"><Ionicons name="star" size={16} color="#FFBC23"/><Text className="font-medium text-sm text-ink">{Number(restaurant.rating ?? 0).toFixed(1)}</Text><Text className="text-xs text-muted"> · </Text><Text accessibilityLabel={distance === null ? 'Chưa có tọa độ để tính khoảng cách' : `Khoảng cách đường chim bay đến địa chỉ giao hàng: ${distance.toFixed(1)} km`} className="text-sm text-muted">{distance === null ? 'Chưa rõ khoảng cách' : `${distance.toFixed(1)} km`}</Text></View>
        {!!tags.length && <View className="flex-row flex-wrap gap-2">{tags.map(tag => <View key={tag} className="max-w-full flex-row items-center gap-1 rounded-lg bg-tealLight px-2 py-1.5"><Ionicons name="ribbon-outline" size={13} color="#008B45"/><Text className="shrink font-medium text-xs text-teal">{tag}</Text></View>)}</View>}
      </View>
    </AppPressable>
    <AppPressable accessibilityRole="button" accessibilityLabel={`${saved ? 'Bỏ yêu thích' : 'Yêu thích'} ${restaurant.name}`} disabled={favorites.isPending || favorites.isUpdating(restaurant.id)} onPress={() => { void favorites.toggle(toRestaurantCard(restaurant)); }} className="h-11 w-11 items-center justify-center rounded-full bg-sage"><Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color="#008B45"/></AppPressable>
    </View>
  </View>;
}
