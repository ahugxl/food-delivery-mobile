import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { FlowButton } from './FlowUI';
import MapPanel from './maps/MapPanel';
import { currentCoordinates, getAddressFromCoords } from '../services/location';
import { validCoordinates, type Coordinates } from '../features/location/coordinates';
import type { DeliveryAddress } from '../features/order/checkout';
import { viLabel } from '../utils/vietnamese';
import { userMessage } from '../utils/userMessage';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
export function LocationEditor({ initial, onSubmit, title = 'Xác nhận điểm giao', disabled = false, children }: {
    initial: DeliveryAddress;
    onSubmit: (value: DeliveryAddress) => void | Promise<void>;
    title?: string;
    disabled?: boolean;
    children?: ReactNode;
}) {
    const [draft, setDraft] = useState(initial);
    const [busy, setBusy] = useState(false);
    const [locating, setLocating] = useState(false);
    const [error, setError] = useState('');
    const [submitError, setSubmitError] = useState('');
    const confirming = useRef(false);
    const generation = useRef(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { generation.current++; if (timer.current)
        clearTimeout(timer.current); }, []);
    const choose = (coordinate: Coordinates) => {
        if (!validCoordinates(coordinate) || disabled)
            return;
        setDraft(value => ({ ...value, ...coordinate, savedAddressId: undefined, street: '' }));
        setError('');
        setBusy(true);
        const request = ++generation.current;
        if (timer.current)
            clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            void getAddressFromCoords(coordinate.latitude, coordinate.longitude).then(street => {
                if (request === generation.current)
                    setDraft(value => ({ ...value, street }));
            }).catch(reason => { if (request === generation.current)
                setError(userMessage(reason)); }).finally(() => { if (request === generation.current)
                setBusy(false); });
        }, 350);
    };
    const locate = async () => {
        if (locating || disabled)
            return;
        setLocating(true);
        setError('');
        try {
            choose(await currentCoordinates());
        }
        catch (reason) {
            setError(userMessage(reason));
        }
        finally {
            setLocating(false);
        }
    };
    const confirm = async () => {
        if (confirming.current || disabled || busy || locating || !validCoordinates(draft) || draft.street.trim().length < 5) return;
        confirming.current = true;
        setSubmitError('');
        try { await onSubmit({ ...draft, street: draft.street.trim() }); }
        catch (reason) { setSubmitError(userMessage(reason)); }
        finally { confirming.current = false; }
    };
    return <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18 }}>
    <TextInput accessibilityLabel="Địa chỉ giao hàng" value={draft.street} onChangeText={street => { generation.current++; if (timer.current)
        clearTimeout(timer.current); setBusy(false); setError(''); setDraft(value => ({ ...value, street, savedAddressId: undefined })); }} editable={!disabled} maxLength={500} multiline placeholder={busy ? 'Đang tìm địa chỉ cho ghim…' : 'Số nhà, tên đường, phường, quận…'} className="min-h-16 rounded-2xl border border-line bg-card px-4 py-3 text-base text-ink"/>
    <FlowButton title={locating ? 'Đang định vị…' : 'Dùng vị trí hiện tại'} disabled={locating || disabled} onPress={() => { void locate(); }}/>
    <MapPanel coordinate={validCoordinates(draft) ? draft : { latitude: 10.7769, longitude: 106.7009 }} onSelect={disabled ? undefined : choose}/>
    {!validCoordinates(draft) && <Text className="text-sm text-muted">Chọn điểm giao trên bản đồ. Tâm bản đồ ban đầu chưa phải vị trí đã chọn.</Text>}
    {busy && <Text accessibilityLiveRegion="polite" className="text-sm text-muted">Đang dịch tọa độ thành địa chỉ…</Text>}
    {!!error && <Text accessibilityRole="alert" className="text-sm text-coral">{error} Bạn có thể nhập địa chỉ thủ công cho ghim đã chọn.</Text>}
    <View className="flex-row gap-2">{(['Home', 'Work', 'Other'] as const).map(value => <View key={value} className="flex-1"><FlowButton disabled={disabled} title={`${draft.label === value ? '✓ ' : ''}${viLabel(value)}`} onPress={() => setDraft(current => ({ ...current, label: value, savedAddressId: undefined }))}/></View>)}</View>
    {children}
    {!!submitError && <Text accessibilityRole="alert" className="text-sm text-coral">{submitError}</Text>}
    <FlowButton title={title} disabled={disabled || busy || locating || !validCoordinates(draft) || draft.street.trim().length < 5} onPress={() => { void confirm(); }}/>
  </ScrollView></KeyboardAvoidingView>;
}
