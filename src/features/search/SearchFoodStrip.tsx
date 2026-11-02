import { ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { AppPressable } from '../../components/AppPressable';
import { FoodPrice } from '../../components/FoodPrice';
import type { Row } from '../../types/supabase';
import { viLabel } from '../../utils/vietnamese';

type SearchFood = Pick<Row<'foods'>, 'id' | 'name' | 'price' | 'original_price' | 'image_url'>;

export function SearchFoodStrip({ foods }: { foods: SearchFood[] }) {
  if (!foods.length) return null;
  return <View style={{ marginTop: 14 }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
      {foods.map(food => <AppPressable key={food.id} accessibilityRole="button"
        accessibilityLabel={`Xem món ${viLabel(food.name)}`}
        onPress={() => router.push({ pathname: '/food/[id]', params: { id: food.id } })}
        style={{ width: 120, gap: 7 }}>
        <Image source={food.image_url ? { uri: food.image_url } : undefined} contentFit="cover"
          style={{ width: 120, height: 112, borderRadius: 14, backgroundColor: '#F3F4F4' }}/>
        <Text numberOfLines={2} className="text-sm font-medium text-ink">{viLabel(food.name)}</Text>
        <FoodPrice food={food}/>
      </AppPressable>)}
    </ScrollView>
  </View>;
}
