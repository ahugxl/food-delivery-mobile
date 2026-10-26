import { useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';
import { useFavoritesStore } from '../store/favoritesStore';
import { engagementApi } from '../services/engagement';
import type { Restaurant } from '../types';
import { applyFavorite, rollbackFavorite } from '../features/favorites/optimistic';
import { messageError } from '../features/chat/messages';

export function useFavorites() {
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const pending = useFavoritesStore(state => state.pendingIds);
  const key = ['favorites', userId] as const;
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => engagementApi.favorites(userId!, signal), enabled: !!userId });
  const toggle = async (restaurant: Restaurant) => {
    if (!userId || query.isPending) return;
    if (query.isError) { void query.refetch(); Toast.show({ type: 'error', text1: 'Chưa tải được yêu thích. Vui lòng thử lại.' }); return; }
    const lock = `${userId}:${restaurant.id}`;
    if (!useFavoritesStore.getState().beginUpdate(lock)) return;
    let previous: Restaurant[] | undefined;
    try {
      await client.cancelQueries({ queryKey: key, exact: true });
      if (useAuthStore.getState().user?.id !== userId) return;
      previous = client.getQueryData<Restaurant[]>(key) ?? [];
      const saved = !previous.some(row => row.id === restaurant.id);
      client.setQueryData<Restaurant[]>(key, current => applyFavorite(current ?? [], restaurant, saved));
      await engagementApi.setFavorite(userId, restaurant.id, saved);
    } catch (error) {
      if (useAuthStore.getState().user?.id !== userId) return;
      if (previous) client.setQueryData<Restaurant[]>(key, current => rollbackFavorite(current ?? [], restaurant.id, previous!));
      Toast.show({ type: 'error', text1: 'Không lưu được yêu thích', text2: messageError(error) });
    } finally {
      useFavoritesStore.getState().endUpdate(lock);
      if (useAuthStore.getState().user?.id === userId && !useFavoritesStore.getState().pendingIds.some(id => id.startsWith(`${userId}:`))) void client.invalidateQueries({ queryKey: key, exact: true });
    }
  };
  return { ...query, favorites: query.data ?? [], toggle,
    isUpdating: (restaurantId: string) => pending.includes(`${userId}:${restaurantId}`),
  };
}
