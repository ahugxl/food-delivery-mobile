import { createChatApi } from './chatApi';
import { supabase } from './supabase';
export const chatApi = createChatApi(supabase);
