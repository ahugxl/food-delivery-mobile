import { create } from 'zustand';
import type { DeliveryAddress, Voucher } from '../features/order/checkout';
import type { VoucherRow } from '../features/order/purchase';
import { voucherTarget } from '../features/order/purchase';

type OrderState = {
  orders: Order[];
  addOrder: (order: Omit<Order, 'id' | 'date' | 'status'>) => void;
  completeLatestOrder: () => void;
  deliveryAddress: DeliveryAddress;
  deliverySelectionVersion: number;
  appliedVoucher: Voucher | null;
  checkoutVoucher: VoucherRow | null;
  shippingVoucher: VoucherRow | null;
  setCheckoutVouchers: (food: VoucherRow | null, shipping: VoucherRow | null) => void;
  setCheckoutVoucher: (voucher: VoucherRow | null) => void;
  setDeliveryAddress: (address: DeliveryAddress) => void;
  setAppliedVoucher: (voucher: Voucher | null) => void;
};

export type Order = {
  id: string;
  restaurant: string;
  date: string;
  total: string;
  status: 'Pending' | 'Preparing' | 'On the way' | 'Delivered' | 'Cancelled';
  restaurantId?: string;
  image: string;
};

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  addOrder: (order) =>
    set((state) => ({
      orders: [
        {
          ...order,
          id: `FD-${Date.now()}-${state.orders.length + 1}`,
          date: new Date().toLocaleDateString('vi-VN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Ho_Chi_Minh',
          }),
          status: 'On the way',
        },
        ...state.orders,
      ],
    })),
  completeLatestOrder: () =>
    set((state) => {
      const latestActive = state.orders.find(
        (order) => order.status === 'On the way',
      );
      return {
        orders: state.orders.map((order) =>
          order.id === latestActive?.id
            ? { ...order, status: 'Delivered' }
            : order,
        ),
      };
    }),
  deliveryAddress: { street: '', label: 'Home' },
  deliverySelectionVersion: 0,
  checkoutVoucher: null,
  shippingVoucher: null,
  setCheckoutVouchers: (checkoutVoucher, shippingVoucher) => set({ checkoutVoucher, shippingVoucher }),
  setCheckoutVoucher: (voucher) => set(voucher && voucherTarget(voucher) === 'shipping' ? { shippingVoucher: voucher } : { checkoutVoucher: voucher }),
  appliedVoucher: null,
  setDeliveryAddress: (deliveryAddress) => set(state => ({ deliveryAddress, deliverySelectionVersion: state.deliverySelectionVersion + 1 })),
  setAppliedVoucher: (appliedVoucher) => set({ appliedVoucher }),
}));
