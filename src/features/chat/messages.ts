import { z } from 'zod';
import type { Database } from '../../types/database.types';
export type Message = Database['public']['Tables']['messages']['Row'];
const messageSchema = z.object({ id: z.string(), order_id: z.string(), sender_id: z.string(), sender_type: z.enum(['user', 'driver']), message_type: z.enum(['text', 'image']), content: z.string().nullable(), image_url: z.string().nullable(), created_at: z.string() });
export function parseMessage(value: unknown): Message | null { const result = messageSchema.safeParse(value); return result.success ? result.data : null; }
export function mergeMessages(...lists: Message[][]): Message[] {
  return [...new Map(lists.flat().map(message => [message.id, message])).values()]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id));
}
export function messageError(error: unknown) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message : 'Không thể kết nối. Vui lòng thử lại.';
}
