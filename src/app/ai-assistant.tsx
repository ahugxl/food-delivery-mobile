import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { FlowButton, FlowHeader } from '../components/FlowUI';
import { AppPressable } from '../components/AppPressable';
import { Skeleton } from '../components/Skeleton';
import { FoodPrice } from '../components/FoodPrice';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';
import { aiApi } from '../services/ai';
import type { AiRecommendation } from '../services/aiApi';
import { validCoordinates } from '../features/location/coordinates';
import { userMessage } from '../utils/userMessage';

const examples = ['Trà sữa ngọt nhẹ dưới 40k', 'Cơm trưa dưới 50k', 'Đồ uống không đường gần tôi'];
export default function AiAssistantScreen() {
  const userId = useAuthStore(s => s.user?.id) || '';
  const address = useOrderStore(s => s.deliveryAddress);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AiRecommendation | null>(null);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const mutation = useMutation({ mutationFn: (input: { message: string; latitude: number; longitude: number; signal: AbortSignal }) => aiApi.recommend(input.message, input, userId, input.signal), retry: false });
  useEffect(() => {
    revision.current += 1; request.current?.abort(); setAnswer(null); setError('');
    return () => { revision.current += 1; request.current?.abort(); };
  }, [userId, address.latitude, address.longitude]);
  const send = async () => {
    if (mutation.isPending || !userId || !validCoordinates(address) || !question.trim()) return;
    const token = revision.current;
    request.current?.abort(); request.current = new AbortController();
    setAnswer(null); setError('');
    try {
      const result = await mutation.mutateAsync({ message: question, latitude: address.latitude, longitude: address.longitude, signal: request.current.signal });
      if (token === revision.current && useAuthStore.getState().user?.id === userId) setAnswer(result);
    } catch (reason) {
      if (token === revision.current) setError(request.current?.signal.aborted ? 'Yêu cầu mất nhiều thời gian. Bạn có thể thử lại.' : userMessage(reason));
    }
  };
  return <SafeAreaView className="flex-1 bg-white"><FlowHeader title="Trợ lý chọn món" />
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 18 }}>
      <View className="gap-3 rounded-3xl bg-tealLight p-5"><View className="flex-row items-center gap-2"><Ionicons name="sparkles" size={25} color="#008B45" /><Text className="font-bold text-xl text-ink">Hôm nay ăn gì?</Text></View><Text className="text-sm text-muted" style={{ lineHeight: 22 }}>Cho mình biết món bạn thích, khẩu vị và mức giá.</Text></View>
      <AppPressable accessibilityRole="button" accessibilityLabel="Đổi địa chỉ dùng để gợi ý món" onPress={() => router.push('/select-location')} className="flex-row items-center gap-3 rounded-2xl border border-line p-4"><Ionicons name="location-outline" size={23} color="#008B45" /><Text numberOfLines={2} className="flex-1 text-sm text-ink">{address.street || 'Chọn địa chỉ giao hàng'}</Text><Ionicons name="chevron-forward" size={18} color="#727772" /></AppPressable>
      {!validCoordinates(address) && <Text className="text-sm text-coral">Vui lòng chọn điểm giao để tìm các quán trong phạm vi 20 km.</Text>}
      <View className="gap-2">{examples.map(text => <AppPressable key={text} accessibilityRole="button" disabled={mutation.isPending} onPress={() => setQuestion(text)} className="rounded-2xl border border-line px-4 py-3"><Text className="text-sm text-teal">{text}</Text></AppPressable>)}</View>
      <TextInput accessibilityLabel="Nhu cầu chọn món" placeholder="Ví dụ: Trà sữa ngọt nhẹ, dưới 40k…" value={question} onChangeText={setQuestion} maxLength={600} multiline editable={!mutation.isPending} className="min-h-24 rounded-2xl border border-line px-4 py-3 text-base text-ink" style={{ textAlignVertical: 'top' }} />
      <FlowButton title={mutation.isPending ? 'Đang tìm món phù hợp…' : 'Gợi ý cho tôi'} disabled={mutation.isPending || !question.trim() || !validCoordinates(address)} onPress={() => { void send(); }} />
      {!!error && <View className="gap-3"><Text accessibilityRole="alert" className="text-sm text-coral">{error}</Text><FlowButton title="Tìm món thông thường" onPress={() => router.push('/search')} /></View>}
      {mutation.isPending && <View className="gap-3"><Skeleton height={95} /><Skeleton height={95} /></View>}
      {!!answer && <View className="gap-4"><Text accessibilityLiveRegion="polite" className="text-sm text-ink" style={{ lineHeight: 22 }}>{answer.message}</Text>{answer.foods.map(food => <AppPressable key={food.food_id} accessibilityRole="button" accessibilityLabel={`Xem món ${food.name} tại ${food.restaurant_name}`} onPress={() => router.push({ pathname: '/food/[id]', params: { id: food.food_id } })} className="gap-3 rounded-3xl border border-line p-4">
        <View className="flex-row gap-3"><Image source={food.image_url ? { uri: food.image_url } : undefined} contentFit="cover" style={{ width: 85, height: 85, borderRadius: 17, backgroundColor: '#F1F5EF' }} /><View className="flex-1 gap-1"><Text className="font-bold text-base text-ink">{food.name}</Text><Text className="text-xs text-muted">{food.restaurant_name} · {food.distance_km.toFixed(1)} km</Text><FoodPrice food={food} /></View></View>
        {!!food.option_hint && <Text className="text-sm text-teal">Có tùy chọn: {food.option_hint}</Text>}
        {!!food.description && <Text numberOfLines={3} className="text-sm text-muted">{food.description}</Text>}
        <Text className="font-semibold text-sm text-teal">Xem món và chọn tùy chọn →</Text>
      </AppPressable>)}</View>}
      <Text className="text-xs text-muted" style={{ lineHeight: 19 }}>Giá, tùy chọn và khả năng giao hàng được kiểm tra lại khi đặt đơn.</Text>
    </ScrollView></KeyboardAvoidingView>
  </SafeAreaView>;
}
