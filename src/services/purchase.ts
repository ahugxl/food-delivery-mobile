import { supabase } from './supabase';
import { createPurchaseApi } from './purchaseApi';
export const purchaseApi = createPurchaseApi(supabase);
