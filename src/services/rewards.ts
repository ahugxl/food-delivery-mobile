import { supabase } from './supabase';
import { createRewardsApi } from './rewardsApi';
export const rewardsApi = createRewardsApi(supabase);
