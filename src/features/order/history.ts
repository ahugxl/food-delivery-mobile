export type OrderSection = 'active' | 'history';
function vietnamDateParts(value: string | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Object.fromEntries(new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]));
}

export function orderHistoryTime(value: string) {
  const parts = vietnamDateParts(value);
  return parts ? `${parts.hour}:${parts.minute}, ${parts.day} thg ${Number(parts.month)} ${parts.year}` : 'Chưa có thời gian';
}

export function orderHistoryMonths<T extends { id: string; created_at: string }>(orders: T[], now = new Date()) {
  const current = vietnamDateParts(now);
  const groups = new Map<string, { key: string; title: string; data: T[] }>();
  for (const order of [...orders].sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0) || a.id.localeCompare(b.id))) {
    const parts = vietnamDateParts(order.created_at);
    const key = parts ? `${parts.year}-${parts.month}` : 'unknown';
    const title = !parts ? 'Đơn hàng khác' : parts.year === current?.year && parts.month === current.month
      ? 'Tháng này' : `Tháng ${Number(parts.month)}, ${parts.year}`;
    if (!groups.has(key)) groups.set(key, { key, title, data: [] });
    groups.get(key)!.data.push(order);
  }
  return [...groups.values()];
}
export const ORDER_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận', preparing: 'Đang chuẩn bị', delivering: 'Đang đến', completed: 'Đã hoàn thành', cancelled: 'Đã hủy',
};
export function orderSection(status: string): OrderSection {
  // Keep preparing and unrecognized non-terminal states visible rather than hiding orders.
  return status === 'completed' || status === 'cancelled' ? 'history' : 'active';
}
