import type { Row } from '../../types/supabase';
import { distanceKm, type Coordinates } from './liveCatalog';
import { viLabel } from '../../utils/vietnamese';
import { normalizeSearch } from './normalizeSearch';
import { matchesRestaurantTag, type FoodCollection } from './foodCollections';
export { normalizeSearch } from './normalizeSearch';
type MenuMatch = {
    restaurant_id: string;
    name: string;
};
export function searchRestaurants(restaurants: Row<'restaurants'>[], foods: MenuMatch[], keyword: string, filters: {
    favorite: boolean;
    freeship: boolean;
    nearby: boolean;
    sort: string;
}, saved: string[], location: Coordinates | null, categoryId?: string, collectionId?: string, collection?: FoodCollection) {
    const words = normalizeSearch(keyword).trim().split(/\s+/).filter(Boolean);
    if (collectionId && (!collection || collection.id !== collectionId || !collection.is_active)) return [];
    // Food collections receive only dishes linked by food_discovery_categories.
    // No dish-name heuristics or ingredient matching remain.
    const matchingFoods = foods;
    const result = restaurants.filter(restaurant => {
        const menu = matchingFoods.filter(food => food.restaurant_id === restaurant.id);
        const text = normalizeSearch(`${restaurant.name} ${menu.map(food => `${food.name} ${viLabel(food.name)}`).join(' ')}`);
        const tokens = text.split(/[^\p{L}\p{N}]+/u);
        const distance = location && restaurant.latitude != null && restaurant.longitude != null ? distanceKm(location, { latitude: restaurant.latitude, longitude: restaurant.longitude }) : Infinity;
        return (!(categoryId || collection?.kind === 'food') || menu.length > 0)
            && (collection?.kind !== 'restaurant_tag' || matchesRestaurantTag(restaurant.promo_tags, collection.restaurant_tag))
            && words.every(word => tokens.some(token => token.startsWith(word)))
            && (!filters.favorite || saved.includes(restaurant.id))
            && (!filters.freeship || (Array.isArray(restaurant.promo_tags) && restaurant.promo_tags.some(tag => typeof tag === 'string' && /freeship|free delivery|miễn phí giao/i.test(viLabel(tag)))))
            && (!filters.nearby || distance <= 2);
    });
    if (filters.sort === 'rating')
        result.sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
    if (filters.sort === 'distance' && location) {
        const distance = (r: Row<'restaurants'>) => r.latitude != null && r.longitude != null ? distanceKm(location, { latitude: r.latitude, longitude: r.longitude }) : Infinity;
        result.sort((a, b) => distance(a) - distance(b));
    }
    return result;
}
