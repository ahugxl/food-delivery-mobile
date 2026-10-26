import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseDatabase } from '../types/supabase';
import type { Database } from '../types/database.types';

export type DriverProfile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'full_name' | 'phone' | 'avatar_url'>;
export type OrderDriver = { driverId: string | null; profile: DriverProfile | null };

export function createDriverApi(client: SupabaseClient<SupabaseDatabase> | null) {
  return {
    async forOrder(orderId: string, userId: string, signal?: AbortSignal): Promise<OrderDriver> {
      if (!client) throw new Error('Chưa cấu hình kết nối Supabase.');
      if (!userId || !orderId) throw new Error('Vui lòng đăng nhập và chọn đơn hàng.');
      // driver_id references auth.users, not profiles: do not invent a PostgREST FK join.
      const request = client.from('orders').select('id,driver_id').eq('id', orderId).eq('user_id', userId);
      const { data: order, error } = await (signal ? request.abortSignal(signal) : request).maybeSingle();
      if (error) throw error;
      if (!order) throw new Error('Không tìm thấy đơn hàng của bạn.');
      if (!order.driver_id) return { driverId: null, profile: null };
      const profileRequest = client.from('profiles').select('id,full_name,phone,avatar_url').eq('id', order.driver_id).eq('role', 'driver');
      const { data: profile, error: profileError } = await (signal ? profileRequest.abortSignal(signal) : profileRequest).maybeSingle();
      if (profileError) throw profileError;
      return { driverId: order.driver_id, profile };
    },
  };
}
