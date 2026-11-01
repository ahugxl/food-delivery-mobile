import type { Database } from '../../types/database.types';

type OrderChatState = Pick<Database['public']['Tables']['orders']['Row'], 'status' | 'completed_at'>;
export const CUSTOMER_CHAT_GRACE_MS = 5 * 60 * 1000;
export function canSendCustomerMessage(order: OrderChatState | null | undefined, now = Date.now()): boolean {
  if (!order || !Number.isFinite(now)) return false;
  if (['pending', 'preparing', 'delivering'].includes(order.status ?? '')) return true;
  if (order.status !== 'completed' || !order.completed_at) return false;
  const completed = Date.parse(order.completed_at);
  return Number.isFinite(completed) && completed <= now && now < completed + CUSTOMER_CHAT_GRACE_MS;
}
export function customerChatClosedReason(order: OrderChatState | null | undefined) {
  if (!order) return 'Đang kiểm tra quyền gửi tin nhắn…';
  return order.status === 'completed'
    ? 'Đã hết thời gian nhắn tin sau khi hoàn thành đơn (5 phút). Bạn chỉ có thể xem lại cuộc trò chuyện.'
    : 'Đơn hàng không còn cho phép gửi tin nhắn. Bạn vẫn có thể xem lại cuộc trò chuyện.';
}
