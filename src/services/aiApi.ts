import { z } from 'zod';
import { validCoordinates, type Coordinates } from '../features/location/coordinates';

export const aiFoodSchema = z.object({
  food_id: z.string().uuid(), restaurant_id: z.string().uuid(), name: z.string().max(500),
  description: z.string().nullable(), price: z.number().finite().nonnegative(), original_price: z.number().finite().nonnegative().nullable(),
  image_url: z.string().nullable(), restaurant_name: z.string(), distance_km: z.number().finite().min(0).max(20), option_hint: z.string().nullable(),
});
export const recommendationSchema = z.object({ message: z.string().max(2000), foods: z.array(aiFoodSchema).max(5) });
export type AiRecommendation = z.infer<typeof recommendationSchema>;
const chatHistorySchema = z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) })).max(12);
export type AiChatTurn = z.infer<typeof chatHistorySchema>[number];

export function conversationHistory(entries: (AiChatTurn & { foods?: AiRecommendation['foods'] })[]): AiChatTurn[] {
  return entries.slice(-12).map(entry => ({
    role: entry.role,
    content: entry.foods?.length
      ? `${entry.content.slice(0, 900)}\nCác thẻ món đã hiển thị:\n${entry.foods.map((food, index) => `${index + 1}. ${food.name.slice(0, 90)} — ${food.restaurant_name.slice(0, 70)} — ${food.price} VND`).join('\n')}`.slice(0, 2000)
      : entry.content,
  }));
}
type Session = { accessToken: string; userId: string } | null;

export async function readAiStream(response: Response, onText: (text: string) => void): Promise<AiRecommendation> {
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw Error('Máy chủ chưa hỗ trợ chat trực tiếp. Vui lòng cập nhật backend AI.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      if (buffer.length > 100000) throw Error('Phản hồi trợ lý quá dài. Vui lòng thử lại.');
      let separator;
      while ((separator = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        let event = 'message'; const data: string[] = [];
        for (const line of frame.split(/\r?\n/)) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
        }
        if (!data.length) continue;
        const body: unknown = JSON.parse(data.join('\n'));
        if (event === 'delta') {
          const chunk = z.object({ text: z.string().max(2000) }).parse(body);
          text += chunk.text;
          if (text.length > 2000) throw Error('Phản hồi trợ lý quá dài. Vui lòng thử lại.');
          onText(text);
        } else if (event === 'result') {
          return recommendationSchema.parse(body);
        } else if (event === 'error') {
          const error = z.object({ message: z.string().max(500) }).safeParse(body);
          throw Error(error.success ? error.data.message : 'Trợ lý bị gián đoạn. Vui lòng thử lại.');
        }
      }
      if (done) throw Error('Kết nối bị gián đoạn trước khi nhận đủ câu trả lời. Vui lòng thử lại.');
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function createAiApi(baseUrl: string | undefined, session: () => Promise<Session>, fetcher: typeof fetch = fetch) {
  return {
    async recommend(message: string, coordinates: Coordinates, userId: string, signal?: AbortSignal, history: AiChatTurn[] = [], onText?: (text: string) => void): Promise<AiRecommendation> {
      if (!message.trim() || message.trim().length > 600) throw Error('Vui lòng nhập nhu cầu chọn món, tối đa 600 ký tự.');
      const previous = chatHistorySchema.safeParse(history);
      if (!previous.success) throw Error('Lịch sử trò chuyện không hợp lệ. Vui lòng bắt đầu cuộc trò chuyện mới.');
      if (!validCoordinates(coordinates)) throw Error('Vui lòng chọn địa chỉ giao hàng trước khi hỏi trợ lý.');
      if (!baseUrl || !/^https?:\/\/[^\s]+$/i.test(baseUrl)) throw Error('Trợ lý chưa sẵn sàng. Bạn có thể dùng tìm kiếm món trong lúc chờ.');
      const current = await session();
      if (!current || current.userId !== userId) throw Error('Phiên đăng nhập đã thay đổi. Vui lòng mở lại trợ lý.');
      const abort = new AbortController();
      const cancel = () => abort.abort();
      if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(cancel, onText ? 75000 : 55000);
      try {
        const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/ai/${onText ? 'chat/stream' : 'recommendations'}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.accessToken}`, ...(onText ? { Accept: 'text/event-stream' } : {}) },
          body: JSON.stringify({ message: message.trim(), latitude: coordinates.latitude, longitude: coordinates.longitude, ...(previous.data.length ? { history: previous.data } : {}) }), signal: abort.signal,
        });
        if (response.ok && onText) return await readAiStream(response, onText);
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const detail = z.object({ message: z.string().max(500) }).safeParse(body);
          throw Error(detail.success ? detail.data.message : 'Trợ lý đang bận hoặc chưa sẵn sàng. Vui lòng thử lại sau.');
        }
        const result = recommendationSchema.safeParse(body);
        if (!result.success) throw Error('Chưa xác minh được danh sách món gợi ý. Vui lòng thử lại.');
        return result.data;
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
    },
  };
}
