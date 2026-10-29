import type { Database } from '../../types/database.types';

type FoodPriceData = Pick<Database['public']['Tables']['foods']['Row'], 'price' | 'original_price'>;

export function foodDiscountPercent(food: FoodPriceData) {
  return isDiscountedFood(food) && food.original_price !== null
    ? Math.round((food.original_price - food.price) / food.original_price * 100)
    : null;
}

export function isDiscountedFood(food: FoodPriceData) {
  return Number.isFinite(food.price) && food.price >= 0
    && food.original_price !== null && Number.isFinite(food.original_price)
    && food.original_price > food.price;
}
