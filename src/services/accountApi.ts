import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseDatabase } from '../types/supabase';
import type { DeliveryAddress } from '../features/order/checkout';
import { addressInput, profileInput } from '../features/account/validation';
export function createAccountApi(client: SupabaseClient<SupabaseDatabase> | null) {
    const db = () => { if (!client)
        throw new Error('Chưa cấu hình kết nối Supabase.'); return client; };
    return {
        async profile(userId: string, signal?: AbortSignal) {
            const query = db().from('profiles').select('id,full_name,phone,avatar_url,loyalty_points').eq('id', userId);
            const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
            if (error)
                throw error;
            return data;
        },
        async saveProfile(name: string, phone: string, avatar: string | null) {
            const { data, error } = await db().rpc('update_my_profile', profileInput(name, phone, avatar)).single();
            if (error)
                throw error;
            if (!data)
                throw new Error('Máy chủ chưa xác nhận cập nhật hồ sơ.');
            return data;
        },
        async addresses(userId: string, signal?: AbortSignal) {
            const query = db().from('user_addresses').select('*').eq('user_id', userId).order('is_default', { ascending: false }).order('title').order('id');
            const { data, error } = await (signal ? query.abortSignal(signal) : query);
            if (error)
                throw error;
            return data ?? [];
        },
        async saveAddress(id: string, address: DeliveryAddress, isDefault: boolean, create: boolean) {
            const { data, error } = await db().rpc('save_my_address', addressInput(id, address, isDefault, create)).single();
            if (error)
                throw error;
            if (!data)
                throw new Error('Máy chủ chưa xác nhận lưu địa chỉ.');
            return data;
        },
        async removeAddress(id: string) {
            const { error } = await db().rpc('delete_my_address', { p_id: id });
            if (error)
                throw error;
        },
        async uploadAvatar(path: string, bytes: ArrayBuffer, mime: string) {
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime) || !bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024)
                throw new Error('Chọn ảnh JPEG/PNG/WebP không quá 5 MB.');
            const { error } = await db().storage.from('profile-avatars').upload(path, bytes, { contentType: mime, upsert: false });
            if (error)
                throw error;
            return path;
        },
        async avatarUrl(path: string) {
            if (/^https:\/\//i.test(path))
                return path; // Existing externally hosted avatars remain readable.
            const { data, error } = await db().storage.from('profile-avatars').createSignedUrl(path, 3600);
            if (error)
                throw error;
            return data.signedUrl;
        },
        async removeAvatar(path: string) {
            if (/^https?:\/\//i.test(path))
                return;
            const { error } = await db().storage.from('profile-avatars').remove([path]);
            if (error)
                throw error;
        },
    };
}
