import type { Json } from '../../types/database.types';
import { viLabel } from '../../utils/vietnamese';

export function orderSnapshot(snapshot: Json, fallback = 'Món ăn') {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return { name: fallback, description: '', image: null as string | null };
  const options = Array.isArray(snapshot.options) ? snapshot.options.flatMap(option => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return [];
    return typeof option.label === 'string' ? [viLabel(option.label)] : [];
  }) : [];
  if (typeof snapshot.note === 'string' && snapshot.note) options.push(`Ghi chú: ${snapshot.note}`);
  return { name: typeof snapshot.food_name === 'string' ? viLabel(snapshot.food_name) : fallback,
    description: options.join(', '), image: typeof snapshot.image_url === 'string' ? snapshot.image_url : null };
}
