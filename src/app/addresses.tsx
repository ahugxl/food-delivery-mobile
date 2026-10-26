import { useState } from 'react';
import { FlatList, Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
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
export default function AddressesScreen() {
    const { select } = useLocalSearchParams<{
        select?: string;
    }>();
    const query = useSavedAddresses();
    const mutation = useAddressActions();
    const locked = useCartStore(state => state.isCheckingOut);
    const [toDelete, setDelete] = useState<SavedAddress | null>(null);
    const selected = useOrderStore(state => state.deliveryAddress.savedAddressId);
    const busy = locked || mutation.isPending;
    const choose = (row: SavedAddress) => {
        const delivery = deliveryFromSaved(row);
        if (!delivery || useCartStore.getState().isCheckingOut)
            return;
        useOrderStore.getState().setDeliveryAddress(delivery);
        if (select === '1' && router.canGoBack())
            router.back();
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
    return <SafeAreaView className="flex-1 bg-cream"><FlowHeader title={select === '1' ? 'Chọn địa chỉ đã lưu' : 'Sổ địa chỉ'}/>
    <View className="gap-3 px-5 pb-4"><Text className="text-sm text-muted">Lưu vị trí để đặt hàng nhanh hơn. Địa chỉ mặc định được tải khi mở ứng dụng.</Text><FlowButton title="Thêm địa chỉ mới" disabled={busy} onPress={() => router.push('/address-form')}/></View>
    {query.isPending ? <Text className="p-5 text-muted">Đang tải địa chỉ…</Text> : query.isError ? <View className="gap-4 p-5"><Text className="text-muted">Không tải được sổ địa chỉ.</Text><FlowButton title="Thử lại" onPress={() => { void query.refetch(); }}/></View> : <FlatList data={query.data} keyExtractor={row => row.id} refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 16 }} renderItem={({ item }) => {
                const delivery = deliveryFromSaved(item);
                return <View className="gap-3 rounded-3xl border border-line bg-card p-5"><View className="flex-row items-center gap-2"><Ionicons name={item.title === 'Home' ? 'home-outline' : item.title === 'Work' ? 'business-outline' : 'location-outline'} size={22} color="#008B45"/><Text className="flex-1 font-bold text-base text-ink">{viLabel(item.title)}</Text>{item.is_default && <Text className="rounded-full bg-tealLight px-3 py-1 text-xs text-teal">Mặc định</Text>}</View><Text className="text-sm leading-6 text-ink">{item.address}</Text>
        {!delivery && <Text className="text-xs text-coral">Địa chỉ cũ chưa có tọa độ. Hãy sửa và chọn ghim để sử dụng.</Text>}
        <FlowButton title={selected === item.id ? '✓ Đang dùng để giao hàng' : 'Giao đến địa chỉ này'} disabled={busy || !delivery} onPress={() => choose(item)}/>
        <View className="flex-row flex-wrap gap-3"><AppPressable accessibilityRole="button" disabled={busy} onPress={() => router.push({ pathname: '/address-form', params: { id: item.id } })} className="min-h-11 justify-center"><Text className="font-semibold text-sm text-teal">Chỉnh sửa</Text></AppPressable>
          {!item.is_default && <AppPressable accessibilityRole="button" disabled={busy || !delivery} onPress={async () => { if (!delivery || busy)
                    return; try {
                    await mutation.mutateAsync({ kind: 'save', id: item.id, address: delivery, isDefault: true, create: false });
                    Toast.show({ type: 'success', text1: 'Đã đổi địa chỉ mặc định' });
                }
                catch (error) {
                    Toast.show({ type: 'error', text1: userMessage(error) });
                } }} className="min-h-11 justify-center"><Text className="font-semibold text-sm text-teal">Đặt mặc định</Text></AppPressable>}
          <AppPressable accessibilityRole="button" disabled={busy} onPress={() => setDelete(item)} className="min-h-11 justify-center"><Text className="font-semibold text-sm text-coral">Xóa</Text></AppPressable></View>
      </View>;
            }} ListEmptyComponent={<View className="items-center gap-3 py-12"><Ionicons name="location-outline" size={44} color="#008B45"/><Text className="font-bold text-xl text-ink">Chưa có địa chỉ đã lưu</Text><Text className="text-center text-sm text-muted">Thêm địa chỉ nhà riêng hoặc cơ quan của bạn.</Text></View>}/>}
    <Modal visible={!!toDelete} transparent animationType="fade" onRequestClose={() => { if (!busy)
        setDelete(null); }}><View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.4)', alignItems: 'center', justifyContent: 'center', padding: 24 }}><View className="w-full max-w-md gap-4 rounded-3xl bg-white p-6"><Text className="font-bold text-xl text-ink">Xóa địa chỉ này?</Text><Text className="text-sm text-muted">{toDelete?.address}</Text><Text className="text-sm text-muted">Đơn hàng đã đặt vẫn giữ nguyên địa chỉ trên hóa đơn. Nếu xóa địa chỉ mặc định, một địa chỉ còn lại sẽ trở thành mặc định.</Text><FlowButton title={mutation.isPending ? 'Đang xóa…' : 'Xác nhận xóa địa chỉ'} disabled={busy} onPress={() => { void remove(); }}/><FlowButton title="Giữ lại" disabled={mutation.isPending} onPress={() => setDelete(null)}/></View></View></Modal>
  </SafeAreaView>;
}
