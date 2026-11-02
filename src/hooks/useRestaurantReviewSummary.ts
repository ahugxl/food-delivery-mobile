import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { restaurantReviewsApi } from '../services/restaurantReviews';
import { isUuid } from '../services/catalogApi';
import { useAuthStore } from '../store/authStore';

// Counts and histogram follow the same eligible reviews as restaurants.rating.
export function useRestaurantReviewSummary(restaurantId: string, enabled = true) {
  const userId = useAuthStore(state => state.user?.id);
  const canFetch = enabled && isUuid(restaurantId) && !!userId;
  const query = useQuery({
    queryKey: ['restaurant-reviews', restaurantId, userId || '', 'summary'],
    queryFn: ({ signal }) => restaurantReviewsApi.summary(restaurantId, signal),
    enabled: canFetch,
  });
  const { refetch } = query;
  useFocusEffect(useCallback(() => {
    if (canFetch) void refetch();
  }, [canFetch, refetch]));
  return query;
}
