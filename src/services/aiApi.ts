import { z } from 'zod';
import { validCoordinates, type Coordinates } from '../features/location/coordinates';

export const aiFoodSchema = z.object({
  food_id: z.string().uuid(), restaurant_id: z.string().uuid(), name: z.string().max(500),
  description: z.string().nullable(), price: z.number().finite().nonnegative(), original_price: z.number().finite().nonnegative().nullable(),
  image_url: z.string().nullable(), restaurant_name: z.string(), distance_km: z.number().finite().min(0).max(20), option_hint: z.string().nullable(),
});
export const recommendationSchema = z.object({ message: z.string().max(2000), foods: z.array(aiFoodSchema).max(5) });
export type AiRecommendation = z.infer<typeof recommendationSchema>;
type Session = { accessToken: string; userId: string } | null;

export function createAiApi(baseUrl: string | undefined, session: () => Promise<Session>, fetcher: typeof fetch = fetch) {
  return {
    async recommend(message: string, coordinates: Coordinates, userId: string, signal?: AbortSignal): Promise<AiRecommendation> {
      if (!message.trim() || message.trim().length > 600) throw Error('Vui lòng nhập nhu cầu chọn món, tối đa 600 ký tự.');
      if (!validCoordinates(coordinates)) throw Error('Vui lòng chọn địa chỉ giao hàng trước khi hỏi trợ lý.');
      if (!baseUrl || !/^https?:\/\/[^\s]+$/i.test(baseUrl)) throw Error('Trợ lý chưa sẵn sàng. Bạn có thể dùng tìm kiếm món trong lúc chờ.');
      const current = await session();
      if (!current || current.userId !== userId) throw Error('Phiên đăng nhập đã thay đổi. Vui lòng mở lại trợ lý.');
      const abort = new AbortController();
      const cancel = () => abort.abort();
      if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(cancel, 55000);
      try {
        const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/ai/recommendations`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${current.accessToken}` },
          body: JSON.stringify({ message: message.trim(), latitude: coordinates.latitude, longitude: coordinates.longitude }), signal: abort.signal,
        });
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
