import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FlowHeader } from '../components/FlowUI';
import { LocationEditor } from '../components/LocationEditor';
import { useOrderStore } from '../store/orderStore';
import { useCartStore } from '../store/cartStore';
export default function DeliveryLocationScreen() {
    const saved = useOrderStore(state => state.deliveryAddress);
    const locked = useCartStore(state => state.isCheckingOut);
    return <SafeAreaView className="flex-1 bg-cream"><FlowHeader title="Chọn vị trí giao hàng"/>
    <LocationEditor key={JSON.stringify(saved)} initial={saved} disabled={locked} onSubmit={value => { if (useCartStore.getState().isCheckingOut)
        return; useOrderStore.getState().setDeliveryAddress(value); router.canGoBack() ? router.back() : router.replace('/checkout'); }}/>
  </SafeAreaView>;
}
