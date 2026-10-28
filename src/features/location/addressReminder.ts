import type { DeliveryAddress } from '../order/checkout';
import { validCoordinates } from './coordinates';
import { haversineDistance } from '../../utils/distance';

// Ignore small GPS drift and differences in address spelling from the geocoder.
export function differsFromDefault(detected: DeliveryAddress | null, savedDefault: DeliveryAddress | null): boolean {
  if (!detected?.street.trim() || !savedDefault?.street.trim()) return false;
  if (validCoordinates(detected) && validCoordinates(savedDefault)) return haversineDistance(detected, savedDefault) > 0.2;
  const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('vi').replace(/[\s,.;]+/g, ' ').trim();
  return normalize(detected.street) !== normalize(savedDefault.street);
}
