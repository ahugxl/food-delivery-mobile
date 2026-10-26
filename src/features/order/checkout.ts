export type DeliveryAddress = {
  street: string;
  label: 'Home' | 'Work' | 'Other';
  latitude?: number;
  longitude?: number;
};
export type Voucher = {
  id: string;
  title: string;
  description: string;
  kind: 'percentage' | 'shipping';
  value: number;
  minimumSubtotal?: number;
};

export const vouchers: Voucher[] = [
  {
    id: 'meal10',
    title: '-10%',
    description: '10% off your food subtotal',
    kind: 'percentage',
    value: 10,
  },
  {
    id: 'ship1',
    title: '-$1 shipping fee',
    description: 'Save $1 on delivery',
    kind: 'shipping',
    value: 1,
  },
  {
    id: 'meal30',
    title: '-30% for bill over $50',
    description: '30% off food when your subtotal is over $50',
    kind: 'percentage',
    value: 30,
    minimumSubtotal: 50,
  },
  {
    id: 'freeship',
    title: 'Freeship',
    description: 'Your delivery fee is on us',
    kind: 'shipping',
    value: 2,
  },
];

// Keep the backend's existing USD amounts; localize number formatting without conversion.
export const currency = (amount: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD' }).format(amount === 0 ? 0 : amount);
export const isVoucherEligible = (voucher: Voucher, subtotal: number) =>
  Math.round(subtotal * 100) > 0 &&
  (voucher.minimumSubtotal === undefined ||
    Math.round(subtotal * 100) > Math.round(voucher.minimumSubtotal * 100));

export function calculateTotals(subtotal: number, voucher: Voucher | null) {
  // Work in cents so the displayed breakdown adds up exactly.
  const subtotalCents = Math.max(0, Math.round(subtotal * 100));
  const deliveryCents = subtotalCents > 0 ? 200 : 0;
  const voucherEligible =
    voucher !== null && isVoucherEligible(voucher, subtotalCents / 100);
  const discountCents = !voucherEligible
    ? 0
    : voucher.kind === 'percentage'
      ? Math.min(
          subtotalCents,
          Math.round((subtotalCents * voucher.value) / 100),
        )
      : Math.min(deliveryCents, Math.round(voucher.value * 100));
  return {
    subtotal: subtotalCents / 100,
    deliveryFee: deliveryCents / 100,
    discount: discountCents / 100,
    total: (subtotalCents + deliveryCents - discountCents) / 100,
    voucherEligible,
  };
}
