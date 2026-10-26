import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { FlowButton, FlowHeader } from '../components/FlowUI';
import { LocationEditor } from '../components/LocationEditor';
import { useSavedAddresses } from '../hooks/useSavedAddresses';
import { useAddressActions } from '../hooks/useAddressActions';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { deliveryFromSaved, type SavedAddress } from '../features/account/validation';
import { userMessage } from '../utils/userMessage';
export default function AddressFormScreen() {
    const { id } = useLocalSearchParams<{
        id?: string;
    }>();
    const query = useSavedAddresses();
    const row = query.data?.find(item => item.id === id);
    return <SafeAreaView className="flex-1 bg-cream"><FlowHeader title={id ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}/>
    {query.isPending ? <Text className="p-5 text-muted">Đang tải sổ địa chỉ…</Text> : query.isError && !query.data ? <View className="gap-4 p-5"><Text className="text-muted">Không tải được sổ địa chỉ.</Text><FlowButton title="Thử lại" onPress={() => { void query.refetch(); }}/></View> : id && !row ? <Text className="p-5 text-muted">Địa chỉ không còn tồn tại. Vui lòng quay lại sổ địa chỉ.</Text> : <AddressForm key={id ?? 'new'} row={row}/>}
  </SafeAreaView>;
}
function AddressForm({ row }: {
    row?: SavedAddress;
}) {
    const [newId] = useState(() => randomUUID());
    const [isDefault, setDefault] = useState(!!row?.is_default);
    const mutation = useAddressActions();
    const locked = useCartStore(state => state.isCheckingOut);
    const userId = useAuthStore(state => state.user?.id);
    const initial = row ? (deliveryFromSaved(row) ?? { street: row.address, label: row.title === 'Home' || row.title === 'Work' ? row.title : 'Other' as const }) : { street: '', label: 'Home' as const };
    return <LocationEditor initial={initial} disabled={locked || mutation.isPending} title={mutation.isPending ? 'Đang lưu…' : 'Lưu địa chỉ'} onSubmit={async (address) => {
            if (mutation.isPending)
                return;
            try {
                await mutation.mutateAsync({ kind: 'save', id: row?.id ?? newId, address, isDefault, create: !row });
                if (useAuthStore.getState().user?.id !== userId)
                    return;
                Toast.show({ type: 'success', text1: 'Đã lưu địa chỉ' });
                router.canGoBack() ? router.back() : router.replace('/addresses');
            }
            catch (error) {
                Toast.show({ type: 'error', text1: 'Chưa lưu được địa chỉ', text2: userMessage(error) });
            }
        }}>
    <View className="flex-row items-center justify-between gap-3 rounded-2xl bg-tealLight p-4"><View className="flex-1"><Text className="font-semibold text-sm text-ink">Đặt làm địa chỉ mặc định</Text><Text className="mt-1 text-xs text-muted">{row?.is_default ? 'Để đổi mặc định, hãy chọn một địa chỉ khác trong sổ.' : 'Địa chỉ đầu tiên tự động được đặt làm mặc định.'}</Text></View><Switch accessibilityLabel="Đặt làm địa chỉ mặc định" value={isDefault} onValueChange={setDefault} disabled={!!row?.is_default || mutation.isPending || locked} trackColor={{ true: '#008B45' }}/></View>
    {mutation.isError && <Text accessibilityRole="alert" className="text-sm text-coral">{userMessage(mutation.error)}</Text>}
  </LocationEditor>;
}
