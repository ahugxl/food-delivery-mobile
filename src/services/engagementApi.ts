import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseDatabase } from '../types/supabase';
import type { Database } from '../types/database.types';
import { reviewPayload, type ReviewInput } from '../features/reviews/review';
import { toRestaurantCard } from '../features/home/adapters';

export function createEngagementApi(client: SupabaseClient<SupabaseDatabase> | null) {
  const db = () => { if (!client) throw new Error('Supabase chưa được cấu hình.'); return client; };
  const readReview = async (orderId: string, userId: string, signal?: AbortSignal) => {
    const query = db().from('reviews').select('*').eq('order_id', orderId).eq('user_id', userId);
    const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
    if (error) throw error;
    return data;
  };
  return {
    review: readReview,
    async submitReview(orderId: string, userId: string, input: ReviewInput) {
      const payload = reviewPayload(orderId, userId, input);
      const order = await db().from('orders').select('id,status').eq('id', orderId).eq('user_id', userId).maybeSingle();
      if (order.error) throw order.error;
      if (!order.data || order.data.status !== 'completed') throw new Error('Chỉ được đánh giá đơn hàng của bạn đã hoàn thành.');
      const driver = await db().rpc('submit_order_review', { p_order_id: orderId, p_stage: 'driver', p_rating: payload.driver_rating!, p_feedback: payload.driver_feedback ?? '' }).single();
      if (driver.error) throw driver.error;
      const { data, error } = await db().rpc('submit_order_review', { p_order_id: orderId, p_stage: 'restaurant', p_rating: payload.restaurant_rating!, p_feedback: payload.restaurant_feedback ?? '', p_food_votes: [] }).single();
      if (error) throw error;
      if (!data) throw new Error('Server chưa xác nhận đánh giá. Vui lòng thử lại.');
      return data;
    },
    async favorites(userId: string, signal?: AbortSignal) {
      const query = db().from('favorites').select('restaurants(*)').eq('user_id', userId).not('restaurant_id', 'is', null).order('created_at', { ascending: false });
      const { data, error } = await (signal ? query.abortSignal(signal) : query);
      if (error) throw error;
      return (data ?? []).flatMap(row => row.restaurants ? [toRestaurantCard(row.restaurants)] : []);
    },
    async setFavorite(userId: string, restaurantId: string, saved: boolean) {
      if (saved) {
        const record: Database['public']['Tables']['favorites']['Insert'] = { user_id: userId, restaurant_id: restaurantId };
        const { error } = await db().from('favorites').upsert(record, { onConflict: 'user_id,restaurant_id', ignoreDuplicates: true });
        if (error) throw error;
      } else {
        const { error } = await db().from('favorites').delete().eq('user_id', userId).eq('restaurant_id', restaurantId);
        if (error) throw error;
      }
    },
  };
}
