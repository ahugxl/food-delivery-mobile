import { supabase } from './supabase';
import { createDriverApi } from './driverApi';
export const driverApi = createDriverApi(supabase);
