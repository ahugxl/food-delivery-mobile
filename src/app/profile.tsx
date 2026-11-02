import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import Toast from 'react-native-toast-message';
import { FlowButton, FlowHeader } from '../components/FlowUI';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { accountApi } from '../services/account';
import { useAuthStore } from '../store/authStore';
import { imageFromBase64 } from '../features/chat/imageData';
import { profileInput } from '../features/account/validation';
import { userMessage } from '../utils/userMessage';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
type Profile = NonNullable<Awaited<ReturnType<typeof accountApi.profile>>>;
export default function ProfileScreen() {
    const user = useAuthStore(state => state.user);
    const userId = user?.id;
    const query = useQuery({ queryKey: ['profile', userId], queryFn: ({ signal }) => accountApi.profile(userId!, signal), enabled: !!userId });
    return <SafeAreaView className="flex-1 bg-cream"><FlowHeader title="Chỉnh sửa hồ sơ"/>
    {query.isPending ? <Text className="p-5 text-muted">Đang tải hồ sơ…</Text> : query.isError && !query.data ? <View className="gap-4 p-5"><Text className="text-muted">{userMessage(query.error)}</Text><FlowButton title="Thử lại" onPress={() => { void query.refetch(); }}/></View> : user && <ProfileEditor key={userId} profile={query.data ?? { id: user.id, full_name: user.name, phone: null, avatar_url: null, loyalty_points: 0 }} missing={!query.data}/>}
  </SafeAreaView>;
}
function ProfileEditor({ profile, missing }: {
    profile: Profile;
    missing: boolean;
}) {
    const user = useAuthStore(state => state.user);
    const client = useQueryClient();
    const [name, setName] = useState(profile.full_name);
    const [phone, setPhone] = useState(profile.phone ?? '');
    const [avatar, setAvatar] = useState(profile.avatar_url);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const mounted = useRef(true);
    const pendingPaths = useRef(new Set<string>());
    const savedAvatar = useRef(profile.avatar_url);
    const saving = useRef(false);
    const uploadingRef = useRef(false);
    const mutation = useMutation({ retry: false, mutationFn: () => accountApi.saveProfile(name, phone, avatar) });
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            // The Storage policy also blocks deletion of an avatar already committed to profiles.
            if (!saving.current)
                for (const path of pendingPaths.current)
                    void accountApi.removeAvatar(path).catch(() => { });
        };
    }, []);
    const pick = async () => {
        if (!user || saving.current || uploadingRef.current)
            return;
        uploadingRef.current = true;
        setUploading(true);
        setError('');
        let uploaded: string | null = null;
        try {
            if (Platform.OS !== 'web') {
                const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (permission.status !== 'granted')
                    throw new Error('Vui lòng cấp quyền chọn ảnh đại diện.');
            }
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .8, base64: true });
            if (result.canceled)
                return;
            const asset = result.assets[0];
            if (!asset.base64)
                throw new Error('Không đọc được ảnh đã chọn. Vui lòng chọn lại.');
            const image = imageFromBase64(asset.base64);
            const path = `${user.id}/${randomUUID()}.${image.extension}`;
            await accountApi.uploadAvatar(path, image.buffer, image.mime);
            uploaded = path;
            if (!mounted.current || useAuthStore.getState().user?.id !== user.id) {
                void accountApi.removeAvatar(path).catch(() => { });
                return;
            }
            pendingPaths.current.add(path);
            setAvatar(path);
        }
        catch (reason) {
            if (mounted.current)
                setError(userMessage(reason));
            if (uploaded)
                void accountApi.removeAvatar(uploaded).catch(() => { });
        }
        finally {
            uploadingRef.current = false;
            if (mounted.current)
                setUploading(false);
        }
    };
    const save = async () => {
        if (!user || saving.current || uploadingRef.current || useAuthStore.getState().user?.id !== user.id)
            return;
        try {
            profileInput(name, phone, avatar);
        }
        catch (reason) {
            setError(userMessage(reason));
            return;
        }
        saving.current = true;
        setError('');
        try {
            const result = await mutation.mutateAsync();
            const previous = savedAvatar.current;
            savedAvatar.current = result.avatar_url;
            if (result.avatar_url)
                pendingPaths.current.delete(result.avatar_url);
            if (previous && previous !== result.avatar_url && previous.startsWith(`${user.id}/`))
                void accountApi.removeAvatar(previous).catch(() => { });
            for (const path of pendingPaths.current) {
                void accountApi.removeAvatar(path).catch(() => { });
            }
            pendingPaths.current.clear();
            if (useAuthStore.getState().user?.id !== user.id)
                return;
            client.setQueryData(['profile', user.id], result);
            void client.invalidateQueries({ queryKey: ['profile', user.id] });
            if (mounted.current) {
                setName(result.full_name);
                setPhone(result.phone ?? '');
                setAvatar(result.avatar_url);
                Toast.show({ type: 'success', text1: 'Đã cập nhật hồ sơ' });
            }
        }
        catch (reason) {
            if (mounted.current)
                setError(userMessage(reason));
        }
        finally {
            saving.current = false;
        }
    };
    const busy = uploading || mutation.isPending;
    return <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding"><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
    {missing && <Text className="rounded-2xl bg-sage p-4 text-sm text-muted">Tài khoản chưa có bản ghi hồ sơ. Nhấn lưu để khởi tạo hồ sơ của bạn.</Text>}
    <View className="items-center gap-4 rounded-3xl border border-line bg-white p-5"><ProfileAvatar path={avatar} size={100}/><Text className="text-center text-xs text-muted">Ảnh JPEG, PNG hoặc WebP, tối đa 5 MB. Nhấn lưu để cập nhật hồ sơ.</Text><View className="w-full gap-3"><FlowButton title={uploading ? 'Đang tải ảnh…' : 'Chọn ảnh đại diện'} disabled={busy} onPress={() => { void pick(); }}/></View></View>
    <View className="gap-2"><Text className="font-semibold text-sm text-ink">Họ và tên</Text><TextInput accessibilityLabel="Họ và tên" value={name} onChangeText={setName} maxLength={100} editable={!busy} autoCapitalize="words" autoComplete="name" className="min-h-14 rounded-2xl border border-line bg-white px-4 text-base text-ink"/></View>
    <View className="gap-2"><Text className="font-semibold text-sm text-ink">Số điện thoại</Text><TextInput accessibilityLabel="Số điện thoại" value={phone} onChangeText={setPhone} maxLength={24} editable={!busy} keyboardType="phone-pad" autoComplete="tel" placeholder="Nhập số điện thoại" className="min-h-14 rounded-2xl border border-line bg-white px-4 text-base text-ink"/><Text className="text-xs text-muted">Có thể để trống nếu chưa muốn cung cấp.</Text></View>
    <View className="gap-2 rounded-2xl bg-sage p-4"><Text className="font-semibold text-sm text-ink">Email đăng nhập</Text><Text selectable className="text-sm text-muted">{user?.email}</Text><Text className="text-xs text-muted">Email được quản lý bởi tài khoản đăng nhập.</Text></View>
    {!!error && <Text accessibilityRole="alert" className="text-sm text-coral">{error}</Text>}
    <FlowButton title={mutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'} disabled={busy} onPress={() => { void save(); }}/>
  </ScrollView></KeyboardAvoidingView>;
}
