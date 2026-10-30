import { z } from 'zod';
import { userMessage } from '../../utils/userMessage';
import type { Database } from '../../types/database.types';
export type Message = Database['public']['Tables']['messages']['Row'];
const messageSchema = z.object({ id: z.string(), order_id: z.string(), sender_id: z.string(), sender_type: z.enum(['user', 'driver']), message_type: z.enum(['text', 'image']).nullable(), content: z.string().nullable(), image_url: z.string().nullable(), created_at: z.string().nullable() });
const messageTime = (value: string | null) => value ? Date.parse(value) || 0 : 0;
export function messageTimeLabel(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Chưa có thời gian';
  return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
export function parseMessage(value: unknown): Message | null { const result = messageSchema.safeParse(value); return result.success ? result.data : null; }
export function mergeMessages(...lists: Message[][]): Message[] {
  return [...new Map(lists.flat().map(message => [message.id, message])).values()]
    .sort((a, b) => messageTime(a.created_at) - messageTime(b.created_at) || a.id.localeCompare(b.id));
}
export function messageError(error: unknown) {
  return userMessage(error);
}
