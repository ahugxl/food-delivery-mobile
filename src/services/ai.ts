import { supabase } from './supabase';
import { createAiApi } from './aiApi';

export const aiApi = createAiApi(process.env.EXPO_PUBLIC_AI_API_URL, async () => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ? { userId: data.session.user.id, accessToken: data.session.access_token } : null;
});
