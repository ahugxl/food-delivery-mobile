import { ScrollView, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppPressable } from '../../components/AppPressable';
import { FoodPrice } from '../../components/FoodPrice';
import type { Database } from '../../types/database.types';
import { viLabel } from '../../utils/vietnamese';
import { isDiscountedFood } from './foodPricing';

export function RestaurantOffers({ foods, width }: { foods: Database['public']['Tables']['foods']['Row'][]; width: number }) {
  const offers = foods.filter(isDiscountedFood);
  if (!offers.length) return null;
  return <View style={{ marginBottom: 24 }}>
    <Text className="mx-5 mb-4 font-bold text-xl text-ink">Ưu đãi hôm nay</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 4, gap: 12 }}>
      {offers.map(food => <AppPressable key={food.id} accessibilityRole="button" accessibilityLabel={`Xem món ưu đãi ${viLabel(food.name)}`} onPress={() => router.push({ pathname: '/food/[id]', params: { id: food.id } })}
        style={{ width: Math.min(width - 52, 360), flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10, borderRadius: 18, borderWidth: 1, borderColor: '#E7EBE7', backgroundColor: 'white', shadowColor: '#17241B', shadowOpacity: .08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
        <Image source={food.image_url ? { uri: food.image_url } : undefined} contentFit="cover" style={{ width: 84, height: 84, borderRadius: 14, backgroundColor: '#F3F4F4' }} />
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Text numberOfLines={2} className="font-semibold text-sm text-ink">{viLabel(food.name)}</Text>
          {!!food.description && <Text numberOfLines={2} className="text-xs text-muted">{food.description}</Text>}
          <FoodPrice food={food} />
        </View>
        <View style={{ alignSelf: 'flex-end', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#008B45' }}><Ionicons name="add" size={22} color="white" /></View>
      </AppPressable>)}
    </ScrollView>
  </View>;
}
