import { supabase } from './supabase';
import { createRestaurantReviewsApi } from './restaurantReviewsApi';
export const restaurantReviewsApi = createRestaurantReviewsApi(supabase);
