import { supabase } from './supabase';
import { createVoucherApi } from './voucherApi';
export const voucherApi = createVoucherApi(supabase);
