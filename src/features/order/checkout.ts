export type DeliveryAddress = {
  recipientName?: string;
  recipientPhone?: string;
  savedAddressId?: string;
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
    description: 'Giảm 10% giá trị món ăn',
    kind: 'percentage',
    value: 10,
  },
  {
    id: 'ship1',
    title: 'Giảm 1 ₫ phí giao hàng',
    description: 'Tiết kiệm 1 ₫ phí giao hàng',
    kind: 'shipping',
    value: 1,
  },
  {
    id: 'meal30',
    title: 'Giảm 30% cho đơn trên 50 ₫',
    description: 'Giảm 30% giá trị món ăn khi tạm tính trên 50 ₫',
    kind: 'percentage',
    value: 30,
    minimumSubtotal: 50,
  },
  {
    id: 'freeship',
    title: 'Miễn phí giao hàng',
    description: 'Bạn được miễn phí giao hàng',
    kind: 'shipping',
    value: 2,
  },
];

// Display existing numeric amounts in VND without applying an exchange rate.
const moneyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
export const currency = (amount: number) => moneyFormatter.format(amount === 0 ? 0 : amount);

export function localizeCurrencyText(value: string) {
  return value
    .replace(/(?:US\$|\$)\s*(\d[\d,]*(?:\.\d+)?)/gi, (_, amount: string) => currency(Number(amount.replace(/,/g, ''))))
    .replace(/(\d[\d,]*(?:\.\d+)?)\s*(?:USD\b|US\$)/gi, (_, amount: string) => currency(Number(amount.replace(/,/g, ''))));
}
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
