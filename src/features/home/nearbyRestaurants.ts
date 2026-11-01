import { validCoordinates } from '../location/coordinates';
import { haversineDistance } from '../../utils/distance';

type Point = { latitude?: number | null; longitude?: number | null };
export function nearestRestaurants<T extends Point>(restaurants: readonly T[], address: Point): T[] {
  if (!validCoordinates(address)) return [...restaurants];
  return restaurants.map((restaurant, index) => ({ restaurant, index,
    distance: validCoordinates(restaurant) ? haversineDistance(restaurant, address) : Infinity,
  })).sort((a, b) => a.distance - b.distance || a.index - b.index).map(item => item.restaurant);
}
