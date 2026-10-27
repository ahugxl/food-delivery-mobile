export type Recipient = { recipientName?: string; recipientPhone?: string };

export function recipientInput(value: Recipient) {
  const name = (value.recipientName ?? '').trim();
  const phone = (value.recipientPhone ?? '').trim().replace(/[\s().-]/g, '');
  if (name.length < 2 || name.length > 100) throw new Error('Tên người nhận cần từ 2 đến 100 ký tự.');
  if (!/^\+?\d{9,15}$/.test(phone)) throw new Error('Số điện thoại người nhận cần từ 9 đến 15 chữ số.');
  return { recipientName: name, recipientPhone: phone };
}

export function hasRecipient(value: Recipient) {
  try { recipientInput(value); return true; } catch { return false; }
}
