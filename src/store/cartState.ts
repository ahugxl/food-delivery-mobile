import { create, type StateCreator } from 'zustand';
import type { DeliveryAddress } from '../features/order/checkout';
import type { VoucherRow } from '../features/order/purchase';
import type { CartItem } from '../types';
import { cartLineId } from '../features/food-detail/selection';

export type CheckoutContext = { address: DeliveryAddress; voucher: VoucherRow | null; shippingVoucher?: VoucherRow | null };
export type CartState = {
  ownerId: string | null;
  setOwner: (ownerId: string | null) => void;
  items: CartItem[];
  isCheckingOut: boolean;
  checkoutRequest: { id: string; signature: string; context?: CheckoutContext } | null;
  addToCart: (item: CartItem) => string | null;
  incrementQuantity: (lineId: string) => void;
  removeFromCart: (lineId: string) => void;
  setNote: (lineId: string, note: string) => string | null;
  prepareCheckout: (signature: string, requestId: string, context?: CheckoutContext) => string;
  setCheckingOut: (value: boolean) => void;
  clearCart: () => void;
};

export const cartState: StateCreator<CartState> = (set, get) => ({
  ownerId: null,
  setOwner: (ownerId) => {
    if (get().ownerId === ownerId) return;
    set({ ownerId, items: [], isCheckingOut: false, checkoutRequest: null });
  },
  items: [], isCheckingOut: false, checkoutRequest: null,
  addToCart: (item) => {
    const state = get();
    if (state.isCheckingOut) return 'Đang gửi đơn hàng. Vui lòng chờ.';
    if (state.items.some(line => line.restaurantId !== item.restaurantId)) return 'Giỏ hàng có món từ quán khác. Vui lòng xóa giỏ trước khi thêm món này.';
    if (!Number.isFinite(item.basePrice) || item.basePrice < 0 || item.note.length > 500 || item.options.some(option => !Number.isFinite(option.price))) return 'Giá món hoặc ghi chú không hợp lệ.';
    const lineId = cartLineId(item.foodId, item.options, item.note);
    const existing = state.items.find(line => line.lineId === lineId);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity + (existing?.quantity ?? 0) > 99) return 'Mỗi món có số lượng từ 1 đến 99.';
    if (!existing && state.items.length >= 100) return 'Giỏ hàng tối đa 100 dòng món.';
    const copy = { ...item, lineId, unitPrice: Math.round((item.basePrice + item.options.reduce((sum, option) => sum + option.price, 0)) * 100) / 100, note: item.note.trim(), options: item.options.map(option => ({ ...option })) };
    set({ items: existing ? state.items.map(line => line.lineId === lineId ? { ...copy, quantity: line.quantity + item.quantity } : line) : [...state.items, copy] });
    return null;
  },
  incrementQuantity: (lineId) => {
    if (get().isCheckingOut) return;
    set(state => ({ items: state.items.map(item => item.lineId === lineId ? { ...item, quantity: Math.min(99, item.quantity + 1) } : item) }));
  },
  removeFromCart: (lineId) => {
    if (get().isCheckingOut) return;
    set(state => ({ items: state.items.flatMap(item => item.lineId !== lineId ? [item] : item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : []) }));
  },
  setNote: (lineId, note) => {
    const state = get();
    if (state.isCheckingOut) return 'Đang gửi đơn hàng. Vui lòng chờ.';
    const item = state.items.find(line => line.lineId === lineId);
    if (!item) return null;
    const next = { ...item, note: note.slice(0, 500).trim() };
    next.lineId = cartLineId(next.foodId, next.options, next.note);
    const other = state.items.find(line => line.lineId !== lineId && line.lineId === next.lineId);
    // Reject a note edit that would merge beyond the per-line quantity limit.
    if (other && other.quantity + next.quantity > 99) return 'Ghi chú này sẽ gộp quá 99 phần. Vui lòng giảm số lượng trước.';
    set({ items: state.items.flatMap(line => line.lineId === lineId ? (other ? [] : [next]) : line.lineId === other?.lineId ? [{ ...line, quantity: line.quantity + next.quantity }] : [line]) });
    return null;
  },
  prepareCheckout: (signature, requestId, context) => {
    const previous = get().checkoutRequest;
    if (previous?.signature === signature) return previous.id;
    set({ checkoutRequest: { id: requestId, signature, context } });
    return requestId;
  },
  setCheckingOut: (value) => set({ isCheckingOut: value }),
  clearCart: () => set({ items: [], checkoutRequest: null, isCheckingOut: false }),
});

export const createCartStore = () => create<CartState>()(cartState);
