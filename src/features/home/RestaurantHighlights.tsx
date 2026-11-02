import { restaurantRatingLabel } from '../../utils/restaurantRating';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppPressable } from '../../components/AppPressable';
import { FlowButton } from '../../components/FlowUI';
import { Skeleton } from '../../components/Skeleton';
import { useFavorites } from '../../hooks/useFavorites';
import { useOrderStore } from '../../store/orderStore';
import { validCoordinates } from '../location/coordinates';
import { haversineDistance } from '../../utils/distance';
import { restaurantInfoLabels } from './adapters';
import type { Row } from '../../types/supabase';
import { RestaurantClosedOverlay } from '../../components/RestaurantClosedOverlay';

export function RestaurantHighlights({ restaurants, loading, error, onRetry }: {
  restaurants: Row<'restaurants'>[]; loading: boolean; error: boolean; onRetry: () => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((Math.min(width, 520) - 64) / 2.2);
  const favorites = useFavorites();
  const address = useOrderStore(state => state.deliveryAddress);
  return <View style={{ borderRadius: 20, backgroundColor: 'white', paddingVertical: 16, marginBottom: 20, overflow: 'hidden' }}>
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 12 }}>
      <Text style={{ flex: 1, fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 27, color: '#008B45' }}>Quán ngon hội tụ, nhất định phải thử</Text>
      <AppPressable accessibilityRole="button" accessibilityLabel="Xem thêm quán ngon" onPress={() => router.push('/search')} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 2 }}><Text style={{ fontSize: 13, color: '#727772' }}>Xem thêm</Text><Ionicons name="chevron-forward" size={17} color="#727772"/></AppPressable>
    </View>
    <Text style={{ paddingHorizontal: 12, marginTop: 8, marginBottom: 16, fontSize: 13, lineHeight: 20, color: '#727772' }}>Khám phá những quán ăn được đánh giá cao!</Text>
    {loading ? <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 12 }}><Skeleton width={cardWidth} height={cardWidth + 70}/><Skeleton width={cardWidth} height={cardWidth + 70}/></View>
      : error ? <View className="gap-3 px-3"><Text className="text-sm text-muted">Chưa tải được các quán gợi ý.</Text><FlowButton title="Thử lại" onPress={onRetry}/></View>
      : !restaurants.length ? <Text className="px-3 text-sm text-muted">Chưa có quán đang hoạt động.</Text>
      : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}>
        {restaurants.slice(0, 8).map(restaurant => {
          const tags = restaurantInfoLabels(restaurant.promo_tags);
          const saved = favorites.favorites.some(item => item.id === restaurant.id);
          const distance = validCoordinates(address) && validCoordinates(restaurant) ? haversineDistance(restaurant, address) : null;
          return <AppPressable key={restaurant.id} accessibilityRole="button" accessibilityLabel={`Xem quán ${restaurant.name}`} onPress={() => router.push({ pathname: '/restaurant/[id]', params: { id: restaurant.id } })} style={{ width: cardWidth, gap: 8 }}>
            <View style={{ width: cardWidth, height: cardWidth, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F3F4F4' }}>
              <Image source={restaurant.image_url ? { uri: restaurant.image_url } : undefined} contentFit="cover" style={{ width: '100%', height: '100%' }}/>
              {saved && <View style={{ position: 'absolute', left: 0, top: 8, backgroundColor: '#008B45', paddingHorizontal: 8, paddingVertical: 4, borderTopRightRadius: 5, borderBottomRightRadius: 5 }}><Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 11, color: 'white' }}>Yêu thích</Text></View>}
              <RestaurantClosedOverlay closed={restaurant.is_open === false}/>
            </View>
            <Text numberOfLines={2} style={{ minHeight: 40, fontFamily: 'Inter_700Bold', fontSize: 14, lineHeight: 20, color: '#17241B' }}>{restaurant.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}><Ionicons name="star" size={14} color="#FFBC23"/><Text style={{ fontSize: 12, color: '#727772' }}>{restaurantRatingLabel(restaurant.rating)}{distance !== null ? ` · ${distance.toFixed(1)} km` : ''}</Text></View>
            {!!tags.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>{tags.map(tag => <View key={tag} style={{ maxWidth: '100%', borderWidth: 1, borderColor: '#CCE6D7', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 4 }}><Text style={{ fontSize: 11, color: '#008B45' }}>{tag}</Text></View>)}</View>}
          </AppPressable>;
        })}
      </ScrollView>}
  </View>;
}
