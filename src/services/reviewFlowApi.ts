import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseDatabase } from '../types/supabase';
import { reviewStageArgs, type ReviewStageInput } from '../features/reviews/reviewFlow';

export function createReviewFlowApi(client: SupabaseClient<SupabaseDatabase> | null) {
  const db = () => { if (!client) throw new Error('Chưa cấu hình Supabase.'); return client; };
  return {
    async submit(orderId: string, userId: string, input: ReviewStageInput) {
      const { data, error } = await db().rpc('submit_order_review', reviewStageArgs(orderId, userId, input)).single();
      if (error) throw error;
      if (!data) throw new Error('Máy chủ chưa xác nhận đánh giá.');
      return data;
    },
    async votes(reviewId: string, signal?: AbortSignal) {
      const request = db().from('food_reviews').select('*').eq('review_id', reviewId);
      const { data, error } = await (signal ? request.abortSignal(signal) : request);
      if (error) throw error;
      return data ?? [];
    },
    async foods(ids: string[], signal?: AbortSignal) {
      if (!ids.length) return [];
      const request = db().from('foods').select('id,name,image_url').in('id', [...new Set(ids)]);
      const { data, error } = await (signal ? request.abortSignal(signal) : request);
      if (error) throw error;
      return data ?? [];
    },
    async stats(id: string, signal?: AbortSignal) {
      const request = db().rpc('food_review_stats', { p_food_ids: [id] });
      const { data, error } = await (signal ? request.abortSignal(signal) : request);
      if (error) throw error;
      return data?.[0] ?? { food_id: id, sold_count: 0, like_count: 0 };
    },
    async upload(path: string, bytes: ArrayBuffer, mime: string) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime) || !bytes.byteLength || bytes.byteLength > 5242880) throw new Error('Chọn ảnh JPEG/PNG/WebP không quá 5 MB.');
      const { error } = await db().storage.from('review-photos').upload(path, bytes, { contentType: mime, upsert: false });
      if (error) throw error;
      return path;
    },
    async imageUrl(path: string) {
      const { data, error } = await db().storage.from('review-photos').createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    async removeDraft(path: string) {
      const { error } = await db().storage.from('review-photos').remove([path]);
      if (error) throw error;
    },
  };
}
