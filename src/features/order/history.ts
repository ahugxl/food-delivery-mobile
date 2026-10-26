export type OrderSection = 'active' | 'history';
export const ORDER_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận', preparing: 'Đang chuẩn bị', delivering: 'Đang đến', completed: 'Đã hoàn thành', cancelled: 'Đã hủy',
};
export function orderSection(status: string): OrderSection {
  // Keep preparing and unrecognized non-terminal states visible rather than hiding orders.
  return status === 'completed' || status === 'cancelled' ? 'history' : 'active';
}
