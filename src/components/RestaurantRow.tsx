import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { AppPressable } from './AppPressable';
import { useFavorites } from '../hooks/useFavorites';
import { toRestaurantCard } from '../features/home/adapters';
import { viLabel, viHours } from '../utils/vietnamese';
import type { Row } from '../types/supabase';
export function RestaurantRow({ restaurant, onPress }: {
    restaurant: Row<'restaurants'>;
    onPress: () => void;
}) {
    const favorites = useFavorites();
    const saved = favorites.favorites.some(item => item.id === restaurant.id);
    const tags = toRestaurantCard(restaurant).tags;
    return <View className="mb-1 border-b border-line py-5"><View className="flex-row gap-3">
    <AppPressable accessibilityRole="button" accessibilityLabel={`Xem quán ${restaurant.name}`} onPress={onPress} className="flex-1 flex-row gap-3">
      <Image source={restaurant.image_url ? { uri: restaurant.image_url } : undefined} contentFit="cover" style={{ width: 108, height: 112, borderRadius: 18, backgroundColor: '#F3F4F4' }}/>
      <View className="flex-1 gap-2 py-1"><Text numberOfLines={2} className="font-bold text-base text-ink">{restaurant.name}</Text>
        <View className="flex-row items-center gap-1"><Ionicons name="star" size={16} color="#FFBC23"/><Text className="font-medium text-sm text-ink">{Number(restaurant.rating ?? 0).toFixed(1)}</Text><Text className="text-xs text-muted"> · {restaurant.is_open ? 'Đang mở cửa' : 'Đã đóng cửa'}</Text></View>
        <Text numberOfLines={1} className="text-xs text-muted">{viHours(restaurant.opening_hours)}</Text><Text className="font-semibold text-xs text-teal">Xem thực đơn →</Text>
      </View>
    </AppPressable>
    <AppPressable accessibilityRole="button" accessibilityLabel={`${saved ? 'Bỏ yêu thích' : 'Yêu thích'} ${restaurant.name}`} disabled={favorites.isPending || favorites.isUpdating(restaurant.id)} onPress={() => { void favorites.toggle(toRestaurantCard(restaurant)); }} className="h-11 w-11 items-center justify-center rounded-full bg-sage"><Ionicons name={saved ? 'heart' : 'heart-outline'} size={22} color="#008B45"/></AppPressable>
    </View>{!!tags.length && <View className="mt-3 flex-row flex-wrap gap-2">{tags.map(tag => <View key={tag} className="flex-row items-center gap-1 rounded-lg bg-tealLight px-3 py-2"><Ionicons name="pricetag-outline" size={13} color="#008B45"/><Text className="font-medium text-xs text-teal">{viLabel(tag)}</Text></View>)}</View>}
  </View>;
}
