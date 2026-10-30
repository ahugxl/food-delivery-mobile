import type { Restaurant } from '../../types';
import type { Row } from '../../types/supabase';
import { viHours } from '../../utils/vietnamese';
// Label text is managed in the database, without a hardcoded allowlist.
export function restaurantInfoLabels(value: Row<'restaurants'>['promo_tags']): string[] {
  if (!Array.isArray(value)) return [];
  const labels = value.filter((tag): tag is string => typeof tag === 'string' && !!tag.trim());
  return [...new Set(labels)];
}

export function toRestaurantCard(row: Row<'restaurants'>): Restaurant {
  return {
    id: row.id, name: row.name, rating: Number(row.rating ?? 0),
    image: row.image_url ?? '',
    deliveryTime: viHours(row.opening_hours),
    openingHours: viHours(row.opening_hours),
    isOpen: row.is_open === true,
    tags: restaurantInfoLabels(row.promo_tags),
  };
}
