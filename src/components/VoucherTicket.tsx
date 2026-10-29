import { useState } from 'react';
import { Text, View } from 'react-native';
import { AppPressable } from './AppPressable';
import { currency } from '../features/order/checkout';
import type { Voucher } from '../services/voucherApi';
import { voucherTarget } from '../features/order/purchase';

export function VoucherTicket({ voucher, reason, action, disabled, selected, onPress }: {
  voucher: Voucher; reason?: string | null; action: string; disabled?: boolean; selected?: boolean; onPress: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shipping = voucherTarget(voucher) === 'shipping';
  const amount = voucher.discount_type === 'percentage' ? `${voucher.discount_value}%` : currency(voucher.discount_value);
  return <View style={{ borderWidth: 1, borderColor: selected ? '#008B45' : '#E5E7EB', borderRadius: 18, backgroundColor: 'white', marginBottom: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text className="font-bold text-base text-ink">Giảm {amount} {shipping ? 'phí giao hàng' : 'tiền món'}</Text>
        <Text className="text-xs text-muted">Đơn từ {currency(voucher.min_order_value)}</Text>
        <AppPressable accessibilityRole="button" accessibilityLabel={`Điều kiện mã ${voucher.code}`} accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 28, justifyContent: 'center' }}>
          <Text className="text-xs text-teal">{voucher.code} · {expanded ? 'Thu gọn' : 'Điều kiện ›'}</Text>
        </AppPressable>
      </View>
      <AppPressable accessibilityRole="button" accessibilityLabel={`${action} ${voucher.code}`} accessibilityState={{ disabled: !!disabled, selected: !!selected }} disabled={disabled} onPress={onPress}
        style={{ width: 88, flexShrink: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 24, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: disabled ? '#ECEEEC' : selected ? '#005E30' : '#008B45' }}>
        <Text style={{ color: disabled ? '#727872' : 'white', fontWeight: '600', fontSize: 13, textAlign: 'center' }}>{action}</Text>
      </AppPressable>
    </View>
    {!!reason && <Text style={{ marginTop: 6 }} className="text-xs text-coral">{reason}</Text>}
    {expanded && <View style={{ borderTopWidth: 1, borderTopColor: '#F0F1F0', paddingTop: 10, marginTop: 8, gap: 5 }}>
      <Text className="text-xs text-muted">{voucher.restaurant_id ? 'Áp dụng tại quán chọn lọc' : 'Áp dụng mọi nhà hàng'} · Tối đa bằng {shipping ? 'phí giao hàng' : 'tiền món'}</Text>
      <Text className="text-xs text-muted">{voucher.expiry_date ? `Hạn dùng: ${new Date(voucher.expiry_date).toLocaleDateString('vi-VN')}` : 'Không giới hạn ngày'}</Text>
    </View>}
  </View>;
}
