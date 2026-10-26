import type { CartItem } from '../../types';
import type { Database, Json } from '../../types/database.types';
import type { Coordinates } from '../location/coordinates';

export type VoucherRow = Database['public']['Tables']['vouchers']['Row'];
export type OrderRow = Database['public']['Tables']['orders']['Row'];
export const cents = (value: number) => Math.round(value * 100);
export const cartSubtotal = (items: CartItem[]) => items.reduce((sum, item) => sum + cents(item.unitPrice) * item.quantity, 0) / 100;

export function voucherError(voucher: VoucherRow, subtotal: number, restaurantId: string, now = Date.now()): string | null {
  if (!voucher.is_active) return 'This voucher is inactive.';
  if (voucher.expiry_date && (!Number.isFinite(Date.parse(voucher.expiry_date)) || Date.parse(voucher.expiry_date) <= now)) return 'This voucher has expired.';
  if (voucher.restaurant_id && voucher.restaurant_id !== restaurantId) return 'This voucher belongs to another restaurant.';
  if (cents(subtotal) <= 0 || cents(subtotal) < cents(Number(voucher.min_order_value ?? 0))) return `Minimum food subtotal: $${Number(voucher.min_order_value ?? 0).toFixed(2)}.`;
  if (!['percentage', 'fixed'].includes(voucher.discount_type)) return 'Unsupported voucher type.';
  const amount = Number(voucher.discount_value);
  if (!Number.isFinite(amount) || amount < 0 || (voucher.discount_type === 'percentage' && amount > 100)) return 'Invalid voucher discount.';
  return null;
}

export function purchaseTotals(items: CartItem[], voucher: VoucherRow | null, now = Date.now()) {
  const subtotal = cartSubtotal(items);
  const deliveryFee = items.length > 0 ? 2 : 0;
  const error = voucher ? voucherError(voucher, subtotal, items[0]?.restaurantId ?? '', now) : null;
  const discountCents = !voucher || error ? 0 : Math.min(cents(subtotal), voucher.discount_type === 'percentage'
    ? Math.round(cents(subtotal) * Number(voucher.discount_value) / 100) : cents(Number(voucher.discount_value)));
  return { subtotal, deliveryFee, discount: discountCents / 100, total: (cents(subtotal) + cents(deliveryFee) - discountCents) / 100, voucherError: error };
}

export function validatePurchase(items: CartItem[], address: string) {
  if (!items.length || items.length > 100) throw new Error('Your cart must contain 1 to 100 items.');
  if (address.trim().length < 5 || address.length > 500) throw new Error('Enter a delivery address between 5 and 500 characters.');
  for (const item of items) {
    if (item.restaurantId !== items[0].restaurantId) throw new Error('Each order must belong to one restaurant.');
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new Error('Quantity must be from 1 to 99.');
    if (item.note.length > 500) throw new Error('Notes must be at most 500 characters.');
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) throw new Error('Invalid item price.');
  }
}

export function serializeCart(items: CartItem[]): Json {
  return items.map(item => ({
    foodId: item.foodId, quantity: item.quantity, basePrice: item.basePrice, unitPrice: item.unitPrice,
    note: item.note.trim(), options: item.options.map(option => ({ ...option })),
  }));
}

export function purchaseSignature(items: CartItem[], address: string, code?: string, coordinates?: Coordinates) {
  return JSON.stringify({ items: serializeCart(items), address: address.trim(), code: code?.trim().toUpperCase() || null, ...(coordinates ? { coordinates } : {}) });
}
