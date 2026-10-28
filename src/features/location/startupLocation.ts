import type { DeliveryAddress } from '../order/checkout';
import type { Row } from '../../types/supabase';
import { validCoordinates, type Coordinates } from './coordinates';

export function detectedDelivery(coordinates: Coordinates, street: string, profile: Pick<Row<'profiles'>, 'full_name' | 'phone'> | null): DeliveryAddress {
  if (!validCoordinates(coordinates) || street.trim().length < 5) throw new Error('Chưa xác định được địa chỉ cụ thể.');
  return {
    ...coordinates, street: street.trim(), label: 'Other',
    recipientName: profile?.full_name?.trim() ?? '',
    recipientPhone: (profile?.phone ?? '').trim().replace(/[\s().-]/g, ''),
  };
}

// A slow GPS/geocoder must never keep the home screen waiting indefinitely.
export async function withLocationDeadline<T>(operation: Promise<T>, milliseconds = 15000, message = 'Chưa lấy được vị trí. Hãy bật GPS hoặc chọn địa chỉ đã lưu.'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

type Position = { coords: { latitude: number; longitude: number } };
export async function acquireCoordinates(provider: {
  servicesEnabled: () => Promise<boolean>;
  lastKnown: () => Promise<Position | null>;
  current: () => Promise<Position>;
}): Promise<Coordinates> {
  if (!await provider.servicesEnabled()) throw new Error('Dịch vụ vị trí đang tắt. Hãy bật Vị trí/GPS trên Android rồi thử lại.');
  const recent = await withLocationDeadline(provider.lastKnown(), 2000).catch(() => null);
  const result = recent && validCoordinates(recent.coords) ? recent : await withLocationDeadline(provider.current(), 30000,
    'Android chưa trả về tọa độ GPS. Trên máy ảo, hãy bật Enable GPS signal và nhấn Set location trong Extended Controls → Location, rồi định vị lại.');
  if (!validCoordinates(result.coords)) throw new Error('Thiết bị trả về tọa độ không hợp lệ. Hãy định vị lại.');
  return { latitude: result.coords.latitude, longitude: result.coords.longitude };
}

export async function resolveStartupDelivery(dependencies: {
  coordinates: () => Promise<Coordinates>;
  address: (coordinates: Coordinates) => Promise<string>;
  profile: () => Promise<Pick<Row<'profiles'>, 'full_name' | 'phone'> | null>;
  onCoordinates?: (coordinates: Coordinates) => void;
}) {
  // Slow/offline profile requests must not delay GPS or reverse geocoding.
  const profile = withLocationDeadline(dependencies.profile(), 4000).catch(() => null);
  const coordinates = await dependencies.coordinates();
  dependencies.onCoordinates?.(coordinates);
  const street = await withLocationDeadline(dependencies.address(coordinates), 12000,
    'Đã lấy được tọa độ nhưng chưa dịch được thành địa chỉ. Hãy kiểm tra mạng hoặc nhập địa chỉ cho vị trí này.');
  return detectedDelivery(coordinates, street, await profile);
}
