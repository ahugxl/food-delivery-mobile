import { validCoordinates, type Coordinates } from '../features/location/coordinates';

export const BASE_DELIVERY_FEE = 15000;
export const EXTRA_KM_FEE = 5000;

/** Kilometres, normalized to micrometre precision to keep JS/PostgreSQL boundary pricing identical. */
export function haversineDistance(origin: Coordinates, destination: Coordinates): number {
  if (!validCoordinates(origin) || !validCoordinates(destination)) throw new Error('Tọa độ tính khoảng cách không hợp lệ.');
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(destination.latitude - origin.latitude);
  const longitudeDelta = radians(destination.longitude - origin.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  const clamped = Math.min(1, Math.max(0, a));
  const distance = 6371 * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
  return Math.round(distance * 1e9) / 1e9;
}

export function calculateShippingFee(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) throw new Error('Khoảng cách tính phí giao hàng không hợp lệ.');
  return BASE_DELIVERY_FEE + Math.ceil(Math.max(0, distanceKm - 2)) * EXTRA_KM_FEE;
}
