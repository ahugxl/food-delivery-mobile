import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FlowButton, FlowHeader } from '../components/FlowUI';
import MapPanel from '../components/maps/MapPanel';
import { currentCoordinates, getAddressFromCoords } from '../services/location';
import { validCoordinates, type Coordinates } from '../features/location/coordinates';
import { useOrderStore } from '../store/orderStore';

const DEFAULT_CENTER = { latitude: 10.7769, longitude: 106.7009 };
export default function SelectLocationScreen() {
  const saved = useOrderStore(state => state.deliveryAddress);
  const [coordinate, setCoordinate] = useState<Coordinates | null>(validCoordinates(saved) ? { latitude: saved.latitude, longitude: saved.longitude } : null);
  const [street, setStreet] = useState(saved.street);
  const [label, setLabel] = useState(saved.label);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { generation.current++; if (timer.current) clearTimeout(timer.current); }, []);
  const choose = (point: Coordinates) => {
    if (!validCoordinates(point)) return;
    setCoordinate(point); setError(''); setBusy(true);
    const request = ++generation.current;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void getAddressFromCoords(point.latitude, point.longitude).then(address => {
        if (request === generation.current) setStreet(address);
      }).catch((reason: unknown) => {
        if (request === generation.current) { setStreet(''); setError(reason instanceof Error ? reason.message : 'Không lấy được địa chỉ. Hãy nhập thủ công.'); }
      }).finally(() => { if (request === generation.current) setBusy(false); });
    }, 350);
  };
  const locate = async () => {
    if (locating) return;
    setLocating(true); setError('');
    try { choose(await currentCoordinates()); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Không lấy được vị trí.'); }
    finally { setLocating(false); }
  };
  const confirm = () => {
    if (!coordinate || busy || street.trim().length < 5) return;
    useOrderStore.getState().setDeliveryAddress({ street: street.trim(), label, ...coordinate });
    router.canGoBack() ? router.back() : router.replace('/checkout');
  };
  return <SafeAreaView className="flex-1 bg-cream"><FlowHeader title="Chọn vị trí giao hàng" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18 }}>
      <TextInput accessibilityLabel="Địa chỉ giao hàng" value={street} onChangeText={value => { generation.current++; if (timer.current) clearTimeout(timer.current); setBusy(false); setError(''); setStreet(value); }}
        maxLength={500} placeholder={busy ? 'Đang tìm địa chỉ cho ghim...' : 'Số nhà, tên đường, phường, quận...'} multiline
        className="min-h-16 rounded-2xl border border-line bg-card px-4 py-3 font-regular text-base text-ink" />
      <FlowButton title={locating ? 'Đang định vị...' : 'Dùng vị trí hiện tại'} disabled={locating} onPress={() => { void locate(); }} />
      <MapPanel coordinate={coordinate ?? DEFAULT_CENTER} onSelect={choose} />
      {!coordinate && <Text className="text-sm text-muted">Chạm bản đồ hoặc kéo ghim để chọn điểm giao. Vị trí ban đầu chỉ là tâm bản đồ.</Text>}
      {busy && <Text accessibilityLiveRegion="polite" className="text-sm text-muted">Đang dịch tọa độ thành địa chỉ...</Text>}
      {!!error && <Text accessibilityRole="alert" className="text-sm text-coral">{error}</Text>}
      <View className="flex-row gap-3">{(['Home', 'Work', 'Other'] as const).map(value => <View key={value} className="flex-1"><FlowButton title={value === label ? `✓ ${value}` : value} onPress={() => setLabel(value)} /></View>)}</View>
      <FlowButton title="Xác nhận điểm giao" disabled={!coordinate || busy || street.trim().length < 5} onPress={confirm} />
    </ScrollView>
  </SafeAreaView>;
}
