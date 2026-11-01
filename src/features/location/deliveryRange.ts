import { validCoordinates } from './coordinates';
import { haversineDistance } from '../../utils/distance';

export const MAX_DELIVERY_DISTANCE_KM = 20;
export const OUTSIDE_DELIVERY_RANGE = 'Ngoài phạm vi giao hàng 20 km. Vui lòng chọn quán gần hơn hoặc thay đổi địa chỉ.';
type Point = { latitude?: number | null; longitude?: number | null } | null | undefined;

export function deliveryRange(restaurant: Point, address: Point) {
  const distanceKm = validCoordinates(restaurant) && validCoordinates(address) ? haversineDistance(restaurant, address) : null;
  return { distanceKm, outsideRange: distanceKm !== null && distanceKm > MAX_DELIVERY_DISTANCE_KM };
}

export function deliveryOrderError(restaurant: Point, address: Point): string | null {
  const { distanceKm, outsideRange } = deliveryRange(restaurant, address);
  if (distanceKm === null) return 'Vui lòng chọn điểm giao và tọa độ quán hợp lệ trước khi thêm món.';
  return outsideRange ? OUTSIDE_DELIVERY_RANGE : null;
}
