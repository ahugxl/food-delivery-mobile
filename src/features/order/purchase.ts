import type { CartItem } from '../../types';
import type { Database, Json } from '../../types/database.types';
import type { Coordinates } from '../location/coordinates';
import { currency } from './checkout';
import { BASE_DELIVERY_FEE } from '../../utils/distance';
import { recipientInput, type Recipient } from './recipient';

export type VoucherRow = Database['public']['Tables']['vouchers']['Row'];
export type OrderRow = Database['public']['Tables']['orders']['Row'];
export type VoucherTarget = 'food' | 'shipping';
export const voucherTarget = (voucher: VoucherRow): VoucherTarget => voucher.applies_to ?? 'food';
export const cents = (value: number) => Math.round(value * 100);
export const cartSubtotal = (items: CartItem[]) => items.reduce((sum, item) => sum + cents(item.unitPrice) * item.quantity, 0) / 100;

export function voucherError(voucher: VoucherRow, subtotal: number, restaurantId: string, now = Date.now(), expectedTarget?: VoucherTarget): string | null {
  if (!['food', 'shipping'].includes(voucherTarget(voucher))) return 'Phạm vi áp dụng mã không hợp lệ.';
  if (expectedTarget && voucherTarget(voucher) !== expectedTarget) return expectedTarget === 'food' ? 'Vui lòng chọn voucher giảm tiền món.' : 'Vui lòng chọn voucher giảm phí giao hàng.';
  if (!voucher.is_active) return 'Mã ưu đãi đã ngừng hoạt động.';
  if (voucher.expiry_date && (!Number.isFinite(Date.parse(voucher.expiry_date)) || Date.parse(voucher.expiry_date) <= now)) return 'Mã ưu đãi đã hết hạn.';
  if (voucher.restaurant_id && voucher.restaurant_id !== restaurantId) return 'Mã ưu đãi chỉ áp dụng tại quán khác.';
  if (cents(subtotal) <= 0 || cents(subtotal) < cents(Number(voucher.min_order_value ?? 0))) return `Giá trị món tối thiểu: ${currency(Number(voucher.min_order_value ?? 0))}.`;
  if (!['percentage', 'fixed'].includes(voucher.discount_type)) return 'Loại mã ưu đãi chưa được hỗ trợ.';
  const amount = Number(voucher.discount_value);
  if (!Number.isFinite(amount) || amount < 0 || (voucher.discount_type === 'percentage' && amount > 100)) return 'Giá trị giảm giá không hợp lệ.';
  return null;
}

export function purchaseTotals(items: CartItem[], voucher: VoucherRow | null, now = Date.now(), shippingFee = BASE_DELIVERY_FEE, shippingVoucher: VoucherRow | null = null) {
  const subtotal = cartSubtotal(items);
  if (!Number.isFinite(shippingFee) || shippingFee < 0 || !Number.isInteger(shippingFee)) throw new Error('Phí giao hàng phải là số nguyên VND không âm.');
  const deliveryFee = items.length > 0 ? shippingFee : 0;
  const foodError = voucher ? voucherError(voucher, subtotal, items[0]?.restaurantId ?? '', now, 'food') : null;
  const shippingError = shippingVoucher ? voucherError(shippingVoucher, subtotal, items[0]?.restaurantId ?? '', now, 'shipping') : null;
  const discountFor = (value: VoucherRow | null, base: number, error: string | null) => !value || error ? 0 : Math.min(cents(base), value.discount_type === 'percentage'
    ? Math.round(cents(base) * Number(value.discount_value) / 100) : cents(Number(value.discount_value)));
  const foodDiscount = discountFor(voucher, subtotal, foodError);
  const shippingDiscount = discountFor(shippingVoucher, deliveryFee, shippingError);
  return { subtotal, deliveryFee, foodDiscount: foodDiscount / 100, shippingDiscount: shippingDiscount / 100, discount: (foodDiscount + shippingDiscount) / 100, total: (cents(subtotal) + cents(deliveryFee) - foodDiscount - shippingDiscount) / 100, foodError, shippingError, voucherError: foodError || shippingError };
}

export function validatePurchase(items: CartItem[], address: string) {
  if (!items.length || items.length > 100) throw new Error('Giỏ hàng cần có từ 1 đến 100 dòng món.');
  if (address.trim().length < 5 || address.length > 500) throw new Error('Địa chỉ giao hàng cần từ 5 đến 500 ký tự.');
  for (const item of items) {
    if (item.restaurantId !== items[0].restaurantId) throw new Error('Mỗi đơn hàng chỉ được đặt từ một quán.');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('Số lượng phải từ 1 đến 99.');
    if (item.note.length > 500) throw new Error('Ghi chú tối đa 500 ký tự.');
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) throw new Error('Giá món không hợp lệ.');
  }
}

export function serializeCart(items: CartItem[]): Json {
  return items.map(item => ({
    foodId: item.foodId, quantity: item.quantity, basePrice: item.basePrice, unitPrice: item.unitPrice,
    note: item.note.trim(), options: item.options.map(option => ({ ...option })),
  }));
}

export function purchaseSignature(items: CartItem[], address: string, code?: string, coordinates?: Coordinates, recipient?: Recipient, shippingCode?: string) {
  return JSON.stringify({ items: serializeCart(items), address: address.trim(), code: code?.trim().toUpperCase() || null, ...(coordinates ? { coordinates } : {}), ...(recipient ? recipientInput(recipient) : {}), ...(shippingCode ? { shippingCode: shippingCode.trim().toUpperCase() } : {}) });
}
