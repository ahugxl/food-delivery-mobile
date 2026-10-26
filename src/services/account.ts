import { supabase } from './supabase';
import { createAccountApi } from './accountApi';
export const accountApi = createAccountApi(supabase);
