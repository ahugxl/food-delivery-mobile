import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseDatabase } from '../types/supabase';
import type { RewardRequest } from '../features/offers/rewards';
import { parseRewardRequest } from '../features/offers/rewards';

export function createRewardsApi(client: SupabaseClient<SupabaseDatabase> | null) {
  const db = () => { if (!client) throw Error('Chưa cấu hình Supabase.'); return client; };
  return {
    async redeem(userId: string, request: RewardRequest) {
      if (!userId || !parseRewardRequest(request)) throw Error('Yêu cầu đổi xu không hợp lệ.');
      const { data, error } = await db().rpc('redeem_loyalty_voucher', {
        p_request_id: request.id, p_discount_amount: request.amount, p_expected_user_id: userId,
      }).single();
      if (error) throw error;
      return data;
    },
    async history(userId: string, signal?: AbortSignal) {
      const q = db().from('loyalty_redemptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
      const { data, error } = await (signal ? q.abortSignal(signal) : q);
      if (error) throw error;
      return data ?? [];
    },
  };
}
