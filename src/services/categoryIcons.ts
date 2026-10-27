export function categoryIconUrl(id: string) {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
  const bucket = process.env.EXPO_PUBLIC_CATEGORY_ICON_BUCKET?.trim() || 'category-icons';
  const prefix = process.env.EXPO_PUBLIC_CATEGORY_ICON_PREFIX?.trim().replace(/^\/+|\/+$/g, '') || '';
  if (!base || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return undefined;
  const path = [...(prefix ? prefix.split('/') : []), `${id}.png`].map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path}`;
}
