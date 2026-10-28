import { useState } from 'react';
import { CurrentLocationCard } from './CurrentLocationCard';
import { useLocationStore } from '../store/locationStore';
import { FlatList, Modal, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';
import { FlowButton, FlowHeader } from '../components/FlowUI';
import { AppPressable } from '../components/AppPressable';
import { useSavedAddresses } from '../hooks/useSavedAddresses';
import { useAddressActions } from '../hooks/useAddressActions';
import { useOrderStore } from '../store/orderStore';
import { useCartStore } from '../store/cartStore';
import { deliveryFromSaved, type SavedAddress } from '../features/account/validation';
import { viLabel } from '../utils/vietnamese';
import { userMessage } from '../utils/userMessage';
import { hasRecipient } from '../features/order/recipient';
import { normalizeSearch } from '../features/search/normalizeSearch';
export default function AddressBookScreen({ selectionMode = false }: { selectionMode?: boolean }) {
    const query = useSavedAddresses();
    const mutation = useAddressActions();
    const locked = useCartStore(state => state.isCheckingOut);
    const [toDelete, setDelete] = useState<SavedAddress | null>(null);
    const [search, setSearch] = useState('');
    const current = useOrderStore(state => state.deliveryAddress);
    const detected = useLocationStore(state => state.detected);
    const selected = useOrderStore(state => state.deliveryAddress.savedAddressId);
    const busy = locked || mutation.isPending;
    const choose = (row: SavedAddress) => {
        const delivery = deliveryFromSaved(row);
        if (!delivery || useCartStore.getState().isCheckingOut)
            return;
        useOrderStore.getState().setDeliveryAddress(delivery);
        if (selectionMode)
            router.canGoBack() ? router.back() : router.replace('/checkout');
        else
            Toast.show({ type: 'success', text1: 'Đã chọn địa chỉ giao hàng' });
    };
    const remove = async () => {
        if (!toDelete || busy)
            return;
        try {
            await mutation.mutateAsync({ kind: 'delete', id: toDelete.id });
            setDelete(null);
            Toast.show({ type: 'success', text1: 'Đã xóa địa chỉ' });
        }
        catch (error) {
            Toast.show({ type: 'error', text1: 'Chưa xóa được địa chỉ', text2: userMessage(error) });
        }
    };
    const term = normalizeSearch(search);
    const rows = [...(query.data ?? [])].sort((a, b) => Number(b.id === selected) - Number(a.id === selected)).filter(row => normalizeSearch([row.address, viLabel(row.title), row.recipient_name, row.recipient_phone].filter(Boolean).join(' ')).includes(term));
    return <SafeAreaView className="flex-1 bg-cream"><View className="flex-row items-center"><View className="flex-1"><FlowHeader title="Địa chỉ giao hàng"/></View><AppPressable accessibilityRole="button" accessibilityLabel="Chọn vị trí trên bản đồ" disabled={busy} onPress={() => router.push('/delivery-location')} className="mr-5 h-11 w-11 items-center justify-center"><Ionicons name="map-outline" size={26} color="#008B45"/></AppPressable></View>
    <View className="px-5 pb-4"><View className="flex-row items-center gap-3 rounded-2xl bg-white px-4"><Ionicons name="search-outline" size={22} color="#827A71"/><TextInput accessibilityLabel="Tìm địa chỉ đã lưu" placeholder="Tìm địa chỉ, tên hoặc số điện thoại" value={search} onChangeText={setSearch} className="min-h-12 flex-1 text-base text-ink"/></View></View>
    {query.isPending ? <View className="flex-1"><Text className="p-5 text-muted">Đang tải địa chỉ…</Text></View> : query.isError ? <View className="flex-1 gap-4 p-5"><Text className="text-muted">Không tải được sổ địa chỉ.</Text><FlowButton title="Thử lại" onPress={() => { void query.refetch(); }}/></View> : <FlatList style={{ flex: 1 }} data={rows} keyExtractor={row => row.id} keyboardShouldPersistTaps="handled" refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16 }} ListHeaderComponent={<View className="gap-4 pb-4"><CurrentLocationCard selectionMode={selectionMode}/>{!selected && !!current.street && current.street !== detected?.street && <View className="gap-3 rounded-3xl border border-line bg-card p-5"><Text className="font-bold text-base text-ink">Điểm giao đang chọn</Text><Text className="text-sm text-ink">{current.street}</Text><Text className="text-sm text-muted">{[current.recipientName, current.recipientPhone].filter(Boolean).join(' · ')}</Text><AppPressable accessibilityRole="button" disabled={busy} onPress={() => router.push('/delivery-location')} className="min-h-11 justify-center"><Text className="font-semibold text-sm text-teal">Sửa điểm giao trên bản đồ</Text></AppPressable></View>}<Text className="font-semibold text-base text-muted">Địa chỉ đã lưu</Text></View>} renderItem={({ item }) => {
                const delivery = deliveryFromSaved(item);
                return <View className={`gap-2 rounded-3xl border bg-card p-5 ${selected === item.id ? 'border-teal' : 'border-line'}`}><View className="flex-row items-center gap-2"><Ionicons name={item.title === 'Home' ? 'home-outline' : item.title === 'Work' ? 'business-outline' : 'location-outline'} size={22} color="#008B45"/><Text className="flex-1 font-bold text-base text-ink">{viLabel(item.title)}</Text><AppPressable accessibilityRole="button" accessibilityLabel={`Sửa địa chỉ ${item.address}`} disabled={busy} onPress={() => router.push({ pathname: '/address-form', params: { id: item.id } })} className="min-h-11 min-w-11 items-end justify-center"><Text className="font-semibold text-sm text-teal">Sửa</Text></AppPressable></View>
        <AppPressable accessibilityRole="button" accessibilityLabel={`Giao đến ${item.address}`} accessibilityState={{ selected: selected === item.id, disabled: busy || !delivery }} disabled={busy || !delivery} onPress={() => choose(item)} className="gap-3 py-2"><Text className="text-sm leading-6 text-ink">{item.address}</Text>
        <Text className="text-sm text-ink">{[item.recipient_name, item.recipient_phone].filter(Boolean).join(' · ') || 'Chưa có thông tin người nhận. Hãy chỉnh sửa để bổ sung.'}</Text>
        {!delivery && <Text className="text-xs text-coral">Địa chỉ cũ chưa có tọa độ. Hãy sửa và chọn ghim để sử dụng.</Text>}
        {selected === item.id && <Text className="text-xs text-teal">✓ Đang dùng để giao hàng</Text>}
        {item.is_default && <Text className="text-xs text-muted">Địa chỉ mặc định</Text>}</AppPressable>
        <View className="flex-row flex-wrap gap-3">
          {!item.is_default && <AppPressable accessibilityRole="button" disabled={busy || !delivery || !hasRecipient(delivery)} onPress={async () => { if (!delivery || !hasRecipient(delivery) || busy)
                    return; try {
                    await mutation.mutateAsync({ kind: 'save', id: item.id, address: delivery, isDefault: true, create: false });
                    Toast.show({ type: 'success', text1: 'Đã đổi địa chỉ mặc định' });
                }
                catch (error) {
                    Toast.show({ type: 'error', text1: userMessage(error) });
                } }} className="min-h-11 justify-center"><Text className="font-semibold text-sm text-teal">Đặt mặc định</Text></AppPressable>}
          <AppPressable accessibilityRole="button" disabled={busy} onPress={() => setDelete(item)} className="min-h-11 justify-center"><Text className="font-semibold text-sm text-coral">Xóa</Text></AppPressable></View>
      </View>;
            }} ListEmptyComponent={<View className="items-center gap-3 py-12"><Ionicons name="location-outline" size={44} color="#008B45"/><Text className="font-bold text-xl text-ink">{term ? 'Không tìm thấy địa chỉ phù hợp' : 'Chưa có địa chỉ đã lưu'}</Text><Text className="text-center text-sm text-muted">{term ? 'Thử tìm bằng địa chỉ, tên hoặc số điện thoại khác.' : 'Thêm địa chỉ nhà riêng hoặc cơ quan của bạn.'}</Text></View>}/>}
    <View className="border-t border-line bg-card px-5 py-4"><FlowButton title="Thêm địa chỉ mới" disabled={busy} onPress={() => router.push('/address-form')}/></View>
    <Modal visible={!!toDelete} transparent animationType="fade" onRequestClose={() => { if (!busy)
        setDelete(null); }}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.4)', alignItems: 'center', justifyContent: 'center', padding: 24 }}><View className="w-full max-w-md gap-4 rounded-3xl bg-white p-6"><Text className="font-bold text-xl text-ink">Xóa địa chỉ này?</Text><Text className="text-sm text-muted">{toDelete?.address}</Text><Text className="text-sm text-muted">Đơn hàng đã đặt vẫn giữ nguyên địa chỉ trên hóa đơn. Nếu xóa địa chỉ mặc định, một địa chỉ còn lại sẽ trở thành mặc định.</Text><FlowButton title={mutation.isPending ? 'Đang xóa…' : 'Xác nhận xóa địa chỉ'} disabled={busy} onPress={() => { void remove(); }}/><FlowButton title="Giữ lại" disabled={mutation.isPending} onPress={() => setDelete(null)}/></View></View></Modal>
  </SafeAreaView>;
}
