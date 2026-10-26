import type { Row } from '../../types/supabase';
import { distanceKm, type Coordinates } from './liveCatalog';
import { viLabel } from '../../utils/vietnamese';
export const normalizeSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
type MenuMatch = {
    restaurant_id: string;
    name: string;
};
export function searchRestaurants(restaurants: Row<'restaurants'>[], foods: MenuMatch[], keyword: string, filters: {
    favorite: boolean;
    freeship: boolean;
    nearby: boolean;
    sort: string;
}, saved: string[], location: Coordinates | null, categoryId?: string) {
    const words = normalizeSearch(keyword).trim().split(/\s+/).filter(Boolean);
    const result = restaurants.filter(restaurant => {
        const menu = foods.filter(food => food.restaurant_id === restaurant.id);
        const text = normalizeSearch(`${restaurant.name} ${menu.map(food => `${food.name} ${viLabel(food.name)}`).join(' ')}`);
        const tokens = text.split(/[^\p{L}\p{N}]+/u);
        const distance = location && restaurant.latitude != null && restaurant.longitude != null ? distanceKm(location, { latitude: restaurant.latitude, longitude: restaurant.longitude }) : Infinity;
        return (!categoryId || menu.length > 0) && words.every(word => tokens.some(token => token.startsWith(word)))
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
