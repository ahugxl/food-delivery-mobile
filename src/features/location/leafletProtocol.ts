import type { MapPanelProps } from '../../components/maps/MapPanel.types';
import { validCoordinates, type Coordinates } from './coordinates';

export type MapScene = { coordinate: Coordinates; origin: Coordinates | null; driver: Coordinates | null; selectable: boolean; simulation: boolean };
export type MapEvent = { type: 'ready' | 'tiles-ready' | 'tiles-error' | 'error' | 'attribution' } | { type: 'select'; coordinate: Coordinates };
export const MAP_CHANNEL = 'food-delivery-map';
export const MAP_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

export function mapScene(props: MapPanelProps): MapScene {
  if (!validCoordinates(props.coordinate)) throw new Error('Tọa độ bản đồ không hợp lệ.');
  const copy = (value: Coordinates): Coordinates => ({ latitude: value.latitude, longitude: value.longitude });
  return { coordinate: copy(props.coordinate), origin: validCoordinates(props.origin) ? copy(props.origin) : null,
    driver: validCoordinates(props.driver) ? copy(props.driver) : null, selectable: !!props.onSelect, simulation: !!props.simulation };
}

export function parseMapEvent(raw: unknown, token: string, selectable: boolean): MapEvent | null {
  try {
    if (typeof raw === 'string' && raw.length > 2048) return null;
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object') return null;
    const event = value as Record<string, unknown>;
    if (event.channel !== MAP_CHANNEL || event.token !== token) return null;
    if (event.type === 'select') {
      const coordinate = event.coordinate as Coordinates | null;
      return selectable && validCoordinates(coordinate) ? { type: 'select', coordinate: { latitude: coordinate.latitude, longitude: coordinate.longitude } } : null;
    }
    return ['ready', 'tiles-ready', 'tiles-error', 'error', 'attribution'].includes(String(event.type)) ? { type: event.type as Exclude<MapEvent['type'], 'select'> } : null;
  } catch { return null; }
}

// Escape for a script element, not for HTML text or shell commands.
export function scriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function mapUpdateScript(scene: MapScene, token: string) {
  return `window.FoodDeliveryMap && window.FoodDeliveryMap.update(${scriptJson(scene)},${scriptJson(token)});true;`;
}
