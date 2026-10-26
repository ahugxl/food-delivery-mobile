import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseDatabase } from '../types/supabase';
import type { CartItem } from '../types';
import { cartSubtotal, serializeCart, validatePurchase, voucherError } from '../features/order/purchase';
import { validCoordinates, type Coordinates } from '../features/location/coordinates';

export function createPurchaseApi(client: SupabaseClient<SupabaseDatabase> | null) {
  function db() { if (!client) throw new Error('Supabase is not configured.'); return client; }
  return {
    async checkVoucher(code: string, items: CartItem[]) {
      const normalized = code.trim().toUpperCase();
      if (!normalized || normalized.length > 100) throw new Error('Enter a valid voucher code.');
      if (!items.length) throw new Error('Add items before applying a voucher.');
      if (items.some(item => item.restaurantId !== items[0].restaurantId)) throw new Error('Each order must belong to one restaurant.');
      const { data, error } = await db().from('vouchers').select('*').eq('code', normalized).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Voucher code not found.');
      const reason = voucherError(data, cartSubtotal(items), items[0].restaurantId);
      if (reason) throw new Error(reason);
      return data;
    },
    async createOrder(input: { orderId: string; items: CartItem[]; address: string; voucherCode?: string; coordinates?: Coordinates }) {
      validatePurchase(input.items, input.address);
      const args = {
        p_order_id: input.orderId, p_items: serializeCart(input.items),
        p_address: input.address.trim(), p_voucher_code: input.voucherCode?.trim().toUpperCase() || null,
      };
      if (input.coordinates && !validCoordinates(input.coordinates)) throw new Error('Invalid delivery coordinates.');
      const request = input.coordinates ? db().rpc('create_food_order_at_location', { ...args, p_latitude: input.coordinates.latitude, p_longitude: input.coordinates.longitude }) : db().rpc('create_food_order', args);
      const { data, error } = await request.single();
      if (error) {
        if (error.code === 'PGRST202') throw new Error('Checkout setup is missing on Supabase. Please run the matching Phase 2/3 SQL migration.');
        throw error;
      }
      if (!data) throw new Error('The server did not confirm your order. Please retry.');
      return data;
    },
    async order(id: string, userId: string, signal?: AbortSignal) {
      const query = db().from('orders').select('*, restaurants(id, name, image_url, latitude, longitude), order_items(*)').eq('id', id).eq('user_id', userId);
      const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
      if (error) throw error;
      return data;
    },
    async orders(userId: string, signal?: AbortSignal) {
      const query = db().from('orders').select('*, restaurants(id, name, image_url)').eq('user_id', userId).order('created_at', { ascending: false });
      const { data, error } = await (signal ? query.abortSignal(signal) : query);
      if (error) throw error;
      return data ?? [];
    },
  };
}
