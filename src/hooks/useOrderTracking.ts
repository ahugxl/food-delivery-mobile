import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseApi } from '../services/purchase';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import { interpolateTrip, validCoordinates } from '../features/location/coordinates';

export function useOrderTracking(orderId: string) {
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const [connection, setConnection] = useState('connecting');
  const [progress, setProgress] = useState(0);
  const query = useQuery({ queryKey: ['order', userId, orderId], queryFn: ({ signal }) => purchaseApi.order(orderId, userId!, signal), enabled: !!userId && !!orderId,
    refetchInterval: connection === 'connected' ? false : 10000,
  });
  useEffect(() => {
    setConnection('connecting');
    if (!supabase || !orderId || !userId) return;
    let active = true;
    const refresh = () => { void client.invalidateQueries({ queryKey: ['order', userId, orderId] }); void client.invalidateQueries({ queryKey: ['orders', userId] }); };
    const channel = supabase.channel(`tracking:${userId}:${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => { if (active) refresh(); })
      .subscribe(status => { if (active) { setConnection(status === 'SUBSCRIBED' ? 'connected' : 'reconnecting'); if (status === 'SUBSCRIBED') refresh(); } });
    const appState = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { active = false; appState.remove(); void supabase?.removeChannel(channel); };
  }, [orderId, userId, client]);
  const restaurant = query.data?.restaurants;
  const destination = validCoordinates(query.data) ? { latitude: query.data.latitude, longitude: query.data.longitude } : null;
  const origin = validCoordinates(restaurant) ? { latitude: restaurant.latitude, longitude: restaurant.longitude } : null;
  useEffect(() => {
    setProgress(query.data?.status === 'completed' ? 1 : 0);
    if (query.data?.status !== 'delivering' || !origin || !destination) return;
    const start = Date.now();
    const timer = setInterval(() => { const value = Math.min(1, (Date.now() - start) / 40000); setProgress(value); if (value === 1) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [orderId, query.data?.status, origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude]);
  return { ...query, connection, origin, destination, progress,
    driverLocation: origin && destination ? interpolateTrip(origin, destination, progress) : null,
  };
}
