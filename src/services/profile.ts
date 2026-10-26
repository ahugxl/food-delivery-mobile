import { supabase } from './supabase';

export async function fetchProfile(userId: string, signal?: AbortSignal) {
  if (!supabase) throw new Error('Chưa cấu hình kết nối Supabase.');
  let query = supabase.from('profiles')
    .select('id, full_name, avatar_url, phone, loyalty_points')
    .eq('id', userId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}
