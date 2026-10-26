import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseDatabase } from '../types/supabase';
import type { Database } from '../types/database.types';

export function createChatApi(client: SupabaseClient<SupabaseDatabase> | null) {
  const db = () => { if (!client) throw new Error('Supabase chưa được cấu hình.'); return client; };
  return {
    async history(orderId: string, signal?: AbortSignal) {
      const query = db().from('messages').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(200);
      const { data, error } = await (signal ? query.abortSignal(signal) : query);
      if (error) throw error;
      return (data ?? []).reverse();
    },
    async send(input: { id: string; orderId: string; senderId: string; content: string; imagePath?: string | null }) {
      const text = input.content.trim();
      if ((!text && !input.imagePath) || text.length > 2000) throw new Error('Tin nhắn phải có nội dung hoặc ảnh, tối đa 2.000 ký tự.');
      if (input.imagePath && !input.imagePath.startsWith(`${input.orderId}/${input.senderId}/`)) throw new Error('Ảnh không thuộc cuộc trò chuyện này.');
      const record: Database['public']['Tables']['messages']['Insert'] = {
        id: input.id, order_id: input.orderId, sender_id: input.senderId, sender_type: 'user',
        message_type: input.imagePath ? 'image' : 'text', content: text || null, image_url: input.imagePath ?? null,
      };
      const { data, error } = await db().from('messages').insert(record).select('*').single();
      if (error?.code === '23505') {
        const existing = await db().from('messages').select('*').eq('id', input.id).eq('order_id', input.orderId).eq('sender_id', input.senderId).single();
        if (existing.error) throw existing.error;
        return existing.data;
      }
      if (error) throw error;
      return data;
    },
    async upload(path: string, bytes: ArrayBuffer, mimeType: string) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || bytes.byteLength > 5 * 1024 * 1024 || bytes.byteLength === 0) throw new Error('Ảnh phải là JPEG/PNG/WebP và không quá 5 MB.');
      const { error } = await db().storage.from('order-chat').upload(path, bytes, { contentType: mimeType, upsert: false });
      if (error) throw error;
      return path;
    },
    async imageUrl(path: string) {
      if (/^https:\/\//i.test(path)) return path;
      const { data, error } = await db().storage.from('order-chat').createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    async removeUpload(path: string) {
      const { error } = await db().storage.from('order-chat').remove([path]);
      if (error) throw error;
    },
  };
}
