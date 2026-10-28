import { validCoordinates } from './coordinates';
import { haversineDistance } from '../../utils/distance';

export const MAX_DELIVERY_DISTANCE_KM = 20;
type Point = { latitude?: number | null; longitude?: number | null } | null | undefined;

export function deliveryRange(restaurant: Point, address: Point) {
  const distanceKm = validCoordinates(restaurant) && validCoordinates(address) ? haversineDistance(restaurant, address) : null;
  return { distanceKm, outsideRange: distanceKm !== null && distanceKm > MAX_DELIVERY_DISTANCE_KM };
}
