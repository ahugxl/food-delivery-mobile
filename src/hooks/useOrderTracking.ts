import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseApi } from '../services/purchase';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import { validCoordinates } from '../features/location/coordinates';
import { driverApi } from '../services/drivers';
import { canTrackDriver, driverFixState } from '../features/location/driverLocation';
import { deliveryProgressView } from '../features/order/deliveryProgress';

export function useOrderTracking(orderId: string) {
  const userId = useAuthStore(state => state.user?.id);
  const client = useQueryClient();
  const [connection, setConnection] = useState('connecting');
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [, tick] = useState(0);
  const query = useQuery({ queryKey: ['order', userId, orderId], queryFn: ({ signal }) => purchaseApi.order(orderId, userId!, signal), enabled: !!userId && !!orderId,
    refetchInterval: connection === 'connected' ? false : 10000,
  });
  useEffect(() => {
    setConnection('connecting');
    if (!supabase || !orderId || !userId) return;
    let active = true;
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['order', userId, orderId] });
      void client.invalidateQueries({ queryKey: ['orders', userId] });
      void client.invalidateQueries({ queryKey: ['driver-location', userId, orderId] });
      void client.invalidateQueries({ queryKey: ['delivery-progress', userId, orderId] });
    };
    const channel = supabase.channel(`tracking:${userId}:${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => { if (active) refresh(); })
      .subscribe(status => { if (active) { setConnection(status === 'SUBSCRIBED' ? 'connected' : 'reconnecting'); if (status === 'SUBSCRIBED') refresh(); } });
    const appState = AppState.addEventListener('change', state => { setForeground(state === 'active'); if (state === 'active') refresh(); });
    return () => { active = false; appState.remove(); void supabase?.removeChannel(channel); };
  }, [orderId, userId, client]);
  const restaurant = query.data?.restaurants;
  const destination = validCoordinates(query.data) ? { latitude: query.data.latitude, longitude: query.data.longitude } : null;
  const origin = validCoordinates(restaurant) ? { latitude: restaurant.latitude, longitude: restaurant.longitude } : null;
  const progressQuery = useQuery({
    queryKey: ['delivery-progress', userId, orderId],
    queryFn: ({ signal }) => driverApi.progressForOrder(orderId, signal),
    enabled: !!userId && !!orderId && !!query.data && foreground,
    refetchInterval: foreground && !!query.data && !['completed','cancelled'].includes(query.data.status ?? '') ? 5000 : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
  useEffect(() => {
    const snapshot = progressQuery.data;
    if (!snapshot || !query.data || progressQuery.isError || progressQuery.dataUpdatedAt <= query.dataUpdatedAt) return;
    // Includes terminal transitions if an orders WebSocket event was missed.
    if (snapshot.order_status !== query.data.status || snapshot.driver_id !== query.data.driver_id) {
      void client.invalidateQueries({ queryKey: ['order', userId, orderId] });
      void client.invalidateQueries({ queryKey: ['orders', userId] });
    }
  }, [progressQuery.data, progressQuery.isError, progressQuery.dataUpdatedAt, query.data, query.dataUpdatedAt, userId, orderId, client]);
  const tracking = !!userId && !!orderId && canTrackDriver(query.data?.status, query.data?.driver_id);
  const locationQuery = useQuery({
    // A driver/status change cannot display a previous assignment's cached marker.
    queryKey: ['driver-location', userId, orderId, query.data?.driver_id, query.data?.status],
    queryFn: ({ signal }) => driverApi.locationForOrder(orderId, signal),
    enabled: tracking && foreground,
    refetchInterval: tracking && foreground ? 5000 : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });
  useEffect(() => {
    if (!tracking || !foreground) return;
    const timer = setInterval(() => tick(value => value + 1), 5000);
    return () => clearInterval(timer);
  }, [tracking, foreground]);
  const locationState = driverFixState({ status: query.data?.status, driverId: query.data?.driver_id,
    fix: locationQuery.data, loading: locationQuery.isPending, error: locationQuery.isError });
  const deliveryProgress = query.data ? deliveryProgressView(query.data, progressQuery.isError ? null : progressQuery.data) : null;
  return { ...query, connection, origin, destination, locationState, lastDriverFix: locationQuery.data,
    deliveryProgress, progressError: progressQuery.isError,
    driverLocation: locationState === 'live' && locationQuery.data ? { latitude: locationQuery.data.latitude, longitude: locationQuery.data.longitude } : null,
  };
}
