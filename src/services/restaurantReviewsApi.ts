import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseDatabase } from '../types/supabase';
import type { Database } from '../types/database.types';
export type RestaurantReview = Database['public']['Functions']['restaurant_review_feed']['Returns'][number];
export type ReviewSummary = Database['public']['Functions']['restaurant_review_summary']['Returns'][number];
export type ReviewFilters = { sort: 'newest' | 'highest' | 'lowest'; rating: number | null; photos: boolean; mine: boolean };
export const REVIEW_PAGE_SIZE = 20;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function reviewFeedArgs(id: string, filters: ReviewFilters, offset: number) {
  if (!uuid.test(id) || !['newest','highest','lowest'].includes(filters.sort) || (filters.rating !== null && (!Number.isInteger(filters.rating) || filters.rating < 1 || filters.rating > 5)) || !Number.isInteger(offset) || offset < 0 || offset > 100000) throw Error('Thông tin quán hoặc bộ lọc đánh giá không hợp lệ.');
  return { p_restaurant_id: id, p_sort: filters.sort, p_rating: filters.rating, p_with_photos: filters.photos, p_mine: filters.mine, p_offset: offset, p_limit: REVIEW_PAGE_SIZE };
}
export function createRestaurantReviewsApi(client: SupabaseClient<SupabaseDatabase> | null) {
  const db = () => { if (!client) throw Error('Chưa cấu hình Supabase.'); return client; };
  return {
    async summary(id: string, signal?: AbortSignal): Promise<ReviewSummary> {
      if (!uuid.test(id)) throw Error('Mã quán không hợp lệ.');
      const q = db().rpc('restaurant_review_summary', { p_restaurant_id: id });
      const { data, error } = await (signal ? q.abortSignal(signal) : q).single();
      if (error) throw error; return data;
    },
    async feed(id: string, filters: ReviewFilters, offset: number, signal?: AbortSignal): Promise<RestaurantReview[]> {
      const q = db().rpc('restaurant_review_feed', reviewFeedArgs(id, filters, offset));
      const { data, error } = await (signal ? q.abortSignal(signal) : q);
      if (error) throw error; return data ?? [];
    },
    async photo(path: string): Promise<string> {
      const { data, error } = await db().storage.from('review-photos').createSignedUrl(path, 3600);
      if (error) throw error; return data.signedUrl;
    },
  };
}
