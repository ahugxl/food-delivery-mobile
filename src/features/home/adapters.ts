import type { Restaurant } from '../../types';
import type { Row } from '../../types/supabase';
import { viHours, viLabel } from '../../utils/vietnamese';

export function toRestaurantCard(row: Row<'restaurants'>): Restaurant {
  return {
    id: row.id, name: row.name, rating: Number(row.rating ?? 0),
    image: row.image_url ?? '',
    deliveryTime: viHours(row.opening_hours),
    openingHours: viHours(row.opening_hours),
    isOpen: row.is_open,
    tags: Array.isArray(row.promo_tags) ? row.promo_tags.filter((tag): tag is string => typeof tag === 'string').map(viLabel) : [],
  };
}
