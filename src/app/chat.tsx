import { useRef, useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { FlowButton, FlowHeader } from '../components/FlowUI';
import { AppPressable } from '../components/AppPressable';
import { useChatRealtime } from '../hooks/useChatRealtime';
import { useAuthStore } from '../store/authStore';
import { chatApi } from '../services/chat';
import { purchaseApi } from '../services/purchase';
import { messageError, type Message } from '../features/chat/messages';
import { imageFromBase64 } from '../features/chat/imageData';

export default function ChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  return orderId ? <OrderChat key={orderId} orderId={orderId} /> : <SafeAreaView className="flex-1 bg-cream"><FlowHeader title="Tin nhắn" /><View className="p-5"><FlowButton title="Chọn cuộc trò chuyện" onPress={() => router.replace('/inbox')} /></View></SafeAreaView>;
}
function ChatImage({ path }: { path: string }) {
  const userId = useAuthStore(state => state.user?.id);
  const image = useQuery({ queryKey: ['chat-image', userId, path], queryFn: () => chatApi.imageUrl(path), staleTime: 50 * 60000, refetchInterval: 50 * 60000 });
  return image.data ? <Image source={{ uri: image.data }} contentFit="contain" style={{ width: 220, height: 180, borderRadius: 12 }} accessibilityLabel="Ảnh trong cuộc trò chuyện" />
    : <AppPressable accessibilityRole="button" onPress={() => { void image.refetch(); }}><Text className="text-sm text-muted">{image.isError ? 'Không tải được ảnh. Chạm để thử lại.' : 'Đang tải ảnh...'}</Text></AppPressable>;
}
function OrderChat({ orderId }: { orderId: string }) {
  const userId = useAuthStore(state => state.user?.id);
  const chat = useChatRealtime(orderId);
  const order = useQuery({ queryKey: ['order', userId, orderId], queryFn: ({ signal }) => purchaseApi.order(orderId, userId!, signal), enabled: !!userId });
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<FlatList<Message>>(null);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const sending = useRef(false);
  const mutation = useMutation({ mutationFn: chatApi.send, retry: false });
  const send = async () => {
    if (!userId || !order.data || sending.current || uploading || (!draft.trim() && !attachment)) return;
    sending.current = true; setError('');
    const signature = JSON.stringify([draft.trim(), attachment]);
    if (request.current?.signature !== signature) request.current = { signature, id: randomUUID() };
    try {
      const message = await mutation.mutateAsync({ id: request.current.id, orderId, senderId: userId, content: draft, imagePath: attachment });
      chat.acceptSent(message); setDraft(''); setAttachment(null); request.current = null;
    } catch (reason) { setError(messageError(reason)); }
    finally { sending.current = false; }
  };
  const pickImage = async (camera: boolean) => {
    if (!userId || uploading || mutation.isPending || !order.data) return;
    setError(''); setUploading(true);
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Quyền camera bị từ chối.');
      const result = camera ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7, mediaTypes: ['images'] })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, mediaTypes: ['images'] });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64 || (asset.fileSize && asset.fileSize > 5 * 1024 * 1024)) throw new Error('Ảnh không hợp lệ hoặc vượt quá 5 MB.');
      const image = imageFromBase64(asset.base64);
      const path = `${orderId}/${userId}/${randomUUID()}.${image.extension}`;
      await chatApi.upload(path, image.buffer, image.mime);
      setAttachment(path);
    } catch (reason) { setError(messageError(reason)); }
    finally { setUploading(false); }
  };
  return <SafeAreaView className="flex-1 bg-cream">
    <FlowHeader title="Tin nhắn theo đơn hàng" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View className="gap-1 px-5 pb-3"><Text className="font-semibold text-sm text-ink">{order.data?.restaurants?.name ?? 'Đơn hàng'} · {orderId.slice(0, 8)}</Text>
        <Text className="text-xs text-muted">{chat.connection === 'connected' ? 'Đang đồng bộ trực tiếp' : 'Đang kết nối lại; lịch sử sẽ tự tải bù'}</Text>
        {order.isSuccess && !order.data && <Text className="text-sm text-coral">Không tìm thấy đơn hàng của bạn.</Text>}
        {(order.isError || chat.isError) && <AppPressable accessibilityRole="button" onPress={() => { void order.refetch(); void chat.refetch(); }}><Text className="text-sm text-coral">Không tải được cuộc trò chuyện. Chạm để thử lại.</Text></AppPressable>}
      </View>
      {chat.isPending && <Text className="px-5 text-sm text-muted">Đang tải tin nhắn...</Text>}
      <FlatList ref={list} data={chat.messages} keyExtractor={message => message.id} contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={!chat.isPending ? <Text className="text-center text-sm text-muted">Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện.</Text> : null}
        renderItem={({ item }) => <View className={item.sender_type === 'user' ? 'items-end' : 'items-start'}>
          <View className={`max-w-[90%] gap-2 rounded-2xl p-3 ${item.sender_type === 'user' ? 'bg-tealLight' : 'bg-white'}`}>
            <Text className="font-semibold text-xs text-muted">{item.sender_type === 'user' ? 'Bạn' : 'Tài xế'}</Text>
            {item.image_url && <ChatImage path={item.image_url} />}
            {!!item.content && <Text selectable className="font-regular text-base text-ink">{item.content}</Text>}
            <Text className="text-xs text-muted">{new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        </View>} />
      <View className="gap-3 border-t border-line bg-card p-4">
        {!!error && <Text accessibilityRole="alert" className="text-sm text-coral">{error}</Text>}
        {attachment && <View className="gap-2"><ChatImage path={attachment} /><FlowButton title="Bỏ ảnh đính kèm" disabled={mutation.isPending} onPress={() => { if (!request.current) void chatApi.removeUpload(attachment).catch(() => {}); setAttachment(null); }} /></View>}
        <View className="flex-row gap-3"><View className="flex-1"><FlowButton title={uploading ? 'Đang tải...' : 'Chọn ảnh'} disabled={uploading || mutation.isPending || !!attachment || !order.data} onPress={() => { void pickImage(false); }} /></View>
          <View className="flex-1"><FlowButton title="Chụp ảnh" disabled={uploading || mutation.isPending || !!attachment || !order.data} onPress={() => { void pickImage(true); }} /></View></View>
        <TextInput accessibilityLabel="Nội dung tin nhắn" placeholder="Nhắn tin về đơn hàng..." value={draft} onChangeText={setDraft} maxLength={2000} editable={!mutation.isPending} multiline className="min-h-12 rounded-2xl border border-line px-4 py-3 text-base text-ink" />
        <FlowButton title={mutation.isPending ? 'Đang gửi...' : 'Gửi tin nhắn'} disabled={mutation.isPending || uploading || !order.data || (!draft.trim() && !attachment)} onPress={() => { void send(); }} />
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
