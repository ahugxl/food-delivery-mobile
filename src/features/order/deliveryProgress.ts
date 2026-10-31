import type { Database } from '../../types/database.types';

export type DeliveryProgress = Database['public']['Functions']['order_delivery_progress']['Returns'][number];
export const DELIVERY_STEPS = [
  'Chờ tài xế nhận chuyến', 'Tài xế đang đến quán', 'Tài xế đã đến quán',
  'Tài xế đang giao hàng', 'Tài xế đã đến điểm giao', 'Giao hàng thành công',
] as const;
const stages: Record<string, number> = { offered: 0, accepted: 1, at_restaurant: 2, picked_up: 3, at_customer: 4, delivered: 5 };

export const DELIVERY_MILESTONES = [
  'Tài xế đã nhận đơn', 'Tài xế đã đến quán',
  'Tài xế đã đến điểm giao', 'Giao hàng thành công',
] as const;

// Arrival milestones stay separate from the in-transit text shown above the bar.
export function deliveryMilestoneProgress(step: number | null | undefined) {
  const positions = [-1, 0.5, 1, 1.5, 2, 3];
  const position = typeof step === 'number' && Number.isInteger(step) && step >= 0 && step < positions.length ? positions[step] : -1;
  return { position, completed: position < 0 ? 0 : Math.floor(position) + 1 };
}

export function deliveryProgressView(order: { status: string | null; driver_id: string | null }, progress: DeliveryProgress | null | undefined) {
  if (order.status === 'cancelled') return { label: 'Đơn hàng đã hủy', step: null };
  if (order.status === 'completed') return { label: DELIVERY_STEPS[5], step:
    progress?.assignment_id && progress.driver_id === order.driver_id && progress.order_status === 'completed' && progress.delivery_status === 'delivered' ? 5 : null };
  // Avoid showing a previous driver's stage or a response older than the order snapshot.
  if (progress && progress.driver_id === order.driver_id && progress.order_status === order.status) {
    const status = progress.delivery_status;
    const validStage = (order.status === 'preparing' && ['offered','accepted','at_restaurant'].includes(status ?? ''))
      || (order.status === 'delivering' && ['picked_up','at_customer'].includes(status ?? ''));
    if (validStage && status) return { label: DELIVERY_STEPS[stages[status]], step: stages[status] };
    if (status === 'failed') return { label: 'Chuyến giao cần được hỗ trợ xử lý', step: null };
  }
  if (order.status === 'pending') return { label: 'Chờ quán xác nhận', step: null };
  if (order.status === 'delivering') return { label: 'Đang giao hàng', step: null };
  if (order.status === 'preparing') return { label: order.driver_id ? 'Đang cập nhật tiến trình tài xế' : 'Quán đang chuẩn bị món, chờ phân công tài xế', step: null };
  return { label: 'Đang cập nhật đơn hàng', step: null };
}
