import type { SupabaseClient } from '@supabase/supabase-js';
import type { FoodDetail, SupabaseDatabase } from '../types/supabase';

export const FOOD_DETAIL_SELECT = `
  *,
  restaurants!inner(id, name, rating, is_active, is_open),
  food_option_groups(*, food_option_items(*))
` as const;

export function createCatalogApi(client: SupabaseClient<SupabaseDatabase> | null) {
  function db() {
    if (!client) throw new Error('Supabase is not configured.');
    return client;
  }
  return {
    async banners(signal?: AbortSignal) {
      const query = db().from('banners').select('*').eq('is_active', true).order('position').order('id');
      const { data, error } = await (signal ? query.abortSignal(signal) : query);
      if (error) throw error;
      return data ?? [];
    },
    async categories(signal?: AbortSignal) {
      const query = db().from('categories').select('*').order('name').order('id');
      const { data, error } = await (signal ? query.abortSignal(signal) : query);
      if (error) throw error;
      return data ?? [];
    },
    async restaurants(signal?: AbortSignal) {
      const query = db().from('restaurants').select('*').eq('is_active', true).order('rating', { ascending: false }).order('id');
      const { data, error } = await (signal ? query.abortSignal(signal) : query);
      if (error) throw error;
      return data ?? [];
    },
    async food(id: string, signal?: AbortSignal): Promise<FoodDetail | null> {
      // Legacy mock IDs and malformed links must not produce PostgreSQL UUID errors.
      if (!isUuid(id)) return null;
      const query = db().from('foods').select(FOOD_DETAIL_SELECT).eq('id', id).eq('restaurants.is_active', true);
      const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
      if (error) throw error;
      return data;
    },
    async foods(filters: { categoryId?: string; restaurantId?: string } = {}, signal?: AbortSignal) {
      if ((filters.categoryId && !isUuid(filters.categoryId)) || (filters.restaurantId && !isUuid(filters.restaurantId))) return [];
      let query = db().from('foods').select('*, restaurants!inner(id, name, rating, is_active, is_open, latitude, longitude, opening_hours, promo_tags)')
        .eq('is_available', true).eq('restaurants.is_active', true).order('name').order('id');
      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.restaurantId) query = query.eq('restaurant_id', filters.restaurantId);
      const { data, error } = await (signal ? query.abortSignal(signal) : query);
      if (error) throw error;
      return data ?? [];
    },
  };
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
