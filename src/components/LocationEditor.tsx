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
import { RecipientFields } from './RecipientFields';
import { hasRecipient, recipientInput } from '../features/order/recipient';
import { AppPressable } from './AppPressable';
import { Ionicons } from '@expo/vector-icons';
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
        if (confirming.current || disabled || busy || locating || !validCoordinates(draft) || draft.street.trim().length < 5 || !hasRecipient(draft)) return;
        confirming.current = true;
        setSubmitError('');
        try { await onSubmit({ ...draft, ...recipientInput(draft), street: draft.street.trim() }); }
        catch (reason) { setSubmitError(userMessage(reason)); }
        finally { confirming.current = false; }
    };
    return <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 18 }}>
    <RecipientFields value={draft} disabled={disabled} onChange={recipient => setDraft(value => ({ ...value, ...recipient, savedAddressId: undefined }))} />
    {!hasRecipient(draft) && <Text className="text-sm text-muted">Nhập tên (2–100 ký tự) và số điện thoại (9–15 chữ số) để xác nhận địa chỉ.</Text>}
    <TextInput accessibilityLabel="Địa chỉ giao hàng" value={draft.street} onChangeText={street => { generation.current++; if (timer.current)
        clearTimeout(timer.current); setBusy(false); setError(''); setDraft(value => ({ ...value, street, savedAddressId: undefined })); }} editable={!disabled} maxLength={500} multiline placeholder={busy ? 'Đang tìm địa chỉ cho ghim…' : 'Số nhà, tên đường, phường, quận…'} className="min-h-16 rounded-2xl border border-line bg-card px-4 py-3 text-base text-ink"/>
    <FlowButton title={locating ? 'Đang định vị…' : 'Dùng vị trí hiện tại'} disabled={locating || disabled} onPress={() => { void locate(); }}/>
    <MapPanel coordinate={validCoordinates(draft) ? draft : { latitude: 10.7769, longitude: 106.7009 }} onSelect={disabled ? undefined : choose}/>
    {!validCoordinates(draft) && <Text className="text-sm text-muted">Dùng vị trí hiện tại hoặc chọn tọa độ giao hàng. Vị trí hiển thị ban đầu chưa phải điểm giao đã xác nhận.</Text>}
    {busy && <Text accessibilityLiveRegion="polite" className="text-sm text-muted">Đang dịch tọa độ thành địa chỉ…</Text>}
    {!!error && <Text accessibilityRole="alert" className="text-sm text-coral">{error} Bạn có thể nhập địa chỉ thủ công cho ghim đã chọn.</Text>}
    <View accessibilityRole="radiogroup" accessibilityLabel="Loại địa chỉ" style={{ flexDirection: 'row', gap: 8 }}>{(['Home', 'Work', 'Other'] as const).map(value => {
      const selected = draft.label === value;
      return <AppPressable key={value} accessibilityRole="radio" accessibilityLabel={viLabel(value)} accessibilityState={{ checked: selected, disabled }} disabled={disabled}
        onPress={() => setDraft(current => ({ ...current, label: value, savedAddressId: undefined }))}
        style={{ flex: 1, minWidth: 0, minHeight: 56, borderRadius: 16, paddingHorizontal: 6, paddingVertical: 12, backgroundColor: disabled ? '#E7E7E7' : '#008B45', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        {selected && <Ionicons name="checkmark" size={15} color="white" style={{ flexShrink: 0 }} />}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, minWidth: 0, textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 14, color: disabled ? '#827A71' : 'white' }}>{viLabel(value)}</Text>
      </AppPressable>;
    })}</View>
    {children}
    {!!submitError && <Text accessibilityRole="alert" className="text-sm text-coral">{submitError}</Text>}
    <FlowButton title={title} disabled={disabled || busy || locating || !validCoordinates(draft) || draft.street.trim().length < 5 || !hasRecipient(draft)} onPress={() => { void confirm(); }}/>
  </ScrollView></KeyboardAvoidingView>;
}
