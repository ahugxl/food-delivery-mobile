import { supabase } from './supabase';
import { createCatalogApi } from './catalogApi';

export const catalogApi = createCatalogApi(supabase);
export const catalogKeys = {
  banners: ['catalog', 'banners'] as const,
  categories: ['catalog', 'categories'] as const,
  restaurants: ['catalog', 'restaurants'] as const,
  food: (id: string) => ['catalog', 'food', id] as const,
  foods: (categoryId?: string, restaurantId?: string) => ['catalog', 'foods', categoryId ?? '', restaurantId ?? ''] as const,
};
