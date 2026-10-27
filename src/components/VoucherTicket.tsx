import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppPressable } from './AppPressable';
import { currency } from '../features/order/checkout';
import type { Voucher } from '../services/voucherApi';
import { voucherTarget } from '../features/order/purchase';

export function VoucherTicket({ voucher, reason, action, disabled, selected, onPress }: {
  voucher: Voucher; reason?: string | null; action: string; disabled?: boolean; selected?: boolean; onPress: () => void;
}) {
  return <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: selected ? '#008B45' : '#E5E7EB', borderRadius: 18, overflow: 'hidden', backgroundColor: 'white', marginBottom: 14 }}>
    <View style={{ width: 80, backgroundColor: reason ? '#F7CFC3' : '#F4512B', alignItems: 'center', justifyContent: 'center', padding: 10, gap: 8 }}>
      <Ionicons name={voucherTarget(voucher) === 'shipping' ? 'bicycle-outline' : 'restaurant-outline'} size={32} color="white" /><Text style={{ color: 'white', fontSize: 11, textAlign: 'center' }}>{voucherTarget(voucher) === 'shipping' ? 'Giảm phí giao hàng' : 'Giảm tiền món'}</Text>
    </View>
    <View style={{ flex: 1, padding: 14, gap: 7 }}>
      <Text className="font-bold text-base text-ink">{voucher.discount_type === 'percentage' ? `Giảm ${voucher.discount_value}%` : `Giảm ${currency(voucher.discount_value)}`}</Text>
      <Text selectable className="font-semibold text-sm text-ink">{voucher.code}</Text>
      <Text className="text-xs text-muted">Đơn từ {currency(voucher.min_order_value)}</Text>
      <Text className="text-xs text-muted">{voucher.restaurant_id ? 'Áp dụng tại quán chọn lọc' : 'Áp dụng mọi nhà hàng'} · Tối đa bằng {voucherTarget(voucher) === 'shipping' ? 'phí giao hàng' : 'tiền món'}</Text>
      <Text className="text-xs text-muted">{voucher.expiry_date ? `Hạn dùng: ${new Date(voucher.expiry_date).toLocaleDateString('vi-VN')}` : 'Không giới hạn ngày'}</Text>
      {!!reason && <Text className="text-xs text-coral">{reason}</Text>}
      <AppPressable accessibilityRole="button" accessibilityLabel={`${action} ${voucher.code}`} accessibilityState={{ disabled: !!disabled, selected: !!selected }} disabled={disabled} onPress={onPress}
        style={{ alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center', borderRadius: 20, paddingHorizontal: 16, backgroundColor: disabled ? '#ECEEEC' : selected ? '#005E30' : '#008B45' }}>
        <Text style={{ color: disabled ? '#727872' : 'white', fontWeight: '600', fontSize: 13 }}>{action}</Text>
      </AppPressable>
    </View>
  </View>;
}
