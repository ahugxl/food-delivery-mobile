import type { Row } from '../../types/supabase';

export type FoodCollection = Row<'discovery_categories'>;
export function findFoodCollection(id: string | undefined, collections: FoodCollection[]) {
  return collections.find(item => item.id === id);
}

// Match a complete restaurant label, not a substring or a menu ingredient.
export function matchesRestaurantTag(tags: Row<'restaurants'>['promo_tags'], tag: string | null) {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
  return !!tag && Array.isArray(tags) && tags.some(value => typeof value === 'string' && normalize(value) === normalize(tag));
}
