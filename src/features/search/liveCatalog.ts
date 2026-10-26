import type { createCatalogApi } from '../../services/catalogApi';
import type { SearchFilters } from './catalog';

type FoodRow = Awaited<ReturnType<ReturnType<typeof createCatalogApi>['foods']>>[number];
export type Coordinates = { latitude: number; longitude: number };

export function distanceKm(origin: Coordinates, target: Coordinates) {
  const rad = (value: number) => value * Math.PI / 180;
  const dlat = rad(target.latitude - origin.latitude);
  const dlon = rad(target.longitude - origin.longitude);
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(rad(origin.latitude)) * Math.cos(rad(target.latitude)) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

export function searchLiveCatalog(rows: FoodRow[], keyword: string, filters: SearchFilters, favorites: string[], location: Coordinates | null) {
  const words = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const results = rows.map(row => ({
    food: { id: row.id, name: row.name, price: Number(row.price), image: row.image_url ?? '' },
    restaurantId: row.restaurant_id,
    restaurant: row.restaurants.name,
    rating: Number(row.restaurants.rating ?? 0),
    deliveryTime: row.restaurants.opening_hours || 'Chưa có giờ mở cửa',
    distanceKm: location && row.restaurants.latitude != null && row.restaurants.longitude != null
      ? distanceKm(location, { latitude: row.restaurants.latitude, longitude: row.restaurants.longitude }) : null,
    freeDelivery: Array.isArray(row.restaurants.promo_tags) && row.restaurants.promo_tags.some(tag => typeof tag === 'string' && /freeship|free delivery/i.test(tag)),
    isOpen: row.restaurants.is_open,
  })).filter(item => words.every(word => `${item.food.name} ${item.restaurant}`.toLowerCase().includes(word))
    && (!filters.freeship || item.freeDelivery)
    && (!filters.favorite || favorites.includes(item.restaurantId))
    && (!filters.nearby || (item.distanceKm !== null && item.distanceKm <= 2)));
  if (filters.sort === 'rating') results.sort((a, b) => b.rating - a.rating);
  if (filters.sort === 'distance') results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return results;
}
