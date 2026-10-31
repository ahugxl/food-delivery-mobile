import type { Json, Database } from '../../types/database.types';
import { validCoordinates } from './coordinates';

export type DriverFix = Pick<Database['public']['Tables']['driver_locations']['Row'], 'latitude' | 'longitude' | 'received_at'> & { is_stale: boolean };
export function parseDriverFix(value: Json): DriverFix | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)
    || typeof value.latitude !== 'number' || typeof value.longitude !== 'number'
    || !validCoordinates({ latitude: value.latitude, longitude: value.longitude })
    || typeof value.received_at !== 'string' || !Number.isFinite(Date.parse(value.received_at))
    || typeof value.is_stale !== 'boolean') throw new Error('Máy chủ trả về vị trí tài xế không hợp lệ.');
  return { latitude: value.latitude, longitude: value.longitude, received_at: value.received_at, is_stale: value.is_stale };
}

export function canTrackDriver(status: string | null | undefined, driverId: string | null | undefined) {
  return !!driverId && (status === 'preparing' || status === 'delivering');
}

export function driverFixState(input: {
  status: string | null | undefined; driverId: string | null | undefined;
  fix: DriverFix | null | undefined; loading: boolean; error: boolean;
}, now = Date.now()): 'inactive' | 'unassigned' | 'waiting' | 'loading' | 'error' | 'stale' | 'live' {
  if (input.status === 'completed' || input.status === 'cancelled') return 'inactive';
  if (!input.driverId) return 'unassigned';
  if (!canTrackDriver(input.status, input.driverId)) return 'waiting';
  if (input.error) return 'error';
  if (input.loading) return 'loading';
  if (!input.fix) return 'waiting';
  const age = now - Date.parse(input.fix.received_at);
  // Honor server freshness and also age cached data when the network stops updating.
  if (input.fix.is_stale || !Number.isFinite(age) || age >= 120000 || age < -60000) return 'stale';
  return 'live';
}

export function driverFixTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
}
