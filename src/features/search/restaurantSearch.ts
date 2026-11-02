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
const tokenize = (value: string) => normalizeSearch(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
export function matchesSearchPhrase(value: string, keyword: string) {
    const words = tokenize(keyword);
    if (!words.length) return false;
    const tokens = tokenize(value);
    return tokens.some((_, start) => words.every((word, offset) => tokens[start + offset] === word));
}
export function matchingMenuFoods<T extends MenuMatch>(foods: T[], keyword: string, includeAllWhenEmpty = false) {
    // Category queries already restrict foods by their database links.
    if (includeAllWhenEmpty && !tokenize(keyword).length) return foods;
    return foods.filter(food => matchesSearchPhrase(food.name, keyword) || matchesSearchPhrase(viLabel(food.name), keyword));
}
export function searchRestaurants(restaurants: Row<'restaurants'>[], foods: MenuMatch[], keyword: string, filters: {
    favorite: boolean;
    freeship: boolean;
    nearby: boolean;
    sort: string;
}, saved: string[], location: Coordinates | null, categoryId?: string, collectionId?: string, collection?: FoodCollection) {
    const hasKeyword = tokenize(keyword).length > 0;
    if (collectionId && (!collection || collection.id !== collectionId || !collection.is_active)) return [];
    // Food collections receive only dishes linked by food_discovery_categories.
    // No dish-name heuristics or ingredient matching remain.
    const matchingFoods = foods;
    const result = restaurants.filter(restaurant => {
        const menu = matchingFoods.filter(food => food.restaurant_id === restaurant.id);
        // A phrase must occur in one name, never across unrelated menu items.
        const matchesKeyword = !hasKeyword || matchesSearchPhrase(restaurant.name, keyword)
            || matchingMenuFoods(menu, keyword).length > 0;
        const distance = location && restaurant.latitude != null && restaurant.longitude != null ? distanceKm(location, { latitude: restaurant.latitude, longitude: restaurant.longitude }) : Infinity;
        return (!(categoryId || collection?.kind === 'food') || menu.length > 0)
            && (collection?.kind !== 'restaurant_tag' || matchesRestaurantTag(restaurant.promo_tags, collection.restaurant_tag))
            && matchesKeyword
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
