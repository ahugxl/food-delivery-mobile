import { create } from 'zustand';
import type { DeliveryAddress, Voucher } from '../features/order/checkout';
import type { VoucherRow } from '../features/order/purchase';

type OrderState = {
  orders: Order[];
  addOrder: (order: Omit<Order, 'id' | 'date' | 'status'>) => void;
  completeLatestOrder: () => void;
  deliveryAddress: DeliveryAddress;
  appliedVoucher: Voucher | null;
  checkoutVoucher: VoucherRow | null;
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
          date: new Date().toLocaleDateString('en-US', {
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
  checkoutVoucher: null,
  setCheckoutVoucher: (checkoutVoucher) => set({ checkoutVoucher }),
  appliedVoucher: null,
  setDeliveryAddress: (deliveryAddress) => set({ deliveryAddress }),
  setAppliedVoucher: (appliedVoucher) => set({ appliedVoucher }),
}));
