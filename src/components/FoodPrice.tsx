import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Database } from '../types/database.types';
import { isDiscountedFood } from '../features/catalog/foodPricing';
import { currency } from '../features/order/checkout';

export function FoodPrice({ food, detail = false }: { food: Pick<Database['public']['Tables']['foods']['Row'], 'price' | 'original_price'>; detail?: boolean }) {
  const discounted = isDiscountedFood(food);
  if (detail) return <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 7 }}>
    {discounted && food.original_price !== null && <Text accessibilityLabel={`Giá gốc ${currency(food.original_price)}`} style={{ textDecorationLine: 'line-through', fontSize: 14, color: '#9A9E9A' }}>{currency(food.original_price)}</Text>}
    <Text accessibilityLabel={`Giá bán ${currency(food.price)}`} style={{ fontFamily: 'Inter_700Bold', fontSize: 24, color: '#F47721' }}>{currency(food.price)}</Text>
  </View>;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
    <Text accessibilityLabel={`Giá bán ${currency(food.price)}`} className="font-bold text-base text-ink">{currency(food.price)}</Text>
    {discounted && food.original_price !== null && <>
      <Text accessibilityLabel={`Giá gốc ${currency(food.original_price)}`} style={{ textDecorationLine: 'line-through', fontSize: 12, color: '#727772' }}>{currency(food.original_price)}</Text>
      <Ionicons name="pricetag-outline" size={13} color="#F16B45" />
    </>}
  </View>;
}
