import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { z } from 'zod';
import { cartState, type CartState } from './cartState';

const optionSchema = z.object({
  id: z.string(), groupId: z.string(), groupName: z.string(), label: z.string(), price: z.number().finite(),
});
const itemSchema = z.object({
  id: z.string(), foodId: z.string(), lineId: z.string(), name: z.string(), image: z.string(),
  restaurantId: z.string(), restaurantName: z.string(),
  basePrice: z.number().finite().nonnegative(), price: z.number().finite().nonnegative(),
  unitPrice: z.number().finite().nonnegative(), quantity: z.number().int().min(1).max(99),
  options: z.array(optionSchema).max(100), note: z.string().max(500),
});
const voucherSchema = z.object({
  id: z.string(), restaurant_id: z.string().nullable(), code: z.string(), discount_type: z.string(),
  discount_value: z.number().finite(), min_order_value: z.number().finite(),
  expiry_date: z.string().nullable(), is_active: z.boolean(),
});
const savedSchema = z.object({
  ownerId: z.string().min(1).nullable(),
  items: z.array(itemSchema).max(100),
  checkoutRequest: z.object({
    id: z.string(), signature: z.string(),
    context: z.object({
      address: z.object({ recipientName: z.string().max(100).optional(), recipientPhone: z.string().max(25).optional(), savedAddressId: z.string().optional(), street: z.string().min(5).max(500), label: z.enum(['Home', 'Work', 'Other']), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional() }),
      voucher: voucherSchema.nullable(),
    }).optional(),
  }).nullable(),
});
type SavedCart = z.infer<typeof savedSchema>;
export const CART_STORAGE_KEY = 'food-delivery-cart';

export function createPersistedCartStore(storage: StateStorage) {
  // Serialize disk writes so a slow earlier save cannot restore an already-cleared cart.
  let writes = Promise.resolve();
  const queue = (action: () => unknown | Promise<unknown>) => {
    writes = writes.then(action).then(() => {}, () => { console.warn('Không lưu được giỏ hàng trên thiết bị.'); });
    return writes;
  };
  const orderedStorage: StateStorage = {
    getItem: async name => { await writes; return storage.getItem(name); },
    setItem: (name, value) => queue(() => storage.setItem(name, value)),
    removeItem: name => queue(() => storage.removeItem(name)),
  };
  return create<CartState>()(persist(cartState, {
    name: CART_STORAGE_KEY,
    storage: createJSONStorage<SavedCart>(() => orderedStorage),
    version: 1,
    skipHydration: true,
    partialize: state => ({ ownerId: state.ownerId, items: state.items, checkoutRequest: state.checkoutRequest }),
    merge: (saved, current) => {
      const result = savedSchema.safeParse(saved);
      if (!result.success || !result.data.ownerId || result.data.items.some(item => item.restaurantId !== result.data.items[0]?.restaurantId)) return current;
      return { ...current, ...result.data, isCheckingOut: false };
    },
    migrate: () => ({ ownerId: null, items: [], checkoutRequest: null }),
    onRehydrateStorage: () => (_state, error) => {
      if (error) console.warn('Không khôi phục được giỏ đã lưu. Đang mở giỏ trống.');
    },
  }));
}
