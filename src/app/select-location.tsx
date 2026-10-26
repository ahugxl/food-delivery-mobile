import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FlowButton, FlowHeader } from '../components/FlowUI';
import { LocationEditor } from '../components/LocationEditor';
import { useOrderStore } from '../store/orderStore';
import { useCartStore } from '../store/cartStore';
export default function SelectLocationScreen() {
    const saved = useOrderStore(state => state.deliveryAddress);
    const locked = useCartStore(state => state.isCheckingOut);
    return <SafeAreaView className="flex-1 bg-cream"><FlowHeader title="Chọn vị trí giao hàng"/>
    <View className="gap-2 px-5"><FlowButton title="Chọn từ sổ địa chỉ" disabled={locked} onPress={() => router.push({ pathname: '/addresses', params: { select: '1' } })}/><Text className="mt-3 text-sm text-muted">Hoặc chọn một điểm giao khác:</Text></View>
    <LocationEditor key={JSON.stringify(saved)} initial={saved} disabled={locked} onSubmit={value => { if (useCartStore.getState().isCheckingOut)
        return; useOrderStore.getState().setDeliveryAddress(value); router.canGoBack() ? router.back() : router.replace('/checkout'); }}/>
  </SafeAreaView>;
}
