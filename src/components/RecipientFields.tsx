import { Text, TextInput, View } from 'react-native';
import type { Recipient } from '../features/order/recipient';

export function RecipientFields({ value, onChange, disabled }: { value: Recipient; onChange: (value: Recipient) => void; disabled?: boolean }) {
  return <View className="gap-3">
    <Text className="font-bold text-base text-ink">Thông tin người nhận</Text>
    <View style={{ gap: 6 }}>
      <Text className="font-medium text-sm text-ink">Họ và tên người nhận</Text>
      <TextInput accessibilityLabel="Tên người nhận" placeholder="Nhập họ và tên người nhận" placeholderTextColor="#727772" value={value.recipientName ?? ''} onChangeText={recipientName => onChange({ recipientName })} editable={!disabled} maxLength={100} autoComplete="off" importantForAutofill="no" style={{ color: '#17241B', minHeight: 52, textAlignVertical: 'center' }} className="rounded-2xl border border-line bg-card px-4 py-3 text-base" />
    </View>
    <View style={{ gap: 6 }}>
      <Text className="font-medium text-sm text-ink">Số điện thoại người nhận</Text>
      <TextInput accessibilityLabel="Số điện thoại người nhận" placeholder="Nhập số điện thoại, ví dụ 0901234567" placeholderTextColor="#727772" value={value.recipientPhone ?? ''} onChangeText={recipientPhone => onChange({ recipientPhone })} editable={!disabled} maxLength={25} keyboardType="phone-pad" autoComplete="off" importantForAutofill="no" style={{ color: '#17241B', minHeight: 52, textAlignVertical: 'center' }} className="rounded-2xl border border-line bg-card px-4 py-3 text-base" />
    </View>
  </View>;
}
