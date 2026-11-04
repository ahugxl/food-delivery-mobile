import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { FlowHeader } from '../components/FlowUI';
import { AppPressable } from '../components/AppPressable';
import { FoodPrice } from '../components/FoodPrice';
import { AiReplyText } from '../components/AiReplyText';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';
import { aiApi } from '../services/ai';
import type { AiChatTurn, AiRecommendation } from '../services/aiApi';
import { conversationHistory } from '../services/aiApi';
import { validCoordinates } from '../features/location/coordinates';
import { userMessage } from '../utils/userMessage';

const examples = ['Đang đói, ăn gì dưới 40k?', 'Trà sữa ngọt nhẹ dưới 40k', 'Cơm trưa dưới 50k'];
type ChatEntry = AiChatTurn & { id: number; foods?: AiRecommendation['foods'] };
type ChatInput = { message: string; latitude: number; longitude: number; signal: AbortSignal; history: AiChatTurn[]; onText: (text: string) => void };

export default function AiAssistantScreen() {
  const userId = useAuthStore(s => s.user?.id) || '';
  const address = useOrderStore(s => s.deliveryAddress);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [error, setError] = useState('');
  const [failedMessage, setFailedMessage] = useState('');
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const nextId = useRef(0);
  const busy = useRef(false);
  const [receiving, setReceiving] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const mutation = useMutation({ mutationFn: (input: ChatInput) => aiApi.recommend(input.message, input, userId, input.signal, input.history, input.onText), retry: false });
  const reset = () => {
    revision.current += 1; request.current?.abort(); busy.current = false;
    setMessages([]); setQuestion(''); setError(''); setFailedMessage(''); setReceiving(false);
  };
  useEffect(() => {
    revision.current += 1; request.current?.abort(); busy.current = false;
    setMessages([]); setQuestion(''); setError(''); setFailedMessage(''); setReceiving(false);
    return () => { revision.current += 1; request.current?.abort(); };
  }, [userId, address.latitude, address.longitude]);
  const send = async (text = question, retry = false) => {
    if (busy.current || mutation.isPending || !userId || !validCoordinates(address) || !text.trim()) return;
    busy.current = true;
    const token = revision.current;
    const previous = retry ? messages.slice(0, -1) : messages;
    const history = conversationHistory(previous);
    const controller = new AbortController();
    request.current = controller;
    setMessages([...previous, { id: ++nextId.current, role: 'user', content: text.trim() }]);
    setQuestion(''); setError(''); setFailedMessage(''); setReceiving(false);
    const assistantId = ++nextId.current;
    const onText = (content: string) => {
      if (token !== revision.current || useAuthStore.getState().user?.id !== userId) return;
      setReceiving(true);
      setMessages(current => current.some(entry => entry.id === assistantId) ? current.map(entry => entry.id === assistantId ? { ...entry, content } : entry) : [...current, { id: assistantId, role: 'assistant', content }]);
    };
    try {
      const result = await mutation.mutateAsync({ message: text, latitude: address.latitude, longitude: address.longitude, signal: controller.signal, history, onText });
      if (token === revision.current && useAuthStore.getState().user?.id === userId) {
        setMessages(current => [...current.filter(entry => entry.id !== assistantId), { id: assistantId, role: 'assistant', content: result.message, foods: result.foods }]);
      }
    } catch (reason) {
      if (token === revision.current) {
        setMessages(current => current.filter(entry => entry.id !== assistantId));
        setError(userMessage(reason)); setFailedMessage(text);
      }
    } finally { if (token === revision.current) { busy.current = false; setReceiving(false); } }
  };
  const pending = mutation.isPending;
  return <SafeAreaView className="flex-1 bg-white">
    <View className="flex-row items-center"><View className="flex-1"><FlowHeader title="Trợ lý chọn món" /></View><AppPressable accessibilityRole="button" accessibilityLabel="Cuộc trò chuyện mới" disabled={pending} onPress={reset} style={{ padding: 16 }}><Ionicons name="create-outline" size={24} color="#008B45" /></AppPressable></View>
    <AppPressable accessibilityRole="button" accessibilityLabel="Đổi địa chỉ dùng để gợi ý món" onPress={() => router.push('/select-location')} className="mx-4 mb-2 flex-row items-center gap-2 rounded-2xl bg-tealLight px-3 py-2"><Ionicons name="location-outline" size={18} color="#008B45" /><Text numberOfLines={1} className="flex-1 text-xs text-ink">{address.street || 'Chọn địa chỉ giao hàng'}</Text><Ionicons name="chevron-forward" size={16} color="#727772" /></AppPressable>
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })} contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 16 }}>
        <View className="self-start rounded-3xl bg-tealLight p-4" style={{ maxWidth: '92%' }}><View className="mb-2 flex-row items-center gap-2"><Ionicons name="sparkles" size={20} color="#008B45" /><Text className="font-bold text-base text-ink">Hôm nay ăn gì?</Text></View><Text className="text-sm text-ink" style={{ lineHeight: 22 }}>Chào bạn! Mình có thể giúp bạn chọn món. Bạn đang thèm gì, muốn ăn khoảng bao nhiêu tiền?</Text></View>
        {!messages.length && <View className="gap-2">{examples.map(text => <AppPressable key={text} accessibilityRole="button" disabled={pending} onPress={() => { void send(text); }} className="rounded-2xl border border-line px-4 py-3"><Text className="text-sm text-teal">{text}</Text></AppPressable>)}</View>}
        {messages.map(entry => <View key={entry.id} style={{ alignSelf: entry.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: entry.role === 'user' ? '88%' : '100%', width: entry.foods?.length ? '100%' : undefined, gap: 10 }}>
          <View style={{ backgroundColor: entry.role === 'user' ? '#008B45' : '#EAF6EF', borderRadius: 22, padding: 15 }}>{entry.role === 'assistant' ? <AiReplyText text={entry.content} /> : <Text selectable style={{ color: '#FFFFFF', fontSize: 15, lineHeight: 23 }}>{entry.content}</Text>}</View>
          {entry.foods?.map(food => <AppPressable key={food.food_id} accessibilityRole="button" accessibilityLabel={`Xem món ${food.name} tại ${food.restaurant_name}`} onPress={() => router.push({ pathname: '/food/[id]', params: { id: food.food_id } })} className="gap-2 rounded-3xl border border-line bg-white p-3">
            <View className="flex-row gap-3"><Image source={food.image_url ? { uri: food.image_url } : undefined} contentFit="cover" style={{ width: 76, height: 76, borderRadius: 15, backgroundColor: '#F1F5EF' }} /><View className="flex-1 gap-1"><Text className="font-bold text-base text-ink">{food.name}</Text><Text className="text-xs text-muted">{food.restaurant_name} · {food.distance_km.toFixed(1)} km</Text><FoodPrice food={food} /></View></View>
            {!!food.option_hint && <Text className="text-xs text-teal">Có tùy chọn: {food.option_hint}</Text>}
            <Text className="font-semibold text-sm text-teal">Xem món và chọn tùy chọn →</Text>
          </AppPressable>)}
        </View>)}
        {pending && !receiving && <View className="flex-row items-center gap-3 self-start rounded-3xl bg-tealLight px-4 py-3"><ActivityIndicator size="small" color="#008B45" /><Text accessibilityLiveRegion="polite" className="text-sm text-muted">Đang tìm món phù hợp…</Text></View>}
        {!!error && <View className="gap-2 rounded-2xl bg-red-50 p-3"><Text accessibilityRole="alert" className="text-sm text-coral">{error}</Text><AppPressable disabled={pending} onPress={() => { void send(failedMessage, true); }}><Text className="font-semibold text-sm text-teal">Thử lại</Text></AppPressable></View>}
      </ScrollView>
      <View className="gap-2 border-t border-line bg-white px-4 pb-3 pt-3">
        {!validCoordinates(address) && <Text className="text-xs text-coral">Chọn địa chỉ giao hàng trước khi hỏi trợ lý nhé.</Text>}
        <View className="flex-row items-end gap-2">
          <TextInput accessibilityLabel="Tin nhắn cho trợ lý" placeholder="Hỏi món ăn, hoặc nhắn tiếp…" placeholderTextColor="#7A837D" value={question} onChangeText={setQuestion} maxLength={600} multiline editable={!pending} className="flex-1 rounded-3xl bg-surface px-4 py-3 text-base text-ink" style={{ minHeight: 48, maxHeight: 120, textAlignVertical: 'top' }} />
          <AppPressable accessibilityRole="button" accessibilityLabel="Gửi tin nhắn" disabled={pending || !question.trim() || !userId || !validCoordinates(address)} onPress={() => { void send(); }} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: pending || !question.trim() || !userId || !validCoordinates(address) ? '#C8D9CF' : '#008B45' }}><Ionicons name="arrow-up" size={24} color="white" /></AppPressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
