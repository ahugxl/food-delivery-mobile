import type { Restaurant } from '../../types';
export function applyFavorite(current: Restaurant[], restaurant: Restaurant, saved: boolean) {
  const others = current.filter(row => row.id !== restaurant.id);
  return saved ? [restaurant, ...others] : others;
}
// Roll back only this restaurant, preserving other concurrent favorite changes.
export function rollbackFavorite(current: Restaurant[], restaurantId: string, previous: Restaurant[]) {
  const old = previous.find(row => row.id === restaurantId);
  const others = current.filter(row => row.id !== restaurantId);
  if (!old) return others;
  const index = Math.min(previous.findIndex(row => row.id === restaurantId), others.length);
  return [...others.slice(0, index), old, ...others.slice(index)];
}
