import type { Row } from '../../types/supabase';
import { distanceKm, type Coordinates } from './liveCatalog';
import { viLabel } from '../../utils/vietnamese';
import { normalizeSearch } from './normalizeSearch';
import { findFoodCollection, matchesFoodCollection } from './foodCollections';
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
}, saved: string[], location: Coordinates | null, categoryId?: string, collectionId?: string) {
    const words = normalizeSearch(keyword).trim().split(/\s+/).filter(Boolean);
    const collection = findFoodCollection(collectionId);
    if (collectionId && !collection) return [];
    const matchingFoods = collection ? foods.filter(food => matchesFoodCollection(food, collection)) : foods;
    const result = restaurants.filter(restaurant => {
        const menu = matchingFoods.filter(food => food.restaurant_id === restaurant.id);
        const text = normalizeSearch(`${restaurant.name} ${menu.map(food => `${food.name} ${viLabel(food.name)}`).join(' ')}`);
        const tokens = text.split(/[^\p{L}\p{N}]+/u);
        const distance = location && restaurant.latitude != null && restaurant.longitude != null ? distanceKm(location, { latitude: restaurant.latitude, longitude: restaurant.longitude }) : Infinity;
        return (!(categoryId || collection) || menu.length > 0) && words.every(word => tokens.some(token => token.startsWith(word)))
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
