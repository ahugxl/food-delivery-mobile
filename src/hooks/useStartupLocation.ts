import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { accountApi } from '../services/account';
import { currentCoordinates, getAddressFromCoords } from '../services/location';
import { resolveStartupDelivery } from '../features/location/startupLocation';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';
import { useCartStore } from '../store/cartStore';
import { useLocationStore } from '../store/locationStore';
import { userMessage } from '../utils/userMessage';
import { AppState } from 'react-native';

export function StartupLocationSync() {
  const userId = useAuthStore(state => state.user?.id);
  const attempt = useLocationStore(state => state.attempt);
  const client = useQueryClient();
  useEffect(() => {
    useLocationStore.setState({ reminderDismissed: false });
    let previous = AppState.currentState;
    const listener = AppState.addEventListener('change', next => {
      if (previous !== 'active' && next === 'active' && userId && useLocationStore.getState().status === 'error') useLocationStore.getState().retry();
      previous = next;
    });
    return () => listener.remove();
  }, [userId]);
  useEffect(() => {
    useLocationStore.setState({ status: 'idle', detected: null, coordinates: null, error: '' });
    if (!userId) return;
    // Preserve a pending checkout's address for an idempotent retry.
    if (useCartStore.getState().checkoutRequest || useCartStore.getState().isCheckingOut) return;
    let active = true;
    const version = useOrderStore.getState().deliverySelectionVersion;
    const controller = new AbortController();
    useLocationStore.setState({ status: 'locating' });
    const unsubscribe = useOrderStore.subscribe(state => {
      if (state.deliverySelectionVersion !== version && useLocationStore.getState().status === 'locating') {
        active = false;
        controller.abort();
        useLocationStore.setState({ status: 'idle', error: '' });
      }
    });
    void resolveStartupDelivery({
      coordinates: currentCoordinates,
      address: point => getAddressFromCoords(point.latitude, point.longitude),
      profile: () => client.fetchQuery({ queryKey: ['profile', userId], queryFn: () => accountApi.profile(userId, controller.signal), staleTime: 0 }),
      onCoordinates: coordinates => { if (active && useAuthStore.getState().user?.id === userId) useLocationStore.setState({ coordinates }); },
    }).then(address => {
      if (!active || useAuthStore.getState().user?.id !== userId) return;
      useLocationStore.setState({ status: 'ready', detected: address, error: '' });
      if (useOrderStore.getState().deliverySelectionVersion === version && !useCartStore.getState().isCheckingOut && !useCartStore.getState().checkoutRequest) {
        useOrderStore.getState().setDeliveryAddress(address);
      }
    }).catch(error => {
      if (active && useAuthStore.getState().user?.id === userId)
        useLocationStore.setState({ status: 'error', error: userMessage(error) });
    }).finally(() => controller.abort());
    return () => { active = false; controller.abort(); unsubscribe(); };
  }, [userId, attempt, client]);
  return null;
}
