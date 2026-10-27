import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseDatabase } from '../types/supabase';
import type { CartItem } from '../types';
import { cartSubtotal, serializeCart, validatePurchase, voucherError } from '../features/order/purchase';
import { validCoordinates, type Coordinates } from '../features/location/coordinates';
import type { Database } from '../types/database.types';
import { BASE_DELIVERY_FEE, EXTRA_KM_FEE } from '../utils/distance';
import { recipientInput, type Recipient } from '../features/order/recipient';

export function createPurchaseApi(client: SupabaseClient<SupabaseDatabase> | null) {
  function db() { if (!client) throw new Error('Chưa cấu hình kết nối Supabase.'); return client; }
  return {
    async checkVoucher(code: string, items: CartItem[]) {
      const normalized = code.trim().toUpperCase();
      if (!normalized || normalized.length > 100) throw new Error('Vui lòng nhập mã ưu đãi hợp lệ.');
      if (!items.length) throw new Error('Vui lòng thêm món trước khi áp dụng mã.');
      if (items.some(item => item.restaurantId !== items[0].restaurantId)) throw new Error('Mỗi đơn hàng chỉ được đặt từ một quán.');
      const { data, error } = await db().from('vouchers').select('*').eq('code', normalized).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Không tìm thấy mã ưu đãi.');
      const reason = voucherError(data, cartSubtotal(items), items[0].restaurantId);
      if (reason) throw new Error(reason);
      return data;
    },
    async createOrder(input: { orderId: string; items: CartItem[]; address: string; voucherCode?: string; shippingVoucherCode?: string; coordinates: Coordinates; deliveryFee: Database['public']['Tables']['orders']['Insert']['delivery_fee'] } & Recipient) {
      validatePurchase(input.items, input.address);
      if (!validCoordinates(input.coordinates)) throw new Error('Tọa độ giao hàng không hợp lệ.');
      if (typeof input.deliveryFee !== 'number' || !Number.isInteger(input.deliveryFee) || input.deliveryFee < BASE_DELIVERY_FEE || (input.deliveryFee - BASE_DELIVERY_FEE) % EXTRA_KM_FEE !== 0) throw new Error('Phí giao hàng không hợp lệ. Vui lòng tính lại.');
      const recipient = recipientInput(input);
      const args = {
        p_recipient_name: recipient.recipientName, p_recipient_phone: recipient.recipientPhone,
        p_order_id: input.orderId, p_items: serializeCart(input.items),
        p_address: input.address.trim(), p_voucher_code: input.voucherCode?.trim().toUpperCase() || null,
        p_shipping_voucher_code: input.shippingVoucherCode?.trim().toUpperCase() || null,
        p_latitude: input.coordinates.latitude, p_longitude: input.coordinates.longitude, p_delivery_fee: input.deliveryFee,
      };
      const request = db().rpc('create_food_order', args);
      const { data, error } = await request.single();
      if (error) {
        if (error.code === 'PGRST202') throw new Error('Máy chủ chưa được cập nhật chức năng voucher giảm món và phí giao hàng. Vui lòng liên hệ quản trị viên.');
        throw error;
      }
      if (!data) throw new Error('Chưa nhận được xác nhận đơn từ máy chủ. Vui lòng thử lại.');
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
