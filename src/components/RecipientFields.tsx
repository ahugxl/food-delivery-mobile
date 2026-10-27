import { Text, TextInput, View } from 'react-native';
import type { Recipient } from '../features/order/recipient';

export function RecipientFields({ value, onChange, disabled }: { value: Recipient; onChange: (value: Recipient) => void; disabled?: boolean }) {
  return <View className="gap-3">
    <Text className="font-bold text-base text-ink">Thông tin người nhận</Text>
    <TextInput accessibilityLabel="Tên người nhận" placeholder="Họ và tên người nhận" value={value.recipientName ?? ''} onChangeText={recipientName => onChange({ ...value, recipientName })} editable={!disabled} maxLength={100} autoComplete="off" importantForAutofill="no" className="min-h-12 rounded-2xl border border-line bg-card px-4 py-3 text-base text-ink" />
    <TextInput accessibilityLabel="Số điện thoại người nhận" placeholder="Số điện thoại người nhận" value={value.recipientPhone ?? ''} onChangeText={recipientPhone => onChange({ ...value, recipientPhone })} editable={!disabled} maxLength={25} keyboardType="phone-pad" autoComplete="off" importantForAutofill="no" className="min-h-12 rounded-2xl border border-line bg-card px-4 py-3 text-base text-ink" />
  </View>;
}
