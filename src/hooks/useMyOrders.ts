import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseApi } from '../services/purchase';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../services/supabase';

export function useMyOrders() {
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['orders', userId], queryFn: ({ signal }) => purchaseApi.orders(userId!, signal), enabled: !!userId });
  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    const refresh = () => { if (active) { void client.invalidateQueries({ queryKey: ['orders', userId] }); void client.invalidateQueries({ queryKey: ['order', userId] }); } };
    const channel = supabase.channel(`orders-list:${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` }, refresh)
      .subscribe(status => { if (status === 'SUBSCRIBED') refresh(); });
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; listener.remove(); void supabase?.removeChannel(channel); };
  }, [userId, client]);
  return query;
}
