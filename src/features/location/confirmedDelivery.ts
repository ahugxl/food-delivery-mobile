import type { DeliveryAddress } from '../order/checkout';
import { validCoordinates } from './coordinates';

// Only replace the GPS card whose snapshot was edited. A later GPS fix or an
// unrelated saved address must not be overwritten by a stale editor callback.
export function confirmedDetectedDelivery(
  detected: DeliveryAddress | null,
  initial: DeliveryAddress,
  confirmed: DeliveryAddress,
): DeliveryAddress | null {
  if (!detected || initial.savedAddressId || !validCoordinates(initial) || !validCoordinates(detected)
    || initial.latitude !== detected.latitude || initial.longitude !== detected.longitude
    || initial.street.trim() !== detected.street.trim()) return detected;
  return { ...confirmed, savedAddressId: undefined };
}
